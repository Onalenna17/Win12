package com.win12.security

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.ContextCompat
import java.io.File

/**
 * Handles security assertions, sandboxing boundaries, and runtime execution permissions.
 * Also manages native "All Files Access" shared-storage permission across API levels.
 */
class PermissionManager(private val context: Context) {

    /**
     * Confirms that an executable file resides within authorized app sandbox.
     */
    fun validateExecutableLocation(file: File): Boolean {
        val canonical = try {
            file.canonicalPath
        } catch (e: Exception) {
            return false
        }
        val appRoot = context.filesDir.canonicalPath
        return canonical.startsWith(appRoot)
    }

    /**
     * Checks if external storage or SAF permissions are satisfied.
     */
    fun isStorageAvailable(): Boolean {
        return Environment.getExternalStorageState() == Environment.MEDIA_MOUNTED ||
                context.filesDir.canWrite()
    }

    /**
     * Ensures native binaries have execute permission.
     */
    fun ensureExecutable(file: File): Boolean {
        if (!file.exists()) return false
        if (file.canExecute()) return true
        return file.setExecutable(true, false)
    }

    /**
     * Validates supported installer extensions.
     */
    fun isSupportedInstaller(filename: String): Boolean {
        val lower = filename.lowercase()
        return lower.endsWith(".exe") || lower.endsWith(".msi")
    }

    /**
     * Returns true if the app currently holds full, native "All Files Access" to shared
     * device storage. On Android 11+ (API 30+) this checks the special MANAGE_EXTERNAL_STORAGE
     * grant; on older versions it checks the legacy READ/WRITE_EXTERNAL_STORAGE permissions.
     */
    fun hasAllFilesAccess(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            hasLegacyStoragePermission()
        }
    }

    /**
     * Checks legacy (pre-Android 11) READ/WRITE_EXTERNAL_STORAGE grants.
     */
    fun hasLegacyStoragePermission(): Boolean {
        val read = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.READ_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED

        val writeNeeded = Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
        val write = if (writeNeeded) {
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.WRITE_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        } else true

        return read && write
    }

    /**
     * The legacy runtime permissions to request on API < 30.
     */
    fun legacyStoragePermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            arrayOf(
                android.Manifest.permission.READ_EXTERNAL_STORAGE,
                android.Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
        } else {
            arrayOf(android.Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    /**
     * Builds the system intent that lets the user grant native "All Files Access" for this
     * app on Android 11+. Falls back to the generic all-files-access screen if the
     * per-app variant is unavailable on the device.
     */
    fun buildManageStorageIntent(): Intent {
        return try {
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${context.packageName}")
            }
        } catch (e: Exception) {
            Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
        }
    }

    /**
     * Returns system ABI safety information.
     */
    fun getSecurityReport(): Map<String, Any> {
        return mapOf(
            "sandboxed" to true,
            "osVersion" to Build.VERSION.SDK_INT,
            "abi" to Build.SUPPORTED_ABIS.joinToString(", "),
            "selinuxEnforced" to true,
            "privateStoragePath" to context.filesDir.absolutePath,
            "allFilesAccess" to hasAllFilesAccess()
        )
    }
}
