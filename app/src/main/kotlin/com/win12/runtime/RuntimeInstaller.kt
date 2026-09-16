package com.win12.runtime

import com.win12.logging.Win12Logger
import com.win12.storage.StorageManager
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream

/**
 * Downloads and installs the Windows compatibility runtime (Wine + Box64 +
 * optional Box86) into [StorageManager.runtimeDir].
 *
 * There is no bundled/embedded runtime: WIN12 does not ship Wine or Box64
 * binaries, and does not fabricate their presence (Phase 49 - NO FAKE
 * FUNCTIONALITY). A real bundle URL must be configured by the operator
 * (see [RuntimeInstallSource]) before this can install anything; without
 * one, [install] fails immediately with a clear, non-fake error rather than
 * pretending to succeed.
 *
 * The bundle is expected to be a ZIP archive containing, at minimum:
 *   wine/bin/wine   (or wine/bin/wine64)
 *   box64/box64
 * and optionally:
 *   box86/box86
 *
 * Download and extraction run on the calling thread — callers are expected
 * to invoke [install] from a background thread/coroutine, never the main
 * thread.
 */
class RuntimeInstaller(
    private val storageManager: StorageManager,
    private val validator: RuntimeValidator,
    private val logger: Win12Logger
) {

    data class InstallProgress(
        val step: String, // Preparing, Downloading, Verifying, Extracting, SettingPermissions, Validating, Installed, Failed
        val progressPercent: Int,
        val message: String,
        val error: String? = null
    ) {
        fun toJson(): JSONObject = JSONObject().apply {
            put("step", step)
            put("progressPercent", progressPercent)
            put("message", message)
            put("error", error ?: JSONObject.NULL)
        }
    }

    @Volatile
    private var cancelled = false

    fun cancel() {
        cancelled = true
    }

    /**
     * @param bundleUrl HTTPS URL of the runtime bundle ZIP. Required — there
     *   is no default/hardcoded source, since Anthropic/this codebase does
     *   not bundle or endorse a specific Wine/Box64 distribution.
     * @param expectedSha256 optional checksum; when provided the download is
     *   rejected if it doesn't match, rather than being installed unverified.
     */
    fun install(
        bundleUrl: String,
        expectedSha256: String? = null,
        onProgress: (InstallProgress) -> Unit
    ): RuntimeValidationResult {
        cancelled = false

        if (bundleUrl.isBlank()) {
            val msg = "No runtime bundle URL configured. WIN12 does not embed Wine/Box64 " +
                    "binaries; provide a bundle URL in Settings > Compatibility Runtime before installing."
            logger.logSystem("RuntimeInstaller", msg)
            onProgress(InstallProgress("Failed", 0, msg, error = "NO_BUNDLE_URL"))
            return validator.validate()
        }
        if (!bundleUrl.startsWith("https://") && !bundleUrl.startsWith("http://")) {
            val msg = "Runtime bundle URL must be a valid http(s) URL."
            onProgress(InstallProgress("Failed", 0, msg, error = "INVALID_URL"))
            return validator.validate()
        }

        val tempZip = File(storageManager.runtimeDir, "_download.tmp")
        var connection: HttpURLConnection? = null

        try {
            onProgress(InstallProgress("Preparing", 2, "Preparing runtime installation..."))
            if (tempZip.exists()) tempZip.delete()

            onProgress(InstallProgress("Downloading", 5, "Connecting to runtime source..."))
            val url = URL(bundleUrl)
            connection = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 30_000
                requestMethod = "GET"
                instanceFollowRedirects = true
            }
            connection.connect()

            if (connection.responseCode !in 200..299) {
                val msg = "Runtime source returned HTTP ${connection.responseCode}."
                logger.logSystem("RuntimeInstaller", msg)
                onProgress(InstallProgress("Failed", 5, msg, error = "HTTP_${connection.responseCode}"))
                return validator.validate()
            }

            val totalBytes = connection.contentLengthLong
            val digest = MessageDigest.getInstance("SHA-256")

            BufferedInputStream(connection.inputStream).use { input ->
                FileOutputStream(tempZip).use { output ->
                    val buffer = ByteArray(64 * 1024)
                    var readTotal = 0L
                    var lastReportedPercent = -1
                    while (true) {
                        if (cancelled) {
                            onProgress(InstallProgress("Failed", 0, "Installation cancelled.", error = "CANCELLED"))
                            tempZip.delete()
                            return validator.validate()
                        }
                        val read = input.read(buffer)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                        digest.update(buffer, 0, read)
                        readTotal += read

                        if (totalBytes > 0) {
                            // Download spans 5%-60% of overall progress.
                            val pct = 5 + ((readTotal * 55) / totalBytes).toInt().coerceIn(0, 55)
                            if (pct != lastReportedPercent) {
                                lastReportedPercent = pct
                                onProgress(
                                    InstallProgress(
                                        "Downloading", pct,
                                        "Downloading runtime (${readTotal / 1024 / 1024}MB" +
                                                "${if (totalBytes > 0) " / ${totalBytes / 1024 / 1024}MB" else ""})..."
                                    )
                                )
                            }
                        }
                    }
                }
            }

            onProgress(InstallProgress("Verifying", 62, "Verifying download integrity..."))
            val actualSha256 = digest.digest().joinToString("") { "%02x".format(it) }
            if (expectedSha256 != null && !expectedSha256.equals(actualSha256, ignoreCase = true)) {
                val msg = "Checksum mismatch: expected $expectedSha256 but downloaded $actualSha256. " +
                        "Refusing to install a corrupted/tampered bundle."
                logger.logSystem("RuntimeInstaller", msg)
                tempZip.delete()
                onProgress(InstallProgress("Failed", 62, msg, error = "CHECKSUM_MISMATCH"))
                return validator.validate()
            }
            logger.logSystem("RuntimeInstaller", "Downloaded bundle SHA-256: $actualSha256")

            onProgress(InstallProgress("Extracting", 65, "Extracting runtime files..."))
            extractZip(tempZip, storageManager.runtimeDir) { entryName, pct ->
                onProgress(InstallProgress("Extracting", 65 + (pct * 20 / 100), "Extracting: $entryName"))
            }

            onProgress(InstallProgress("SettingPermissions", 88, "Setting executable permissions..."))
            markRuntimeBinariesExecutable()

            onProgress(InstallProgress("Validating", 95, "Validating installed runtime..."))
            val result = validator.validate()

            tempZip.delete()

            if (result.isValid) {
                onProgress(InstallProgress("Installed", 100, "Windows compatibility runtime installed successfully."))
            } else {
                val reason = result.errors.firstOrNull()
                    ?: "Bundle extracted but expected binaries were not found at the expected paths."
                onProgress(InstallProgress("Failed", 95, reason, error = "POST_INSTALL_VALIDATION_FAILED"))
            }
            return result

        } catch (e: Exception) {
            logger.logSystem("RuntimeInstaller", "Install failed: ${e.message}")
            tempZip.delete()
            onProgress(InstallProgress("Failed", 0, "Installation failed: ${e.message}", error = "EXCEPTION"))
            return validator.validate()
        } finally {
            connection?.disconnect()
        }
    }

    private fun extractZip(zipFile: File, destDir: File, onEntry: (String, Int) -> Unit) {
        val estimatedEntries = countZipEntries(zipFile).coerceAtLeast(1)
        var processed = 0

        ZipInputStream(BufferedInputStream(zipFile.inputStream())).use { zis ->
            var entry: ZipEntry? = zis.nextEntry
            while (entry != null) {
                val outFile = File(destDir, entry.name)

                // Prevent Zip Slip / path traversal (Phase 42 security requirement).
                if (!storageManager.isPathSafe(destDir, outFile)) {
                    logger.logSystem("RuntimeInstaller", "Refused unsafe zip entry path: ${entry.name}")
                    zis.closeEntry()
                    entry = zis.nextEntry
                    continue
                }

                if (entry.isDirectory) {
                    outFile.mkdirs()
                } else {
                    outFile.parentFile?.mkdirs()
                    FileOutputStream(outFile).use { fos ->
                        val buffer = ByteArray(64 * 1024)
                        var len: Int
                        while (zis.read(buffer).also { len = it } != -1) {
                            fos.write(buffer, 0, len)
                        }
                    }
                }

                processed++
                onEntry(entry.name, (processed * 100 / estimatedEntries).coerceIn(0, 100))
                zis.closeEntry()
                entry = zis.nextEntry
            }
        }
    }

    private fun countZipEntries(zipFile: File): Int {
        return try {
            var count = 0
            ZipInputStream(BufferedInputStream(zipFile.inputStream())).use { zis ->
                while (zis.nextEntry != null) count++
            }
            count
        } catch (e: Exception) {
            1
        }
    }

    private fun markRuntimeBinariesExecutable() {
        val candidates = listOf(
            File(storageManager.runtimeDir, "wine/bin/wine"),
            File(storageManager.runtimeDir, "wine/bin/wine64"),
            File(storageManager.runtimeDir, "wine/wine"),
            File(storageManager.runtimeDir, "box64/box64"),
            File(storageManager.runtimeDir, "box64/bin/box64"),
            File(storageManager.runtimeDir, "box86/box86"),
            File(storageManager.runtimeDir, "box86/bin/box86")
        )
        candidates.forEach { f ->
            if (f.exists() && f.isFile && !f.canExecute()) {
                f.setExecutable(true, false)
            }
        }
    }

    /**
     * Removes an installed runtime entirely, returning the desktop to
     * NOT_INSTALLED state (used by Settings > Compatibility Runtime >
     * Reinstall, and by QA Phase 50's storage/delete/recalculate flow).
     */
    fun uninstall(): Boolean {
        val dir = storageManager.runtimeDir
        if (!dir.exists()) return true
        val ok = dir.listFiles()?.all { it.deleteRecursively() } ?: true
        logger.logSystem("RuntimeInstaller", "Runtime uninstalled: $ok")
        return ok
    }
}
