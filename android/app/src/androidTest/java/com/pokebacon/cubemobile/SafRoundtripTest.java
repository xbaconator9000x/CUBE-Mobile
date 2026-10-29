package com.pokebacon.cubemobile;

import android.app.Instrumentation;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

/**
 * Real emulator content-provider and WebView accessibility harness.
 * Synthetic bytes only. This does NOT simulate an external SAF picker,
 * certify cloud providers, or establish authentic CUBE ROM compatibility.
 */
@RunWith(AndroidJUnit4.class)
public class SafRoundtripTest {
    @Test public void syntheticContentDocumentReopensAndImportedIdentityIsProtected()
        throws Exception {
        assumeTrue("Scoped MediaStore requires API 29+", Build.VERSION.SDK_INT >= 29);
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME,
            "cube-mobile-synthetic-" + System.nanoTime() + ".bin");
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH,
            Environment.DIRECTORY_DOWNLOADS + "/CUBE-Mobile-Tests");
        Uri document = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        assertNotNull("Emulator content provider did not create a document", document);
        byte[] payload = new byte[32769]; // Crosses ExportReadback's 32 KiB chunk boundary.
        for (int i = 0; i < payload.length; i++) payload[i] = (byte)(i * 37 + 11);
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(payload);
        try {
            try (OutputStream output = resolver.openOutputStream(document, "w")) {
                assertNotNull(output);
                output.write(payload);
                output.flush();
            }
            try (InputStream input = resolver.openInputStream(document)) {
                assertTrue("Provider readback must match exact bytes and SHA-256",
                    ExportReadback.verify(input, payload.length, digest));
            }
            try (InputStream input = resolver.openInputStream(document)) {
                assertFalse("A wrong length must fail even with a valid digest",
                    ExportReadback.verify(input, payload.length + 1, digest));
            }
            byte[] incorrectDigest = digest.clone();
            incorrectDigest[0] ^= 1;
            try (InputStream input = resolver.openInputStream(document)) {
                assertFalse("An incorrect digest must fail closed",
                    ExportReadback.verify(input, payload.length, incorrectDigest));
            }
            ImportedDocumentGuard guard = new ImportedDocumentGuard();
            assertTrue(guard.rememberAll(Collections.singletonList(document.toString())));
            assertTrue("An imported document cannot become an export destination",
                guard.protects(document.toString()));
            ImportedDocumentGuard restored = new ImportedDocumentGuard();
            restored.restore(guard.snapshot());
            assertTrue(restored.protects(document.toString()));
            restored.invalidate();
            assertTrue("Untrusted restoration must refuse even unknown destinations",
                restored.protects("content://media/external/downloads/123456789"));
        } finally {
            resolver.delete(document, null, null);
        }
    }

    @Test public void offlineWebViewExposesNamedNavigationAndLiveStatus() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Intent intent = new Intent(instrumentation.getTargetContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(intent);
        try {
            AtomicReference<WebView> web = new AtomicReference<>();
            instrumentation.runOnMainSync(() -> {
                ViewGroup root = activity.findViewById(android.R.id.content);
                assertTrue(root.getChildAt(0) instanceof WebView);
                web.set((WebView) root.getChildAt(0));
            });
            long deadline = SystemClock.elapsedRealtime() + 90000L;
            boolean ready = false;
            while (SystemClock.elapsedRealtime() < deadline) {
                CountDownLatch latch = new CountDownLatch(1);
                AtomicReference<String> result = new AtomicReference<>();
                instrumentation.runOnMainSync(() -> web.get().evaluateJavascript(
                    "(function(){var help=document.getElementById('help-button');" +
                    "var home=document.getElementById('home-button');" +
                    "var picker=document.getElementById('rom-picker');" +
                    "var status=document.getElementById('rom-fingerprint-status');" +
                    "return document.readyState==='complete' && " +
                    "location.protocol==='https:' && !!help && " +
                    "help.getAttribute('aria-label')==='Help and safety' && " +
                    "!!home && !!home.getAttribute('aria-label') && " +
                    "!!picker && picker.type==='file' && " +
                    "!!document.querySelector('label[for=\\\"rom-picker\\\"]') && " +
                    "!!status && status.getAttribute('aria-live')==='polite';})()",
                    value -> { result.set(value); latch.countDown(); }));
                if (latch.await(5, TimeUnit.SECONDS) &&
                    "true".equals(result.get())) { ready = true; break; }
                Thread.sleep(300);
            }
            assertTrue("Offline WebView navigation or status semantics missing", ready);
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
