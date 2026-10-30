/*
 * ثبت دویدن با GPS: محاسبه‌ی مسافت، زمان، پیس و اسپلیت‌های هر کیلومتر از نقطه‌های موقعیت.
 * بدون DOM و بدون پلتفرم (نقطه‌ها رو CoachPlatform.gps می‌ده)، تا با تست‌های node بررسی بشه.
 * مختصات نگه داشته نمی‌شن: فقط آخرین نقطه برای محاسبه‌ی فاصله‌ی بعدی (بعد از پایان هم پاک می‌شه).
 *
 * نقطه: { lat, lon, acc (متر، دقت افقی)، t (میلی‌ثانیه) }
 * وضعیت: create(now) → add(st, p) → pause / resume → summary(st, now)
 */
(function (root) {
  'use strict';
  var MAX_ACC = 30;        // نقطه‌ی با دقت بدتر از ۳۰ متر کنار گذاشته می‌شه
  var MAX_SPEED = 8;       // بیشتر از ۸ متر بر ثانیه (۲۹ کیلومتر بر ساعت) پرش GPS حساب می‌شه، نه دویدن
  var MIN_STEP = 3;        // جابه‌جایی کمتر از ۳ متر (یا نصف دقت) لرزش GPS در حالت ایستاده‌ست
  var JUMP_RESET = 5;      // بعد از ۵ پرش پشت‌سرهم، نقطه‌ی تازه مبنا می‌شه (بدون حساب کردن مسافتش)
  var WINDOW_MS = 30000;   // پیس لحظه‌ای از ۳۰ ثانیه‌ی آخر
  var MOVING = 0.5;        // سریع‌تر از نیم متر بر ثانیه یعنی در حال حرکت

  function rad(x) { return x * Math.PI / 180; }
  // فاصله‌ی دو نقطه روی کره (متر)
  function haversine(a, b) {
    var R = 6371000, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function create(now) {
    return { startedAt: now, activeMs: 0, segStart: now, paused: false, dist: 0, movingMs: 0, last: null,
      jumps: 0, rejected: 0, points: 0, splits: [], recent: [], lastAcc: null };
  }
  // زمان فعال (بدون توقف‌ها)
  function elapsed(st, now) { return st.activeMs + (st.paused ? 0 : Math.max(0, now - st.segStart)); }

  // یک نقطه‌ی تازه؛ true اگه مسافت اضافه شد
  function add(st, p) {
    if (!p || !isFinite(p.lat) || !isFinite(p.lon) || !isFinite(p.t)) return false;
    st.lastAcc = p.acc;
    if (st.paused) return false;
    if (!(p.acc <= MAX_ACC)) { st.rejected++; return false; }
    var last = st.last;
    if (!last) { st.last = { lat: p.lat, lon: p.lon, t: p.t }; st.points++; return false; }
    if (p.t <= last.t) return false;
    var d = haversine(last, p), dt = (p.t - last.t) / 1000;
    if (d / dt > MAX_SPEED) {
      st.rejected++;
      if (++st.jumps >= JUMP_RESET) { st.last = { lat: p.lat, lon: p.lon, t: p.t }; st.jumps = 0; }
      return false;
    }
    st.jumps = 0;
    if (d < Math.max(MIN_STEP, (p.acc || 0) / 2)) {
      // ایستاده یا لرزش: نقطه‌ی مبنا عوض نمی‌شه تا لرزش‌های کوچک روی هم جمع نشن
      return false;
    }
    var before = st.dist;
    st.dist += d;
    if (d / dt >= MOVING) st.movingMs += dt * 1000;
    st.last = { lat: p.lat, lon: p.lon, t: p.t };
    st.points++;
    st.recent.push({ t: p.t, d: st.dist });
    while (st.recent.length > 2 && p.t - st.recent[0].t > WINDOW_MS) st.recent.shift();
    // اسپلیت هر کیلومتر کامل: زمان فعال تا اون لحظه، با درون‌یابی داخل همین قطعه
    var k = Math.floor(st.dist / 1000);
    while (st.splits.length < k) {
      var target = (st.splits.length + 1) * 1000, frac = (target - before) / d;
      var at = elapsed(st, last.t + frac * (p.t - last.t));
      var prev = st.splits.reduce(function (s, x) { return s + x; }, 0);
      st.splits.push(Math.round(at / 1000 - prev));
    }
    return true;
  }

  function pause(st, now) {
    if (st.paused) return;
    st.activeMs += Math.max(0, now - st.segStart);
    st.paused = true;
    // فاصله‌ی بین محل توقف و محل ادامه حساب نمی‌شه
    st.last = null; st.recent = []; st.jumps = 0;
  }
  function resume(st, now) {
    if (!st.paused) return;
    st.paused = false;
    st.segStart = now;
  }

  // پیس میانگین (ثانیه بر کیلومتر) یا null
  function avgPace(st, now) { return st.dist >= 50 ? elapsed(st, now) / 1000 / (st.dist / 1000) : null; }
  // پیس لحظه‌ای از ۳۰ ثانیه‌ی آخر؛ null اگه ایستاده یا داده کمه
  function currentPace(st, now) {
    var r = st.recent;
    if (st.paused || r.length < 2 || now - r[r.length - 1].t > 15000) return null;
    var d = r[r.length - 1].d - r[0].d, dt = (r[r.length - 1].t - r[0].t) / 1000;
    return d >= 20 && dt > 0 ? dt / (d / 1000) : null;
  }
  // وضعیت GPS برای نمایش: 'wait' (هنوز نقطه‌ای نیومده) | 'weak' | 'good'
  function signal(st) { return st.lastAcc == null ? 'wait' : (st.lastAcc <= 15 ? 'good' : 'weak'); }

  // نتیجه برای ذخیره: همون شکل عدد واقعی جلسه (km، sec، start) به‌علاوه‌ی اسپلیت‌ها
  function summary(st, now) {
    var sec = Math.round(elapsed(st, now) / 1000), d = new Date(st.startedAt);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return { km: Math.round(st.dist / 10) / 100, sec: sec, movingSec: Math.round(st.movingMs / 1000), splits: st.splits.slice(),
      start: pad(d.getHours()) + ':' + pad(d.getMinutes()), points: st.points, rejected: st.rejected };
  }

  var api = { create: create, add: add, pause: pause, resume: resume, elapsed: elapsed, avgPace: avgPace, currentPace: currentPace,
    signal: signal, summary: summary, haversine: haversine, MAX_ACC: MAX_ACC, MAX_SPEED: MAX_SPEED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachTrack = api;
})(typeof window !== 'undefined' ? window : this);
