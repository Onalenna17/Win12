package com.win12.storage

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.OpenableColumns
import android.util.Log
import com.win12.logging.Win12Logger
import com.win12.security.PermissionManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Manages sandboxed application storage and virtual Windows paths.
 * Also bridges to native, all-files shared device storage (mapped as a second "drive")
 * when the user has granted full storage access.
 */
class StorageManager(
    private val context: Context,
    private val logger: Win12Logger
) {

    val rootDir: File = context.filesDir

    val applicationsDir = File(rootDir, "applications").apply { if (!exists()) mkdirs() }
    val prefixesDir = File(rootDir, "prefixes").apply { if (!exists()) mkdirs() }
    val desktopDir = File(rootDir, "desktop").apply { if (!exists()) mkdirs() }
    val downloadsDir = File(rootDir, "downloads").apply { if (!exists()) mkdirs() }
    val documentsDir = File(rootDir, "documents").apply { if (!exists()) mkdirs() }
    val runtimeDir = File(rootDir, "runtime").apply { if (!exists()) mkdirs() }
    val registryDir = File(rootDir, "registry").apply { if (!exists()) mkdirs() }
    val virtualCDir = File(rootDir, "virtual_c").apply { if (!exists()) mkdirs() }
    val logsDir = File(rootDir, "logs").apply { if (!exists()) mkdirs() }

    /** Real, native shared device storage root (e.g. /storage/emulated/0). */
    val sharedStorageRoot: File = Environment.getExternalStorageDirectory()

    private val permissionManager = PermissionManager(context)

    init {
        initDefaultStorage()
    }

    private fun initDefaultStorage() {
        // Create runtime subdirectories
        listOf("wine", "box64", "box86", "libraries", "configs").forEach {
            File(runtimeDir, it).apply { if (!exists()) mkdirs() }
        }

        // Create sample desktop shortcuts / readme in documents
        val readme = File(documentsDir, "Welcome to Win12.txt")
        if (!readme.exists()) {
            readme.writeText(
                "Welcome to Win12 for Android!\n\n" +
                "Win12 is a native Windows desktop environment and compatibility runtime framework.\n" +
                "- Install Windows .exe and .msi applications through the Installer wizard.\n" +
                "- Manage compatibility runtimes (Wine, Box64, Box86) under Settings > Runtime.\n" +
                "- Browse your isolated files and simulated Windows drives via File Explorer.\n" +
                "\nSystem Architecture: Android Native Host + Win12 Desktop + Wine/Box Translation Layer.\n"
            )
        }
    }

    /**
     * Resolves a virtual "E:\..." path into the real, native shared storage location.
     * Guards against traversal escaping the shared storage root itself.
     */
    fun resolveSharedPath(virtualPath: String): File {
        val normalized = virtualPath.replace('/', '\\').trim()
        val withoutDrive = when {
            normalized.startsWith("E:\\", ignoreCase = true) -> normalized.substring(3)
            normalized.startsWith("E:", ignoreCase = true) -> normalized.substring(2)
            else -> normalized
        }
        val parts = withoutDrive.split('\\').filter { it.isNotEmpty() }
        val resolved = if (parts.isEmpty()) {
            sharedStorageRoot
        } else {
            File(sharedStorageRoot, parts.joinToString(File.separator))
        }
        if (!isPathSafe(sharedStorageRoot, resolved)) {
            throw SecurityException("Shared storage path escaped sandbox: $virtualPath")
        }
        return resolved
    }

    /**
     * Lists a directory under the native shared device storage drive (E:). Requires the
     * user to have granted All Files Access; returns an empty, flagged listing otherwise.
     */
    fun listSharedStorageDirectory(virtualPath: String): JSONObject {
        val response = JSONObject()
        val itemsArray = JSONArray()
        response.put("currentPath", virtualPath)

        if (!permissionManager.hasAllFilesAccess()) {
            response.put("items", itemsArray)
            response.put("permissionRequired", true)
            return response
        }

        val realDir = try {
            resolveSharedPath(virtualPath)
        } catch (e: SecurityException) {
            response.put("items", itemsArray)
            response.put("error", e.message)
            return response
        }

        if (!realDir.exists()) {
            response.put("items", itemsArray)
            return response
        }

        val files = realDir.listFiles() ?: emptyArray()
        for (f in files) {
            val item = JSONObject()
            item.put("name", f.name)
            item.put("type", if (f.isDirectory) "directory" else "file")
            item.put(
                "path",
                "E:\\" + sharedStorageRoot.toURI().relativize(f.toURI()).path
                    .replace('/', '\\')
                    .trimEnd('\\')
            )
            item.put("size", if (f.isDirectory) 0 else f.length())
            item.put("modified", f.lastModified())
            item.put("extension", f.extension.lowercase())

            // FIXED: use '||' instead of a comma in a subject-less 'when'
            item.put("icon", when {
                f.isDirectory -> "folder"
                f.extension.equals("exe", ignoreCase = true) -> "exe"
                f.extension.equals("msi", ignoreCase = true) -> "msi"
                f.extension.equals("txt", ignoreCase = true) -> "text"
                f.extension.equals("jpg", ignoreCase = true) ||
                    f.extension.equals("png", ignoreCase = true) -> "image"
                else -> "file"
            })
            itemsArray.put(item)
        }

        response.put("items", itemsArray)
        response.put("permissionRequired", false)
        return response
    }

    /**
     * Prevents directory traversal attacks.
     */
    fun isPathSafe(targetFile: File): Boolean {
        return isPathSafe(rootDir, targetFile)
    }

    fun isPathSafe(baseDir: File, targetFile: File): Boolean {
        return try {
            val canonicalBase = baseDir.canonicalPath
            val canonicalTarget = targetFile.canonicalPath
            canonicalTarget.startsWith(canonicalBase)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Extracts filename from a content Uri safely.
     */
    fun getFileNameFromUri(uri: Uri): String {
        var result: String? = null
        if (uri.scheme == "content") {
            try {
                context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                        if (index != -1) {
                            result = cursor.getString(index)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w("StorageManager", "Error resolving Uri display name: ${e.message}")
            }
        }
        if (result == null) {
            result = uri.path
            val cut = result?.lastIndexOf('/')
            if (cut != null && cut != -1) {
                result = result?.substring(cut + 1)
            }
        }
        return sanitizeFileName(result ?: "unnamed_file.exe")
    }

    fun sanitizeFileName(rawName: String): String {
        val sanitized = rawName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        return if (sanitized.isEmpty()) "application.exe" else sanitized
    }

    /**
     * Copies a file from an Android SAF content URI into Win12 private application storage.
     */
    fun copyFromUri(uri: Uri, targetDir: File, targetFileName: String): File {
        if (!isPathSafe(rootDir, targetDir)) {
            throw SecurityException("Illegal path traversal attempt: ${targetDir.absolutePath}")
        }
        if (!targetDir.exists()) targetDir.mkdirs()

        val safeName = sanitizeFileName(targetFileName)
        val destinationFile = File(targetDir, safeName)

        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(destinationFile).use { output ->
                val buffer = ByteArray(64 * 1024)
                var bytesRead: Int
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                }
            }
        } ?: throw IllegalStateException("Could not open input stream for Uri: $uri")

        logger.logSystem(
            "StorageManager",
            "Copied file to ${destinationFile.absolutePath} (${destinationFile.length()} bytes)"
        )
        return destinationFile
    }

    /**
     * Maps virtual Windows paths into real sandboxed directories.
     */
    fun resolveVirtualPath(virtualPath: String): File {
        val normalized = virtualPath.replace('/', '\\').trim()
        val pathWithoutDrive = if (normalized.startsWith("C:\\", ignoreCase = true)) {
            normalized.substring(3)
        } else if (normalized.startsWith("C:", ignoreCase = true)) {
            normalized.substring(2)
        } else {
            normalized.removePrefix("\\")
        }

        val parts = pathWithoutDrive.split('\\').filter { it.isNotEmpty() }
        if (parts.isEmpty()) {
            return File(rootDir, "virtual_c")
        }

        val top = parts[0].lowercase()
        val remaining = parts.drop(1).joinToString(File.separator)

        val baseDir = when (top) {
            "windows" -> File(File(rootDir, "virtual_c"), "Windows")
            "program files" -> File(File(rootDir, "virtual_c"), "Program Files")
            "program files (x86)" -> File(File(rootDir, "virtual_c"), "Program Files (x86)")
            "users" -> File(File(rootDir, "virtual_c"), "Users")
            "win12apps" -> applicationsDir
            "downloads" -> downloadsDir
            "documents" -> documentsDir
            "desktop" -> desktopDir
            else -> File(File(rootDir, "virtual_c"), parts[0])
        }

        val resolved = if (remaining.isNotEmpty()) File(baseDir, remaining) else baseDir
        if (!isPathSafe(rootDir, resolved)) {
            throw SecurityException("Virtual path escaped sandbox: $virtualPath")
        }
        return resolved
    }

    /**
     * Lists directory items formatted for the Win12 File Explorer.
     */
    fun listVirtualDirectory(virtualPath: String): JSONObject {
        val response = JSONObject()
        val itemsArray = JSONArray()

        val normalized = virtualPath.replace('/', '\\').trim()
        response.put("currentPath", normalized)

        if (normalized.equals("This PC", ignoreCase = true) || normalized.isEmpty()) {
            // Root "This PC" view
            val cDrive = JSONObject().apply {
                put("name", "Local Disk (C:)")
                put("type", "drive")
                put("path", "C:\\")
                put("size", getStorageBreakdown().optLong("freeBytes"))
                put("icon", "drive")
            }
            itemsArray.put(cDrive)

            // Native shared device storage, exposed only once the user has granted
            // full "All Files Access" (or legacy read/write on older devices).
            if (permissionManager.hasAllFilesAccess()) {
                val sharedDrive = JSONObject().apply {
                    put("name", "Device Storage (E:)")
                    put("type", "drive")
                    put("path", "E:\\")
                    put("size", sharedStorageRoot.freeSpace)
                    put("icon", "drive-removable")
                }
                itemsArray.put(sharedDrive)
            } else {
                val lockedDrive = JSONObject().apply {
                    put("name", "Device Storage (E:) - Permission Required")
                    put("type", "drive-locked")
                    put("path", "E:\\")
                    put("size", 0)
                    put("icon", "drive-locked")
                }
                itemsArray.put(lockedDrive)
            }

            response.put("items", itemsArray)
            return response
        }

        if (normalized.equals("E:\\", ignoreCase = true) ||
            normalized.equals("E:", ignoreCase = true) ||
            normalized.startsWith("E:\\", ignoreCase = true) ||
            normalized.startsWith("E:", ignoreCase = true)
        ) {
            return listSharedStorageDirectory(normalized)
        }

        if (normalized.equals("C:\\", ignoreCase = true) ||
            normalized.equals("C:", ignoreCase = true)
        ) {
            // Standard C: drive folders
            val defaultFolders = listOf(
                "Windows" to "folder-system",
                "Program Files" to "folder-app",
                "Program Files (x86)" to "folder-app",
                "Users" to "folder-user",
                "Win12Apps" to "folder-wine",
                "Downloads" to "folder-download",
                "Documents" to "folder-doc",
                "Desktop" to "folder-desktop"
            )
            defaultFolders.forEach { (name, icon) ->
                val folderObj = JSONObject().apply {
                    put("name", name)
                    put("type", "directory")
                    put("path", "C:\\$name")
                    put("size", 0)
                    put("icon", icon)
                    put("modified", System.currentTimeMillis())
                }
                itemsArray.put(folderObj)
            }
            response.put("items", itemsArray)
            return response
        }

        val realDir = resolveVirtualPath(virtualPath)
        if (!realDir.exists()) realDir.mkdirs()

        val files = realDir.listFiles() ?: emptyArray()
        for (f in files) {
            val item = JSONObject()
            item.put("name", f.name)
            item.put("type", if (f.isDirectory) "directory" else "file")
            item.put("path", "$normalized\\${f.name}".replace("\\\\", "\\"))
            item.put("size", if (f.isDirectory) 0 else f.length())
            item.put("modified", f.lastModified())
            item.put("extension", f.extension.lowercase())
            item.put("icon", when {
                f.isDirectory -> "folder"
                f.extension.equals("exe", ignoreCase = true) -> "exe"
                f.extension.equals("msi", ignoreCase = true) -> "msi"
                f.extension.equals("txt", ignoreCase = true) -> "text"
                f.extension.equals("log", ignoreCase = true) -> "log"
                f.extension.equals("json", ignoreCase = true) -> "code"
                else -> "file"
            })
            itemsArray.put(item)
        }

        response.put("items", itemsArray)
        return response
    }

    fun createVirtualFolder(parentVirtualPath: String, folderName: String): Boolean {
        val normalizedParent = parentVirtualPath.replace('/', '\\').trim()
        if (normalizedParent.startsWith("E:", ignoreCase = true)) {
            if (!permissionManager.hasAllFilesAccess()) return false
            return try {
                val safeName = sanitizeFileName(folderName)
                val parent = resolveSharedPath(normalizedParent)
                val newDir = File(parent, safeName)
                if (isPathSafe(sharedStorageRoot, newDir)) newDir.mkdirs() else false
            } catch (e: Exception) {
                false
            }
        }
        return try {
            val safeName = sanitizeFileName(folderName)
            val parent = resolveVirtualPath(parentVirtualPath)
            val newDir = File(parent, safeName)
            if (isPathSafe(rootDir, newDir)) {
                newDir.mkdirs()
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    fun deleteVirtualFile(virtualPath: String): Boolean {
        val normalized = virtualPath.replace('/', '\\').trim()
        if (normalized.startsWith("E:", ignoreCase = true)) {
            if (!permissionManager.hasAllFilesAccess()) return false
            return try {
                val target = resolveSharedPath(normalized)
                if (isPathSafe(sharedStorageRoot, target) && target.exists()) {
                    target.deleteRecursively()
                } else {
                    false
                }
            } catch (e: Exception) {
                false
            }
        }
        return try {
            val target = resolveVirtualPath(virtualPath)
            if (isPathSafe(rootDir, target) && target.exists()) {
                target.deleteRecursively()
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    fun getStorageBreakdown(): JSONObject {
        val totalSpace = rootDir.totalSpace
        val freeSpace = rootDir.freeSpace
        val usedSpace = totalSpace - freeSpace

        fun dirSize(dir: File): Long {
            var size = 0L
            dir.walkTopDown().forEach {
                if (it.isFile) size += it.length()
            }
            return size
        }

        val appsSize = dirSize(applicationsDir)
        val prefixesSize = dirSize(prefixesDir)
        val runtimeSize = dirSize(runtimeDir)
        val logsSize = dirSize(logsDir)

        return JSONObject().apply {
            put("totalBytes", totalSpace)
            put("freeBytes", freeSpace)
            put("usedBytes", usedSpace)
            put("totalTracked", appsSize + prefixesSize + runtimeSize + logsSize)
            put("appsBytes", appsSize)
            put("prefixesBytes", prefixesSize)
            put("runtimeBytes", runtimeSize)
            put("downloadsBytes", dirSize(downloadsDir))
            put("documentsBytes", dirSize(documentsDir))
            put("logsBytes", logsSize)
        }
    }
}