/*
 * سنسور ضربان قلب بلوتوث (پروفایل استاندارد Heart Rate، سرویس 0x180D، مشخصه‌ی 0x2A37):
 * خوندن بسته‌ی «Heart Rate Measurement» و آمار جلسه (میانگین وزنی با زمان، بیشینه، زمان بالای سقف ایزی).
 * بدون DOM و پلتفرم (اتصال در CoachPlatform.hr)، تا با تست‌های node بررسی بشه. فقط همین عددها ذخیره می‌شن.
 */
(function (root) {
  'use strict';
  var MIN_BPM = 30, MAX_BPM = 240;
  var GAP_MS = 5000; // فاصله‌ی بیشتر از ۵ ثانیه بین دو عدد (قطع سنسور) در آمار حساب نمی‌شه

  // bytes: آرایه‌ی عدد ۰ تا ۲۵۵ (یا Uint8Array). خروجی: { bpm, contact: true|false|null, rr: [میلی‌ثانیه] } یا null
  function parse(bytes) {
    if (!bytes || bytes.length < 2) return null;
    var f = bytes[0], i = 1, bpm;
    if (f & 1) { if (bytes.length < 3) return null; bpm = bytes[1] | (bytes[2] << 8); i = 3; } else { bpm = bytes[1]; i = 2; }
    // بیت ۱ و ۲: وضعیت تماس با پوست (اگه بیت ۲ صفر باشه، سنسور پشتیبانی نمی‌کنه)
    var contact = (f & 4) ? !!(f & 2) : null;
    if (f & 8) i += 2; // انرژی مصرفی (استفاده نمی‌شه)
    var rr = [];
    if (f & 16) for (; i + 1 < bytes.length; i += 2) rr.push(Math.round((bytes[i] | (bytes[i + 1] << 8)) * 1000 / 1024));
    return { bpm: bpm, contact: contact, rr: rr };
  }
  // «0a 46» یا «0a46» (خروجی افزونه‌ی بلوتوث در اپ نیتیو) → آرایه‌ی بایت
  function hexToBytes(hex) {
    var out = [], s = String(hex || '').replace(/[^0-9a-f]/gi, '');
    for (var i = 0; i + 1 < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
    return out;
  }
  function valid(bpm) { return bpm >= MIN_BPM && bpm <= MAX_BPM; }

  function create() { return { sumMs: 0, weighted: 0, max: 0, aboveMs: 0, last: null, samples: 0 }; }
  // یک عدد ضربان در زمان t (میلی‌ثانیه). easyMax: سقف ضربان ایزی (اختیاری). counting: false یعنی ثبت متوقفه
  function add(st, bpm, t, easyMax, counting) {
    if (!valid(bpm)) return;
    var prev = st.last;
    st.last = { bpm: bpm, t: t };
    if (counting === false) return;
    st.samples++;
    if (bpm > st.max) st.max = bpm;
    if (!prev || t <= prev.t || t - prev.t > GAP_MS) return;
    var dt = t - prev.t;
    st.sumMs += dt; st.weighted += prev.bpm * dt;
    if (easyMax && prev.bpm > easyMax) st.aboveMs += dt;
  }
  // بعد از توقف موقت، فاصله‌ی توقف حساب نشه
  function gap(st) { st.last = null; }
  function summary(st) {
    if (!st || !st.samples) return null;
    var avg = st.sumMs ? Math.round(st.weighted / st.sumMs) : (st.last ? st.last.bpm : 0);
    return { avg: avg, max: st.max, aboveSec: Math.round(st.aboveMs / 1000), sec: Math.round(st.sumMs / 1000) };
  }

  var api = { parse: parse, hexToBytes: hexToBytes, valid: valid, create: create, add: add, gap: gap, summary: summary,
    SERVICE: '0000180d-0000-1000-8000-00805f9b34fb', MEASUREMENT: '00002a37-0000-1000-8000-00805f9b34fb' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachHr = api;
})(typeof window !== 'undefined' ? window : this);
