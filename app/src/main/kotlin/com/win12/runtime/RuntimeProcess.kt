package com.win12.runtime

import com.win12.logging.Win12Logger
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Encapsulates an active OS runtime process with safe I/O streaming, state tracking, and lifecycle management.
 */
class RuntimeProcess(
    val applicationId: String,
    val process: Process,
    val pid: Long,
    val startTime: Long = System.currentTimeMillis(),
    private val logger: Win12Logger,
    private val onProcessTerminated: (appId: String, exitCode: Int, crashed: Boolean) -> Unit
) {

    @Volatile
    var status: String = "RUNNING"
        private set

    val exitCode = AtomicInteger(-1)
    private val isStopping = AtomicBoolean(false)

    init {
        startStreamReaders()
        startExitWatcher()
    }

    private fun startStreamReaders() {
        // Read stdout safely
        Thread({
            try {
                BufferedReader(InputStreamReader(process.inputStream)).use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        line?.let { logger.appendStdout(applicationId, it) }
                    }
                }
            } catch (e: Exception) {
                logger.appendStdout(applicationId, "[Stream Closed]: ${e.message}")
            }
        }, "Win12-Stdout-$applicationId").start()

        // Read stderr safely
        Thread({
            try {
                BufferedReader(InputStreamReader(process.errorStream)).use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        line?.let { logger.appendStderr(applicationId, it) }
                    }
                }
            } catch (e: Exception) {
                logger.appendStderr(applicationId, "[Stream Closed]: ${e.message}")
            }
        }, "Win12-Stderr-$applicationId").start()
    }

    private fun startExitWatcher() {
        Thread({
            try {
                val code = process.waitFor()
                exitCode.set(code)
                val crashed = code != 0 && !isStopping.get()
                status = if (crashed) "CRASHED" else "STOPPED"

                logger.logRuntime(
                    applicationId,
                    "Process terminated with exit code $code. Status=$status (Duration: ${(System.currentTimeMillis() - startTime) / 1000}s)"
                )
                onProcessTerminated(applicationId, code, crashed)
            } catch (e: InterruptedException) {
                status = "STOPPED"
                exitCode.set(-1)
                onProcessTerminated(applicationId, -1, false)
            }
        }, "Win12-Watcher-$applicationId").start()
    }

    fun isAlive(): Boolean {
        return try {
            process.isAlive
        } catch (e: Exception) {
            false
        }
    }

    fun stop(): Boolean {
        isStopping.set(true)
        status = "STOPPING"
        logger.logRuntime(applicationId, "Requesting graceful process termination (SIGTERM)...")
        return try {
            process.destroy()
            true
        } catch (e: Exception) {
            logger.logRuntime(applicationId, "Graceful stop failed: ${e.message}")
            false
        }
    }

    fun forceStop(): Boolean {
        isStopping.set(true)
        status = "STOPPING"
        logger.logRuntime(applicationId, "Forcibly killing process (SIGKILL)...")
        return try {
            process.destroyForcibly()
            true
        } catch (e: Exception) {
            logger.logRuntime(applicationId, "Force kill failed: ${e.message}")
            false
        }
    }

    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("applicationId", applicationId)
            put("pid", pid)
            put("startTime", startTime)
            put("status", status)
            put("isAlive", isAlive())
            put("exitCode", if (exitCode.get() == -1 && isAlive()) JSONObject.NULL else exitCode.get())
        }
    }
}
