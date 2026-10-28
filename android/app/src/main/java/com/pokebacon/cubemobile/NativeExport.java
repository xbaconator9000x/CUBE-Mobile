package com.pokebacon.cubemobile;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.Collections;
import org.json.JSONObject;

/**
 * Bounded, backpressured blob export to an explicit user-selected SAF document.
 * Origin and main-frame restrictions prevent arbitrary external pages from
 * gaining a file-writing bridge. Does not confer semantic ROM edit authority.
 */
final class NativeExport {
    static final int REQUEST = 1002;
    private static final long MAX_BYTES = 128L * 1024 * 1024;
    private static final int CHUNK_BYTES = 48 * 1024;
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private final Activity activity;
    private final WebView webView;
    private boolean installed;
    private boolean pending;
    private long expected;
    private long written;
    private int nextIndex;
    private Uri destination;
    private OutputStream output;
    private MessageDigest writingDigest;

    NativeExport(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    void install() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            return;
        }
        installed = true;
        WebViewCompat.addWebMessageListener(webView, "CubeExport",
            Collections.singleton(ORIGIN), (view, message, source, isMain, reply) -> {
                if (!isMain || !ORIGIN.equals(source.toString()) ||
                    message.getType() != WebMessageCompat.TYPE_STRING ||
                    message.getData() == null || message.getData().length() > 100000) {
                    return;
                }
                try {
                    JSONObject data = new JSONObject(message.getData());
                    String kind = data.optString("kind", "");
                    switch (kind) {
                        case "start": start(data); break;
                        case "chunk": chunk(data); break;
                        case "finish": finish(); break;
                        default: break;
                    }
                } catch (Exception failure) {
                    abort("Export failed; incomplete document removed");
                }
            });
    }

    void inject() {
        if (installed) {
            webView.evaluateJavascript(
                "(function(){var s=document.createElement('script');" +
                "s.src='/assets/export-bridge.js';document.head.appendChild(s)})()", null);
        }
    }

    private void start(JSONObject data) throws Exception {
        if (pending || output != null) return;
        long size = data.getLong("size");
        if (size < 0 || size > MAX_BYTES) throw new IOException("Export size limit");
        String name = data.optString("name", "cube-export.bin")
            .replaceAll("[^A-Za-z0-9._ -]", "_");
        if (name.isEmpty()) name = "cube-export.bin";
        if (name.length() > 96) name = name.substring(name.length() - 96);
        String mime = data.optString("mime", "application/octet-stream");
        if (!mime.matches("[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+")) {
            mime = "application/octet-stream";
        }
        pending = true;
        expected = size;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try {
            activity.startActivityForResult(intent, REQUEST);
        } catch (RuntimeException failure) {
            pending = false;
            webView.evaluateJavascript("window.__cubeNativeCancel&&window.__cubeNativeCancel()", null);
            Toast.makeText(activity, "No document save picker available",
                Toast.LENGTH_LONG).show();
        }
    }

    void onResult(int resultCode, Intent data) {
        if (!pending) return;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            pending = false;
            webView.evaluateJavascript("window.__cubeNativeCancel&&window.__cubeNativeCancel()", null);
            return;
        }
        destination = data.getData();
        try {
            output = activity.getContentResolver().openOutputStream(destination, "w");
            if (output == null) throw new IOException("No output stream");
            writingDigest = MessageDigest.getInstance("SHA-256");
            written = 0;
            nextIndex = 0;
            webView.evaluateJavascript("window.__cubeNativeBegin&&window.__cubeNativeBegin()", null);
        } catch (Exception failure) {
            abort("Unable to create export document");
        }
    }

    private void chunk(JSONObject data) throws Exception {
        if (!pending || output == null) throw new IOException("No export document");
        if (data.getInt("index") != nextIndex) throw new IOException("Out-of-order export");
        String encoded = data.getString("data");
        if (encoded.length() > 4 * ((CHUNK_BYTES + 2) / 3) + 4)
            throw new IOException("Oversized export chunk");
        byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
        if (bytes.length == 0 || bytes.length > CHUNK_BYTES ||
            written + bytes.length > expected)
            throw new IOException("Invalid export chunk");
        output.write(bytes);
        writingDigest.update(bytes);
        written += bytes.length;
        int acknowledged = nextIndex++;
        webView.evaluateJavascript("window.__cubeNativeAck&&window.__cubeNativeAck(" +
            acknowledged + ")", null);
    }

    private void finish() throws Exception {
        if (!pending || output == null || written != expected)
            throw new IOException("Incomplete export");
        output.flush();
        output.close();
        output = null;
        MessageDigest verified = MessageDigest.getInstance("SHA-256");
        long count = 0;
        try (InputStream input = activity.getContentResolver().openInputStream(destination)) {
            if (input == null) throw new IOException("Cannot reopen export");
            byte[] buffer = new byte[32768];
            int read;
            while ((read = input.read(buffer)) != -1) {
                count += read;
                if (count > expected) throw new IOException("Export length changed");
                verified.update(buffer, 0, read);
            }
        }
        if (count != expected ||
            !MessageDigest.isEqual(writingDigest.digest(), verified.digest()))
            throw new IOException("Export reopen verification failed");
        destination = null;
        pending = false;
        writingDigest = null;
        Toast.makeText(activity, "Export saved and verified", Toast.LENGTH_SHORT).show();
    }

    void abort(String message) {
        try { if (output != null) output.close(); } catch (IOException ignored) { }
        output = null;
        if (destination != null) {
            try { activity.getContentResolver().delete(destination, null, null); }
            catch (Exception ignored) { }
        }
        destination = null;
        pending = false;
        writingDigest = null;
        webView.evaluateJavascript("window.__cubeNativeCancel&&window.__cubeNativeCancel()", null);
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
    }

    void close() {
        if (pending || output != null) abort("Export cancelled");
    }
}
