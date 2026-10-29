package com.pokebacon.cubemobile;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;

/**
 * Offline-only Android host for the generated, source-controlled CUBE web app.
 * No ROMs, metadata, network permission or proprietary assets are packaged.
 * The native file picker grants only user-selected content URIs to WebView.
 */
public final class MainActivity extends Activity {
    private static final int PICK_FILE = 1001;
    private static final String IMPORTED_DOCUMENTS_STATE = "cube.importedDocuments";
    private static final String APP_URL =
        "https://appassets.androidplatform.net/assets/index.html";
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private NativeExport nativeExport;
    private final ImportedDocumentGuard importedDocuments = new ImportedDocumentGuard();
    private OnBackInvokedCallback modernBackCallback;
    private boolean backInFlight;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null && state.containsKey(IMPORTED_DOCUMENTS_STATE)) {
            try {
                importedDocuments.restore(state.getStringArrayList(IMPORTED_DOCUMENTS_STATE));
            } catch (RuntimeException malformedState) {
                importedDocuments.invalidate();
            }
        }
        WebView.setWebContentsDebuggingEnabled(false);
        webView = new WebView(this);
        setContentView(webView);
        nativeExport = new NativeExport(this, webView,
            chosen -> importedDocuments.protects(chosen == null ? null : chosen.toString()));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        nativeExport.install();
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url,
                android.graphics.Bitmap favicon) {
                // A reload destroys the JS session state even at the same URL.
                // Cancel the native session rather than accepting stale chunks.
                if (nativeExport != null) nativeExport.close();
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (APP_URL.equals(url)) nativeExport.inject();
            }
            @Override public WebResourceResponse shouldInterceptRequest(
                WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) ||
                    !"appassets.androidplatform.net".equals(uri.getHost()) ||
                    !uri.getPath().startsWith("/assets/")) {
                    return new WebResourceResponse("text/plain", "utf-8",
                        new ByteArrayInputStream(new byte[0]));
                }
                WebResourceResponse result = assets.shouldInterceptRequest(uri);
                return result == null
                    ? new WebResourceResponse("text/plain", "utf-8",
                        new ByteArrayInputStream(new byte[0]))
                    : result;
            }
            @Override public boolean shouldOverrideUrlLoading(
                WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String destination = uri.toString();
                return !(destination.equals(APP_URL) ||
                    destination.startsWith(APP_URL + "#"));
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,
                ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                    params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(intent, PICK_FILE);
                } catch (RuntimeException ex) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    Toast.makeText(MainActivity.this,
                        "No document picker available", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        webView.setDownloadListener((url, userAgent, disposition, mime, size) ->
            Toast.makeText(this,
                "This build does not yet support native downloads",
                Toast.LENGTH_LONG).show());
        if (Build.VERSION.SDK_INT >= 33) {
            modernBackCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, modernBackCallback);
        }
        webView.loadUrl(APP_URL);
    }

    @Override protected void onActivityResult(int requestCode,
        int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == NativeExport.REQUEST) {
            nativeExport.onResult(resultCode, data);
            return;
        }
        if (requestCode != PICK_FILE || fileCallback == null) return;
        ValueCallback<Uri[]> callback = fileCallback;
        fileCallback = null;
        Uri[] selected = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        if (selected != null) {
            // Reject the entire picker selection if any URI is invalid or
            // exceeds the bounded lifetime identity budget. Never grant the
            // WebView an import we cannot protect against later export.
            ArrayList<String> picked = new ArrayList<>();
            for (Uri uri : selected) picked.add(uri == null ? null : uri.toString());
            if (!importedDocuments.rememberAll(picked)) {
                selected = null;
                Toast.makeText(this, "Import refused: invalid or excessive documents",
                    Toast.LENGTH_LONG).show();
            }
        }
        callback.onReceiveValue(selected);
    }

    @Override public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (webView == null || backInFlight || isFinishing() || isDestroyed()) return;
        backInFlight = true;
        // Native Back must dismiss an open editor/help dialog before changing
        // tabs. WebView.canGoBack() alone incorrectly leaves dialogs open while
        // navigating underneath them, trapping touch and keyboard interaction.
        webView.evaluateJavascript(
            "(function(){var dialogs=document.querySelectorAll('dialog[open]');" +
            "if(!dialogs.length)return false;" +
            "dialogs[dialogs.length-1].close();return true;})()", result -> {
                backInFlight = false;
                if (webView == null || isFinishing() || isDestroyed()) return;
                if ("true".equals(result)) return;
                // The web app creates real hash-history entries per tab. Keep
                // native Back in sync with its own route history.
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    webView.evaluateJavascript(
                        "(function(){var b=document.getElementById('home-button');" +
                        "if(b&&!b.hidden){b.click();return true;}return false;})()", null);
                }
            });
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        // Keep the protected input identities through process/activity
        // recreation. A null snapshot intentionally restores as fail-closed.
        outState.putStringArrayList(IMPORTED_DOCUMENTS_STATE, importedDocuments.snapshot());
        super.onSaveInstanceState(outState);
    }

    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && modernBackCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(modernBackCallback);
            modernBackCallback = null;
        }
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (nativeExport != null) nativeExport.dispose();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
