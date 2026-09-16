package com.win12.runtime

import org.json.JSONArray
import org.json.JSONObject

enum class RuntimeState {
    AVAILABLE,
    NOT_INSTALLED,
    INVALID,
    STARTING,
    RUNNING,
    STOPPED,
    CRASHED,
    FAILED
}

data class RuntimeInfo(
    val state: RuntimeState,
    val wineInstalled: Boolean,
    val box64Installed: Boolean,
    val box86Installed: Boolean,
    val systemArch: String,
    val supportedArchitectures: List<String>,
    val runtimeVersion: String,
    val winePath: String?,
    val box64Path: String?,
    val box86Path: String?,
    val health: String, // "Healthy", "Warning", "Unavailable"
    val diagnostics: List<String>,
    val errorReason: String? = null
) {
    fun toJson(): JSONObject {
        val obj = JSONObject()
        obj.put("state", state.name)
        obj.put("wineInstalled", wineInstalled)
        obj.put("box64Installed", box64Installed)
        obj.put("box86Installed", box86Installed)
        obj.put("systemArch", systemArch)
        
        val archArray = JSONArray()
        supportedArchitectures.forEach { archArray.put(it) }
        obj.put("supportedArchitectures", archArray)

        obj.put("runtimeVersion", runtimeVersion)
        obj.put("winePath", winePath ?: JSONObject.NULL)
        obj.put("box64Path", box64Path ?: JSONObject.NULL)
        obj.put("box86Path", box86Path ?: JSONObject.NULL)
        obj.put("health", health)
        
        val diagArray = JSONArray()
        diagnostics.forEach { diagArray.put(it) }
        obj.put("diagnostics", diagArray)

        obj.put("errorReason", errorReason ?: JSONObject.NULL)
        return obj
    }
}

data class RuntimeValidationResult(
    val isValid: Boolean,
    val wineReady: Boolean,
    val box64Ready: Boolean,
    val box86Ready: Boolean,
    val errors: List<String>,
    val warnings: List<String>
)

sealed class ProcessLaunchResult {
    data class Success(
        val applicationId: String,
        val pid: Long,
        val process: Process
    ) : ProcessLaunchResult()

    data class Failure(
        val reason: String,
        val errorCode: String,
        val logPath: String? = null
    ) : ProcessLaunchResult()
}
