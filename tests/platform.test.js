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
// یک window ساختگی؛ o: { ua, touch, capacitor, canShare, share, quota, standalone }
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
    Notification: o.notification
  };
  if (!o.notification) delete win.Notification;
  var ctx = { window: win, URL: { createObjectURL: function () { return 'blob:x'; }, revokeObjectURL: function () {} },
    File: function (parts, name, opts) { this.name = name; this.type = opts && opts.type; },
    setTimeout: function (fn, ms) { log.timers.push({ fn: fn, ms: ms }); return log.timers.length; }, clearTimeout: function (id) { if (log.timers[id - 1]) log.timers[id - 1].fn = null; },
    Promise: Promise, Date: Date, JSON: JSON, Object: Object, String: String, Math: Math };
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

Promise.all(runs).then(function () { console.log(passed + ' تست لایه‌ی پلتفرم موفق' + (process.exitCode ? ' — برخی ناموفق' : '')); });
