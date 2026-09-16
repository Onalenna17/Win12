package com.win12.system

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import java.util.concurrent.ConcurrentHashMap

/**
 * Native WIN12 system-sound service. The WebApp requests semantic sound names;
 * browser autoplay is never required for system audio.
 */
class Win12SoundService(private val context: Context) {
    private val pool: SoundPool
    private val ids = ConcurrentHashMap<String, Int>()
    private val ready = ConcurrentHashMap<Int, Boolean>()

    init {
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        pool = SoundPool.Builder()
            .setAudioAttributes(attrs)
            .setMaxStreams(4)
            .build()
        pool.setOnLoadCompleteListener { _, sampleId, status ->
            ready[sampleId] = status == 0
        }

        load("startup", "web/sounds/startup.wav")
        load("desktopReady", "web/sounds/desktop_ready.wav")
        load("click", "web/sounds/click.wav")
        load("menuOpen", "web/sounds/menu_open.wav")
        load("menuClose", "web/sounds/menu_close.wav")
        load("windowOpen", "web/sounds/window_open.wav")
        load("windowClose", "web/sounds/window_close.wav")
        load("windowMinimize", "web/sounds/window_minimize.wav")
        load("windowRestore", "web/sounds/window_restore.wav")
        load("windowMaximize", "web/sounds/window_maximize.wav")
        load("windowSnap", "web/sounds/window_snap.wav")
        load("notification", "web/sounds/notification.wav")
        load("error", "web/sounds/error.wav")
        load("file", "web/sounds/file.wav")
        load("power", "web/sounds/power.wav")
        load("shutdown", "web/sounds/shutdown.wav")
        load("restart", "web/sounds/restart.wav")
        load("toggle", "web/sounds/toggle.wav")
        load("success", "web/sounds/success.wav")
    }

    private fun load(name: String, assetPath: String) {
        try {
            context.assets.openFd(assetPath).use { fd ->
                ids[name] = pool.load(fd, 1)
            }
        } catch (_: Exception) {
            // A missing optional sound must never prevent WIN12 from starting.
        }
    }

    fun play(name: String, volume: Float = 1f): Boolean {
        val id = ids[name] ?: return false
        if (ready[id] == false) return false
        val v = volume.coerceIn(0f, 1f)
        return pool.play(id, v, v, 1, 0, 1f) != 0
    }

    fun release() {
        pool.release()
        ids.clear()
        ready.clear()
    }
}
