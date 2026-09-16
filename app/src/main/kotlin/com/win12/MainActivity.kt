package com.win12

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.win12.apps.AppRegistry
import com.win12.apps.ExeInstaller
import com.win12.apps.ExeLauncher
import com.win12.bridge.Win12Bridge
import com.win12.logging.Win12Logger
import com.win12.runtime.PrefixManager
import com.win12.runtime.RuntimeInstaller
import com.win12.runtime.RuntimeManager
import com.win12.runtime.RuntimeValidator
import com.win12.security.PermissionManager
import com.win12.storage.StorageManager
import org.json.JSONObject

/**
 * Native Android host for the Win12 desktop WebView.
 *
 * This class deliberately uses Android Views rather than Jetpack Compose so the
 * host has no Compose compiler/plugin dependency and remains compatible with
 * the AGP 9 build used by AndroidIDE.
 */
open class MainActivity : ComponentActivity() {

    private lateinit var logger: Win12Logger
    private lateinit var storageManager: StorageManager
    private lateinit var permissionManager: PermissionManager
    private lateinit var runtimeValidator: RuntimeValidator
    private lateinit var prefixManager: PrefixManager
    private lateinit var runtimeManager: RuntimeManager
    private lateinit var runtimeInstaller: RuntimeInstaller
    private lateinit var appRegistry: AppRegistry
    private lateinit var exeInstaller: ExeInstaller
    private lateinit var exeLauncher: ExeLauncher

    private var bridge: Win12Bridge? = null
    private var webView: WebView? = null
    private lateinit var rootContainer: FrameLayout
    private var webViewError: String? = null

    private val openDocumentLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            handleSelectedInstallerUri(uri)
        } else {
            bridge?.dispatchEvent("installerCancelled", "{}")
        }
    }

    private val manageStorageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        notifyStoragePermissionState()
    }

    private val legacyStoragePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        notifyStoragePermissionState()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableImmersiveFullscreen()
        rootContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(15, 23, 42))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        setContentView(rootContainer)

        initArchitecture()
        setupBackHandler()
        createDesktopWebView()
    }

    private fun enableImmersiveFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val params = window.attributes
            params.layoutInDisplayCutoutMode =
                android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = params
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enableImmersiveFullscreen()
    }

    override fun onResume() {
        super.onResume()
        notifyStoragePermissionState()
    }

    private fun initArchitecture() {
        logger = Win12Logger(this)
        logger.logSystem("Host", "Initializing Win12 Architecture...")

        storageManager = StorageManager(this, logger)
        permissionManager = PermissionManager(this)
        runtimeValidator = RuntimeValidator(this, storageManager, logger)
        prefixManager = PrefixManager(this, storageManager, logger)
        runtimeManager =
            RuntimeManager(this, storageManager, runtimeValidator, prefixManager, logger)
        runtimeInstaller = RuntimeInstaller(storageManager, runtimeValidator, logger)
        appRegistry = AppRegistry(this, storageManager, logger)
        exeInstaller =
            ExeInstaller(this, storageManager, appRegistry, prefixManager, runtimeManager, logger)
        exeLauncher =
            ExeLauncher(this, appRegistry, runtimeManager, prefixManager, storageManager, logger)

        runtimeManager.onProcessStateChanged = { appId, status, exitCode ->
            val data = JSONObject().apply {
                put("appId", appId)
                put("status", status)
                put("exitCode", exitCode ?: JSONObject.NULL)
            }
            runOnUiThread {
                bridge?.dispatchEvent("processStateChanged", data.toString())
            }
        }
    }

    private fun setupBackHandler() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    webView?.evaluateJavascript(
                        "if (window.Win12Desktop && window.Win12Desktop.handleBackButton) { window.Win12Desktop.handleBackButton(); }",
                        null
                    )
                }
            }
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createDesktopWebView() {
        rootContainer.removeAllViews()

        val view = WebView(this)
        webView = view

        view.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        view.setBackgroundColor(Color.rgb(15, 23, 42))

        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

        bridge = Win12Bridge(
            context = this,
            webView = view,
            appRegistry = appRegistry,
            runtimeManager = runtimeManager,
            runtimeInstaller = runtimeInstaller,
            exeLauncher = exeLauncher,
            exeInstaller = exeInstaller,
            storageManager = storageManager,
            permissionManager = permissionManager,
            logger = logger,
            onPickInstallerRequested = {
                openDocumentLauncher.launch(
                    arrayOf(
                        "application/x-msdownload",
                        "application/octet-stream",
                        "application/x-msi",
                        "*/*"
                    )
                )
            },
            onManageStorageRequested = { requestManageStorage() }
        )

        view.addJavascriptInterface(bridge!!, "Win12Native")
        view.webChromeClient = WebChromeClient()

        view.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    showRecovery(error?.description?.toString() ?: "Failed to load Win12 Desktop.")
                }
            }
        }

        rootContainer.addView(view)
        view.loadUrl("file:///android_asset/web/index.html")
    }

    private fun showRecovery(message: String) {
        webViewError = message
        rootContainer.removeAllViews()

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
            setBackgroundColor(Color.rgb(15, 23, 42))
        }

        val title = TextView(this).apply {
            text = "Win12 Recovery Environment"
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }

        val error = TextView(this).apply {
            text = "The Win12 Desktop encountered an interface issue:\n\n$message"
            textSize = 14f
            setTextColor(Color.rgb(148, 163, 184))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 24)
        }

        val reload = Button(this).apply {
            text = "Reload Win12 Desktop"
            setOnClickListener {
                webViewError = null
                createDesktopWebView()
            }
        }

        layout.addView(
            title,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
        layout.addView(
            error,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )
        layout.addView(
            reload,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        )

        rootContainer.addView(
            layout,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
    }

    private fun requestManageStorage() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            manageStorageLauncher.launch(permissionManager.buildManageStorageIntent())
        } else {
            legacyStoragePermissionLauncher.launch(permissionManager.legacyStoragePermissions())
        }
    }

    private fun notifyStoragePermissionState() {
        if (!::permissionManager.isInitialized) return
        val granted = permissionManager.hasAllFilesAccess()
        val data = JSONObject().apply { put("granted", granted) }
        bridge?.dispatchEvent("storagePermissionChanged", data.toString())
    }

    private fun handleSelectedInstallerUri(uri: Uri) {
        try {
            contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        } catch (_: Exception) {
            // Some providers do not offer persistable URI permissions.
        }

        Thread {
            val result = exeInstaller.installFromUri(uri) { progress ->
                runOnUiThread {
                    bridge?.dispatchEvent("installerProgress", progress.toJson().toString())
                }
            }
            logger.logSystem("Installer", "Installation completed: ${result.isSuccess}")
        }.apply {
            name = "Win12-Installer"
            isDaemon = true
            start()
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_ESCAPE) {
            webView?.evaluateJavascript(
                "if (window.Win12Desktop && window.Win12Desktop.handleEscapeKey) { window.Win12Desktop.handleEscapeKey(); }",
                null
            )
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        bridge = null
        webView?.apply {
            stopLoading()
            removeJavascriptInterface("Win12Native")
            webChromeClient = null
            // NOTE: webViewClient is annotated @NonNull since API 26 — do not null it.
            // destroy() tears the client down along with the WebView.
            destroy()
        }
        webView = null
        super.onDestroy()
    }
}