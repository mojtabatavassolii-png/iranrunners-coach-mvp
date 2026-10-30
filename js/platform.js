/*
 * لایه‌ی پلتفرم «گام»: همه‌ی چیزهایی که به محیط اجرا وابسته‌ان (مرورگر، یا بعداً اپ نیتیو با Capacitor) از این‌جا رد می‌شن.
 * بقیه‌ی اپ فقط CoachPlatform رو صدا می‌زنه و نمی‌دونه کجا اجرا می‌شه. پیاده‌سازی فعلی همون رفتار مرورگره؛
 * برای نسخه‌ی نیتیو فقط همین فایل با افزونه‌های Capacitor عوض می‌شه.
 *
 * - info:    نوع پلتفرم (web، ios، android)، نیتیو بودن، آیفون، نصب‌شده (PWA)
 * - store:   ذخیره‌ی ماندگار کلید/مقدار (متن). API همگامه و روی یک کش در حافظه کار می‌کنه؛ پشتوانه‌ی وب localStorage است.
 *            پشتوانه‌ی نیتیو (ناهمگام، مثل Preferences یا SQLite) قبل از اجرای اپ کش رو پر می‌کنه: ready() و نوشتن write-through.
 * - session: داده‌ی همین نشست (sessionStorage)
 * - files:   ذخیره یا اشتراک فایل، چاپ
 * - notify:  اجازه و نمایش اعلان، زمان‌بندی یادآوری
 * - sw:      سرویس‌ورکر (فقط وب)
 * باید قبل از i18n.js و app.js بار بشه.
 */
(function (root) {
  'use strict';
  var nav = root.navigator || {};
  var cap = root.Capacitor;

  // ---------- info ----------
  var isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  var kind = isNative ? (cap.getPlatform && cap.getPlatform()) || 'web' : 'web';
  function isIos() {
    if (kind === 'ios') return true;
    var ua = nav.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  }
  // اپ از صفحه‌ی اصلی گوشی (PWA نصب‌شده) یا به‌صورت اپ نیتیو باز شده
  function isStandalone() {
    return isNative || !!(root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) || nav.standalone === true;
  }
  function isTouch() { return (nav.maxTouchPoints || 0) > 0; }

  // ---------- store ----------
  // پشتوانه: { load() → Promise<{key: value}>, set(k, v), remove(k) }؛ نسخه‌ی وب همگامه و مستقیم از localStorage می‌خونه
  var webBackend = {
    sync: true,
    get: function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { root.localStorage.setItem(k, v); },
    remove: function (k) { try { root.localStorage.removeItem(k); } catch (e) { /* */ } },
    keys: function () { try { return Object.keys(root.localStorage); } catch (e) { return []; } }
  };
  var backend = webBackend, cache = null;
  var store = {
    // null اگه نباشه
    get: function (k) {
      if (backend.sync) return backend.get(k);
      return cache && Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null;
    },
    // ذخیره‌ی متن؛ اگه جا نبود خطا پرتاب می‌شه (اپ پیام «ذخیره نشد» نشون می‌ده)
    set: function (k, v) {
      v = String(v);
      if (backend.sync) { backend.set(k, v); return; }
      cache[k] = v; backend.set(k, v);
    },
    remove: function (k) {
      if (!backend.sync && cache) delete cache[k];
      backend.remove(k);
    },
    keys: function (prefix) {
      var all = backend.sync ? backend.keys() : Object.keys(cache || {});
      return prefix ? all.filter(function (k) { return k.indexOf(prefix) === 0; }) : all;
    },
    getJSON: function (k, fallback) {
      var v = store.get(k);
      if (v == null) return fallback === undefined ? null : fallback;
      try { return JSON.parse(v); } catch (e) { return fallback === undefined ? null : fallback; }
    },
    setJSON: function (k, v) { store.set(k, JSON.stringify(v)); },
    // پشتوانه‌ی ناهمگام (نیتیو) اول همه‌چیز رو در کش می‌خونه؛ اپ بعد از این اجرا می‌شه
    useBackend: function (b) {
      backend = b;
      if (b.sync) { cache = null; return Promise.resolve(); }
      return b.load().then(function (all) { cache = all || {}; });
    }
  };

  // ---------- session ----------
  var session = {
    get: function (k) { try { return root.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { root.sessionStorage.setItem(k, String(v)); } catch (e) { /* */ } },
    remove: function (k) { try { root.sessionStorage.removeItem(k); } catch (e) { /* */ } },
    keys: function (prefix) {
      var all = [];
      try { all = Object.keys(root.sessionStorage); } catch (e) { /* */ }
      return prefix ? all.filter(function (k) { return k.indexOf(prefix) === 0; }) : all;
    }
  };

  // ---------- files ----------
  // ذخیره‌ی فایل: روی گوشی (لمسی) با share: true منوی اشتراک سیستم (ذخیره در Files، درایو، پیام‌رسان)، وگرنه دانلود.
  // نتیجه: 'shared' | 'downloaded' | 'cancelled'
  function download(name, blob) {
    var a = root.document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    root.document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return Promise.resolve('downloaded');
  }
  function canShareFile(file) { return !!(file && nav.canShare && nav.share && nav.canShare({ files: [file] })); }
  var files = {
    save: function (name, blob, opts) {
      opts = opts || {};
      var file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null;
      if (opts.share && (isTouch() || opts.shareAlways) && canShareFile(file)) {
        return nav.share({ files: [file], title: opts.title || name }).then(function () { return 'shared'; }, function (e) {
          // لغو کاربر؛ خطاهای دیگه (مثلاً اجازه نداشتن) → دانلود
          return e && e.name === 'AbortError' ? 'cancelled' : download(name, blob);
        });
      }
      return download(name, blob);
    },
    canShareFile: canShareFile,
    // چاپ صفحه‌ی فعلی؛ before و after برای آماده کردن و برگردوندن صفحه
    print: function (before, after) {
      if (before) before();
      var finished = false;
      var done = function () { if (finished) return; finished = true; root.removeEventListener('afterprint', done); if (after) after(); };
      root.addEventListener('afterprint', done);
      root.print();
      // بعضی مرورگرها afterprint نمی‌فرستن؛ print() تا بسته شدن پنجره‌ی چاپ صبر می‌کنه
      setTimeout(done, 1000);
    }
  };

  // ---------- notify ----------
  // نسخه‌ی وب: اعلان مرورگر، و زمان‌بندی فقط تا وقتی اپ بازه (بدون سرور). نسخه‌ی نیتیو: اعلان محلی سیستم.
  var timers = [];
  var notify = {
    supported: function () { return 'Notification' in root; },
    permission: function () { return notify.supported() ? root.Notification.permission : 'denied'; },
    request: function () { return notify.supported() ? Promise.resolve(root.Notification.requestPermission()) : Promise.resolve('denied'); },
    show: function (title, body, icon) {
      if (notify.permission() !== 'granted') return;
      try { new root.Notification(title, { body: body, icon: icon }); } catch (e) { /* */ }
    },
    // items: [{ at: Date, title, body, icon, check() }] — check (اختیاری) درست قبل از نمایش؛ false = نشون نده
    schedule: function (items) {
      notify.cancelAll();
      var now = Date.now();
      (items || []).forEach(function (it) {
        var ms = it.at - now;
        if (ms <= 0) return;
        timers.push(setTimeout(function () {
          if (it.check && !it.check()) return;
          notify.show(it.title, it.body, it.icon);
        }, Math.min(ms, 2147483000)));
      });
    },
    cancelAll: function () { timers.forEach(clearTimeout); timers = []; }
  };

  // ---------- sw ----------
  // سرویس‌ورکر فقط برای وب (کش آفلاین)؛ در اپ نیتیو همه‌ی فایل‌ها داخل بسته‌ان و لازم نیست
  var sw = {
    supported: function () {
      if (isNative || !('serviceWorker' in nav)) return false;
      var l = root.location;
      return l.protocol === 'https:' || l.hostname === 'localhost' || l.hostname === '127.0.0.1';
    }
  };

  root.CoachPlatform = {
    kind: kind, isNative: isNative, isIos: isIos, isStandalone: isStandalone, isTouch: isTouch,
    store: store, session: session, files: files, notify: notify, sw: sw,
    // آماده بودن داده‌ها (وب: بلافاصله)
    ready: function () { return Promise.resolve(); }
  };
})(typeof window !== 'undefined' ? window : this);
