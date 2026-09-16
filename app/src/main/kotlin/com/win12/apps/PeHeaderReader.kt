package com.win12.apps

import java.io.File
import java.io.RandomAccessFile

/**
 * Parses Windows Portable Executable (PE/COFF) and MSI file headers to determine
 * target architecture (x86, x64, ARM64, or MSI) without executing untrusted code.
 */
object PeHeaderReader {

    data class PeInfo(
        val isWindowsBinary: Boolean,
        val isMsi: Boolean,
        val architecture: String, // "x86", "x64", "ARM64", "MSI", "Unknown"
        val machineHex: String,
        val is64Bit: Boolean,
        val description: String
    )

    fun inspect(file: File): PeInfo {
        if (!file.exists() || file.length() < 64) {
            return PeInfo(
                isWindowsBinary = false,
                isMsi = false,
                architecture = "Unknown",
                machineHex = "0x0000",
                is64Bit = false,
                description = "File is empty or too small"
            )
        }

        // Check if file is an MSI (Compound File Binary Format: D0 CF 11 E0 A1 B1 1A E1)
        val isMsi = checkMsiHeader(file)
        if (isMsi) {
            return PeInfo(
                isWindowsBinary = true,
                isMsi = true,
                architecture = "MSI",
                machineHex = "0x0000",
                is64Bit = true,
                description = "Windows Installer Package (MSI)"
            )
        }

        return try {
            RandomAccessFile(file, "r").use { raf ->
                // Check DOS header "MZ" (0x4D, 0x5A)
                val m = raf.read()
                val z = raf.read()
                if (m != 0x4D || z != 0x5A) {
                    return PeInfo(
                        isWindowsBinary = false,
                        isMsi = false,
                        architecture = "Unknown",
                        machineHex = "0x0000",
                        is64Bit = false,
                        description = "Not a valid Windows PE/DOS executable (Missing MZ header)"
                    )
                }

                // e_lfanew is at offset 0x3C (4 bytes, little-endian)
                raf.seek(0x3C)
                val b0 = raf.read()
                val b1 = raf.read()
                val b2 = raf.read()
                val b3 = raf.read()
                val peOffset = (b0 and 0xFF) or
                        ((b1 and 0xFF) shl 8) or
                        ((b2 and 0xFF) shl 16) or
                        ((b3 and 0xFF) shl 24)

                if (peOffset <= 0 || peOffset >= raf.length() - 24) {
                    return PeInfo(
                        isWindowsBinary = true,
                        isMsi = false,
                        architecture = "x86",
                        machineHex = "0x014c",
                        is64Bit = false,
                        description = "Legacy DOS/Win16 executable"
                    )
                }

                // Check PE signature "PE\0\0" (0x50, 0x45, 0x00, 0x00)
                raf.seek(peOffset.toLong())
                val p = raf.read()
                val e = raf.read()
                val z1 = raf.read()
                val z2 = raf.read()
                if (p != 0x50 || e != 0x45 || z1 != 0x00 || z2 != 0x00) {
                    return PeInfo(
                        isWindowsBinary = true,
                        isMsi = false,
                        architecture = "Unknown",
                        machineHex = "0x0000",
                        is64Bit = false,
                        description = "Invalid PE signature"
                    )
                }

                // Next 2 bytes are Machine type (little-endian)
                val m0 = raf.read()
                val m1 = raf.read()
                val machine = (m0 and 0xFF) or ((m1 and 0xFF) shl 8)

                val machineHex = "0x" + Integer.toHexString(machine).padStart(4, '0')

                when (machine) {
                    0x8664 -> PeInfo(
                        isWindowsBinary = true,
                        isMsi = false,
                        architecture = "x64",
                        machineHex = machineHex,
                        is64Bit = true,
                        description = "Windows x86-64 (AMD64) Application - Requires Box64 + Wine64"
                    )
                    0x014c -> PeInfo(
                        isWindowsBinary = true,
                        isMsi = false,
                        architecture = "x86",
                        machineHex = machineHex,
                        is64Bit = false,
                        description = "Windows x86 32-bit Application - Requires Box86 + Wine32"
                    )
                    0xaa64 -> PeInfo(
                        isWindowsBinary = true,
                        isMsi = false,
                        architecture = "ARM64",
                        machineHex = machineHex,
                        is64Bit = true,
                        description = "Windows ARM64 Application - Compatible with Native Wine"
                    )
                    0x01c0, 0x01c4 -> PeInfo(
                        isWindowsBinary = true,
                        isMsi = false,
                        architecture = "ARM",
                        machineHex = machineHex,
                        is64Bit = false,
                        description = "Windows ARM 32-bit Application"
                    )
                    else -> PeInfo(
                        isWindowsBinary = true,
                        isMsi = false,
                        architecture = "x64",
                        machineHex = machineHex,
                        is64Bit = true,
                        description = "Windows Executable (Machine: $machineHex)"
                    )
                }
            }
        } catch (e: Exception) {
            PeInfo(
                isWindowsBinary = false,
                isMsi = false,
                architecture = "Unknown",
                machineHex = "0x0000",
                is64Bit = false,
                description = "Header inspection failed: ${e.message}"
            )
        }
    }

    private fun checkMsiHeader(file: File): Boolean {
        return try {
            RandomAccessFile(file, "r").use { raf ->
                if (raf.length() < 8) return false
                val magic = ByteArray(8)
                raf.readFully(magic)
                // D0 CF 11 E0 A1 B1 1A E1
                magic[0] == 0xD0.toByte() &&
                        magic[1] == 0xCF.toByte() &&
                        magic[2] == 0x11.toByte() &&
                        magic[3] == 0xE0.toByte() &&
                        magic[4] == 0xA1.toByte() &&
                        magic[5] == 0xB1.toByte() &&
                        magic[6] == 0x1A.toByte() &&
                        magic[7] == 0xE1.toByte()
            }
        } catch (e: Exception) {
            file.extension.equals("msi", ignoreCase = true)
        }
    }
}
