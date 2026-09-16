package com.win12.logging

import android.content.Context
import android.util.Log
import java.io.File
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Manages isolated and system-wide logging for Win12.
 */
class Win12Logger(private val context: Context) {

    private val logsDir: File by lazy {
        File(context.filesDir, "logs").apply { if (!exists()) mkdirs() }
    }

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

    private fun timestamp(): String = dateFormat.format(Date())

    private fun getAppLogDir(appId: String): File {
        val safeAppId = appId.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val dir = File(logsDir, safeAppId)
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    @Synchronized
    fun logSystem(tag: String, message: String) {
        val logLine = "[${timestamp()}] [$tag] $message\n"
        Log.i("Win12System", "[$tag] $message")
        val systemLog = File(logsDir, "system.log")
        appendToFile(systemLog, logLine)
    }

    @Synchronized
    fun logInstaller(appId: String, message: String) {
        val logLine = "[${timestamp()}] [INSTALLER] $message\n"
        Log.i("Win12Installer", "[$appId] $message")
        val file = File(getAppLogDir(appId), "installer.log")
        appendToFile(file, logLine)
    }

    @Synchronized
    fun logRuntime(appId: String, message: String) {
        val logLine = "[${timestamp()}] [RUNTIME] $message\n"
        Log.i("Win12Runtime", "[$appId] $message")
        val file = File(getAppLogDir(appId), "runtime.log")
        appendToFile(file, logLine)
    }

    @Synchronized
    fun appendStdout(appId: String, line: String) {
        val file = File(getAppLogDir(appId), "stdout.log")
        appendToFile(file, line + "\n")
    }

    @Synchronized
    fun appendStderr(appId: String, line: String) {
        val file = File(getAppLogDir(appId), "stderr.log")
        appendToFile(file, line + "\n")
    }

    private fun appendToFile(file: File, text: String) {
        try {
            FileWriter(file, true).use { it.write(text) }
        } catch (e: Exception) {
            Log.e("Win12Logger", "Failed to write log to ${file.name}: ${e.message}")
        }
    }

    fun getAppLogs(appId: String): Map<String, String> {
        val dir = getAppLogDir(appId)
        val result = mutableMapOf<String, String>()
        val files = listOf("installer.log", "runtime.log", "stdout.log", "stderr.log")
        for (fName in files) {
            val file = File(dir, fName)
            result[fName] = if (file.exists()) {
                try {
                    file.readText()
                } catch (e: Exception) {
                    "Error reading log: ${e.message}"
                }
            } else {
                "(No logs recorded)"
            }
        }
        return result
    }

    fun getSystemLog(): String {
        val systemLog = File(logsDir, "system.log")
        return if (systemLog.exists()) {
            try {
                systemLog.readText()
            } catch (e: Exception) {
                "Error reading system log: ${e.message}"
            }
        } else {
            "Win12 Desktop System Initialized.\n"
        }
    }

    fun clearAppLogs(appId: String): Boolean {
        val dir = getAppLogDir(appId)
        return try {
            dir.listFiles()?.forEach { it.delete() }
            true
        } catch (e: Exception) {
            false
        }
    }

    fun clearAllLogs(): Boolean {
        return try {
            logsDir.deleteRecursively()
            logsDir.mkdirs()
            true
        } catch (e: Exception) {
            false
        }
    }
}
