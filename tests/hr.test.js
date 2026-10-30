// اجرای تست‌ها: node tests/hr.test.js
// سنسور ضربان قلب (js/hr.js): خوندن بسته‌ی استاندارد Heart Rate Measurement و آمار جلسه
'use strict';
var assert = require('assert');
var H = require('../js/hr.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('✗ ' + name + '\n  ' + (e && e.message)); process.exitCode = 1; }
}

test('بسته‌ی ۸ بیتی، ۱۶ بیتی، تماس با پوست و RR', function () {
  assert.deepStrictEqual(H.parse([0x00, 72]), { bpm: 72, contact: null, rr: [] });
  assert.deepStrictEqual(H.parse([0x01, 0x2c, 0x01]), { bpm: 300, contact: null, rr: [] });
  assert.strictEqual(H.parse([0x06, 150]).contact, true);
  assert.strictEqual(H.parse([0x04, 150]).contact, false);
  // RR: ۱۰۲۴ واحد = ۱ ثانیه؛ با فیلد انرژی (بیت ۳) قبلش
  var p = H.parse([0x18, 140, 0x10, 0x00, 0x00, 0x04, 0x00, 0x02]);
  assert.strictEqual(p.bpm, 140);
  assert.deepStrictEqual(p.rr, [1000, 500]);
  assert.strictEqual(H.parse([0x01, 0x50]), null);
  assert.strictEqual(H.parse([]), null);
});

test('رشته‌ی hex افزونه‌ی بلوتوث', function () {
  assert.deepStrictEqual(H.hexToBytes('16 8c 00 04'), [0x16, 0x8c, 0x00, 0x04]);
  assert.deepStrictEqual(H.hexToBytes('008c'), [0, 140]);
});

test('میانگین وزنی با زمان، بیشینه و زمان بالای سقف ایزی', function () {
  var st = H.create(), t = 0;
  // ۶۰ ثانیه ۱۴۰، بعد ۳۰ ثانیه ۱۷۰ (سقف ایزی ۱۵۰)
  for (var i = 0; i <= 60; i++) H.add(st, 140, t + i * 1000, 150);
  for (var j = 1; j <= 30; j++) H.add(st, 170, t + (60 + j) * 1000, 150);
  var s = H.summary(st);
  assert.strictEqual(s.max, 170);
  assert.strictEqual(s.sec, 90);
  // ۶۰ ثانیه ۱۴۰ + ۳۰ ثانیه ۱۷۰ (هر بازه با عدد اولش)
  assert.ok(Math.abs(s.avg - 150) <= 1, s.avg);
  assert.ok(Math.abs(s.aboveSec - 29) <= 1, s.aboveSec);
});

test('عدد نامعتبر، قطع سنسور و توقف موقت', function () {
  var st = H.create();
  H.add(st, 0, 0); H.add(st, 255, 1000);
  assert.strictEqual(H.summary(st), null);
  H.add(st, 120, 0); H.add(st, 120, 1000);
  H.add(st, 130, 60000);                       // ۵۹ ثانیه بی‌خبر: حساب نمی‌شه
  assert.strictEqual(H.summary(st).sec, 1);
  H.add(st, 200, 61000, null, false);          // حین توقف: نه بیشینه، نه زمان
  H.gap(st);
  H.add(st, 125, 120000); H.add(st, 125, 121000);
  var s = H.summary(st);
  assert.strictEqual(s.max, 130);
  assert.strictEqual(s.sec, 2);
});

console.log(passed + ' تست سنسور ضربان موفق' + (process.exitCode ? ' — برخی ناموفق' : ''));
