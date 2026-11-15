/* 时间记录 · PWA 页面壳缓存
 * 只缓存同源静态文件。云端同步（Supabase 跨域 POST）一律放行：不代存、不补传、不推送。
 * 联网优先：联网时直接用线上那份 index.html（当次打开即新版），并后台更新缓存；
 * 断网时才回退到已缓存的整页。程序本来就是单文件，缓存这一份即可离线显示整页。
 */
var CACHE = "ttr-shell-v1";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];
var SCOPE_ORIGIN = new URL(self.registration.scope).origin;

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;                    /* 同步写入是 POST，原样放行 */
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== SCOPE_ORIGIN) return;             /* Supabase 等跨域请求不拦截 */

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
