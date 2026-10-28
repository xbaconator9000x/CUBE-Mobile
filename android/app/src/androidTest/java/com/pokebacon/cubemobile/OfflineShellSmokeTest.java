package com.pokebacon.cubemobile;

import android.app.Instrumentation;
import android.content.Intent;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/**
 * Runs against an actual Android emulator WebView, not a DOM mock.
 * Tests local asset loading and bridge injection without a bundled ROM.
 */
@RunWith(AndroidJUnit4.class)
public class OfflineShellSmokeTest {
    @Test public void generatedOfflineAppLoadsAndNativeBridgeIsInjected() throws Exception {
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
            boolean loaded = false;
            for (int attempt = 0; attempt < 40; attempt++) {
                CountDownLatch latch = new CountDownLatch(1);
                AtomicReference<String> result = new AtomicReference<>();
                instrumentation.runOnMainSync(() -> web.get().evaluateJavascript(
                    "(function(){return location.href.indexOf('https://appassets.androidplatform.net/assets/index.html')===0" +
                    " && document.readyState==='complete' && !!document.body" +
                    " && document.body.innerText.length>100 && !!window.CubeExport" +
                    " && !!window.__cubeNativeExportInstalled;})()",
                    value -> { result.set(value); latch.countDown(); }));
                assertTrue("WebView callback timed out", latch.await(3, TimeUnit.SECONDS));
                if ("true".equals(result.get())) { loaded = true; break; }
                Thread.sleep(250);
            }
            assertTrue("Offline HTML or native export bridge did not load", loaded);
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
