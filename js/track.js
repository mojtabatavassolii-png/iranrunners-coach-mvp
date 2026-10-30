/*
 * ثبت دویدن با GPS: محاسبه‌ی مسافت، زمان، پیس و اسپلیت‌های هر کیلومتر از نقطه‌های موقعیت.
 * بدون DOM و بدون پلتفرم (نقطه‌ها رو CoachPlatform.gps می‌ده)، تا با تست‌های node بررسی بشه.
 * شکل مسیر (برای کشیدن روی صفحه، بدون نقشه‌ی زمینه): هر ۸ متر یک نقطه، جدا برای هر تکه بین توقف‌ها، و جای هر کیلومتر.
 * routeOut ساده‌شده و فشرده‌ش (polyline) رو برای ذخیره کنار همون دویدن روی دستگاه می‌ده؛ به جایی فرستاده نمی‌شه.
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
  var ROUTE_STEP = 8;      // فاصله‌ی نقطه‌های شکل مسیر (متر)
  var ROUTE_TOL = 4;       // ساده‌سازی شکل مسیر برای ذخیره (متر)

  function rad(x) { return x * Math.PI / 180; }
  // فاصله‌ی دو نقطه روی کره (متر)
  function haversine(a, b) {
    var R = 6371000, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function create(now) {
    return { startedAt: now, activeMs: 0, segStart: now, paused: false, dist: 0, movingMs: 0, last: null,
      jumps: 0, rejected: 0, points: 0, splits: [], recent: [], lastAcc: null, route: [], kmMarks: [] };
  }
  function r5(x) { return Math.round(x * 1e5) / 1e5; }
  // نقطه‌ی شکل مسیر؛ newSeg: تکه‌ی تازه (شروع، بعد از توقف یا قطع GPS)
  function routeAdd(st, lat, lon, newSeg) {
    st.route = st.route || [];
    var seg = st.route[st.route.length - 1];
    if (newSeg || !seg) { st.route.push([[r5(lat), r5(lon)]]); return; }
    var tail = seg[seg.length - 1];
    if (haversine({ lat: tail[0], lon: tail[1] }, { lat: lat, lon: lon }) >= ROUTE_STEP) seg.push([r5(lat), r5(lon)]);
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
    if (!last) { st.last = { lat: p.lat, lon: p.lon, t: p.t }; st.points++; routeAdd(st, p.lat, p.lon, true); return false; }
    if (p.t <= last.t) return false;
    var d = haversine(last, p), dt = (p.t - last.t) / 1000;
    if (d / dt > MAX_SPEED) {
      st.rejected++;
      if (++st.jumps >= JUMP_RESET) { st.last = { lat: p.lat, lon: p.lon, t: p.t }; st.jumps = 0; routeAdd(st, p.lat, p.lon, true); }
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
    routeAdd(st, p.lat, p.lon, false);
    st.recent.push({ t: p.t, d: st.dist });
    while (st.recent.length > 2 && p.t - st.recent[0].t > WINDOW_MS) st.recent.shift();
    // اسپلیت هر کیلومتر کامل: زمان فعال تا اون لحظه، با درون‌یابی داخل همین قطعه
    var k = Math.floor(st.dist / 1000);
    while (st.splits.length < k) {
      var target = (st.splits.length + 1) * 1000, frac = (target - before) / d;
      var at = elapsed(st, last.t + frac * (p.t - last.t));
      var prev = st.splits.reduce(function (s, x) { return s + x; }, 0);
      st.splits.push(Math.round(at / 1000 - prev));
      st.kmMarks = st.kmMarks || [];
      st.kmMarks.push([r5(last.lat + frac * (p.lat - last.lat)), r5(last.lon + frac * (p.lon - last.lon))]);
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

  // ---------- شکل مسیر برای ذخیره ----------
  // ساده‌سازی Douglas–Peucker (در متر، با تصویر محلی) و رمزگذاری polyline (دقت ۱e-5)
  function simplify(pts, tol) {
    if (pts.length < 3) return pts.slice();
    var lat0 = rad(pts[0][0]), kx = 6371000 * Math.cos(lat0) * Math.PI / 180, ky = 6371000 * Math.PI / 180;
    var xy = pts.map(function (q) { return [q[1] * kx, q[0] * ky]; }), keep = new Array(pts.length);
    keep[0] = keep[pts.length - 1] = true;
    (function dp(a, b) {
      var best = -1, bi = -1, ax = xy[a][0], ay = xy[a][1], bx = xy[b][0], by = xy[b][1], L = Math.hypot(bx - ax, by - ay);
      for (var i = a + 1; i < b; i++) {
        var d = L ? Math.abs((bx - ax) * (ay - xy[i][1]) - (ax - xy[i][0]) * (by - ay)) / L : Math.hypot(xy[i][0] - ax, xy[i][1] - ay);
        if (d > best) { best = d; bi = i; }
      }
      if (best > tol) { keep[bi] = true; dp(a, bi); dp(bi, b); }
    })(0, pts.length - 1);
    return pts.filter(function (q, i) { return keep[i]; });
  }
  function encNum(v) {
    v = v < 0 ? ~(v << 1) : v << 1;
    var s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  }
  function encode(pts) {
    var plat = 0, plon = 0;
    return pts.map(function (q) {
      var la = Math.round(q[0] * 1e5), lo = Math.round(q[1] * 1e5), s = encNum(la - plat) + encNum(lo - plon);
      plat = la; plon = lo;
      return s;
    }).join('');
  }
  function decode(str) {
    var out = [], i = 0, la = 0, lo = 0;
    function next() { var r = 0, sh = 0, b; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; }
    while (i < str.length) { la += next(); lo += next(); out.push([la / 1e5, lo / 1e5]); }
    return out;
  }
  // { segs: [polyline], km: polyline } یا null (اگه مسیری نیست)
  function routeOut(st) {
    var segs = (st.route || []).filter(function (s) { return s.length >= 2; }).map(function (s) { return encode(simplify(s, ROUTE_TOL)); });
    return segs.length ? { segs: segs, km: encode(st.kmMarks || []) } : null;
  }

  var api = { routeOut: routeOut, decode: decode, encode: encode, simplify: simplify, create: create, add: add, pause: pause, resume: resume, elapsed: elapsed, avgPace: avgPace, currentPace: currentPace,
    signal: signal, summary: summary, haversine: haversine, MAX_ACC: MAX_ACC, MAX_SPEED: MAX_SPEED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachTrack = api;
})(typeof window !== 'undefined' ? window : this);
