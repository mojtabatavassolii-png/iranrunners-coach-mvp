/*
 * سرویس‌ورکر «مربی خودت باش»: کش پوسته‌ی اپ برای باز شدن سریع و کار بدون اینترنت.
 * - صفحه (ناوبری): اول شبکه، اگه نشد (آفلاین) نسخه‌ی کش‌شده.
 * - فایل‌های نسخه‌دار (?v=…): اول کش؛ با هر انتشار آدرس عوض می‌شه، پس فایل قدیمی هیچ‌وقت با صفحه‌ی جدید قاطی نمی‌شه.
 * - بقیه (آیکون‌ها، فونت): کش و به‌روزرسانی در پس‌زمینه.
 * با هر انتشار، VERSION و نسخه‌ی فایل‌ها در index.html با هم بالا می‌رن (تست این هماهنگی رو بررسی می‌کنه).
 */
var VERSION = '39';
var CACHE = 'coach-v' + VERSION;
var SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css?v=' + VERSION,
  'js/vendor/jalaali.js?v=' + VERSION,
  'js/i18n.js?v=' + VERSION,
  'js/i18n/fa.js?v=' + VERSION,
  'js/i18n/en.js?v=' + VERSION,
  'js/i18n/learn-fa.js?v=' + VERSION,
  'js/i18n/learn-en.js?v=' + VERSION,
  'js/logic.js?v=' + VERSION,
  'js/charts.js?v=' + VERSION,
  'js/timepicker.js?v=' + VERSION,
  'js/app.js?v=' + VERSION,
  'img/logo.png?v=' + VERSION,
  'img/favicon.png',
  'img/apple-touch-icon.png',
  'img/icon-192.png',
  'img/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('coach-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function putCache(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;

  // صفحه: اول شبکه (تا نسخه‌ی تازه برسه)، آفلاین → صفحه‌ی کش‌شده (پارامترهایی مثل ?source=pwa نادیده)
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./', copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./'); });
    }));
    return;
  }
  // فایل نسخه‌دار: اول کش
  if (sameOrigin && url.searchParams.has('v')) {
    e.respondWith(caches.match(req).then(function (r) { return r || fetch(req).then(function (res) { return putCache(req, res); }); }));
    return;
  }
  // بقیه: از کش (اگه هست) و به‌روزرسانی در پس‌زمینه
  e.respondWith(caches.match(req).then(function (cached) {
    var net = fetch(req).then(function (res) { return putCache(req, res); }).catch(function () { return cached; });
    return cached || net;
  }));
});
