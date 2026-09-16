package com.win12

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.win12.apps.AppRegistry
import com.win12.apps.PeHeaderReader
import com.win12.logging.Win12Logger
import com.win12.model.WinApp
import com.win12.runtime.PrefixManager
import com.win12.runtime.RuntimeState
import com.win12.runtime.RuntimeValidator
import com.win12.security.PermissionManager
import com.win12.storage.StorageManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.io.FileOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class Win12ArchitectureTest {

    private lateinit var context: Context
    private lateinit var logger: Win12Logger
    private lateinit var storageManager: StorageManager
    private lateinit var permissionManager: PermissionManager
    private lateinit var prefixManager: PrefixManager
    private lateinit var runtimeValidator: RuntimeValidator
    private lateinit var appRegistry: AppRegistry

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        logger = Win12Logger(context)
        storageManager = StorageManager(context, logger)
        permissionManager = PermissionManager(context)
        prefixManager = PrefixManager(context, storageManager, logger)
        runtimeValidator = RuntimeValidator(context, storageManager, logger)
        appRegistry = AppRegistry(context, storageManager, logger)
    }

    @Test
    fun testStorageManagerSanitizationAndVirtualPaths() {
        // Sandboxed path validation
        val safeFile = File(storageManager.rootDir, "test.txt")
        assertTrue(storageManager.isPathSafe(safeFile))

        // Virtual path mapping
        val virtualC = storageManager.resolveVirtualPath("C:\\Windows\\system32")
        assertNotNull(virtualC)
        assertTrue(virtualC!!.path.contains("Windows") && virtualC.path.contains("system32"))

        // Storage breakdown metrics
        val breakdown = storageManager.getStorageBreakdown()
        assertNotNull(breakdown)
        assertTrue(breakdown.has("totalTracked"))
    }

    @Test
    fun testPrefixManagerIsolation() {
        val appId = "test_app_notepad"
        val prefix = prefixManager.createPrefix(appId)
        assertTrue(prefix.exists())

        val driveC = File(prefix, "drive_c")
        assertTrue(driveC.exists())
        assertTrue(File(driveC, "windows/system32").exists())
        assertTrue(File(driveC, "Program Files").exists())
        assertTrue(File(driveC, "users/win12user/Desktop").exists())

        // Repair prefix
        val repaired = prefixManager.repairPrefix(appId)
        assertTrue(repaired)

        // Delete prefix
        val deleted = prefixManager.deletePrefix(appId)
        assertTrue(deleted)
        assertFalse(prefix.exists())
    }

    @Test
    fun testAppRegistryOperations() {
        val testApp = WinApp(
            id = "unit_test_calc",
            name = "calc.exe",
            displayName = "Calculator",
            architecture = "x64",
            desktopShortcut = true,
            startMenuShortcut = true,
            status = "installed"
        )

        appRegistry.registerApp(testApp)
        val fetched = appRegistry.getApp("unit_test_calc")
        assertNotNull(fetched)
        assertEquals("Calculator", fetched?.displayName)
        assertEquals("x64", fetched?.architecture)

        // Toggle desktop shortcut
        appRegistry.toggleDesktopShortcut("unit_test_calc", false)
        val updated = appRegistry.getApp("unit_test_calc")
        assertFalse(updated?.desktopShortcut ?: true)

        // Delete app
        val deleted = appRegistry.deleteApp("unit_test_calc")
        assertTrue(deleted)
        assertEquals(null, appRegistry.getApp("unit_test_calc"))
    }

    @Test
    fun testRuntimeValidatorReportsUnavailableWhenBinariesMissing() {
        // In clean test environment, runtime binaries should not be faked
        val info = runtimeValidator.getRuntimeInfo()
        assertNotNull(info)
        // Must not be AVAILABLE without real binaries
        assertTrue(info.state == RuntimeState.NOT_INSTALLED || info.state == RuntimeState.INVALID)
        assertEquals("Unavailable", info.health)
        assertFalse(info.wineInstalled)
        assertFalse(info.box64Installed)
    }

    @Test
    fun testPeHeaderReaderWithDummyPe() {
        // Create a minimal synthetic PE file with MZ and PE header for x64
        val tempFile = File(context.cacheDir, "sample_x64.exe")
        FileOutputStream(tempFile).use { fos ->
            val data = ByteArray(256)
            // MZ Header
            data[0] = 0x4D.toByte()
            data[1] = 0x5A.toByte()
            // e_lfanew at 0x3C points to 0x80
            data[0x3C] = 0x80.toByte()
            data[0x3D] = 0x00.toByte()

            // PE header at 0x80: 'P' 'E' 0 0
            val peOffset = 0x80
            data[peOffset] = 0x50.toByte()
            data[peOffset + 1] = 0x45.toByte()
            data[peOffset + 2] = 0x00.toByte()
            data[peOffset + 3] = 0x00.toByte()

            // Machine at peOffset + 4 (AMD64 = 0x8664)
            data[peOffset + 4] = 0x64.toByte()
            data[peOffset + 5] = 0x86.toByte()

            fos.write(data)
        }

        val info = PeHeaderReader.inspect(tempFile)
        assertTrue(info.isWindowsBinary)
        assertEquals("x64", info.architecture)
        assertTrue(info.is64Bit)

        tempFile.delete()
    }

    @Test
    fun testPermissionManagerValidation() {
        val safeFile = File(context.filesDir, "valid.bin")
        safeFile.writeText("sample")
        assertTrue(permissionManager.validateExecutableLocation(safeFile))

        assertTrue(permissionManager.isSupportedInstaller("setup.exe"))
        assertTrue(permissionManager.isSupportedInstaller("installer.msi"))
        assertFalse(permissionManager.isSupportedInstaller("malicious.sh"))

        safeFile.delete()
    }
}
