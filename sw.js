/*
 * سرویس‌ورکر «گام»: کش پوسته‌ی اپ برای باز شدن سریع و کار بدون اینترنت.
 * - صفحه (ناوبری): اول شبکه، اگه نشد (آفلاین) نسخه‌ی کش‌شده.
 * - فایل‌های نسخه‌دار (?v=…): اول کش؛ با هر انتشار آدرس عوض می‌شه، پس فایل قدیمی هیچ‌وقت با صفحه‌ی جدید قاطی نمی‌شه.
 * - بقیه (آیکون‌ها، فونت): کش و به‌روزرسانی در پس‌زمینه.
 * با هر انتشار، VERSION و نسخه‌ی فایل‌ها در index.html با هم بالا می‌رن (تست این هماهنگی رو بررسی می‌کنه).
 */
var VERSION = '77';
var CACHE = 'coach-v' + VERSION;
// صبر حداکثر برای شبکه موقع باز کردن صفحه، قبل از نشون دادن نسخه‌ی کش‌شده
var NAV_WAIT = 1500;
// فایل‌های بزرگ تحلیل دویدن (MediaPipe و مدل، حدود ۳۵ مگابایت): کش جدا و ماندگار، فقط بعد از اولین استفاده؛
// با انتشار نسخه‌ی تازه‌ی اپ پاک نمی‌شن. با عوض شدن نسخه‌ی MediaPipe، این اسم عوض می‌شه.
var BIG_CACHE = 'coach-mp-1.1.1';
function isBig(url) { return url.pathname.indexOf('/js/vendor/mediapipe/') >= 0 || url.pathname.indexOf('/models/') >= 0; }
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
  'js/splash.js?v=' + VERSION,
  'js/gait.js?v=' + VERSION,
  'js/pose.js?v=' + VERSION,
  'js/app.js?v=' + VERSION,
  'css/theme.css?v=' + VERSION,
  'public/assets/gaam-logo-transparent.svg?v=' + VERSION,
  'public/assets/gaam-logo-transparent-light.svg?v=' + VERSION,
  'public/assets/flag-ir.svg?v=' + VERSION,
  'public/assets/flag-gb.svg?v=' + VERSION,
  'public/assets/gaam-splash.svg',
  'public/assets/favicon.svg',
  'public/assets/favicon-32.png',
  'public/assets/apple-touch-icon.png',
  'public/assets/icon-192.png',
  'public/assets/icon-512.png',
  'public/assets/icon-maskable-512.png'
];

// نسخه‌ی تازه بلافاصله فعال می‌شه (منتظر بسته شدن همه‌ی تب‌ها نمی‌مونه). فایل‌ها با cache:'reload' گرفته می‌شن
// تا کش HTTP مرورگر (GitHub Pages تا ۱۰ دقیقه) نسخه‌ی قدیمی رو توی کش جدید نذاره. نبودِ یک فایل نصب رو خراب نمی‌کنه.
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (res) { if (res.ok) return c.put(u, res); }).catch(function () { /* */ });
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('coach-') === 0 && k !== CACHE && k !== BIG_CACHE; }).map(function (k) { return caches.delete(k); }));
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

  // صفحه: اول شبکه (تا نسخه‌ی تازه برسه)، ولی اگه شبکه کند بود (بیشتر از NAV_WAIT) یا قطع بود، نسخه‌ی کش‌شده
  // تا صفحه سفید نمونه؛ درخواست شبکه در پس‌زمینه ادامه پیدا می‌کنه و کش رو تازه می‌کنه (پارامترهایی مثل ?source=pwa نادیده)
  if (req.mode === 'navigate') {
    var fresh;
    try { fresh = fetch(req, { cache: 'no-cache' }); } catch (err) { fresh = fetch(req); }
    var network = fresh.then(function (res) {
      if (res.ok) { var copy = res.clone(); return caches.open(CACHE).then(function (c) { return c.put('./', copy); }).then(function () { return res; }, function () { return res; }); }
      return res;
    });
    var cached = function () { return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./'); }); };
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      function send(r) { if (!done && r) { done = true; resolve(r); } }
      var timer = setTimeout(function () { cached().then(send); }, NAV_WAIT);
      network.then(function (res) { clearTimeout(timer); send(res); }, function () {
        clearTimeout(timer);
        cached().then(function (r) { send(r || Response.error()); });
      });
    }));
    e.waitUntil(network.catch(function () { /* */ }));
    return;
  }
  // MediaPipe و مدل: اول کش ماندگار
  if (sameOrigin && isBig(url)) {
    e.respondWith(caches.open(BIG_CACHE).then(function (c) {
      return c.match(req).then(function (r) {
        return r || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
      });
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
