package com.pokebacon.cubemobile;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.SystemClock;
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

/** Real Android WebView Back behavior: modal first, then hash-history tab. */
@RunWith(AndroidJUnit4.class)
public class BackNavigationSmokeTest {
    private String evaluate(Instrumentation instrumentation, WebView web,
        String expression) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> web.evaluateJavascript(expression,
            value -> { result.set(value); latch.countDown(); }));
        assertTrue("WebView JavaScript callback timed out",
            latch.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void awaitTrue(Instrumentation instrumentation, WebView web,
        String expression, long timeoutMs) throws Exception {
        long deadline = SystemClock.elapsedRealtime() + timeoutMs;
        while (SystemClock.elapsedRealtime() < deadline) {
            if ("true".equals(evaluate(instrumentation, web, expression))) return;
            Thread.sleep(250);
        }
        fail("WebView navigation state did not settle for " + expression +
            " state=" + evaluate(instrumentation, web,
                "JSON.stringify({hash:location.hash,homeHidden:" +
                "document.getElementById('home-button')?.hidden," +
                "dialogs:document.querySelectorAll('dialog[open]').length," +
                "routeFn:typeof gotoTab,scriptCount:document.scripts.length," +
                "currentTab:(function(){try{return currentTab}catch(e){return e.name}})()," +
                "canvas2d:!!document.getElementById('tile-canvas')?.getContext('2d')," +
                "tabCount:document.querySelectorAll('[data-tab]').length," +
                "inlineBytes:document.scripts[0]?.textContent.length," +
                "parse:(function(){try{new Function(document.scripts[0].textContent);" +
                "return 'ok';}catch(e){return e.name+':'+e.message}})()})"));
    }

    @Test public void backDismissesDialogBeforeNavigatingTab() throws Exception {
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
            awaitTrue(instrumentation, web.get(),
                "document.readyState==='complete' && !!window.__cubeNativeExportInstalled" +
                " && !!document.getElementById('help-button')", 90000);
            assertEquals("true", evaluate(instrumentation, web.get(),
                "(function(){var tab=document.querySelector('[data-tab=\\\"hex\\\"]');" +
                "if(!tab)return false;tab.click();return true;})()"));
            awaitTrue(instrumentation, web.get(),
                "location.hash==='#/hex' && !document.getElementById('home-button').hidden", 10000);
            assertEquals("true", evaluate(instrumentation, web.get(),
                "(function(){document.getElementById('help-button').click();" +
                "return !!document.querySelector('dialog[open]');})()"));
            instrumentation.runOnMainSync(activity::onBackPressed);
            awaitTrue(instrumentation, web.get(),
                "location.hash==='#/hex' && !document.querySelector('dialog[open]')", 10000);
            instrumentation.runOnMainSync(activity::onBackPressed);
            awaitTrue(instrumentation, web.get(),
                "location.hash==='#/home' || location.hash===''", 10000);
        } finally {
            instrumentation.runOnMainSync(activity::finish);
        }
    }
}
