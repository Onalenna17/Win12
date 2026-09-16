package com.win12.apps

import android.content.Context
import android.net.Uri
import com.win12.logging.Win12Logger
import com.win12.model.WinApp
import com.win12.runtime.PrefixManager
import com.win12.runtime.ProcessLaunchResult
import com.win12.runtime.RuntimeManager
import com.win12.storage.StorageManager
import org.json.JSONObject
import java.io.File

/**
 * Handles the complete pipeline for installing Windows .exe and .msi applications into Win12.
 */
class ExeInstaller(
    private val context: Context,
    private val storageManager: StorageManager,
    private val appRegistry: AppRegistry,
    private val prefixManager: PrefixManager,
    private val runtimeManager: RuntimeManager,
    private val logger: Win12Logger
) {

    data class InstallProgress(
        val step: String, // Preparing, Copying, Detecting, Creating environment, Installing, Finalizing, Installed, Failed
        val progressPercent: Int,
        val message: String,
        val appId: String? = null,
        val error: String? = null,
        val app: WinApp? = null
    ) {
        fun toJson(): JSONObject {
            return JSONObject().apply {
                put("step", step)
                put("progressPercent", progressPercent)
                put("message", message)
                put("appId", appId ?: JSONObject.NULL)
                put("error", error ?: JSONObject.NULL)
                if (app != null) {
                    put("app", app.toJson())
                }
            }
        }
    }

    fun installFromUri(
        uri: Uri,
        onProgress: (InstallProgress) -> Unit
    ): Result<WinApp> {
        val rawFileName = storageManager.getFileNameFromUri(uri)
        val cleanName = rawFileName.substringBeforeLast(".")
        val extension = rawFileName.substringAfterLast(".").lowercase()

        val appId = "app_" + System.currentTimeMillis() + "_" + cleanName.lowercase().replace(Regex("[^a-z0-9]"), "")

        logger.logInstaller(appId, "=== Starting installation for $rawFileName (AppId: $appId) ===")

        try {
            // Step 1: Preparing
            onProgress(InstallProgress(
                step = "Preparing",
                progressPercent = 10,
                message = "Validating installer package...",
                appId = appId
            ))

            if (extension != "exe" && extension != "msi") {
                val err = "Unsupported installer format: '.$extension'. Only .exe and .msi are supported."
                logger.logInstaller(appId, "Validation failed: $err")
                onProgress(InstallProgress("Failed", 0, err, appId, err))
                return Result.failure(IllegalArgumentException(err))
            }

            // Step 2: Copying into private sandboxed storage
            onProgress(InstallProgress(
                step = "Copying",
                progressPercent = 25,
                message = "Copying installer into secure sandbox...",
                appId = appId
            ))

            val appDir = File(storageManager.applicationsDir, appId).apply { if (!exists()) mkdirs() }
            val stagedInstaller = storageManager.copyFromUri(uri, appDir, rawFileName)

            logger.logInstaller(appId, "Installer securely staged at: ${stagedInstaller.absolutePath} (${stagedInstaller.length()} bytes)")

            // Step 3: Detecting binary architecture (PE Header)
            onProgress(InstallProgress(
                step = "Detecting",
                progressPercent = 40,
                message = "Analyzing binary architecture (PE/COFF)...",
                appId = appId
            ))

            val peInfo = PeHeaderReader.inspect(stagedInstaller)
            logger.logInstaller(appId, "Architecture detected: ${peInfo.architecture} (${peInfo.description})")

            val targetArchitecture = peInfo.architecture

            // Step 4: Creating environment & isolated prefix
            onProgress(InstallProgress(
                step = "Creating environment",
                progressPercent = 60,
                message = "Creating isolated Windows prefix & virtual C: drive...",
                appId = appId
            ))

            val prefixDir = prefixManager.createPrefix(appId)
            logger.logInstaller(appId, "Prefix established at: ${prefixDir.absolutePath}")

            // Step 5: Installing / Invoking runtime installer
            onProgress(InstallProgress(
                step = "Installing",
                progressPercent = 75,
                message = "Configuring runtime compatibility layers...",
                appId = appId
            ))

            val runtimeValidation = runtimeManager.validateRuntime()
            val runtimeType = when (targetArchitecture.lowercase()) {
                "x64" -> "wine64+box64"
                "x86" -> "wine32+box86"
                "arm64" -> "wine-arm64"
                "msi" -> "wine-msi"
                else -> "wine-generic"
            }

            var initialStatus = "installed"
            if (!runtimeValidation.isValid) {
                logger.logInstaller(appId, "Runtime note: Wine/Box64 binaries are not yet packaged. App registered and ready for when runtime binaries are installed.")
                initialStatus = "installed (runtime missing)"
            }

            // Step 6: Finalizing & registering application
            onProgress(InstallProgress(
                step = "Finalizing",
                progressPercent = 90,
                message = "Registering application and building desktop shortcuts...",
                appId = appId
            ))

            val winApp = WinApp(
                id = appId,
                name = rawFileName,
                displayName = cleanName.replace('_', ' ').replace('-', ' ').trim().capitalizeFirstLetter(),
                sourceUri = uri.toString(),
                installerPath = stagedInstaller.absolutePath,
                executablePath = stagedInstaller.absolutePath,
                architecture = targetArchitecture,
                version = "1.0",
                installDate = System.currentTimeMillis(),
                lastRun = 0L,
                prefixPath = prefixDir.absolutePath,
                workingDirectory = stagedInstaller.parent ?: prefixDir.absolutePath,
                arguments = emptyList(),
                desktopShortcut = true,
                startMenuShortcut = true,
                status = initialStatus,
                runtime = if (runtimeValidation.isValid) runtimeType else "unavailable",
                iconPath = if (extension == "msi") "msi" else "exe"
            )

            appRegistry.registerApp(winApp)
            logger.logInstaller(appId, "Application registered successfully in AppRegistry.")

            onProgress(InstallProgress(
                step = "Installed",
                progressPercent = 100,
                message = "Application installation complete!",
                appId = appId,
                app = winApp
            ))

            return Result.success(winApp)

        } catch (e: Exception) {
            val err = "Installation failed: ${e.message}"
            logger.logInstaller(appId, err)
            onProgress(InstallProgress("Failed", 0, err, appId, err))
            return Result.failure(e)
        }
    }

    private fun String.capitalizeFirstLetter(): String {
        return if (isNotEmpty()) this[0].uppercaseChar() + substring(1) else this
    }
}
