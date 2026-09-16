package com.win12.runtime

import android.content.Context
import com.win12.logging.Win12Logger
import com.win12.storage.StorageManager
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Manages isolated Wine prefixes for applications to prevent interference and sandbox state.
 */
class PrefixManager(
    private val context: Context,
    private val storageManager: StorageManager,
    private val logger: Win12Logger
) {

    fun getPrefixPath(appId: String): File {
        val safeAppId = appId.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        return File(storageManager.prefixesDir, safeAppId)
    }

    /**
     * Initializes an isolated Wine prefix structure.
     */
    fun createPrefix(appId: String): File {
        val prefixDir = getPrefixPath(appId)
        if (!prefixDir.exists()) prefixDir.mkdirs()

        // Create standard Wine/Windows drive_c directories
        val driveC = File(prefixDir, "drive_c").apply { if (!exists()) mkdirs() }
        val windowsDir = File(driveC, "windows").apply { if (!exists()) mkdirs() }
        File(windowsDir, "system32").apply { if (!exists()) mkdirs() }
        File(windowsDir, "syswow64").apply { if (!exists()) mkdirs() }

        val progFiles = File(driveC, "Program Files").apply { if (!exists()) mkdirs() }
        val progFilesX86 = File(driveC, "Program Files (x86)").apply { if (!exists()) mkdirs() }
        val users = File(driveC, "users").apply { if (!exists()) mkdirs() }
        val winUser = File(users, "win12user").apply { if (!exists()) mkdirs() }
        File(winUser, "Desktop").apply { if (!exists()) mkdirs() }
        File(winUser, "Documents").apply { if (!exists()) mkdirs() }
        File(winUser, "Downloads").apply { if (!exists()) mkdirs() }

        // dosdevices directory
        val dosdevices = File(prefixDir, "dosdevices").apply { if (!exists()) mkdirs() }

        // Initialize metadata.json
        val metadataFile = File(prefixDir, "metadata.json")
        if (!metadataFile.exists()) {
            val meta = JSONObject().apply {
                put("appId", appId)
                put("created", System.currentTimeMillis())
                put("status", "initialized")
                put("driveC", driveC.absolutePath)
                put("version", "Win12-Wine-1.0")
            }
            metadataFile.writeText(meta.toString(2))
        }

        // Initialize placeholder registry files if not present
        val systemReg = File(prefixDir, "system.reg")
        if (!systemReg.exists()) {
            systemReg.writeText("WINE REGISTRY Version 2\n;; Win12 System Registry Hive\n\n")
        }
        val userReg = File(prefixDir, "user.reg")
        if (!userReg.exists()) {
            userReg.writeText("WINE REGISTRY Version 2\n;; Win12 User Registry Hive\n\n")
        }

        logger.logRuntime(appId, "Isolated prefix created at: ${prefixDir.absolutePath}")
        return prefixDir
    }

    /**
     * Resets a prefix to a clean initial state.
     */
    fun resetPrefix(appId: String): Boolean {
        return try {
            val prefixDir = getPrefixPath(appId)
            if (prefixDir.exists()) {
                prefixDir.deleteRecursively()
            }
            createPrefix(appId)
            logger.logRuntime(appId, "Prefix successfully reset.")
            true
        } catch (e: Exception) {
            logger.logRuntime(appId, "Failed to reset prefix: ${e.message}")
            false
        }
    }

    /**
     * Verifies and restores missing prefix folder structures.
     */
    fun repairPrefix(appId: String): Boolean {
        return try {
            val prefixDir = getPrefixPath(appId)
            if (!prefixDir.exists()) {
                createPrefix(appId)
            } else {
                val driveC = File(prefixDir, "drive_c")
                if (!driveC.exists()) driveC.mkdirs()
                File(driveC, "windows/system32").mkdirs()
                File(driveC, "Program Files").mkdirs()
                File(driveC, "Program Files (x86)").mkdirs()
                File(driveC, "users/win12user/Desktop").mkdirs()
                File(prefixDir, "dosdevices").mkdirs()
            }
            logger.logRuntime(appId, "Prefix integrity repaired.")
            true
        } catch (e: Exception) {
            logger.logRuntime(appId, "Prefix repair failed: ${e.message}")
            false
        }
    }

    /**
     * Creates a zip backup of the prefix.
     */
    fun backupPrefix(appId: String): File? {
        val prefixDir = getPrefixPath(appId)
        if (!prefixDir.exists()) return null

        val backupDir = File(storageManager.rootDir, "backups").apply { if (!exists()) mkdirs() }
        val backupFile = File(backupDir, "${appId}_backup_${System.currentTimeMillis()}.zip")

        return try {
            ZipOutputStream(FileOutputStream(backupFile)).use { zipOut ->
                prefixDir.walkTopDown().forEach { file ->
                    val relativePath = prefixDir.toURI().relativize(file.toURI()).path
                    if (file.isDirectory) {
                        if (relativePath.isNotEmpty()) {
                            zipOut.putNextEntry(ZipEntry(if (relativePath.endsWith("/")) relativePath else "$relativePath/"))
                            zipOut.closeEntry()
                        }
                    } else {
                        zipOut.putNextEntry(ZipEntry(relativePath))
                        FileInputStream(file).use { input -> input.copyTo(zipOut) }
                        zipOut.closeEntry()
                    }
                }
            }
            logger.logRuntime(appId, "Prefix backup created at: ${backupFile.absolutePath}")
            backupFile
        } catch (e: Exception) {
            logger.logRuntime(appId, "Backup failed: ${e.message}")
            null
        }
    }

    /**
     * Deletes an isolated prefix.
     */
    fun deletePrefix(appId: String): Boolean {
        val prefixDir = getPrefixPath(appId)
        return try {
            if (prefixDir.exists()) {
                prefixDir.deleteRecursively()
            }
            logger.logRuntime(appId, "Prefix removed.")
            true
        } catch (e: Exception) {
            logger.logRuntime(appId, "Failed to delete prefix: ${e.message}")
            false
        }
    }
}
