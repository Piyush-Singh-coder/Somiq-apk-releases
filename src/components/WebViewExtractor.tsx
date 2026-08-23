import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface WebViewExtractorProps {
  reelUrl: string;
  onUrlExtracted: (directUrl: string) => void;
  onError: (error: string) => void;
}

/**
 * Hidden WebView that loads the Instagram Reel page in a full browser context
 * and extracts the direct CDN video URL via injected JavaScript.
 *
 * Instagram (2024/2025) is a pure client-side SPA — the video URL is NOT in the
 * initial HTML. It is fetched at runtime via Instagram's private GraphQL API.
 *
 * Strategy: Monkey-patch `fetch` and `XMLHttpRequest` before any JS runs so we
 * intercept Instagram's API responses as they arrive.  We scan each response body
 * for known video URL field names (`video_url`, `playable_url`, etc.) and report
 * the first match back to React Native.
 *
 * Fallback: After the SPA loads, also scan the DOM for a <video> element or any
 * data embedded in <script> tags.
 */
export default function WebViewExtractor({ reelUrl, onUrlExtracted, onError }: WebViewExtractorProps) {
  const webViewRef = useRef<WebView>(null);

  /**
   * This script is injected BEFORE the page's own JavaScript runs
   * (injectedJavaScriptBeforeContentLoaded), so our monkey-patches are in place
   * when Instagram's fetch() calls happen.
   */
  const injectedJavaScript = `
    (function () {
      'use strict';

      var _sent = false;
      var _timeoutId = null;

      /** Known field names Instagram uses for the actual playable video URL */
      var VIDEO_FIELDS = [
        'video_url', 'playable_url', 'playable_url_quality_hd',
        'contentUrl', 'video_dash_manifest'
      ];

      function unescapeUrl(s) {
        var decoded = s.trim();
        decoded = decoded.replace(/%5C/gi, '\\\\');
        if (decoded.slice(-1) === '\\\\') {
          decoded = decoded.slice(0, -1);
        }
        var prev;
        var limit = 5;
        do {
          prev = decoded;
          decoded = decoded
            .replace(/\\\\\\\\\\//g, '/')
            .replace(/\\\\\\//g, '/')
            .replace(/\\\\u0026|\\\\\\\\u0026/gi, '&')
            .replace(/\\\\u003d|\\\\\\\\u003d|\\\\u003D|\\\\\\\\u003D/gi, '=')
            .replace(/\\\\u00253D|\\\\\\\\u00253D/gi, '%3D')
            .replace(/\\\\u0025|\\\\\\\\u0025/gi, '%');
        } while (decoded !== prev && --limit > 0);
        if (decoded.slice(-1) === '\\\\') {
          decoded = decoded.slice(0, -1);
        }
        return decoded;
      }

      /** Search a text body for any known video field with a CDN URL */
      function findVideoUrl(text) {
        for (var i = 0; i < VIDEO_FIELDS.length; i++) {
          var field = VIDEO_FIELDS[i];
          // "field":"https?:..." — handles JSON-escaped slashes too
          var pattern = new RegExp('"' + field + '"\\\\s*:\\\\s*"(https?:[^"]{20,})"');
          var m = text.match(pattern);
          if (m && m[1]) {
            var url = unescapeUrl(m[1]);
            if (!url.startsWith('<') && (url.indexOf('scontent') !== -1 || url.indexOf('fbcdn') !== -1 || url.indexOf('instagram') !== -1)) return url;
          }
        }

        // video_versions array: "video_versions":[{"url":"https://scontent..."}]
        var vvm = text.match(/"video_versions"\\s*:\\s*\\[\\s*\\{[^}]*"url"\\s*:\\s*"(https?:[^"]+)"/);
        if (vvm && vvm[1]) {
          var vurl = unescapeUrl(vvm[1]);
          if (vurl.indexOf('scontent') !== -1 || vurl.indexOf('fbcdn') !== -1 || vurl.indexOf('instagram') !== -1) return vurl;
        }

        return null;
      }

      function reportUrl(url) {
        if (_sent) return;
        _sent = true;
        if (_timeoutId) clearTimeout(_timeoutId);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VIDEO_SRC', data: url }));
      }

      function reportError(msg) {
        if (_sent) return;
        _sent = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', data: msg }));
      }

      // ── Monkey-patch fetch ────────────────────────────────────────────────────
      var _origFetch = window.fetch;
      window.fetch = function () {
        var p = _origFetch.apply(this, arguments);
        p.then(function (res) {
          // Clone the response so the original caller's stream is not consumed
          var clone = res.clone();
          clone.text().then(function (text) {
            if (!_sent) {
              var url = findVideoUrl(text);
              if (url) reportUrl(url);
            }
          }).catch(function () {});
        }).catch(function () {});
        return p;
      };

      // ── Monkey-patch XHR ──────────────────────────────────────────────────────
      var _origOpen = XMLHttpRequest.prototype.open;
      var _origSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function (method, url) {
        this._xhrUrl = url;
        return _origOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function () {
        var xhr = this;
        var _origOnReadyStateChange = xhr.onreadystatechange;
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && !_sent) {
            try {
              var text = xhr.responseText;
              if (text) {
                var url = findVideoUrl(text);
                if (url) reportUrl(url);
              }
            } catch (e) {}
          }
          if (_origOnReadyStateChange) _origOnReadyStateChange.apply(xhr, arguments);
        };
        return _origSend.apply(this, arguments);
      };

      // ── DOM fallback scan (runs after page has time to load) ─────────────────
      function domScan() {
        // Check for a <video> element
        var video = document.querySelector('video');
        if (video && video.src) {
          if (video.src.indexOf('scontent') !== -1 || video.src.indexOf('fbcdn') !== -1 || video.src.indexOf('instagram') !== -1) {
            reportUrl(video.src);
            return;
          }
        }

        // Check all <script> tags for embedded data
        var scripts = document.querySelectorAll('script');
        for (var s = 0; s < scripts.length; s++) {
          var txt = scripts[s].textContent || '';
          if (txt.length > 100) {
            var url = findVideoUrl(txt);
            if (url) { reportUrl(url); return; }
          }
        }

        // Check the full page HTML as a last resort
        var bodyHtml = document.documentElement.innerHTML || '';
        var url = findVideoUrl(bodyHtml);
        if (url) { reportUrl(url); return; }
      }

      // Run DOM scan periodically — Instagram's SPA may load data asynchronously
      var scanAttempts = 0;
      function scheduledDomScan() {
        if (_sent) return;
        scanAttempts++;
        domScan();
        if (!_sent && scanAttempts < 20) {
          setTimeout(scheduledDomScan, 1000);
        } else if (!_sent) {
          reportError('WebView: Instagram SPA loaded but no video URL was intercepted after 20 attempts.');
        }
      }

      // Start DOM scanning after giving Instagram's SPA time to boot up
      setTimeout(scheduledDomScan, 2000);

      true; // prevent undefined evaluation result
    })();
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: reelUrl }}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
        onMessage={(event) => {
          try {
            const { type, data } = JSON.parse(event.nativeEvent.data);
            console.log('[WebViewExtractor] Message received, type:', type, data ? data.substring(0, 60) : '');
            if (type === 'VIDEO_SRC') {
              onUrlExtracted(data as string);
            } else if (type === 'ERROR') {
              onError(data as string);
            }
          } catch (e) {
            console.error('[WebViewExtractor] Parse error:', e);
            onError('WebView: message parse failed.');
          }
        }}
        style={styles.hidden}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        /* Allow mixed content for CDN URLs */
        mixedContentMode="always"
        /* Modern Android Chrome UA — Instagram serves full content to this */
        userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 Instagram/311.0.0.33.110"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute',
    overflow: 'hidden',
  },
  hidden: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
