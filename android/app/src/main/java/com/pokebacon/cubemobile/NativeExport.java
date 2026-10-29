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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.io.OutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.function.Predicate;
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
    private final Predicate<Uri> isImportedDocument;
    private boolean installed;
    private boolean pending;
    // A cancelled picker may still return an Android activity result later.
    // Never bind that stale result to a newer export session.
    private final ExportPickerGate pickerGate = new ExportPickerGate();
    private String session;
    private long expected;
    private final ExportWriteState writeState = new ExportWriteState();
    private int nextIndex;
    private Uri destination;
    private OutputStream output;
    private MessageDigest writingDigest;
    // SAF providers can take seconds to read back large documents. Never
    // hash up to 128 MiB on the Android UI/WebView message thread.
    private final ExecutorService readbackWorker = Executors.newSingleThreadExecutor();
    private Future<?> readbackTask;
    private boolean verifying;

    NativeExport(Activity activity, WebView webView,
        Predicate<Uri> isImportedDocument) {
        this.activity = activity;
        this.webView = webView;
        this.isImportedDocument = isImportedDocument;
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
                String incoming = null;
                String kind = "";
                try {
                    JSONObject data = new JSONObject(message.getData());
                    incoming = data.optString("session", "");
                    kind = data.optString("kind", "");
                    if ("start".equals(kind)) {
                        start(data);
                    } else if (pending && session != null && session.equals(incoming)) {
                        switch (kind) {
                            case "chunk": chunk(data); break;
                            case "finish": finish(); break;
                            case "abort": abort("Export cancelled"); break;
                            default: break;
                        }
                    }
                    // Delayed messages from completed/cancelled exports are ignored.
                } catch (Exception failure) {
                    if (pending && incoming != null && incoming.equals(session)) {
                        abort("Export failed");
                    } else if ("start".equals(kind) && !pending && incoming != null) {
                        callback("__cubeNativeCancel", incoming);
                    }
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

    private void callback(String method, String id) {
        if (id != null) {
            webView.evaluateJavascript("window." + method + "&&window." + method +
                "(" + JSONObject.quote(id) + ")", null);
        }
    }

    private void start(JSONObject data) throws Exception {
        String id = data.getString("session");
        if (pending || output != null || pickerGate.isInFlight()) {
            callback("__cubeNativeCancel", id);
            return;
        }
        if (!id.matches("[1-9][0-9]{0,15}"))
            throw new IOException("Invalid export session");
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
        if (!pickerGate.begin(id)) {
            callback("__cubeNativeCancel", id);
            return;
        }
        // Reset before opening the picker: an earlier successful export must
        // not make a new, never-written document eligible for deletion.
        writeState.reset();
        nextIndex = 0;
        pending = true;
        session = id;
        expected = size;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try {
            activity.startActivityForResult(intent, REQUEST);
        } catch (RuntimeException failure) {
            pickerGate.consume();
            pending = false;
            session = null;
            callback("__cubeNativeCancel", id);
            Toast.makeText(activity, "No document save picker available",
                Toast.LENGTH_LONG).show();
        }
    }

    void onResult(int resultCode, Intent data) {
        // Consume exactly the picker that launched this result, even when its
        // JS session was aborted while the Android picker remained visible.
        String launchedSession = pickerGate.consume();
        if (launchedSession == null || !pending ||
            !launchedSession.equals(session)) return;
        if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
            String id = session;
            pending = false;
            session = null;
            callback("__cubeNativeCancel", id);
            return;
        }
        // ACTION_CREATE_DOCUMENT is expected to create a fresh document, but
        // never trust a provider to return a different URI from an input ROM.
        // Refuse exact matches before opening/truncating or deleting anything.
        Uri chosen = data.getData();
        if (!SafDocumentIdentity.isContentUri(chosen.toString())) {
            abort("Export refused: picker returned an unsafe document URI");
            return;
        }
        if (isImportedDocument.test(chosen)) {
            abort("Export refused: destination is an imported document");
            return;
        }
        // ACTION_CREATE_DOCUMENT should create an empty document, but some
        // providers may return an existing alias. Refuse nonempty or unreadable
        // targets before opening a truncating output stream.
        try (InputStream probe = activity.getContentResolver().openInputStream(chosen)) {
            if (!ExportDestinationPreflight.isEmpty(probe)) {
                abort("Export refused: destination is not an empty new document");
                return;
            }
        } catch (Exception failure) {
            abort("Export refused: cannot verify an empty destination");
            return;
        }
        destination = chosen;
        try {
            output = activity.getContentResolver().openOutputStream(destination, "w");
            if (output == null) throw new IOException("No output stream");
            writingDigest = MessageDigest.getInstance("SHA-256");
            writeState.reset();
            nextIndex = 0;
            callback("__cubeNativeBegin", session);
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
            writeState.bytesWritten() + bytes.length > expected)
            throw new IOException("Invalid export chunk");
        if (!ExportChunkIntegrity.verify(bytes, data.getString("sha256")))
            throw new IOException("Export chunk digest differs from source Blob");
        writeState.beforeWrite(); // A provider may partially write before throwing.
        output.write(bytes);
        writingDigest.update(bytes);
        writeState.committed(bytes.length);
        int acknowledged = nextIndex++;
        webView.evaluateJavascript("window.__cubeNativeAck&&window.__cubeNativeAck(" +
            JSONObject.quote(session) + "," + acknowledged + ")", null);
    }

    private void finish() throws Exception {
        if (!pending || output == null || writeState.bytesWritten() != expected || verifying)
            throw new IOException("Incomplete export");
        output.flush();
        output.close();
        output = null;
        verifying = true;
        final Uri verifiedUri = destination;
        final String verifiedSession = session;
        final long verifiedLength = expected;
        final byte[] expectedDigest = writingDigest.digest();
        try {
            readbackTask = readbackWorker.submit(() -> {
                boolean valid = false;
                try (InputStream input = activity.getContentResolver()
                    .openInputStream(verifiedUri)) {
                    valid = ExportReadback.verify(input, verifiedLength, expectedDigest);
                } catch (Exception ignored) {
                    // Refuse rather than claiming a provider's failed reopen passed.
                }
                final boolean passed = valid;
                activity.runOnUiThread(() -> {
                    // An abort, reload or newer session invalidates old results.
                    if (!pending || !verifying || session == null ||
                        !session.equals(verifiedSession) || destination == null ||
                        !destination.equals(verifiedUri)) return;
                    readbackTask = null;
                    verifying = false;
                    if (!passed) {
                        abort("Export reopen verification failed");
                        return;
                    }
                    destination = null;
                    pending = false;
                    writingDigest = null;
                    session = null;
                    writeState.reset();
                    callback("__cubeNativeComplete", verifiedSession);
                    Toast.makeText(activity, "Export saved and verified",
                        Toast.LENGTH_SHORT).show();
                });
            });
        } catch (RuntimeException rejected) {
            verifying = false;
            throw new IOException("Unable to schedule export verification", rejected);
        }
    }

    void abort(String message) {
        String cancelled = session;
        verifying = false;
        if (readbackTask != null) {
            readbackTask.cancel(true);
            readbackTask = null;
        }
        try { if (output != null) output.close(); } catch (IOException ignored) { }
        output = null;
        boolean hadDestination = destination != null;
        boolean mayContainOurBytes = writeState.mayContainOurBytes();
        // ACTION_CREATE_DOCUMENT is user-selected, but an untrusted provider
        // can return a pre-existing empty document alias. We cannot prove
        // exclusive ownership from a successful picker result or write alone.
        // Deleting that URI on abort could destroy user data. Keep any partial
        // output for explicit user review; never claim destructive rollback.
        destination = null;
        pending = false;
        session = null;
        writingDigest = null;
        writeState.reset();
        callback("__cubeNativeCancel", cancelled);
        String notice = !hadDestination ? message :
            !mayContainOurBytes ? message + "; empty document may remain" :
            message + "; partial document may remain, please delete it";
        Toast.makeText(activity, notice, Toast.LENGTH_LONG).show();
    }

    void close() {
        if (pending || output != null || verifying) abort("Export cancelled");
    }

    void dispose() {
        close();
        readbackWorker.shutdownNow();
    }
}
