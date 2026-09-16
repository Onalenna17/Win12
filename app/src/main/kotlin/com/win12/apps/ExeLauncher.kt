package com.win12.apps

import android.content.Context
import com.win12.logging.Win12Logger
import com.win12.model.WinApp
import com.win12.runtime.PrefixManager
import com.win12.runtime.ProcessLaunchResult
import com.win12.runtime.RuntimeManager
import com.win12.storage.StorageManager
import org.json.JSONObject
import java.io.File

/**
 * Handles launching, stopping, repairing, and uninstalling registered Windows applications.
 */
class ExeLauncher(
    private val context: Context,
    private val appRegistry: AppRegistry,
    private val runtimeManager: RuntimeManager,
    private val prefixManager: PrefixManager,
    private val storageManager: StorageManager,
    private val logger: Win12Logger
) {

    data class LaunchResult(
        val success: Boolean,
        val message: String,
        val pid: Long? = null,
        val errorCode: String? = null,
        val logPath: String? = null
    ) {
        fun toJson(): JSONObject {
            return JSONObject().apply {
                put("success", success)
                put("message", message)
                put("pid", pid ?: JSONObject.NULL)
                put("errorCode", errorCode ?: JSONObject.NULL)
                put("logPath", logPath ?: JSONObject.NULL)
            }
        }
    }

    /**
     * Executes the launch sequence for an application ID.
     */
    fun launchApplication(appId: String, extraArgs: List<String> = emptyList()): LaunchResult {
        logger.logRuntime(appId, "=== Launch requested for appId: $appId ===")

        val app = appRegistry.getApp(appId)
        if (app == null) {
            val msg = "Application with ID '$appId' is not registered."
            logger.logRuntime(appId, msg)
            return LaunchResult(false, msg, errorCode = "APP_NOT_FOUND")
        }

        if (app.isSystemApp) {
            // System apps (Explorer, Settings, etc.) are handled directly by UI
            return LaunchResult(true, "System application launched", pid = 0)
        }

        // Validate executable
        val execPath = app.executablePath
        if (execPath.isNullOrEmpty() || !File(execPath).exists()) {
            val msg = "Executable file does not exist at: $execPath"
            logger.logRuntime(appId, msg)
            appRegistry.updateStatus(appId, "failed")
            return LaunchResult(false, msg, errorCode = "EXECUTABLE_MISSING")
        }

        // Validate or restore prefix
        val prefixDir = prefixManager.getPrefixPath(appId)
        if (!prefixDir.exists()) {
            logger.logRuntime(appId, "Prefix was missing, recreating prefix...")
            prefixManager.createPrefix(appId)
        }

        // Validate runtime
        val runtimeValidation = runtimeManager.validateRuntime()
        if (!runtimeValidation.isValid) {
            val reason = runtimeValidation.errors.firstOrNull() ?: "Windows compatibility runtime is not installed."
            val userMsg = "Runtime Unavailable: $reason. " +
                    "To execute ${app.architecture} Windows applications, the Wine and Box64 runtime package must be installed in the runtime directory."
            logger.logRuntime(appId, userMsg)
            appRegistry.updateStatus(appId, "runtime missing")
            return LaunchResult(
                success = false,
                message = userMsg,
                errorCode = "RUNTIME_UNAVAILABLE",
                logPath = File(storageManager.logsDir, "$appId/runtime.log").absolutePath
            )
        }

        // Launch process
        val launchResult = runtimeManager.launchProcess(app, extraArgs)
        return when (launchResult) {
            is ProcessLaunchResult.Success -> {
                appRegistry.updateLastRun(appId)
                appRegistry.updateStatus(appId, "running")
                LaunchResult(
                    success = true,
                    message = "Application launched successfully (PID: ${launchResult.pid})",
                    pid = launchResult.pid
                )
            }
            is ProcessLaunchResult.Failure -> {
                appRegistry.updateStatus(appId, "failed")
                LaunchResult(
                    success = false,
                    message = launchResult.reason,
                    errorCode = launchResult.errorCode,
                    logPath = launchResult.logPath
                )
            }
        }
    }

    fun stopApplication(appId: String): Boolean {
        val success = runtimeManager.stopProcess(appId)
        if (success) {
            appRegistry.updateStatus(appId, "stopped")
        }
        return success
    }

    fun forceStopApplication(appId: String): Boolean {
        val success = runtimeManager.forceStopProcess(appId)
        if (success) {
            appRegistry.updateStatus(appId, "stopped")
        }
        return success
    }

    fun repairApplication(appId: String): Boolean {
        logger.logRuntime(appId, "Repairing application prefix and environment...")
        val repaired = prefixManager.repairPrefix(appId)
        if (repaired) {
            appRegistry.updateStatus(appId, "installed")
        }
        return repaired
    }

    fun uninstallApplication(appId: String): Boolean {
        logger.logRuntime(appId, "Uninstalling application $appId...")
        // Stop any running instance
        runtimeManager.forceStopProcess(appId)

        // Delete isolated prefix
        prefixManager.deletePrefix(appId)

        // Delete application directory
        val appDir = File(storageManager.applicationsDir, appId)
        if (appDir.exists()) {
            appDir.deleteRecursively()
        }

        // Delete logs
        logger.clearAppLogs(appId)

        // Remove from registry
        val removed = appRegistry.deleteApp(appId)
        logger.logSystem("ExeLauncher", "Uninstall completed for $appId (Success: $removed)")
        return removed
    }
}
