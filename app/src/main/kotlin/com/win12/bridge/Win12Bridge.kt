package com.win12.bridge

import android.content.Context
import android.content.Intent
import android.content.ComponentName
import android.content.ClipData
import androidx.core.content.FileProvider
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import java.io.ByteArrayOutputStream
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import com.win12.apps.AppRegistry
import com.win12.apps.ExeInstaller
import com.win12.apps.ExeLauncher
import com.win12.logging.Win12Logger
import com.win12.runtime.RuntimeInstaller
import com.win12.runtime.RuntimeManager
import com.win12.security.PermissionManager
import com.win12.storage.StorageManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Secure JavascriptInterface exposed to the Win12 WebApp desktop.
 * Strictly enforces access control and validates all parameters against native registries.
 */
class Win12Bridge(
    private val context: Context,
    private val webView: WebView,
    private val appRegistry: AppRegistry,
    private val runtimeManager: RuntimeManager,
    private val runtimeInstaller: RuntimeInstaller,
    private val exeLauncher: ExeLauncher,
    private val exeInstaller: ExeInstaller,
    private val storageManager: StorageManager,
    private val permissionManager: PermissionManager,
    private val logger: Win12Logger,
    private val onPickInstallerRequested: () -> Unit,
    private val onManageStorageRequested: () -> Unit
) {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val discoveredAndroidApps = java.util.concurrent.ConcurrentHashMap<String, Pair<String, String>>()
    @Volatile private var applicationRevision = 0

    // Backing store for desktop UI state (wallpaper choice, window layout,
    // etc.) pushed from the WebApp's StateStore. A dedicated preferences
    // file is used so this survives WebView reloads, Activity recreation
    // and process death, independent of AppRegistry/runtime state.
    private val desktopStatePrefs by lazy {
        context.getSharedPreferences("win12_desktop_state", Context.MODE_PRIVATE)
    }

    /**
     * Dispatches an event to the JavaScript environment.
     */
    fun dispatchEvent(eventName: String, dataJson: String) {
        mainHandler.post {
            val script = "if (window.Win12Desktop && window.Win12Desktop.onNativeEvent) { window.Win12Desktop.onNativeEvent('$eventName', $dataJson); }"
            webView.evaluateJavascript(script, null)
        }
    }

    @JavascriptInterface
    fun getSystemInfo(): String {
        val totalMemory = Runtime.getRuntime().totalMemory()
        val freeMemory = Runtime.getRuntime().freeMemory()
        val maxMemory = Runtime.getRuntime().maxMemory()

        val json = JSONObject().apply {
            put("os", "Android " + Build.VERSION.RELEASE)
            put("apiLevel", Build.VERSION.SDK_INT)
            put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("primaryAbi", if (Build.SUPPORTED_ABIS.isNotEmpty()) Build.SUPPORTED_ABIS[0] else "unknown")
            put("supportedAbis", JSONArray(Build.SUPPORTED_ABIS))
            put("totalMemory", totalMemory)
            put("freeMemory", freeMemory)
            put("maxMemory", maxMemory)
            put("storageBreakdown", storageManager.getStorageBreakdown())
        }
        return json.toString()
    }

    @JavascriptInterface
    fun getRuntimeStatus(): String {
        return runtimeManager.detectRuntime().toJson().toString()
    }

    @Volatile
    private var runtimeInstallInProgress = false

    /**
     * Kicks off a real download + install of the Windows compatibility
     * runtime (Wine/Box64/Box86) from bundleUrl, running off the main
     * thread. Progress is streamed to the WebApp via the
     * `system:runtimeInstallProgress` native event; the terminal event
     * carries the final RuntimeValidationResult-derived status so the UI
     * can refresh getRuntimeStatus(). expectedSha256 may be an empty
     * string to skip checksum verification.
     */
    @JavascriptInterface
    fun installRuntime(bundleUrl: String, expectedSha256: String) {
        if (runtimeInstallInProgress) {
            dispatchEvent(
                "system:runtimeInstallProgress",
                JSONObject().apply {
                    put("step", "Failed")
                    put("progressPercent", 0)
                    put("message", "A runtime installation is already in progress.")
                    put("error", "ALREADY_INSTALLING")
                }.toString()
            )
            return
        }
        runtimeInstallInProgress = true
        Thread({
            try {
                runtimeInstaller.install(
                    bundleUrl = bundleUrl,
                    expectedSha256 = expectedSha256.ifBlank { null }
                ) { progress ->
                    dispatchEvent("system:runtimeInstallProgress", progress.toJson().toString())
                }
            } finally {
                runtimeInstallInProgress = false
            }
        }, "Win12-RuntimeInstall").start()
    }

    @JavascriptInterface
    fun cancelRuntimeInstall() {
        runtimeInstaller.cancel()
    }

    @JavascriptInterface
    fun uninstallRuntime(): Boolean {
        val result = runtimeInstaller.uninstall()
        dispatchEvent("system:runtimeInstallProgress", JSONObject().apply {
            put("step", if (result) "Uninstalled" else "Failed")
            put("progressPercent", 0)
            put("message", if (result) "Runtime removed." else "Failed to remove runtime files.")
            put("error", JSONObject.NULL)
        }.toString())
        return result
    }

    @JavascriptInterface
    fun getInstalledApps(): String {
        val apps = appRegistry.getAllApps()
        val array = JSONArray()
        apps.forEach { array.put(it.toJson()) }
        return array.toString()
    }

    @JavascriptInterface
    fun getDesktopShortcuts(): String {
        val apps = appRegistry.getDesktopShortcuts()
        val array = JSONArray()
        apps.forEach { array.put(it.toJson()) }
        return array.toString()
    }

    @JavascriptInterface
    fun selectInstaller() {
        mainHandler.post {
            onPickInstallerRequested()
        }
    }

    @JavascriptInterface
    fun launchApplication(appId: String): String {
        val cleanAppId = appId.trim()
        val discovered = discoveredAndroidApps[cleanAppId] ?: run { discoverAndroidApplications(); discoveredAndroidApps[cleanAppId] }
        if (discovered != null) {
            return try {
                val (packageName, activityName) = discovered
                val intent = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_LAUNCHER)
                    component = ComponentName(packageName, activityName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                JSONObject().apply { put("success", true); put("message", "Android launch request sent to $packageName."); put("pid", JSONObject.NULL) }.toString()
            } catch (e: Exception) {
                JSONObject().apply { put("success", false); put("message", "Android rejected the launch request: ${e.message ?: "unknown error"}"); put("errorCode", "ANDROID_LAUNCH_FAILED") }.toString()
            }
        }
        return exeLauncher.launchApplication(cleanAppId).toJson().toString()
    }

    @JavascriptInterface
    fun stopApplication(appId: String): Boolean {
        return exeLauncher.stopApplication(appId.trim())
    }

    @JavascriptInterface
    fun forceStopApplication(appId: String): Boolean {
        return exeLauncher.forceStopApplication(appId.trim())
    }

    @JavascriptInterface
    fun getKnownFolders(): String = JSONArray().apply {
        put(JSONObject().put("name", "Desktop").put("path", "C:\\Desktop"))
        put(JSONObject().put("name", "Downloads").put("path", "C:\\Downloads"))
        put(JSONObject().put("name", "Documents").put("path", "C:\\Documents"))
        put(JSONObject().put("name", "Pictures").put("path", "C:\\Pictures"))
        put(JSONObject().put("name", "Music").put("path", "C:\\Music"))
        put(JSONObject().put("name", "Videos").put("path", "C:\\Videos"))
    }.toString()

    @JavascriptInterface
    fun getStorageRoots(): String = JSONArray().apply {
        put(JSONObject().apply { put("name", "WIN12 Storage (C:)"); put("path", "C:\\"); put("type", "drive"); put("source", "APP_PRIVATE"); put("available", true); put("canWrite", true); put("totalBytes", storageManager.rootDir.totalSpace); put("freeBytes", storageManager.rootDir.freeSpace); put("description", "WIN12 private application storage"); put("capacityScope", "WIN12 sandbox") })
        if (permissionManager.hasAllFilesAccess()) put(JSONObject().apply { put("name", "Device Storage (E:)"); put("path", "E:\\"); put("type", "drive"); put("source", "APP_EXTERNAL"); put("available", true); put("canWrite", true); put("totalBytes", storageManager.sharedStorageRoot.totalSpace); put("freeBytes", storageManager.sharedStorageRoot.freeSpace); put("description", "Android shared device storage"); put("capacityScope", "device storage") })
    }.toString()

    @JavascriptInterface
    fun getDirectoryContents(path: String): String = try {
        val result = if (path.trim().startsWith("E:", true)) storageManager.listSharedStorageDirectory(path) else storageManager.listVirtualDirectory(path)
        JSONObject().apply { put("items", result.optJSONArray("items") ?: JSONArray()); if (result.has("permissionRequired")) put("permissionRequired", result.optBoolean("permissionRequired")); if (result.has("error")) put("message", result.optString("error")) }.toString()
    } catch (e: Exception) { JSONObject().apply { put("items", JSONArray()); put("message", e.message ?: "Storage location unavailable."); put("permissionRequired", false) }.toString() }

    @JavascriptInterface
    fun getFileMetadata(path: String): String {
        return try {
            val normalized = path.trim()
            val item = if (normalized.startsWith("E:", true)) {
                val parent = normalized.substringBeforeLast('\\', "E:\\")
                val listing = storageManager.listSharedStorageDirectory(parent).optJSONArray("items") ?: JSONArray()
                (0 until listing.length()).map { listing.getJSONObject(it) }.firstOrNull { it.optString("path").equals(normalized, true) }
            } else {
                val parent = normalized.substringBeforeLast('\\', "This PC")
                val listing = storageManager.listVirtualDirectory(parent).optJSONArray("items") ?: JSONArray()
                (0 until listing.length()).map { listing.getJSONObject(it) }.firstOrNull { it.optString("path").equals(normalized, true) }
            }
            item?.toString() ?: JSONObject.NULL.toString()
        } catch (_: Exception) { JSONObject.NULL.toString() }
    }

    @JavascriptInterface
    fun readTextFile(path: String): String = try {
        val file = if (path.startsWith("E:", true)) storageManager.resolveSharedPath(path) else storageManager.resolveVirtualPath(path)
        if (!file.isFile) JSONObject().apply { put("success", false); put("message", "File not found or is not a regular file.") }.toString()
        else if (file.length() > 4L * 1024 * 1024) JSONObject().apply { put("success", false); put("message", "Text file exceeds the 4 MB editor limit.") }.toString()
        else JSONObject().apply { put("success", true); put("content", file.readText(Charsets.UTF_8)) }.toString()
    } catch (e: Exception) { JSONObject().apply { put("success", false); put("message", e.message ?: "Unable to read file.") }.toString() }

    @JavascriptInterface
    fun fileOperation(action: String, argsJson: String): String {
        return try {
            val args = JSONObject(argsJson); val path = args.optString("path"); val target = if (path.startsWith("E:", true)) storageManager.resolveSharedPath(path) else storageManager.resolveVirtualPath(path)
            when (action) {
                "create" -> { val parent = if (path.startsWith("E:", true)) storageManager.resolveSharedPath(path) else storageManager.resolveVirtualPath(path); val name = storageManager.sanitizeFileName(args.optString("name")); val f = File(parent, name); if (!storageManager.isPathSafe(if (path.startsWith("E:", true)) storageManager.sharedStorageRoot else storageManager.rootDir, f)) throw SecurityException("Unsafe path"); if (args.optBoolean("directory")) f.mkdirs() else { f.parentFile?.mkdirs(); f.writeText(args.optString("content"), Charsets.UTF_8) }; JSONObject().put("success", f.exists()).put("path", if (path.startsWith("E:", true)) "E:\\${f.relativeTo(storageManager.sharedStorageRoot).path.replace(File.separatorChar, '\\')}" else "${path.trimEnd('\\')}\\${name}") }
                "write" -> { if (!target.isFile) throw IllegalArgumentException("File not found"); target.writeText(args.optString("content"), Charsets.UTF_8); JSONObject().put("success", true) }
                "rename" -> { val name = storageManager.sanitizeFileName(args.optString("name")); val dest = File(target.parentFile, name); if (dest.exists()) throw IllegalStateException("An item with that name already exists."); JSONObject().put("success", target.renameTo(dest)) }
                "delete" -> JSONObject().put("success", storageManager.deleteVirtualFile(path))
                "restore" -> { val original = args.optString("originalPath"); if (original.isBlank()) JSONObject().put("success", false).put("message", "No restore target supplied.") else { val dest = if (original.startsWith("E:", true)) storageManager.resolveSharedPath(original) else storageManager.resolveVirtualPath(original); dest.parentFile?.mkdirs(); JSONObject().put("success", target.renameTo(dest)) } }
                "open" -> { if (!target.exists()) JSONObject().put("success", false).put("message", "File not found.") else { val uri = FileProvider.getUriForFile(context, context.packageName + ".files", target); val mime = android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(target.extension.lowercase()) ?: "application/octet-stream"; val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION); context.startActivity(intent); JSONObject().put("success", true).put("pending", true).put("message", "Android file viewer launch requested.") } }
                "export" -> { if (!target.exists()) JSONObject().put("success", false).put("message", "File not found.") else { val uri = FileProvider.getUriForFile(context, context.packageName + ".files", target); val intent = Intent(Intent.ACTION_SEND).setType("application/octet-stream").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION); intent.clipData = ClipData.newRawUri("file", uri); context.startActivity(Intent.createChooser(intent, "Export file").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); JSONObject().put("success", true).put("pending", true).put("message", "Android export chooser opened.") } }
                "copy", "move" -> { val destination = args.optString("destination"); val destDir = if (destination.startsWith("E:", true)) storageManager.resolveSharedPath(destination) else storageManager.resolveVirtualPath(destination); val dest = File(destDir, target.name); destDir.mkdirs(); if (action == "copy") target.copyRecursively(dest, overwrite = false) else target.renameTo(dest); JSONObject().put("success", dest.exists()) }
                else -> JSONObject().put("success", false).put("message", "Unsupported file operation: $action").put("code", "UNSUPPORTED")
            }.toString()
        } catch (e: Exception) { JSONObject().put("success", false).put("message", e.message ?: "File operation failed.").put("code", "FILE_OPERATION_FAILED").toString() }
    }

    @JavascriptInterface
    fun savePngImage(name: String, dataUrl: String): String {
        return try {
            if (!dataUrl.startsWith("data:image/png;base64,")) throw IllegalArgumentException("Only PNG data is accepted.")
            val safe = storageManager.sanitizeFileName(name).let { if (it.lowercase().endsWith(".png")) it else "$it.png" }
            val base64 = dataUrl.substringAfter(',')
            if (base64.length > 5_500_000) throw IllegalArgumentException("PNG is too large.")
            val out = File(storageManager.documentsDir, safe)
            android.util.Base64.decode(base64, android.util.Base64.DEFAULT).let { bytes -> out.writeBytes(bytes) }
            JSONObject().put("success", out.exists()).put("path", "C:\\Documents\\$safe")
        } catch (e: Exception) { JSONObject().put("success", false).put("message", e.message ?: "Unable to save PNG.").toString() }
    }

    @JavascriptInterface
    fun getCapabilities(): String = JSONObject().apply {
        put("version", 2); put("applicationDiscovery", true); put("androidLaunch", true)
        put("storage", true); put("storagePicker", true); put("fileOperations", true)
        put("systemState", false); put("mediaVolume", false); put("deviceLock", false)
        put("notificationAccess", false); put("storeSearch", false); put("runtimeInstall", true)
        put("windowsExecution", runtimeManager.detectRuntime().isValid); put("externalEmbedding", false)
        put("externalWeb", true); put("desktopSounds", false); put("orientationControl", false)
        put("softwareSources", true); put("imageWrite", true); put("shutdown", false); put("reboot", false)
    }.toString()

    private fun discoverAndroidApplications(): JSONArray {
        discoveredAndroidApps.clear()
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolved = if (android.os.Build.VERSION.SDK_INT >= 33) {
            pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION") pm.queryIntentActivities(intent, 0)
        }
        val result = JSONArray()
        val seen = mutableSetOf<String>()
        for (info in resolved.sortedBy { it.loadLabel(pm).toString().lowercase() }) {
            val packageName = info.activityInfo?.packageName ?: continue
            val activityName = info.activityInfo?.name ?: continue
            if (!seen.add(packageName)) continue
            val id = "android:$packageName"
            discoveredAndroidApps[id] = packageName to activityName
            val appInfo = info.activityInfo.applicationInfo
            val versionName = try { pm.getPackageInfo(packageName, 0).versionName ?: "Unknown" } catch (_: Exception) { "Unknown" }
            val launchable = try { pm.getLaunchIntentForPackage(packageName) != null } catch (_: Exception) { false }
            val iconData = try {
                val bitmap = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                val drawable = appInfo.loadIcon(pm)
                drawable.setBounds(0, 0, 64, 64); drawable.draw(canvas)
                val out = ByteArrayOutputStream(); bitmap.compress(Bitmap.CompressFormat.PNG, 100, out); bitmap.recycle()
                "data:image/png;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
            } catch (_: Exception) { "" }
            result.put(JSONObject().apply {
                put("id", id); put("displayName", info.loadLabel(pm).toString()); put("name", info.loadLabel(pm).toString())
                put("packageName", packageName); put("applicationId", packageName); put("versionName", versionName)
                put("launchType", "ANDROID_PACKAGE"); put("launchIntent", ComponentName(packageName, activityName).flattenToString())
                put("isInstalled", true); put("verified", true); put("isLaunchable", launchable)
                put("runningState", "UNKNOWN"); put("observedAt", System.currentTimeMillis()); put("runningEvidence", JSONObject.NULL)
                put("iconSource", "ANDROID_PACKAGE_MANAGER"); if (iconData.isNotEmpty()) put("iconUrl", iconData); put("description", "Discovered from Android launcher metadata")
                put("capabilities", JSONObject().apply { put("appSettings", true); put("uninstall", appInfo.enabled && appInfo.packageName != context.packageName); put("stop", false); put("repair", false) })
                put("metadata", JSONObject().apply { put("activity", activityName); put("sourceDir", appInfo.sourceDir ?: "") })
            })
        }
        applicationRevision++
        return result
    }

    @JavascriptInterface
    fun getApplicationSnapshot(): String = JSONObject().apply {
        val apps = discoverAndroidApplications()
        put("apps", apps); put("status", "READY"); put("message", "Android launcher applications discovered from the current profile.")
        put("scannedAt", System.currentTimeMillis()); put("revision", applicationRevision)
        put("scope", "Current Android profile launcher applications"); put("runningVisibility", "UNKNOWN_FOR_EXTERNAL_APPS")
    }.toString()

    @JavascriptInterface
    fun refreshApplications(): String = JSONObject().apply { put("success", true); put("message", "Application discovery refreshed."); put("pending", false) }.toString()

    @JavascriptInterface
    fun getSoftwareAvailability(): String {
        val targets = listOf("chrome" to "com.android.chrome", "deriv-mt5" to "net.metaquotes.metatrader5")
        val array = JSONArray()
        val now = System.currentTimeMillis()
        for ((id, pkg) in targets) {
            val state = try { val info = context.packageManager.getPackageInfo(pkg, 0); JSONObject().apply { put("productId", id); put("state", "INSTALLED"); put("message", "Installed package discovered."); put("packageName", pkg); put("versionName", info.versionName ?: "Unknown"); put("firstInstallTime", info.firstInstallTime); put("lastUpdateTime", info.lastUpdateTime); put("observedAt", now) } } catch (_: Exception) { JSONObject().apply { put("productId", id); put("state", "NOT_INSTALLED"); put("message", "Package not installed or not visible to this profile."); put("packageName", pkg); put("observedAt", now) } }
            array.put(state)
        }
        array.put(JSONObject().apply { put("productId", "metaeditor"); put("state", "UNSUPPORTED"); put("message", "No official standalone Android MetaEditor package is supplied."); put("observedAt", now) })
        return array.toString()
    }

    @JavascriptInterface
    fun openSoftwareSource(productId: String, destination: String): String {
        val uri = when (productId.trim()) {
            "chrome" -> if (destination == "install") "https://play.google.com/store/apps/details?id=com.android.chrome" else "https://www.google.com/chrome/"
            "deriv-mt5" -> if (destination == "install") "https://play.google.com/store/apps/details?id=net.metaquotes.metatrader5" else "https://deriv.com/trading-platforms/deriv-mt5"
            "metaeditor" -> "https://www.metatrader5.com/en/automated-trading/metaeditor"
            else -> return JSONObject().apply { put("success", false); put("message", "Unknown official software source."); put("code", "UNKNOWN_PRODUCT") }.toString()
        }
        return try { context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); JSONObject().apply { put("success", true); put("message", "Opened official software source."); put("pending", true) }.toString() } catch (e: Exception) { JSONObject().apply { put("success", false); put("message", "No browser could open the official source: ${e.message}"); put("code", "EXTERNAL_WEB_UNAVAILABLE") }.toString() }
    }

    @JavascriptInterface
    fun openApplicationSettings(appId: String): String {
        val target = discoveredAndroidApps[appId] ?: run { discoverAndroidApplications(); discoveredAndroidApps[appId] }
        val pkg = target?.first ?: return JSONObject().apply { put("success", false); put("message", "Application is no longer discovered."); put("code", "APP_NOT_FOUND") }.toString()
        return try { context.startActivity(Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:$pkg")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); JSONObject().apply { put("success", true); put("message", "Opened Android application settings."); put("pending", true) }.toString() } catch (e: Exception) { JSONObject().apply { put("success", false); put("message", e.message ?: "Unable to open application settings.") }.toString() }
    }

    @JavascriptInterface
    fun uninstallApplication(appId: String): Boolean {
        val clean = appId.trim()
        val target = discoveredAndroidApps[clean] ?: run { discoverAndroidApplications(); discoveredAndroidApps[clean] }
        if (target != null) {
            return try {
                val intent = Intent(Intent.ACTION_DELETE, android.net.Uri.parse("package:${target.first}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent); true
            } catch (_: Exception) { false }
        }
        return exeLauncher.uninstallApplication(clean)
    }

    @JavascriptInterface
    fun repairApplication(appId: String): Boolean {
        return exeLauncher.repairApplication(appId.trim())
    }

    @JavascriptInterface
    fun toggleDesktopShortcut(appId: String, enabled: Boolean): Boolean {
        return appRegistry.toggleDesktopShortcut(appId.trim(), enabled)
    }

    @JavascriptInterface
    fun setPinned(appId: String, pinned: Boolean): Boolean {
        val result = appRegistry.setPinned(appId.trim(), pinned)
        if (result) {
            dispatchEvent(
                "application:${if (pinned) "pinned" else "unpinned"}",
                JSONObject().put("appId", appId.trim()).toString()
            )
        }
        return result
    }

    @JavascriptInterface
    fun getPinnedApps(): String {
        val array = JSONArray()
        appRegistry.getPinnedApps().forEach { array.put(it.toJson()) }
        return array.toString()
    }

    @JavascriptInterface
    fun searchApps(query: String): String {
        val array = JSONArray()
        appRegistry.searchApps(query).forEach { array.put(it.toJson()) }
        return array.toString()
    }

    @JavascriptInterface
    fun getVirtualDriveContents(path: String): String {
        return storageManager.listVirtualDirectory(path).toString()
    }

    @JavascriptInterface
    fun createVirtualFolder(parentPath: String, folderName: String): Boolean {
        return storageManager.createVirtualFolder(parentPath, folderName)
    }

    @JavascriptInterface
    fun deleteVirtualFile(path: String): Boolean {
        return storageManager.deleteVirtualFile(path)
    }

    @JavascriptInterface
    fun getLogs(appId: String): String {
        val logsMap = if (appId.equals("system", ignoreCase = true)) {
            mapOf("system.log" to logger.getSystemLog())
        } else {
            logger.getAppLogs(appId.trim())
        }
        val obj = JSONObject()
        logsMap.forEach { (k, v) -> obj.put(k, v) }
        return obj.toString()
    }

    @JavascriptInterface
    fun clearLogs(appId: String): Boolean {
        return if (appId.equals("system", ignoreCase = true)) {
            logger.clearAllLogs()
        } else {
            logger.clearAppLogs(appId.trim())
        }
    }

    @JavascriptInterface
    fun getRunningProcesses(): String {
        val list = runtimeManager.getAllRunningProcesses()
        val array = JSONArray()
        list.forEach { array.put(it.toJson()) }
        return array.toString()
    }

    @JavascriptInterface
    fun hasAllFilesAccess(): Boolean {
        return permissionManager.hasAllFilesAccess()
    }

    @JavascriptInterface
    fun requestAllFilesAccess() {
        mainHandler.post {
            onManageStorageRequested()
        }
    }

    @JavascriptInterface
    fun showToast(message: String) {
        mainHandler.post {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Persists the WebApp's desktop state (wallpaper id, window positions/
     * sizes/z-index/minimized-maximized, taskbar config, etc.) as a single
     * JSON blob. The WebApp is the source of truth for the shape of this
     * data; the bridge only stores/returns it verbatim.
     */
    @JavascriptInterface
    fun saveDesktopState(stateJson: String): Boolean {
        return try {
            // Sanity-check it's valid JSON before persisting so a malformed
            // write can never corrupt the saved state / cause a blank
            // desktop on the next load.
            JSONObject(stateJson)
            desktopStatePrefs.edit().putString(KEY_DESKTOP_STATE, stateJson).apply()
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Returns the last persisted desktop state JSON, or an empty JSON
     * object string if nothing has been saved yet / the saved value is
     * corrupt. Never returns null and never throws, so the WebApp can
     * always safely fall back to defaults.
     */
    @JavascriptInterface
    fun loadDesktopState(): String {
        val raw = desktopStatePrefs.getString(KEY_DESKTOP_STATE, null) ?: return "{}"
        return try {
            JSONObject(raw)
            raw
        } catch (e: Exception) {
            "{}"
        }
    }

    companion object {
        private const val KEY_DESKTOP_STATE = "desktop_state_json"
    }
}
