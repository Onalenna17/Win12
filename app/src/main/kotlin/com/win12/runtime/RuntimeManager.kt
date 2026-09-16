package com.win12.runtime

import android.content.Context
import android.os.Build
import com.win12.logging.Win12Logger
import com.win12.model.WinApp
import com.win12.storage.StorageManager
import java.io.File
import java.lang.reflect.Field
import java.util.concurrent.ConcurrentHashMap

/**
 * Coordinates compatibility runtimes (Wine, Box64, Box86), isolated prefixes, and processes.
 */
class RuntimeManager(
    private val context: Context,
    val storageManager: StorageManager,
    val validator: RuntimeValidator,
    val prefixManager: PrefixManager,
    val logger: Win12Logger
) {

    private val activeProcesses = ConcurrentHashMap<String, RuntimeProcess>()

    // Listener for process lifecycle updates
    var onProcessStateChanged: ((appId: String, status: String, exitCode: Int?) -> Unit)? = null

    fun detectRuntime(): RuntimeInfo {
        return validator.getRuntimeInfo()
    }

    fun validateRuntime(): RuntimeValidationResult {
        return validator.validate()
    }

    fun runtimeVersion(): String {
        val info = detectRuntime()
        return info.runtimeVersion
    }

    fun supportedArchitectures(): List<String> {
        val info = detectRuntime()
        return info.supportedArchitectures
    }

    fun createPrefix(appId: String): File {
        return prefixManager.createPrefix(appId)
    }

    fun deletePrefix(appId: String): Boolean {
        return prefixManager.deletePrefix(appId)
    }

    fun getProcessStatus(appId: String): RuntimeProcess? {
        val proc = activeProcesses[appId]
        return if (proc != null && proc.isAlive()) proc else null
    }

    fun getAllRunningProcesses(): List<RuntimeProcess> {
        return activeProcesses.values.filter { it.isAlive() }
    }

    /**
     * Spawns an executable inside the designated compatibility runtime using ProcessBuilder.
     * Never constructs unsafe shell commands.
     */
    fun launchProcess(app: WinApp, extraArgs: List<String> = emptyList()): ProcessLaunchResult {
        val appId = app.id
        logger.logRuntime(appId, "Initiating launch sequence for app: ${app.displayName} (${app.architecture})")

        // Check if already running
        val existing = activeProcesses[appId]
        if (existing != null && existing.isAlive()) {
            logger.logRuntime(appId, "Application is already running with PID ${existing.pid}")
            return ProcessLaunchResult.Success(appId, existing.pid, existing.process)
        }

        // Validate runtime readiness
        val validation = validator.validate()
        if (!validation.isValid) {
            val reason = validation.errors.firstOrNull() ?: "Windows compatibility runtime is not installed for ${Build.SUPPORTED_ABIS.joinToString()}."
            logger.logRuntime(appId, "Launch blocked: $reason")
            return ProcessLaunchResult.Failure(
                reason = "Windows Compatibility Runtime Unavailable: $reason. " +
                        "Wine and Box64 binaries must be installed in ${storageManager.runtimeDir.absolutePath}.",
                errorCode = "RUNTIME_UNAVAILABLE",
                logPath = File(storageManager.logsDir, "$appId/runtime.log").absolutePath
            )
        }

        val execPath = app.executablePath
        if (execPath.isNullOrEmpty()) {
            return ProcessLaunchResult.Failure(
                reason = "Executable path is not configured for application $appId.",
                errorCode = "MISSING_EXECUTABLE"
            )
        }

        val targetExecutable = File(execPath)
        if (!targetExecutable.exists()) {
            return ProcessLaunchResult.Failure(
                reason = "Executable file not found at: $execPath",
                errorCode = "EXECUTABLE_NOT_FOUND"
            )
        }

        // Ensure prefix exists
        val prefixDir = prefixManager.getPrefixPath(appId).apply { if (!exists()) prefixManager.createPrefix(appId) }

        // Determine runtime commands based on architecture
        val wineBinary = validator.getWineBinary()
            ?: return ProcessLaunchResult.Failure("Wine binary is not available.", "WINE_MISSING")
        val box64Binary = validator.getBox64Binary()
        val box86Binary = validator.getBox86Binary()

        val commandList = mutableListOf<String>()

        when (app.architecture.lowercase()) {
            "x64", "amd64" -> {
                if (box64Binary == null || !box64Binary.exists()) {
                    return ProcessLaunchResult.Failure(
                        "Box64 translation engine is missing. Required for 64-bit Windows applications on ARM64.",
                        "BOX64_MISSING"
                    )
                }
                commandList.add(box64Binary.absolutePath)
                commandList.add(wineBinary.absolutePath)
            }
            "x86", "i386" -> {
                if (box86Binary != null && box86Binary.exists()) {
                    commandList.add(box86Binary.absolutePath)
                } else if (box64Binary != null && box64Binary.exists()) {
                    // Box64 may support x86 in some multi-arch configurations
                    commandList.add(box64Binary.absolutePath)
                } else {
                    return ProcessLaunchResult.Failure(
                        "Box86 translation engine is missing. Required for 32-bit x86 Windows applications.",
                        "BOX86_MISSING"
                    )
                }
                commandList.add(wineBinary.absolutePath)
            }
            "arm64" -> {
                // Native ARM64 Wine execution
                commandList.add(wineBinary.absolutePath)
            }
            "msi" -> {
                if (box64Binary != null && box64Binary.exists()) {
                    commandList.add(box64Binary.absolutePath)
                }
                commandList.add(wineBinary.absolutePath)
                commandList.add("msiexec.exe")
                commandList.add("/i")
            }
            else -> {
                // Default to box64 + wine if on ARM64
                if (box64Binary != null && box64Binary.exists()) {
                    commandList.add(box64Binary.absolutePath)
                }
                commandList.add(wineBinary.absolutePath)
            }
        }

        commandList.add(targetExecutable.absolutePath)
        commandList.addAll(app.arguments)
        commandList.addAll(extraArgs)

        logger.logRuntime(appId, "Preparing process invocation with arguments: ${commandList.joinToString(" ")}")

        try {
            val processBuilder = ProcessBuilder(commandList)

            // Setup working directory safely
            val workingDir = if (app.workingDirectory.isNotEmpty()) {
                val f = File(app.workingDirectory)
                if (f.exists() && f.isDirectory) f else targetExecutable.parentFile ?: prefixDir
            } else {
                targetExecutable.parentFile ?: prefixDir
            }
            processBuilder.directory(workingDir)

            // Setup isolated environment variables
            val env = processBuilder.environment()
            env["WINEPREFIX"] = prefixDir.absolutePath
            env["WINEDEBUG"] = "-all,err+all"
            env["BOX64_LOG"] = "1"
            env["BOX86_LOG"] = "1"
            env["TMPDIR"] = File(prefixDir, "temp").apply { if (!exists()) mkdirs() }.absolutePath
            val libDir = File(storageManager.runtimeDir, "libraries")
            val existingLd = env["LD_LIBRARY_PATH"] ?: ""
            env["LD_LIBRARY_PATH"] = "${libDir.absolutePath}:${context.applicationInfo.nativeLibraryDir}:$existingLd"

            val process = processBuilder.start()
            val pid = extractPid(process)

            logger.logRuntime(appId, "Process spawned successfully. PID=$pid")

            val runtimeProcess = RuntimeProcess(
                applicationId = appId,
                process = process,
                pid = pid,
                logger = logger,
                onProcessTerminated = { id, exitCode, crashed ->
                    activeProcesses.remove(id)
                    val status = if (crashed) "crashed" else "stopped"
                    onProcessStateChanged?.invoke(id, status, exitCode)
                }
            )

            activeProcesses[appId] = runtimeProcess
            onProcessStateChanged?.invoke(appId, "running", null)

            return ProcessLaunchResult.Success(appId, pid, process)

        } catch (e: Exception) {
            logger.logRuntime(appId, "Execution failed: ${e.message}")
            return ProcessLaunchResult.Failure(
                reason = "Failed to launch process: ${e.message}",
                errorCode = "PROCESS_SPAWN_FAILED",
                logPath = File(storageManager.logsDir, "$appId/runtime.log").absolutePath
            )
        }
    }

    private fun extractPid(process: Process): Long {
        return try {
            // Android API 26+ Process pid reflection or getPid
            val method = process.javaClass.getMethod("pid")
            (method.invoke(process) as? Number)?.toLong() ?: -1L
        } catch (e: Exception) {
            try {
                val field: Field = process.javaClass.getDeclaredField("pid")
                field.isAccessible = true
                field.getLong(process)
            } catch (e2: Exception) {
                System.currentTimeMillis() % 100000
            }
        }
    }

    fun stopProcess(appId: String): Boolean {
        val proc = activeProcesses[appId] ?: return false
        return proc.stop()
    }

    fun forceStopProcess(appId: String): Boolean {
        val proc = activeProcesses[appId] ?: return false
        return proc.forceStop()
    }

    fun collectLogs(appId: String): Map<String, String> {
        return logger.getAppLogs(appId)
    }
}
