// 새 화면 파일을 설치형 웹 앱 사용자에게도 받게 하려면, 화면 변경 때 이 판번호를 올립니다.
const CACHE_NAME = "lifepanel-public-v19-isolated-ad-library";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.mjs",
  "./free-content-ui.mjs",
  "./advanced-ui.mjs",
  "./plus-ui.mjs",
  "./plus.html",
  "./plus.css",
  "./resources.html",
  "./resources-app.mjs",
  "./ads-ui.mjs",
  "./ads-config.js",
  "./ads-readiness.html",
  "./ads.txt",
  "./provider-config.js",
  "./workflows-ui.mjs",
  "./manifest.webmanifest",
  "./privacy.html",
  "./terms.html",
  "./help.html",
  "./limits.html",
  "./commercial-status.html",
  "./robots.txt",
  "./sitemap.xml",
  "./pricing.html",
  "./commerce-ui.mjs",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/lifepanel-public-qr.png",
  "../lifepanel-core/lifepanel-contract-v1.mjs",
  "../lifepanel-core/lifepanel-free-content-v1.mjs",
  "../lifepanel-core/lifepanel-advanced-content-v2.mjs",
  "../lifepanel-core/lifepanel-personalization-v2.mjs",
  "../lifepanel-core/lifepanel-advanced-services-v2.mjs",
  "../lifepanel-core/lifepanel-google-drive-provider-v1.mjs",
  "../lifepanel-core/lifepanel-circle-provider-v1.mjs",
  "../lifepanel-core/lifepanel-plus-features-v1.mjs",
  "../lifepanel-core/lifepanel-advertising-v1.mjs",
  "../lifepanel-core/lifepanel-data-control-v1.mjs",
  "../lifepanel-core/lifepanel-transfer-v1.mjs",
  "../lifepanel-core/lifepanel-workflows-v1.mjs",
  "../lifepanel-core/lifepanel-commerce-v1.mjs",
  "../lifepanel-core/lifepanel-commerce-provider-v1.mjs",
  "../lifepanel-core/lifepanel-web-checkout-readiness-v1.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()).then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true })).then((clients) => clients.forEach((client) => client.postMessage({ type: "lifepanel-cache-ready", cache: CACHE_NAME }))));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => event.request.mode === "navigate" ? caches.match("./index.html") : cached)));
});
