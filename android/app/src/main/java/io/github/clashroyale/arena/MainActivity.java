package io.github.clashroyale.arena;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowInsets;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int BACKGROUND = Color.rgb(11, 18, 32);
    private WebView webView;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND);
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isLocal(request.getUrl());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String path = url.getPath();
                if (!isLocal(url) || !"GET".equals(request.getMethod()) || path == null
                        || !path.matches("/[a-zA-Z0-9/_\\-.]*") || path.contains("..")) {
                    return notFound();
                }
                if (path.equals("/")) path = "/index.html";
                try {
                    InputStream stream = getAssets().open("www" + path);
                    String mime = mimeType(path);
                    String encoding = mime.startsWith("text/") || mime.equals("application/javascript")
                        || mime.equals("image/svg+xml") ? "UTF-8" : null;
                    return new WebResourceResponse(mime, encoding, stream);
                } catch (IOException e) {
                    return notFound();
                }
            }
        });
        webView.loadUrl(START_URL);
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1;
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".jpg")) return "image/jpeg";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) { webView.onPause(); webView.pauseTimers(); }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) { webView.onResume(); webView.resumeTimers(); }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            ((FrameLayout) webView.getParent()).removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
