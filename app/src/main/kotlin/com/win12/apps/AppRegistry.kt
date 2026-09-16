package com.win12.apps

import android.content.Context
import android.util.Log
import com.win12.logging.Win12Logger
import com.win12.model.WinApp
import com.win12.storage.StorageManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileWriter
import java.util.concurrent.ConcurrentHashMap

/**
 * Persistent native registry for all installed Windows and system applications.
 * Survives process restarts, webview reload, and device reboots.
 */
class AppRegistry(
    private val context: Context,
    private val storageManager: StorageManager,
    private val logger: Win12Logger
) {

    private val registryFile = File(storageManager.registryDir, "apps.json")
    private val appsMap = ConcurrentHashMap<String, WinApp>()

    init {
        loadRegistry()
    }

    @Synchronized
    private fun loadRegistry() {
        appsMap.clear()
        if (registryFile.exists()) {
            try {
                val jsonStr = registryFile.readText()
                val jsonArray = JSONArray(jsonStr)
                for (i in 0 until jsonArray.length()) {
                    val appJson = jsonArray.getJSONObject(i)
                    val app = WinApp.fromJson(appJson)
                    appsMap[app.id] = app
                }
                logger.logSystem("AppRegistry", "Loaded ${appsMap.size} apps from persistent registry.")
            } catch (e: Exception) {
                Log.e("AppRegistry", "Failed to parse registry: ${e.message}")
                logger.logSystem("AppRegistry", "Registry parsing failed, initializing defaults.")
                populateDefaults()
            }
        } else {
            populateDefaults()
        }
    }

    private fun populateDefaults() {
        val defaults = listOf(
            WinApp(
                id = "sys-explorer",
                name = "File Explorer",
                displayName = "File Explorer",
                architecture = "Native",
                version = "12.0",
                desktopShortcut = true,
                startMenuShortcut = true,
                status = "installed",
                runtime = "native",
                iconPath = "explorer",
                isSystemApp = true,
                systemAppType = "explorer"
            ),
            WinApp(
                id = "sys-installer",
                name = "Install Windows App",
                displayName = "Install Windows App",
                architecture = "Native",
                version = "12.0",
                desktopShortcut = true,
                startMenuShortcut = true,
                status = "installed",
                runtime = "native",
                iconPath = "installer",
                isSystemApp = true,
                systemAppType = "installer"
            ),
            WinApp(
                id = "sys-apps",
                name = "Installed Apps",
                displayName = "Installed Apps",
                architecture = "Native",
                version = "12.0",
                desktopShortcut = true,
                startMenuShortcut = true,
                status = "installed",
                runtime = "native",
                iconPath = "apps",
                isSystemApp = true,
                systemAppType = "apps"
            ),
            WinApp(
                id = "sys-settings",
                name = "Settings",
                displayName = "Settings",
                architecture = "Native",
                version = "12.0",
                desktopShortcut = true,
                startMenuShortcut = true,
                status = "installed",
                runtime = "native",
                iconPath = "settings",
                isSystemApp = true,
                systemAppType = "settings"
            ),
            WinApp(
                id = "sys-recycle",
                name = "Recycle Bin",
                displayName = "Recycle Bin",
                architecture = "Native",
                version = "12.0",
                desktopShortcut = true,
                startMenuShortcut = false,
                status = "installed",
                runtime = "native",
                iconPath = "recycle",
                isSystemApp = true,
                systemAppType = "recycle"
            ),
            WinApp(
                id = "sys-logs",
                name = "Win12 Log Viewer",
                displayName = "Win12 Log Viewer",
                architecture = "Native",
                version = "12.0",
                desktopShortcut = false,
                startMenuShortcut = true,
                status = "installed",
                runtime = "native",
                iconPath = "logviewer",
                isSystemApp = true,
                systemAppType = "logviewer"
            ),
            WinApp(
                id = "sys-taskmgr",
                name = "Task Manager",
                displayName = "Task Manager",
                architecture = "Native",
                version = "12.0",
                desktopShortcut = false,
                startMenuShortcut = true,
                status = "installed",
                runtime = "native",
                iconPath = "taskmgr",
                isSystemApp = true,
                systemAppType = "taskmgr"
            )
        )

        defaults.forEach { appsMap[it.id] = it }
        saveRegistry()
    }

    @Synchronized
    private fun saveRegistry() {
        try {
            val jsonArray = JSONArray()
            appsMap.values.forEach { jsonArray.put(it.toJson()) }

            // Atomic write: write to temp file then rename
            val tempFile = File(storageManager.registryDir, "apps.json.tmp")
            FileWriter(tempFile).use { it.write(jsonArray.toString(2)) }
            if (tempFile.renameTo(registryFile)) {
                logger.logSystem("AppRegistry", "Registry persisted successfully (${appsMap.size} apps)")
            } else {
                // Fallback direct write
                registryFile.writeText(jsonArray.toString(2))
                tempFile.delete()
            }
        } catch (e: Exception) {
            Log.e("AppRegistry", "Error saving registry: ${e.message}")
        }
    }

    fun getAllApps(): List<WinApp> {
        return appsMap.values.toList().sortedByDescending { it.installDate }
    }

    fun getApp(id: String): WinApp? {
        return appsMap[id]
    }

    fun registerApp(app: WinApp) {
        appsMap[app.id] = app
        saveRegistry()
        logger.logSystem("AppRegistry", "Registered app: ${app.displayName} (${app.id})")
    }

    fun updateApp(app: WinApp) {
        appsMap[app.id] = app
        saveRegistry()
    }

    fun deleteApp(id: String): Boolean {
        val removed = appsMap.remove(id)
        if (removed != null) {
            saveRegistry()
            logger.logSystem("AppRegistry", "Deleted app: ${removed.displayName} ($id)")
            return true
        }
        return false
    }

    fun getDesktopShortcuts(): List<WinApp> {
        return appsMap.values.filter { it.desktopShortcut }
    }

    fun getStartMenuApps(): List<WinApp> {
        return appsMap.values.filter { it.startMenuShortcut }
    }

    fun toggleDesktopShortcut(id: String, enabled: Boolean): Boolean {
        val app = appsMap[id] ?: return false
        val updated = app.copy(desktopShortcut = enabled)
        appsMap[id] = updated
        saveRegistry()
        return true
    }

    /**
     * Pin/unpin an app to the Start menu's Pinned section and the taskbar.
     * This is a distinct concept from desktopShortcut (Phase 21/26): pinning
     * never creates or removes a desktop icon, and survives restarts because
     * it lives on the persisted WinApp record itself.
     */
    fun setPinned(id: String, pinned: Boolean): Boolean {
        val app = appsMap[id] ?: return false
        if (app.isPinned == pinned) return true
        appsMap[id] = app.copy(isPinned = pinned)
        saveRegistry()
        logger.logSystem("AppRegistry", "${if (pinned) "Pinned" else "Unpinned"} app: ${app.displayName} ($id)")
        return true
    }

    fun getPinnedApps(): List<WinApp> {
        return appsMap.values.filter { it.isPinned }.sortedBy { it.displayName.lowercase() }
    }

    /**
     * Real search across the fields the spec requires (displayName, name,
     * executable/executablePath, id, version) — partial, case-insensitive,
     * ranked by where the match occurs (prefix match ranks above substring).
     * Unpinned apps are included; pin state has no bearing on search.
     */
    fun searchApps(query: String): List<WinApp> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return getAllApps()

        fun matchScore(app: WinApp): Int {
            val fields = listOf(
                app.displayName.lowercase(),
                app.name.lowercase(),
                app.id.lowercase(),
                app.executablePath?.lowercase().orEmpty(),
                app.version.lowercase()
            )
            var best = Int.MAX_VALUE
            for (f in fields) {
                if (f.isEmpty()) continue
                if (f == q) { best = minOf(best, 0); continue }
                if (f.startsWith(q)) { best = minOf(best, 1); continue }
                if (f.contains(q)) { best = minOf(best, 2) }
            }
            return best
        }

        return appsMap.values
            .map { it to matchScore(it) }
            .filter { it.second != Int.MAX_VALUE }
            .sortedWith(compareBy({ it.second }, { it.first.displayName.lowercase() }))
            .map { it.first }
    }

    fun updateLastRun(id: String) {
        val app = appsMap[id] ?: return
        appsMap[id] = app.copy(lastRun = System.currentTimeMillis())
        saveRegistry()
    }

    fun updateStatus(id: String, status: String, exitCode: Int? = null) {
        val app = appsMap[id] ?: return
        appsMap[id] = app.copy(status = status, exitCode = exitCode)
        saveRegistry()
    }
}
