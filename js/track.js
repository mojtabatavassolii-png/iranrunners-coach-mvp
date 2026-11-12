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
  var MAX_ACC = 20;        // برای حساب مسافت فقط نقطه‌ی با دقت ۲۰ متر یا بهتر
  var RELAX_ACC = 30;      // ولی اگه ۲۰ ثانیه هیچ نقطه‌ی خوبی نیومده (سیگنال ضعیف بین ساختمان‌ها)، تا ۳۰ متر هم قبول می‌شه
  var RELAX_MS = 20000;
  var MAX_SPEED = 8;       // بیشتر از ۸ متر بر ثانیه (۲۹ کیلومتر بر ساعت) پرش GPS حساب می‌شه، نه دویدن
  var MIN_STEP = 3;        // جابه‌جایی کمتر از ۳ متر (یا نصف دقت) لرزش GPS در حالت ایستاده‌ست
  var JUMP_RESET = 5;      // بعد از ۵ پرش پشت‌سرهم، نقطه‌ی تازه مبنا می‌شه (بدون حساب کردن مسافتش)
  var WINDOW_MS = 30000;   // پیس لحظه‌ای از ۳۰ ثانیه‌ی آخر
  var MOVING = 0.5;        // سریع‌تر از نیم متر بر ثانیه یعنی در حال حرکت
  // تشخیص ایستادن (پشت چراغ، استراحت): رانش آهسته‌ی GPS در حالت ایستاده نباید مسافت بسازه.
  // سرعت خود دستگاه (داپلر) اگه باشه ملاکه؛ وگرنه جابه‌جایی خالص نقطه‌های ۲۰ ثانیه‌ی آخر (رانش، رفت‌وبرگشتی و کمه).
  var STILL_SPEED = 0.5;   // سرعت دستگاه کمتر از این یعنی ایستاده
  var STILL_NET = 0.6;     // جابه‌جایی خالص کمتر از ۰٫۶ متر بر ثانیه در پنجره یعنی ایستاده
  var STILL_WIN = 20000, STILL_MIN = 12000;
  var CLEAR_MOVE = 2.5;    // اگه پنجره حرکت روشنی نشون بده (بیش از ۲٫۵ متر بر ثانیه)، سرعت صفرِ اشتباه دستگاه نادیده گرفته می‌شه
  // هموارسازی مسیر: فیلتر کالمن ساده روی موقعیت (وزن هر نقطه از دقتش). نویز GPS زیگزاگ می‌سازه و هر زیگزاگ
  // مسافت اضافه؛ مسافت از موقعیت هموارشده حساب می‌شه. KF_Q: عدم‌قطعیت حرکت (متر بر ثانیه)؛ بزرگ‌تر = دنبال کردن سریع‌تر پیچ‌ها
  var KF_Q = 4;
  var ROUTE_STEP = 8;      // فاصله‌ی نقطه‌های شکل مسیر (متر)
  var ROUTE_TOL = 4;       // ساده‌سازی شکل مسیر برای ذخیره (متر)

  function rad(x) { return x * Math.PI / 180; }
  // یک قدم فیلتر: واریانس با زمان (Q²·dt) زیاد می‌شه و با هر نقطه به نسبت دقتش کم؛ خروجی موقعیت هموارشده
  function kfStep(st, p) {
    var acc = Math.max(3, p.acc || 10), k = st.kf;
    if (!k) { st.kf = { lat: p.lat, lon: p.lon, v: acc * acc, t: p.t }; return { lat: p.lat, lon: p.lon }; }
    var dt = Math.max(0, (p.t - k.t) / 1000), q = st.kfQ || KF_Q;
    k.v += dt * q * q;
    var g = k.v / (k.v + acc * acc);
    k.lat += g * (p.lat - k.lat); k.lon += g * (p.lon - k.lon); k.v = (1 - g) * k.v; k.t = p.t;
    return { lat: k.lat, lon: k.lon };
  }
  // فاصله‌ی دو نقطه روی کره (متر)
  function haversine(a, b) {
    var R = 6371000, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function create(now) {
    return { startedAt: now, activeMs: 0, segStart: now, paused: false, dist: 0, movingMs: 0, last: null,
      jumps: 0, rejected: 0, points: 0, splits: [], recent: [], lastAcc: null, route: [], kmMarks: [], win: [], okAt: null, stillPts: 0 };
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

  // ایستاده؟ speed: سرعت دستگاه (متر بر ثانیه) یا null
  function isStill(st, speed) {
    // جابه‌جایی خالص: فاصله‌ی میانگین نیمه‌ی اول و دوم پنجره (میانگین‌گیری نویز تک‌نقطه‌ها رو کم می‌کنه)
    var w = st.win, net = null;
    if (w.length >= 4 && w[w.length - 1].t - w[0].t >= STILL_MIN) {
      var h = Math.floor(w.length / 2), mean = function (a) {
        return a.reduce(function (o, q) { return { lat: o.lat + q.lat / a.length, lon: o.lon + q.lon / a.length, t: o.t + q.t / a.length }; }, { lat: 0, lon: 0, t: 0 });
      };
      var A = mean(w.slice(0, h)), B = mean(w.slice(h));
      net = haversine(A, B) / Math.max(1, (B.t - A.t) / 1000);
    }
    if (speed != null) return speed < STILL_SPEED && !(net != null && net > CLEAR_MOVE);
    return net != null && net < STILL_NET;
  }

  // یک نقطه‌ی تازه؛ true اگه مسافت اضافه شد
  function add(st, p) {
    if (!p || !isFinite(p.lat) || !isFinite(p.lon) || !isFinite(p.t)) return false;
    st.lastAcc = p.acc;
    if (st.paused) return false;
    st.win = st.win || [];
    if (st.okAt == null) st.okAt = p.t;
    // دقت: ۲۰ متر؛ بعد از ۲۰ ثانیه بدون نقطه‌ی قبول‌شده، تا ۳۰ متر
    // حالت سیگنال ضعیف تا وقتی ادامه داره که نقطه‌ها ضعیف بمونن (نه هر ۲۰ ثانیه یک نقطه)
    if (!(p.acc <= (st.relaxed || p.t - st.okAt >= RELAX_MS ? RELAX_ACC : MAX_ACC))) { st.rejected++; return false; }
    st.relaxed = p.acc > MAX_ACC;
    var last = st.last;
    if (!last) { st.kf = null; kfStep(st, p); st.raw = { lat: p.lat, lon: p.lon, t: p.t, acc: p.acc }; st.last = { lat: p.lat, lon: p.lon, t: p.t }; st.okAt = p.t; st.points++; st.win = [{ lat: p.lat, lon: p.lon, t: p.t }]; routeAdd(st, p.lat, p.lon, true); return false; }
    if (p.t <= last.t) return false;
    // پرش: نسبت به نقطه‌ی خام قبلی (نه موقعیت هموارشده که کمی عقب‌تره)
    // جابه‌جایی منهای دقت دو نقطه (نویز عادی GPS پرش حساب نشه؛ پرش واقعی مثل ۵۰۰ متر در یک ثانیه همچنان رد می‌شه)
    var raw = st.raw || last, d = haversine(raw, p), dt = (p.t - raw.t) / 1000;
    if (!(dt > 0)) return false;
    if (Math.max(0, d - (p.acc || 0) - (raw.acc || 0)) / dt > MAX_SPEED) {
      st.rejected++;
      if (++st.jumps >= JUMP_RESET) { st.kf = null; kfStep(st, p); st.raw = { lat: p.lat, lon: p.lon, t: p.t, acc: p.acc }; st.last = { lat: p.lat, lon: p.lon, t: p.t }; st.okAt = p.t; st.jumps = 0; st.win = []; routeAdd(st, p.lat, p.lon, true); }
      return false;
    }
    st.jumps = 0;
    st.okAt = p.t;
    // از اینجا به بعد مسافت و شکل مسیر از موقعیت هموارشده
    var fp = kfStep(st, p);
    st.raw = { lat: p.lat, lon: p.lon, t: p.t, acc: p.acc };
    d = haversine(last, fp);
    st.win.push({ lat: p.lat, lon: p.lon, t: p.t });
    while (st.win.length > 2 && p.t - st.win[0].t > STILL_WIN) st.win.shift();
    if (d < Math.max(MIN_STEP, (p.acc || 0) / 2)) {
      // لرزش: نقطه‌ی مبنا عوض نمی‌شه تا لرزش‌های کوچک روی هم جمع نشن
      return false;
    }
    // سرعت دستگاه: میانه‌ی ۳ نقطه‌ی آخر (یک عدد پرت نویز داپلر، ایستاده رو «در حرکت» نکنه)
    var speed = null;
    if (isFinite(p.speed) && p.speed >= 0) {
      st.spd = (st.spd || []).concat([p.speed]).slice(-3);
      speed = st.spd.slice().sort(function (x, y) { return x - y; })[Math.floor(st.spd.length / 2)];
    } else st.spd = [];
    if (isStill(st, speed)) {
      // ایستاده (رانش آهسته): مسافت اضافه نمی‌شه و مبنا همون می‌مونه؛ با راه افتادن دوباره، فاصله از همین مبنا حساب می‌شه
      st.stillPts++;
      return false;
    }
    var before = st.dist;
    st.dist += d;
    if (d / dt >= MOVING) st.movingMs += dt * 1000;
    st.last = { lat: fp.lat, lon: fp.lon, t: p.t };
    st.points++;
    routeAdd(st, fp.lat, fp.lon, false);
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
      st.kmMarks.push([r5(last.lat + frac * (fp.lat - last.lat)), r5(last.lon + frac * (fp.lon - last.lon))]);
    }
    return true;
  }

  function pause(st, now) {
    if (st.paused) return;
    st.activeMs += Math.max(0, now - st.segStart);
    st.paused = true;
    // موقعیت هموارشده چند متر عقب‌تر از آخرین نقطه‌ی واقعیه (تأخیر فیلتر)؛ موقع توقف یا پایان این فاصله اضافه می‌شه،
    // مگه اینکه پرش باشه یا دونده ایستاده بوده
    var l = st.last, r = st.raw;
    if (l && r && r.t >= l.t) {
      var gap = haversine(l, r), gdt = Math.max(1, (r.t - l.t) / 1000);
      if (gap >= MIN_STEP && gap / gdt <= MAX_SPEED && !isStill(st, null)) { st.dist += gap; routeAdd(st, r.lat, r.lon, false); }
    }
    // فاصله‌ی بین محل توقف و محل ادامه حساب نمی‌شه
    st.last = null; st.recent = []; st.jumps = 0; st.win = []; st.okAt = null; st.spd = []; st.kf = null; st.raw = null;
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
  var GOOD_ACC = 15;
  function signal(st) { return st.lastAcc == null ? 'wait' : (st.lastAcc <= GOOD_ACC ? 'good' : 'weak'); }

  // نتیجه برای ذخیره: همون شکل عدد واقعی جلسه (km، sec، start) به‌علاوه‌ی اسپلیت‌ها
  function summary(st, now) {
    var sec = Math.round(elapsed(st, now) / 1000), d = new Date(st.startedAt);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return { km: Math.round(st.dist / 10) / 100, sec: sec, movingSec: Math.round(st.movingMs / 1000), splits: st.splits.slice(),
      start: pad(d.getHours()) + ':' + pad(d.getMinutes()), points: st.points, rejected: st.rejected, still: st.stillPts || 0 };
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
    signal: signal, summary: summary, haversine: haversine, MAX_ACC: MAX_ACC, MAX_SPEED: MAX_SPEED, GOOD_ACC: GOOD_ACC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoachTrack = api;
})(typeof window !== 'undefined' ? window : this);
