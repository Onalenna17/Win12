package com.win12.model

import org.json.JSONArray
import org.json.JSONObject

/**
 * Represents a Windows application registered in Win12.
 */
data class WinApp(
    val id: String,
    val name: String,
    val displayName: String,
    val sourceUri: String? = null,
    val installerPath: String? = null,
    val executablePath: String? = null,
    val architecture: String = "x64", // x86, x64, ARM64, MSI, Unknown
    val version: String = "1.0",
    val installDate: Long = System.currentTimeMillis(),
    val lastRun: Long = 0L,
    val prefixPath: String = "",
    val workingDirectory: String = "",
    val arguments: List<String> = emptyList(),
    val desktopShortcut: Boolean = true,
    val startMenuShortcut: Boolean = true,
    val isPinned: Boolean = false,
    val status: String = "installed", // installed, running, stopped, failed, crashed
    val runtime: String = "unavailable", // wine64+box64, wine32+box86, wine-arm64, unavailable
    val exitCode: Int? = null,
    val iconPath: String? = null,
    val isSystemApp: Boolean = false,
    val systemAppType: String? = null // explorer, settings, taskmgr, logviewer, installer
) {
    fun toJson(): JSONObject {
        val json = JSONObject()
        json.put("id", id)
        json.put("name", name)
        json.put("displayName", displayName)
        json.put("sourceUri", sourceUri ?: JSONObject.NULL)
        json.put("installerPath", installerPath ?: JSONObject.NULL)
        json.put("executablePath", executablePath ?: JSONObject.NULL)
        json.put("architecture", architecture)
        json.put("version", version)
        json.put("installDate", installDate)
        json.put("lastRun", lastRun)
        json.put("prefixPath", prefixPath)
        json.put("workingDirectory", workingDirectory)
        
        val argsArray = JSONArray()
        arguments.forEach { argsArray.put(it) }
        json.put("arguments", argsArray)
        
        json.put("desktopShortcut", desktopShortcut)
        json.put("startMenuShortcut", startMenuShortcut)
        json.put("isPinned", isPinned)
        json.put("status", status)
        json.put("runtime", runtime)
        if (exitCode != null) {
            json.put("exitCode", exitCode)
        } else {
            json.put("exitCode", JSONObject.NULL)
        }
        json.put("iconPath", iconPath ?: JSONObject.NULL)
        json.put("isSystemApp", isSystemApp)
        json.put("systemAppType", systemAppType ?: JSONObject.NULL)
        return json
    }

    companion object {
        fun fromJson(json: JSONObject): WinApp {
            val argsList = mutableListOf<String>()
            val argsArray = json.optJSONArray("arguments")
            if (argsArray != null) {
                for (i in 0 until argsArray.length()) {
                    argsList.add(argsArray.getString(i))
                }
            }

            return WinApp(
                id = json.getString("id"),
                name = json.optString("name", "Unknown App"),
                displayName = json.optString("displayName", json.optString("name", "Unknown App")),
                sourceUri = if (json.isNull("sourceUri")) null else json.optString("sourceUri"),
                installerPath = if (json.isNull("installerPath")) null else json.optString("installerPath"),
                executablePath = if (json.isNull("executablePath")) null else json.optString("executablePath"),
                architecture = json.optString("architecture", "x64"),
                version = json.optString("version", "1.0"),
                installDate = json.optLong("installDate", System.currentTimeMillis()),
                lastRun = json.optLong("lastRun", 0L),
                prefixPath = json.optString("prefixPath", ""),
                workingDirectory = json.optString("workingDirectory", ""),
                arguments = argsList,
                desktopShortcut = json.optBoolean("desktopShortcut", true),
                startMenuShortcut = json.optBoolean("startMenuShortcut", true),
                isPinned = json.optBoolean("isPinned", false),
                status = json.optString("status", "installed"),
                runtime = json.optString("runtime", "unavailable"),
                exitCode = if (json.isNull("exitCode")) null else json.optInt("exitCode"),
                iconPath = if (json.isNull("iconPath")) null else json.optString("iconPath"),
                isSystemApp = json.optBoolean("isSystemApp", false),
                systemAppType = if (json.isNull("systemAppType")) null else json.optString("systemAppType")
            )
        }
    }
}
