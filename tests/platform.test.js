// اجرای تست‌ها: node tests/platform.test.js
// لایه‌ی پلتفرم (js/platform.js) با یک window ساختگی: ذخیره، نشست، فایل، اعلان و تشخیص پلتفرم
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var passed = 0;
function test(name, fn) {
  try { var r = fn(); if (r && r.then) return r.then(function () { passed++; }, function (e) { fail(name, e); }); passed++; } catch (e) { fail(name, e); }
  return Promise.resolve();
}
function fail(name, e) { console.error('✗ ' + name + '\n  ' + (e && e.message)); process.exitCode = 1; }

var SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'platform.js'), 'utf8');
function memStorage(quota) {
  var d = {};
  var s = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function (k, v) { if (quota && String(v).length > quota) { var e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } d[k] = String(v); },
    removeItem: function (k) { delete d[k]; }
  };
  // Object.keys(localStorage) فقط کلیدهای ذخیره‌شده رو برمی‌گردونه
  return new Proxy(s, { ownKeys: function () { return Object.keys(d); }, getOwnPropertyDescriptor: function (t, k) { return k in d ? { enumerable: true, configurable: true, value: d[k] } : undefined; } });
}
// یک window ساختگی؛ o: { ua, touch, capacitor, canShare, share, quota, standalone, notification, local }
function load(o) {
  o = o || {};
  var log = { downloads: [], shares: [], notes: [], timers: [] };
  var body = { appendChild: function () {} };
  var win = {
    localStorage: memStorage(o.quota), sessionStorage: memStorage(),
    location: { protocol: 'https:', hostname: 'example.org' },
    navigator: { userAgent: o.ua || 'Mozilla/5.0 (X11; Linux x86_64)', maxTouchPoints: o.touch ? 5 : 0, standalone: o.standalone,
      canShare: o.canShare, share: o.share, serviceWorker: {} },
    matchMedia: function () { return { matches: false }; },
    Capacitor: o.capacitor,
    document: { body: body, createElement: function () { var a = { click: function () { log.downloads.push(a.download); }, remove: function () {} }; return a; } },
    addEventListener: function () {}, removeEventListener: function () {}, print: function () { log.printed = true; },
    Notification: o.notification,
    history: { back: function () { log.back = true; } },
    FileReader: function () { var r = this; r.readAsDataURL = function () { r.result = 'data:x;base64,QUJD'; r.onload(); }; }
  };
  win.location.reload = function () { log.reloaded = true; };
  if (o.local) Object.keys(o.local).forEach(function (k) { win.localStorage.setItem(k, o.local[k]); });
  if (!o.notification) delete win.Notification;
  var ctx = { window: win, URL: { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} },
    File: function (parts, name, opts) { this.name = name; this.type = opts && opts.type; },
    setTimeout: function (fn, ms) { log.timers.push({ fn: fn, ms: ms }); return log.timers.length; }, clearTimeout: function (id) { if (log.timers[id - 1]) log.timers[id - 1].fn = null; },
    Promise: Promise, Date: Date, JSON: JSON, Object: Object, String: String, Math: Math, Error: Error };
  vm.runInNewContext(SRC, ctx);
  return { P: win.CoachPlatform, win: win, log: log };
}

var runs = [];
runs.push(test('ذخیره: نوشتن، خوندن، حذف، فهرست کلیدها با پیشوند و JSON', function () {
  var P = load().P;
  assert.strictEqual(P.store.get('a'), null);
  P.store.set('iranrunners-coach-x', 1); P.store.set('gaam-y', 'z'); P.store.set('other', 'o');
  assert.strictEqual(P.store.get('iranrunners-coach-x'), '1');
  assert.deepStrictEqual(P.store.keys('iranrunners-coach-'), ['iranrunners-coach-x']);
  assert.strictEqual(P.store.keys().length, 3);
  P.store.setJSON('j', { a: [1, 2] });
  assert.deepStrictEqual(P.store.getJSON('j'), { a: [1, 2] });
  P.store.set('bad', '{');
  assert.strictEqual(P.store.getJSON('bad', 'fb'), 'fb');
  P.store.remove('gaam-y');
  assert.strictEqual(P.store.get('gaam-y'), null);
}));
runs.push(test('ذخیره: پر شدن فضا خطا پرتاب می‌کنه (اپ پیام «ذخیره نشد» نشون می‌ده)', function () {
  var P = load({ quota: 10 }).P;
  assert.throws(function () { P.store.set('k', 'x'.repeat(20)); }, /quota/);
}));
runs.push(test('ذخیره: پشتوانه‌ی ناهمگام (نیتیو) اول کش رو پر می‌کنه و نوشتن‌ها رو می‌فرسته', function () {
  var P = load().P, written = {};
  var native = { sync: false, load: function () { return Promise.resolve({ a: '1' }); }, set: function (k, v) { written[k] = v; }, remove: function (k) { written[k] = null; } };
  return P.store.useBackend(native).then(function () {
    assert.strictEqual(P.store.get('a'), '1');
    P.store.set('b', 2);
    assert.strictEqual(P.store.get('b'), '2');
    assert.strictEqual(written.b, '2');
    P.store.remove('a');
    assert.strictEqual(P.store.get('a'), null);
    assert.deepStrictEqual(P.store.keys(), ['b']);
  });
}));
runs.push(test('نشست: جدا از ذخیره‌ی ماندگار', function () {
  var P = load().P;
  P.session.set('gaam-intro', 1);
  assert.strictEqual(P.session.get('gaam-intro'), '1');
  assert.strictEqual(P.store.get('gaam-intro'), null);
  assert.deepStrictEqual(P.session.keys('gaam-'), ['gaam-intro']);
}));
runs.push(test('پلتفرم: وب، آیفون از user agent، و نیتیو از Capacitor', function () {
  var w = load().P;
  assert.strictEqual(w.kind, 'web'); assert.strictEqual(w.isNative, false); assert.strictEqual(w.isIos(), false); assert.strictEqual(w.sw.supported(), true);
  var i = load({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', touch: true }).P;
  assert.strictEqual(i.isIos(), true); assert.strictEqual(i.isStandalone(), false);
  var n = load({ capacitor: { isNativePlatform: function () { return true; }, getPlatform: function () { return 'android'; } } }).P;
  assert.strictEqual(n.kind, 'android'); assert.strictEqual(n.isNative, true); assert.strictEqual(n.isStandalone(), true);
  assert.strictEqual(n.sw.supported(), false);
}));
runs.push(test('فایل: کامپیوتر دانلود؛ گوشی منوی اشتراک؛ لغو کاربر بدون دانلود', function () {
  var d = load({ canShare: function () { return true; }, share: function () { return Promise.resolve(); } });
  return d.P.files.save('a.json', { type: 'application/json' }, { share: true }).then(function (r) {
    assert.strictEqual(r, 'downloaded'); assert.deepStrictEqual(d.log.downloads, ['a.json']);
    var m = load({ touch: true, canShare: function () { return true; }, share: function () { return Promise.resolve(); } });
    return m.P.files.save('a.json', { type: 'application/json' }, { share: true }).then(function (r2) {
      assert.strictEqual(r2, 'shared'); assert.deepStrictEqual(m.log.downloads, []);
      var c = load({ touch: true, canShare: function () { return true; }, share: function () { var e = new Error('x'); e.name = 'AbortError'; return Promise.reject(e); } });
      return c.P.files.save('a.json', { type: 'application/json' }, { share: true }).then(function (r3) {
        assert.strictEqual(r3, 'cancelled'); assert.deepStrictEqual(c.log.downloads, []);
      });
    });
  });
}));
runs.push(test('اعلان: بدون اجازه چیزی زمان‌بندی نمی‌شه؛ زمان گذشته رد می‌شه؛ check قبل از نمایش', function () {
  var shown = [];
  function N(t, o) { shown.push(t + '|' + o.body); }
  N.permission = 'granted';
  var x = load({ notification: N });
  var now = Date.now();
  x.P.notify.schedule([{ at: new Date(now - 1000), title: 'past', body: '' }, { at: new Date(now + 5000), title: 'a', body: 'b' },
    { at: new Date(now + 9000), title: 'skip', body: '', check: function () { return false; } }]);
  var live = x.log.timers.filter(function (t) { return t.fn; });
  assert.strictEqual(live.length, 2);
  live.forEach(function (t) { t.fn(); });
  assert.deepStrictEqual(shown, ['a|b']);
  x.P.notify.cancelAll();
  assert.strictEqual(x.log.timers.filter(function (t) { return t.fn; }).length, 0);
  var none = load();
  assert.strictEqual(none.P.notify.supported(), false);
  assert.strictEqual(none.P.notify.permission(), 'denied');
}));

// Capacitor ساختگی با افزونه‌های نیتیو؛ همه‌ی فراخوانی‌ها در calls ثبت می‌شن
function fakeCap(prefs, opts) {
  opts = opts || {};
  var calls = [], pending = [], listeners = {};
  var ok = function (v) { return Promise.resolve(v); };
  var Plugins = {
    Preferences: {
      keys: function () { return ok({ keys: Object.keys(prefs) }); },
      get: function (o) { return ok({ value: Object.prototype.hasOwnProperty.call(prefs, o.key) ? prefs[o.key] : null }); },
      set: function (o) { prefs[o.key] = o.value; return ok(); },
      remove: function (o) { delete prefs[o.key]; return ok(); }
    },
    LocalNotifications: {
      checkPermissions: function () { return ok({ display: opts.perm || 'granted' }); },
      requestPermissions: function () { return ok({ display: 'granted' }); },
      getPending: function () { return ok({ notifications: pending.slice() }); },
      cancel: function (o) { var ids = o.notifications.map(function (n) { return n.id; }); pending = pending.filter(function (n) { return ids.indexOf(n.id) < 0; }); calls.push('cancel:' + ids.length); return ok(); },
      schedule: function (o) { pending = pending.concat(o.notifications); calls.push('schedule:' + o.notifications.map(function (n) { return n.title; }).join(',')); return ok(); }
    },
    Filesystem: { writeFile: function (o) { calls.push('write:' + o.directory + ':' + o.path + ':' + o.data); return ok({ uri: 'file:///cache/' + o.path }); } },
    Share: { share: function (o) { calls.push('share:' + o.files[0]); return opts.shareCancel ? Promise.reject(new Error('Share canceled')) : ok(); } },
    App: { addListener: function (n, fn) { listeners[n] = fn; }, exitApp: function () { calls.push('exit'); } },
    Health: {
      isAvailable: function () { return ok({ available: true, platform: 'android' }); },
      requestAuthorization: function (o) { calls.push('auth:' + o.read.join(',') + '|' + o.write.length); return ok({ readAuthorized: opts.healthDenied ? [] : o.read, readDenied: [] }); },
      queryWorkouts: function (o) { calls.push('query:' + o.startDate.slice(0, 10) + '>' + o.endDate.slice(0, 10)); return ok({ workouts: [
        { workoutType: 'running', duration: 1805.6, totalDistance: 5023, startDate: '2026-10-26T03:45:00Z', endDate: '2026-10-26T04:15:00Z', sourceName: 'Watch', platformId: 'uuid-1' },
        { workoutType: 'walking', duration: 900, startDate: '2026-10-27T03:45:00Z', endDate: '2026-10-27T04:00:00Z' }] }); },
      openHealthConnectSettings: function () { calls.push('hc-settings'); return ok(); }
    },
    BackgroundGeolocation: {
      addWatcher: function (o, cb) { calls.push('watch:' + o.backgroundMessage); listeners.gps = cb; return ok('w1'); },
      removeWatcher: function (o) { calls.push('unwatch:' + o.id); return ok(); },
      openSettings: function () { calls.push('loc-settings'); return ok(); }
    }
  };
  return { isNativePlatform: function () { return true; }, getPlatform: function () { return 'android'; }, Plugins: Plugins, calls: calls, pending: function () { return pending; }, listeners: listeners };
}
runs.push(test('سلامت: وب نداره؛ نیتیو فقط خوندن تمرین، با مسافت به کیلومتر', function () {
  var w = load().P;
  assert.strictEqual(w.health.supported(), false);
  var c = fakeCap({}), x = load({ capacitor: c });
  assert.strictEqual(x.P.health.supported(), true);
  return x.P.health.available().then(function (a) {
    assert.strictEqual(a.available, true);
    return x.P.health.connect();
  }).then(function (ok) {
    assert.strictEqual(ok, true);
    // اندروید: مسافت و کالری فقط برای مسافت تمرین؛ هیچ نوشتنی
    assert.ok(c.calls.indexOf('auth:workouts,distance,calories|0') >= 0);
    return x.P.health.workouts(new Date('2026-10-20T00:00:00Z'), new Date('2026-10-30T00:00:00Z'));
  }).then(function (ws) {
    // آبجکت از context دیگه‌ی vm میاد؛ مقایسه با JSON
    assert.deepStrictEqual(JSON.parse(JSON.stringify(ws[0])), { id: 'uuid-1', type: 'running', start: '2026-10-26T03:45:00Z', end: '2026-10-26T04:15:00Z', sec: 1806, km: 5.02, source: 'Watch' });
    assert.strictEqual(ws[1].id, 'walking@2026-10-27T03:45:00Z');
    assert.strictEqual(ws[1].km, null);
    assert.strictEqual(x.P.health.canOpenSettings(), true);
    return x.P.health.openSettings();
  }).then(function () {
    assert.ok(c.calls.indexOf('hc-settings') >= 0);
    return load({ capacitor: fakeCap({}, { healthDenied: true }) }).P.health.connect();
  }).then(function (ok) { assert.strictEqual(ok, false); });
}));
runs.push(test('GPS: نیتیو با سرویس پس‌زمینه؛ نقطه‌ها و خطای اجازه', function () {
  var c = fakeCap({}), x = load({ capacitor: c }), pts = [], errs = [];
  assert.strictEqual(x.P.gps.background(), true);
  assert.strictEqual(load().P.gps.background(), false);
  return x.P.gps.start(function (p) { pts.push(p); }, function (e) { errs.push(e); }, { title: 'گام', message: 'در حال ثبت دویدن' }).then(function (h) {
    assert.ok(c.calls.indexOf('watch:در حال ثبت دویدن') >= 0);
    c.listeners.gps({ latitude: 35.7, longitude: 51.4, accuracy: 6, time: 1000 });
    c.listeners.gps(null, { code: 'NOT_AUTHORIZED' });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(pts)), [{ lat: 35.7, lon: 51.4, acc: 6, t: 1000 }]);
    assert.deepStrictEqual(errs, ['denied']);
    return x.P.gps.stop(h);
  }).then(function () { assert.ok(c.calls.indexOf('unwatch:w1') >= 0); });
}));
function tick() { return new Promise(function (r) { setImmediate(r); }); }

runs.push(test('نیتیو: نوشتن‌ها در Preferences هم کپی می‌شن؛ اگه داده‌ی WebView پاک شده باشه برمی‌گرده و یک بار reload', function () {
  var prefs = {}, c = fakeCap(prefs), x = load({ capacitor: c });
  return x.P.ready().then(function () {
    x.P.store.set('iranrunners-coach-state', '{"a":1}');
    x.P.store.remove('gaam-x');
    assert.strictEqual(prefs['iranrunners-coach-state'], '{"a":1}');
    var y = load({ capacitor: fakeCap(prefs) });
    return y.P.ready().then(function () {
      assert.strictEqual(y.log.reloaded, true);
      assert.strictEqual(y.win.localStorage.getItem('iranrunners-coach-state'), '{"a":1}');
    });
  }).then(function () {
    // داده‌ی قدیمی در WebView و Preferences خالی: همه کپی می‌شن
    var p2 = {}, w = load({ capacitor: fakeCap(p2), local: { 'gaam-lang': 'en', other: 'x' } });
    return w.P.ready().then(function () { assert.deepStrictEqual(p2, { 'gaam-lang': 'en' }); assert.ok(!w.log.reloaded); });
  });
}));
runs.push(test('نیتیو: یادآوری‌ها اعلان محلی سیستم‌ان؛ check و زمان گذشته موقع زمان‌بندی؛ جایگزینی قبلی‌ها', function () {
  var c = fakeCap({}), x = load({ capacitor: c }), now = Date.now();
  return tick().then(function () {
    assert.strictEqual(x.P.notify.supported(), true);
    assert.strictEqual(x.P.notify.permission(), 'granted');
    x.P.notify.schedule([{ at: new Date(now - 1000), title: 'past' }, { at: new Date(now + 5000), title: 'a' },
      { at: new Date(now + 9000), title: 'skip', check: function () { return false; } }, { at: new Date(now + 9000), title: 'b' }]);
    x.P.notify.schedule([{ at: new Date(now + 5000), title: 'c' }]);
    return x.P.ready().then(tick).then(tick).then(tick).then(tick);
  }).then(function () {
    assert.deepStrictEqual(c.pending().map(function (n) { return n.title; }), ['c']);
    // زنگ دقیق نه (وگرنه اندروید ۱۲+ صفحه‌ی تنظیمات رو باز می‌کنه)
    assert.strictEqual(c.pending()[0].isExactNotification, false);
    assert.ok(c.calls.indexOf('schedule:a,b') >= 0 && c.calls.indexOf('cancel:2') >= 0);
    x.P.notify.cancelAll();
    return tick().then(tick).then(tick);
  }).then(function () { assert.strictEqual(c.pending().length, 0); });
}));
runs.push(test('نیتیو: فایل در کش نوشته و منوی اشتراک باز می‌شه؛ لغو؛ چاپ نداره؛ دکمه‌ی برگشت', function () {
  var c = fakeCap({}), x = load({ capacitor: c });
  assert.strictEqual(x.P.files.canPrint(), false);
  assert.strictEqual(load().P.files.canPrint(), true);
  return x.P.files.save('b.json', { type: 'application/json' }, { share: true }).then(function (r) {
    assert.strictEqual(r, 'shared');
    assert.deepStrictEqual(c.calls.slice(0, 2), ['write:CACHE:b.json:QUJD', 'share:file:///cache/b.json']);
    assert.deepStrictEqual(x.log.downloads, []);
    var cc = fakeCap({}, { shareCancel: true });
    return load({ capacitor: cc }).P.files.save('b.json', {}).then(function (r2) { assert.strictEqual(r2, 'cancelled'); });
  }).then(function () {
    c.listeners.backButton({ canGoBack: true }); assert.strictEqual(x.log.back, true);
    c.listeners.backButton({ canGoBack: false }); assert.ok(c.calls.indexOf('exit') >= 0);
  });
}));

Promise.all(runs).then(function () { console.log(passed + ' تست لایه‌ی پلتفرم موفق' + (process.exitCode ? ' — برخی ناموفق' : '')); });
