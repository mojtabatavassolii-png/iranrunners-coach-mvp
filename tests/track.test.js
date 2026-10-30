// اجرای تست‌ها: node tests/track.test.js
// ثبت دویدن با GPS (js/track.js): مسافت، فیلتر نقطه‌های بد، توقف، اسپلیت و پیس با مسیرهای ساختگی
'use strict';
var assert = require('assert');
var K = require('../js/track.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + (e && e.message)); process.exitCode = 1; }
}
// مسیر مستقیم به سمت شمال: هر ثانیه v متر؛ ۱ درجه‌ی عرض ≈ ۱۱۱۱۹۵ متر
var M = 111195;
function run(st, from, t0, sec, v, acc, noise) {
  var lat = from, t = t0;
  for (var i = 0; i < sec; i++) {
    lat += v / M; t += 1000;
    var n = noise ? (Math.sin(i * 1.7) * noise) / M : 0;
    K.add(st, { lat: lat + n, lon: 51.4, acc: acc || 5, t: t });
  }
  return { lat: lat, t: t };
}

test('مسافت مسیر مستقیم و پیس میانگین', function () {
  var t0 = Date.UTC(2026, 9, 30, 4, 0, 0), st = K.create(t0);
  K.add(st, { lat: 35.7, lon: 51.4, acc: 5, t: t0 });
  var e = run(st, 35.7, t0, 1503, 10 / 3, 5);   // ۱۵۰۳ ثانیه با ۳٫۳۳ متر بر ثانیه ≈ ۵٫۰۱ کیلومتر، پیس ۵:۰۰
  var s = K.summary(st, e.t);
  assert.ok(Math.abs(s.km - 5.01) < 0.02, s.km);
  assert.strictEqual(s.sec, 1503);
  assert.ok(Math.abs(K.avgPace(st, e.t) - 300) < 2, K.avgPace(st, e.t));
  assert.ok(Math.abs(K.currentPace(st, e.t) - 300) < 3, K.currentPace(st, e.t));
  assert.strictEqual(s.splits.length, 5);
  s.splits.forEach(function (x) { assert.ok(Math.abs(x - 300) <= 2, s.splits.join(',')); });
  assert.strictEqual(s.start, new Date(t0).getHours().toString().padStart(2, '0') + ':00');
});

test('لرزش GPS در حالت ایستاده مسافت نمی‌سازه', function () {
  var t0 = 1e12, st = K.create(t0);
  for (var i = 0; i < 300; i++) K.add(st, { lat: 35.7 + Math.sin(i) * 2 / M, lon: 51.4, acc: 8, t: t0 + i * 1000 });
  assert.ok(st.dist < 10, st.dist);
  assert.strictEqual(K.currentPace(st, t0 + 300000), null);
});

test('نقطه‌های با دقت بد و پرش‌ها کنار گذاشته می‌شن', function () {
  var t0 = 1e12, st = K.create(t0);
  K.add(st, { lat: 35.7, lon: 51.4, acc: 5, t: t0 });
  var e = run(st, 35.7, t0, 300, 3, 5);                                          // ۹۰۰ متر
  K.add(st, { lat: e.lat + 500 / M, lon: 51.4, acc: 5, t: e.t + 1000 });          // پرش ۵۰۰ متری در ۱ ثانیه
  K.add(st, { lat: e.lat + 3 / M, lon: 51.4, acc: 80, t: e.t + 2000 });            // دقت ۸۰ متر
  run(st, e.lat, e.t + 2000, 100, 3, 5);                                         // ۳۰۰ متر دیگه
  assert.ok(Math.abs(st.dist - 1206) < 15, st.dist);
  assert.strictEqual(st.rejected, 2);
});

test('بعد از چند پرش پشت‌سرهم (مثلاً بعد از تونل)، مبنا عوض می‌شه', function () {
  var t0 = 1e12, st = K.create(t0);
  K.add(st, { lat: 35.7, lon: 51.4, acc: 5, t: t0 });
  // پنج نقطه‌ی ۲ کیلومتر دورتر، پشت‌سرهم
  for (var i = 1; i <= 5; i++) K.add(st, { lat: 35.7 + 2000 / M, lon: 51.4, acc: 5, t: t0 + i * 1000 });
  assert.ok(st.dist < 1, st.dist);
  run(st, 35.7 + 2000 / M, t0 + 5000, 100, 3, 5);
  assert.ok(Math.abs(st.dist - 300) < 10, st.dist);
});

test('توقف: زمان و مسافت حین توقف حساب نمی‌شه', function () {
  var t0 = 1e12, st = K.create(t0);
  K.add(st, { lat: 35.7, lon: 51.4, acc: 5, t: t0 });
  var e = run(st, 35.7, t0, 200, 3, 5);              // ۶۰۰ متر، ۲۰۰ ثانیه
  K.pause(st, e.t);
  run(st, e.lat, e.t, 120, 3, 5);                    // راه رفتن حین توقف
  var back = { lat: e.lat + 360 / M, t: e.t + 120000 };
  K.resume(st, back.t);
  K.add(st, { lat: back.lat, lon: 51.4, acc: 5, t: back.t });
  run(st, back.lat, back.t, 100, 3, 5);              // ۳۰۰ متر، ۱۰۰ ثانیه
  var s = K.summary(st, back.t + 100000);
  assert.ok(Math.abs(s.km - 0.9) < 0.02, s.km);
  assert.strictEqual(s.sec, 300);
  assert.ok(Math.abs(K.currentPace(st, back.t + 100000) - 333) < 5, K.currentPace(st, back.t + 100000));
});

test('اسپلیت‌ها با پیس متغیر', function () {
  var t0 = 1e12, st = K.create(t0);
  K.add(st, { lat: 35.7, lon: 51.4, acc: 5, t: t0 });
  var e = run(st, 35.7, t0, 360, 1000 / 360, 6, 1);  // کیلومتر اول ۶:۰۰ با کمی نویز
  run(st, e.lat, e.t, 280, 1000 / 270, 6, 1);       // کیلومتر دوم ۴:۳۰ (و کمی بیشتر)
  var s = K.summary(st, e.t + 280000);
  assert.strictEqual(s.splits.length, 2, s.splits.join(','));
  assert.ok(Math.abs(s.splits[0] - 360) <= 4 && Math.abs(s.splits[1] - 270) <= 4, s.splits.join(','));
});

test('وضعیت سیگنال', function () {
  var st = K.create(0);
  assert.strictEqual(K.signal(st), 'wait');
  K.add(st, { lat: 1, lon: 1, acc: 25, t: 1 });
  assert.strictEqual(K.signal(st), 'weak');
  K.add(st, { lat: 1, lon: 1, acc: 6, t: 2 });
  assert.strictEqual(K.signal(st), 'good');
});

console.log(passed + ' تست ثبت GPS موفق' + (process.exitCode ? ' — برخی ناموفق' : ''));
