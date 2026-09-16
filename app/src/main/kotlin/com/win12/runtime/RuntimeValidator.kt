package com.win12.runtime

import android.content.Context
import android.os.Build
import com.win12.logging.Win12Logger
import com.win12.storage.StorageManager
import java.io.File

/**
 * Validates the Windows compatibility runtime components (Wine, Box64, Box86).
 * Ensures binaries exist, have executable bits set, and match system architecture.
 */
class RuntimeValidator(
    private val context: Context,
    private val storageManager: StorageManager,
    private val logger: Win12Logger
) {

    fun detectSystemArchitecture(): String {
        val primaryAbi = if (Build.SUPPORTED_ABIS.isNotEmpty()) Build.SUPPORTED_ABIS[0] else System.getProperty("os.arch") ?: "unknown"
        return primaryAbi.lowercase()
    }

    fun isArm64Device(): Boolean {
        val arch = detectSystemArchitecture()
        return arch.contains("arm64") || arch.contains("aarch64")
    }

    fun getWineBinary(): File? {
        val runtimeDir = storageManager.runtimeDir
        val candidates = listOf(
            File(runtimeDir, "wine/bin/wine"),
            File(runtimeDir, "wine/bin/wine64"),
            File(runtimeDir, "wine/wine"),
            File(context.applicationInfo.nativeLibraryDir, "libwine.so")
        )
        return candidates.firstOrNull { it.exists() && it.isFile }
    }

    fun getBox64Binary(): File? {
        val runtimeDir = storageManager.runtimeDir
        val candidates = listOf(
            File(runtimeDir, "box64/box64"),
            File(runtimeDir, "box64/bin/box64"),
            File(context.applicationInfo.nativeLibraryDir, "libbox64.so")
        )
        return candidates.firstOrNull { it.exists() && it.isFile }
    }

    fun getBox86Binary(): File? {
        val runtimeDir = storageManager.runtimeDir
        val candidates = listOf(
            File(runtimeDir, "box86/box86"),
            File(runtimeDir, "box86/bin/box86"),
            File(context.applicationInfo.nativeLibraryDir, "libbox86.so")
        )
        return candidates.firstOrNull { it.exists() && it.isFile }
    }

    fun validate(): RuntimeValidationResult {
        val errors = mutableListOf<String>()
        val warnings = mutableListOf<String>()

        val arch = detectSystemArchitecture()
        val isArm64 = isArm64Device()

        if (!isArm64) {
            warnings.add("System ABI '$arch' is not ARM64. Performance translation may be limited.")
        }

        val wineFile = getWineBinary()
        val wineReady = if (wineFile != null) {
            if (!wineFile.canExecute()) {
                val chmodSuccess = wineFile.setExecutable(true, false)
                if (!chmodSuccess) {
                    errors.add("Wine binary found at ${wineFile.absolutePath} but lacks executable permission.")
                    false
                } else true
            } else true
        } else {
            errors.add("Wine binary not found in ${storageManager.runtimeDir.absolutePath}/wine.")
            false
        }

        val box64File = getBox64Binary()
        val box64Ready = if (box64File != null) {
            if (!box64File.canExecute()) {
                val chmodSuccess = box64File.setExecutable(true, false)
                if (!chmodSuccess) {
                    errors.add("Box64 binary found at ${box64File.absolutePath} but lacks executable permission.")
                    false
                } else true
            } else true
        } else {
            errors.add("Box64 translation binary not found in ${storageManager.runtimeDir.absolutePath}/box64.")
            false
        }

        val box86File = getBox86Binary()
        val box86Ready = if (box86File != null) {
            if (!box86File.canExecute()) {
                box86File.setExecutable(true, false)
            }
            true
        } else {
            warnings.add("Box86 translation binary not installed (x86 32-bit binaries will require Box86).")
            false
        }

        val isValid = wineReady && box64Ready

        logger.logSystem(
            "RuntimeValidator",
            "Validation result: valid=$isValid, wine=$wineReady, box64=$box64Ready, errors=${errors.size}"
        )

        return RuntimeValidationResult(
            isValid = isValid,
            wineReady = wineReady,
            box64Ready = box64Ready,
            box86Ready = box86Ready,
            errors = errors,
            warnings = warnings
        )
    }

    fun getRuntimeInfo(): RuntimeInfo {
        val validation = validate()
        val systemArch = detectSystemArchitecture()
        val supportedArchs = mutableListOf<String>()
        if (validation.wineReady && isArm64Device()) supportedArchs.add("ARM64")
        if (validation.wineReady && validation.box64Ready) supportedArchs.add("x86-64 (via Box64)")
        if (validation.wineReady && validation.box86Ready) supportedArchs.add("x86-32 (via Box86)")

        val state = when {
            validation.isValid -> RuntimeState.AVAILABLE
            validation.wineReady || validation.box64Ready -> RuntimeState.INVALID
            else -> RuntimeState.NOT_INSTALLED
        }

        val health = when (state) {
            RuntimeState.AVAILABLE -> "Healthy"
            RuntimeState.INVALID -> "Warning"
            else -> "Unavailable"
        }

        val diagnostics = mutableListOf<String>()
        diagnostics.add("Host Architecture: $systemArch (ARM64: ${isArm64Device()})")
        diagnostics.add("Android SDK Level: ${Build.VERSION.SDK_INT}")
        diagnostics.addAll(validation.errors)
        diagnostics.addAll(validation.warnings)
        if (state == RuntimeState.NOT_INSTALLED) {
            diagnostics.add("To install runtime: Place Wine and Box64 binaries in /runtime/ directory.")
        }

        val wineFile = getWineBinary()
        val box64File = getBox64Binary()
        val box86File = getBox86Binary()

        return RuntimeInfo(
            state = state,
            wineInstalled = validation.wineReady,
            box64Installed = validation.box64Ready,
            box86Installed = validation.box86Ready,
            systemArch = systemArch,
            supportedArchitectures = supportedArchs,
            runtimeVersion = if (validation.isValid) "Wine 9.0 + Box64 0.2.8" else "Not Provisioned",
            winePath = wineFile?.absolutePath,
            box64Path = box64File?.absolutePath,
            box86Path = box86File?.absolutePath,
            health = health,
            diagnostics = diagnostics,
            errorReason = if (!validation.isValid) validation.errors.firstOrNull() else null
        )
    }
}
