/*
 * لایه‌ی پلتفرم «گام»: همه‌ی چیزهایی که به محیط اجرا وابسته‌ان (مرورگر، یا بعداً اپ نیتیو با Capacitor) از این‌جا رد می‌شن.
 * بقیه‌ی اپ فقط CoachPlatform رو صدا می‌زنه و نمی‌دونه کجا اجرا می‌شه. پیاده‌سازی فعلی همون رفتار مرورگره؛
 * برای نسخه‌ی نیتیو فقط همین فایل با افزونه‌های Capacitor عوض می‌شه.
 *
 * - info:    نوع پلتفرم (web، ios، android)، نیتیو بودن، آیفون، نصب‌شده (PWA)
 * - store:   ذخیره‌ی ماندگار کلید/مقدار (متن). API همگامه و روی یک کش در حافظه کار می‌کنه؛ پشتوانه‌ی وب localStorage است.
 *            پشتوانه‌ی ناهمگام (مثل SQLite) با useBackend قبل از اجرای اپ کش رو پر می‌کنه؛ اپ نیتیو فعلاً localStorage رو در Preferences کپی می‌کنه.
 * - session: داده‌ی همین نشست (sessionStorage)
 * - files:   ذخیره یا اشتراک فایل، چاپ
 * نسخه‌ی نیتیو (پایین فایل): Preferences، LocalNotifications، Filesystem و Share، و دکمه‌ی برگشت اندروید با App
 * - notify:  اجازه و نمایش اعلان، زمان‌بندی یادآوری
 * - sw:      سرویس‌ورکر (فقط وب)
 * - health:  خوندن تمرین‌ها از Apple Health یا Health Connect (فقط نیتیو)
 * - gps:     موقعیت برای ثبت دویدن (وب: فقط با صفحه‌ی باز؛ نیتیو: پس‌زمینه)
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
    canPrint: function () { return typeof root.print === 'function'; },
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

  // ---------- health ----------
  // تمرین‌های ثبت‌شده در Apple Health (iOS) یا Health Connect (اندروید)، فقط خوندن. در وب وجود نداره.
  // workouts(from, to) → [{ id, type, start, end, sec, km, source }]؛ type همون نام افزونه‌ست (running، walking، …)
  var health = {
    supported: function () { return false; },
    available: function () { return Promise.resolve({ available: false, reason: 'web' }); },
    connect: function () { return Promise.resolve(false); },
    workouts: function () { return Promise.resolve([]); },
    // تنظیمات اجازه‌ها: اندروید صفحه‌ی Health Connect؛ آیفون API نداره (تنظیمات ← سلامت ← دسترسی داده‌ها)
    canOpenSettings: function () { return false; },
    openSettings: function () { return Promise.resolve(); }
  };

  // ---------- gps ----------
  // موقعیت برای ثبت دویدن. وب: navigator.geolocation فقط تا وقتی صفحه بازه (با Wake Lock که صفحه خاموش نشه).
  // نیتیو: سرویس پس‌زمینه با اعلان، حتی با صفحه‌ی قفل. نقطه: { lat, lon, acc, t }.
  // start(onPoint, onError, texts) → Promise<handle>؛ خطاها: 'denied' | 'unavailable'
  var gps = {
    supported: function () { return !!(nav.geolocation && nav.geolocation.watchPosition); },
    background: function () { return false; },
    start: function (onPoint, onError) {
      var lock = null;
      // صفحه روشن بمونه (مرورگرهایی که پشتیبانی می‌کنن)
      if (nav.wakeLock && nav.wakeLock.request) nav.wakeLock.request('screen').then(function (l) { lock = l; }, function () {});
      var id = nav.geolocation.watchPosition(function (p) {
        onPoint({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: p.timestamp || Date.now() });
      }, function (e) {
        // ۳ (TIMEOUT): فقط مدتی نقطه‌ی تازه نیومده؛ ثبت ادامه داره
        if (e && e.code === 3) return;
        onError(e && e.code === 1 ? 'denied' : 'unavailable');
      }, { enableHighAccuracy: true, maximumAge: 0 });
      return Promise.resolve({ stop: function () { nav.geolocation.clearWatch(id); if (lock) { try { lock.release(); } catch (e) { /* */ } } } });
    },
    stop: function (h) { if (h && h.stop) h.stop(); return Promise.resolve(); },
    canOpenSettings: function () { return false; },
    openSettings: function () { return Promise.resolve(); }
  };

  var ready = Promise.resolve();

  // ---------- native (Capacitor) ----------
  // افزونه‌ها از Capacitor.Plugins خونده می‌شن (پل نیتیو خودش اون‌ها رو تزریق می‌کنه؛ باندلر لازم نیست).
  // هر افزونه‌ای که نباشه، همون رفتار وب می‌مونه.
  if (isNative) {
    var plug = function (name) { return (cap.Plugins || {})[name]; };
    var noop = function () {};
    var Prefs = plug('Preferences'), LN = plug('LocalNotifications'), FS = plug('Filesystem'), Share = plug('Share'), App = plug('App'), Health = plug('Health'), BG = plug('BackgroundGeolocation');

    // ذخیره: localStorage همچنان منبع همگامه و هر نوشتن در Preferences (فایل نیتیو) هم کپی می‌شه.
    // اگه سیستم داده‌ی WebView رو پاک کرده باشه، شروع بعدی از Preferences برمی‌گرده و صفحه یک بار دوباره بار می‌شه.
    if (Prefs) {
      var webSet = webBackend.set, webRemove = webBackend.remove;
      webBackend.set = function (k, v) { webSet(k, v); Prefs.set({ key: k, value: v }).catch(noop); };
      webBackend.remove = function (k) { webRemove(k); Prefs.remove({ key: k }).catch(noop); };
      var mine = function (k) { return k.indexOf('iranrunners-coach-') === 0 || k.indexOf('gaam-') === 0; };
      ready = Prefs.keys().then(function (r) {
        var saved = (r.keys || []).filter(mine), local = webBackend.keys().filter(mine);
        if (local.length && !saved.length) {
          // اولین اجرا با این نسخه: هر چی هست به Preferences
          return Promise.all(local.map(function (k) { return Prefs.set({ key: k, value: webBackend.get(k) }); }));
        }
        if (!local.length && saved.length && session.get('gaam-restored') !== '1') {
          return Promise.all(saved.map(function (k) { return Prefs.get({ key: k }); })).then(function (vals) {
            saved.forEach(function (k, i) { if (vals[i].value != null) webSet(k, vals[i].value); });
            // فقط یک بار در هر نشست، تا اگه نوشتن نشد حلقه‌ی بارگذاری درست نشه
            session.set('gaam-restored', '1');
            root.location.reload();
          });
        }
      }).catch(noop);
    }

    // اعلان محلی سیستم: در زمان مشخص حتی وقتی اپ بسته‌ست. check() همون موقع زمان‌بندی بررسی می‌شه
    // (اپ بعد از هر ذخیره و هر بار باز شدن دوباره زمان‌بندی می‌کنه).
    // isExactNotification: false — یادآوری دقیقه‌ای لازم نداره؛ زنگ دقیق در اندروید ۱۲ به بعد اجازه‌ی جدا می‌خواد
    // و افزونه بدون اون، هر بار صفحه‌ی تنظیمات «Alarms & reminders» رو باز می‌کنه.
    if (LN) {
      var perm = 'default', queue = Promise.resolve(), nextId = 1;
      var mapPerm = function (r) { perm = r && r.display === 'granted' ? 'granted' : r && r.display === 'denied' ? 'denied' : 'default'; return perm; };
      LN.checkPermissions().then(mapPerm, noop);
      var serial = function (fn) { queue = queue.then(fn).catch(noop); return queue; };
      var clearPending = function () {
        return LN.getPending().then(function (r) {
          var n = (r.notifications || []).map(function (x) { return { id: x.id }; });
          if (n.length) return LN.cancel({ notifications: n });
        });
      };
      notify.supported = function () { return true; };
      notify.permission = function () { return perm; };
      notify.request = function () { return LN.requestPermissions().then(mapPerm, function () { return perm; }); };
      notify.show = function (title, body) {
        if (perm !== 'granted') return;
        serial(function () { return LN.schedule({ notifications: [{ id: nextId++, title: title, body: body, isExactNotification: false }] }); });
      };
      notify.schedule = function (items) {
        var now = Date.now();
        var list = (items || []).filter(function (it) { return it.at - now > 0 && (!it.check || it.check()); })
          .map(function (it, i) { return { id: 1000 + i, title: it.title, body: it.body, schedule: { at: it.at, allowWhileIdle: true }, isExactNotification: false }; });
        serial(function () { return clearPending().then(function () { if (list.length) return LN.schedule({ notifications: list }); }); });
      };
      notify.cancelAll = function () { serial(clearPending); };
    }

    // فایل: در WebView دانلود وجود نداره؛ فایل در کش اپ نوشته و منوی اشتراک سیستم باز می‌شه
    if (FS) {
      var toBase64 = function (blob) {
        return new Promise(function (res, rej) {
          var r = new root.FileReader();
          r.onload = function () { res(String(r.result).split(',')[1] || ''); };
          r.onerror = function () { rej(r.error); };
          r.readAsDataURL(blob);
        });
      };
      files.save = function (name, blob, opts) {
        opts = opts || {};
        return toBase64(blob).then(function (data) {
          if (!Share) return FS.writeFile({ path: name, data: data, directory: 'DOCUMENTS' }).then(function () { return 'downloaded'; });
          return FS.writeFile({ path: name, data: data, directory: 'CACHE' }).then(function (w) {
            return Share.share({ title: opts.title || name, files: [w.uri] }).then(function () { return 'shared'; }, function (e) {
              if (/cancel/i.test((e && e.message) || '')) return 'cancelled';
              throw e;
            });
          });
        });
      };
    }
    // چاپ در WebView اندروید و iOS کار نمی‌کنه
    files.canPrint = function () { return false; };

    // سلامت (@capgo/capacitor-health). اندروید مسافت تمرین رو با یک درخواست مشترک مسافت و کالری می‌گیره،
    // پس اون دو هم لازمن؛ آیفون مسافت رو از خود تمرین می‌ده. چیزی نوشته نمی‌شه.
    if (Health) {
      var READ = kind === 'android' ? ['workouts', 'distance', 'calories'] : ['workouts'];
      health.supported = function () { return true; };
      health.available = function () {
        return Health.isAvailable().then(function (r) { return { available: !!(r && r.available), reason: r && r.reason }; },
          function (e) { return { available: false, reason: e && e.message }; });
      };
      // true اگه اجازه‌ی تمرین داده شد. آیفون نمی‌گه کاربر اجازه‌ی خوندن داده یا نه (حریم خصوصی)؛ اون‌جا فقط خطا نبودن معنی داره.
      health.connect = function () {
        return Health.requestAuthorization({ read: READ, write: [] }).then(function (s) {
          return kind === 'ios' || ((s && s.readAuthorized) || []).indexOf('workouts') >= 0;
        });
      };
      health.workouts = function (from, to) {
        return Health.queryWorkouts({ startDate: from.toISOString(), endDate: to.toISOString(), limit: 200, ascending: true }).then(function (r) {
          return ((r && r.workouts) || []).map(function (w) {
            return { id: w.platformId || (w.workoutType + '@' + w.startDate), type: w.workoutType, start: w.startDate, end: w.endDate,
              sec: Math.round(Number(w.duration) || 0), km: w.totalDistance > 0 ? Math.round(w.totalDistance / 10) / 100 : null, source: w.sourceName || '' };
          });
        });
      };
      health.canOpenSettings = function () { return kind === 'android'; };
      health.openSettings = function () { return kind === 'android' ? Health.openHealthConnectSettings().catch(noop) : Promise.resolve(); };
    }

    // GPS در پس‌زمینه (@capacitor-community/background-geolocation): اندروید سرویس پیش‌زمینه با اعلان، آیفون حالت location
    if (BG) {
      gps.supported = function () { return true; };
      gps.background = function () { return true; };
      gps.start = function (onPoint, onError, texts) {
        texts = texts || {};
        return BG.addWatcher({ backgroundTitle: texts.title, backgroundMessage: texts.message || 'GPS', requestPermissions: true, stale: false, distanceFilter: 0 },
          function (loc, err) {
            if (err) { onError(err.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable'); return; }
            if (loc) onPoint({ lat: loc.latitude, lon: loc.longitude, acc: loc.accuracy, t: loc.time || Date.now() });
          }).then(function (id) { return { id: id }; });
      };
      gps.stop = function (h) { return h && h.id ? BG.removeWatcher({ id: h.id }).catch(noop) : Promise.resolve(); };
      gps.canOpenSettings = function () { return true; };
      gps.openSettings = function () { return BG.openSettings().catch(noop); };
    }

    // دکمه‌ی برگشت اندروید: صفحه‌ی قبلی اپ، و در اولین صفحه بستن اپ
    if (App) {
      App.addListener('backButton', function (e) { if (e && e.canGoBack) root.history.back(); else App.exitApp(); });
    }
  }

  root.CoachPlatform = {
    kind: kind, isNative: isNative, isIos: isIos, isStandalone: isStandalone, isTouch: isTouch,
    store: store, session: session, files: files, notify: notify, sw: sw, health: health, gps: gps,
    // آماده بودن داده‌ها (وب: بلافاصله؛ نیتیو: بعد از هماهنگی با Preferences)
    ready: function () { return ready; }
  };
})(typeof window !== 'undefined' ? window : this);
