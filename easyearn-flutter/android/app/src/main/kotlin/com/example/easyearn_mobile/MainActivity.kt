package com.example.easyearn_mobile

import io.flutter.embedding.android.FlutterActivity
import android.app.Activity
import android.content.Intent
import android.util.Base64
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var pendingFileResult: MethodChannel.Result? = null
    private var pendingSaveResult: MethodChannel.Result? = null
    private var pendingSaveBytes: ByteArray? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "easyearn/files")
            .setMethodCallHandler { call, result ->
                if (call.method == "save") {
                    if (pendingSaveResult != null) {
                        result.error("BUSY", "A save is already in progress", null)
                        return@setMethodCallHandler
                    }
                    try {
                        val mime = call.argument<String>("type") ?: ""
                        val encoded = call.argument<String>("base64") ?: ""
                        require(mime in listOf("application/pdf", "image/png", "image/jpeg", "image/webp"))
                        require(encoded.length in 4..4194304)
                        val bytes = Base64.decode(encoded, Base64.DEFAULT)
                        require(bytes.size in 1..3145728)
                        val name = (call.argument<String>("name") ?: "evidence")
                            .replace('/', '_').replace('\\', '_').take(255)
                        pendingSaveResult = result
                        pendingSaveBytes = bytes
                        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = mime
                            putExtra(Intent.EXTRA_TITLE, name)
                        }
                        startActivityForResult(intent, 4102)
                    } catch (error: Exception) {
                        pendingSaveResult = null
                        pendingSaveBytes = null
                        result.error("FILE_SAVE", "Unable to save attachment", null)
                    }
                } else if (call.method != "choose") {
                    result.notImplemented()
                } else if (pendingFileResult != null) {
                    result.success(emptyList<String>())
                } else {
                    val types = call.argument<List<String>>("types")
                        .orEmpty().filter { it.contains('/') }
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = if (types.size == 1) types.first() else "*/*"
                        if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, call.argument<Boolean>("multiple") == true)
                    }
                    pendingFileResult = result
                    try {
                        startActivityForResult(Intent.createChooser(intent, "Choose evidence"), 4101)
                    } catch (error: Exception) {
                        pendingFileResult = null
                        result.error("FILE_PICKER", "Unable to open file picker", null)
                    }
                }
            }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 4102) {
            try {
                val uri = data?.data
                if (resultCode == Activity.RESULT_OK && uri != null) {
                    val bytes = pendingSaveBytes ?: error("Attachment unavailable")
                    val stream = contentResolver.openOutputStream(uri) ?: error("File unavailable")
                    stream.use { it.write(bytes) }
                }
                pendingSaveResult?.success(resultCode == Activity.RESULT_OK)
            } catch (error: Exception) {
                pendingSaveResult?.error("FILE_SAVE", "Unable to save attachment", null)
            } finally {
                pendingSaveResult = null
                pendingSaveBytes = null
            }
            return
        }
        if (requestCode != 4101) return
        val files = mutableListOf<String>()
        if (resultCode == Activity.RESULT_OK) {
            val clip = data?.clipData
            if (clip != null) {
                for (index in 0 until clip.itemCount) files.add(clip.getItemAt(index).uri.toString())
            } else {
                data?.data?.let { files.add(it.toString()) }
            }
        }
        pendingFileResult?.success(files)
        pendingFileResult = null
    }
}
