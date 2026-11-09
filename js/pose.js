/*
 * استخراج نقاط کلیدی بدن از ویدیو، کاملاً داخل مرورگر: RTMPose-m (js/rtmpose.js) و اگه روی این دستگاه بارگذاری نشد، MediaPipe Pose.
 * کتابخانه‌ها (js/vendor) و مدل‌ها (models/) از خود اپ بارگذاری می‌شن و فقط وقتی کاربر تحلیل رو شروع کنه؛
 * ویدیو هیچ‌وقت از دستگاه خارج نمی‌شه (CSP در index.html هم هر اتصال بیرونی رو می‌بنده).
 * خروجی: { w, h, duration, full, input: { w, h }, frames: [{ t, lm: [[x, y, visibility, z] × ۳۳] | null }] } برای js/gait.js
 */
(function (root) {
  'use strict';
  var BASE = 'js/vendor/mediapipe/', MODEL = 'models/pose_landmarker_full.task';
  // نمونه‌برداری ثابت ۳۰ فریم در ثانیه (حداکثر ۱۲ ثانیه)
  var MAX_SEC = 10, STEP = 1 / 30;
  var engine = null, loading = null, clock = 0;

  function abs(p) { return new URL(p, document.baseURI).href; }
  // تحلیلگر: { name, detect(بوم) → Promise<۳۳ نقطه | null>، reset، close }. اول RTMPose؛ اگه نشد (مثلاً مرورگر قدیمی)، MediaPipe.
  // ?pose=mp در آدرس برای مقایسه MediaPipe رو اجباری می‌کنه.
  function load() {
    if (engine) return Promise.resolve(engine);
    if (loading) return loading;
    var forceMp = /[?&]pose=mp\b/.test(location.search);
    loading = (root.CoachRtm && !forceMp ? root.CoachRtm.create().catch(function (e) { if (root.console) console.warn('rtmpose', e); return mpEngine(); }) : mpEngine())
      .then(function (en) { engine = en; return en; }, function (e) { loading = null; throw e; });
    return loading;
  }
  function mpEngine() {
    return import(abs(BASE + 'vision_bundle.mjs')).then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(abs(BASE + 'wasm')).then(function (fs) {
        var opts = function (delegate) {
          return { baseOptions: { modelAssetPath: abs(MODEL), delegate: delegate }, runningMode: 'VIDEO', numPoses: 1,
            minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 };
        };
        // GPU اگه باشه؛ وگرنه CPU
        return mp.PoseLandmarker.createFromOptions(fs, opts('GPU')).catch(function () { return mp.PoseLandmarker.createFromOptions(fs, opts('CPU')); });
      });
    }).then(function (lm) {
      var retried = false;
      var map = function (r) { var p = r && r.landmarks && r.landmarks[0];
        // چهارمین عدد: عمق تخمینی MediaPipe (فقط برای تحلیل؛ پخش‌کننده فقط سه عدد اول رو می‌خونه)
        return p ? p.map(function (q) { return [q.x, q.y, q.visibility == null ? 1 : q.visibility, q.z == null ? 0 : Math.round(q.z * 1e4) / 1e4]; }) : null; };
      return {
        name: 'mediapipe-full',
        reset: function () {},
        detect: function (cv) {
          clock += 34; // زمان‌های ارسالی به MediaPipe باید همیشه صعودی باشن (بین دو ویدیو هم)
          try { return Promise.resolve(map(lm.detectForVideo(cv, clock))); } catch (e) {
            // پردازنده‌ی گرافیکی بعضی گوشی‌ها: یک بار دیگه با CPU
            if (retried) return Promise.reject(fail('detect', e));
            retried = true;
            return recreateCpu().then(function (l) { lm = l; clock += 34; return map(lm.detectForVideo(cv, clock)); }).catch(function (e2) { throw fail('detect', e2); });
          }
        },
        close: function () { try { lm.close(); } catch (e) { /* */ } }
      };
    });
  }

  // آزاد کردن کامل تحلیلگر (گرافیک WebGL و حافظه‌ی WebAssembly)؛ بار بعد از کش دوباره ساخته می‌شه.
  // روی آیفون نگه داشتنش بعد از تحلیل، حافظه‌ی صفحه رو پر می‌کرد و بقیه‌ی صفحه‌ها کشیده نمی‌شدن.
  function unload() {
    var en = engine;
    engine = null; loading = null;
    if (en) en.close();
  }
  function once(el, ev, ms) {
    return new Promise(function (res, rej) {
      var to = setTimeout(function () { done(); rej(new Error('timeout: ' + ev)); }, ms || 8000);
      function h() { done(); res(); }
      function done() { clearTimeout(to); el.removeEventListener(ev, h); }
      el.addEventListener(ev, h);
    });
  }
  // سافاری آیفون ویدیویی رو که در صفحه نیست یا یک بار پخش نشده بارگذاری نمی‌کنه و جابه‌جایی (seek) روش مطمئن نیست؛
  // پس ویدیو (پنهان) به صفحه اضافه می‌شه، بی‌صدا یک لحظه پخش و متوقف می‌شه، و هر فریم اول روی بوم کشیده می‌شه.
  function fail(code, e) { var err = new Error(code + (e && e.message ? ': ' + e.message : '')); err.code = code; return err; }
  function openVideo(file) {
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    ['playsinline', 'webkit-playsinline', 'muted'].forEach(function (a) { v.setAttribute(a, ''); });
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(v);
    v.src = URL.createObjectURL(file);
    v.load();
    return once(v, 'loadedmetadata', 30000).catch(function (e) { throw fail('open', e); }).then(function () {
      if (v.readyState >= 2) return;
      // پخش بی‌صدا برای اینکه سافاری داده‌ی فریم‌ها رو بارگذاری کنه
      var pl = v.play();
      return Promise.race([pl && pl.then ? pl.catch(function () {}) : Promise.resolve(), once(v, 'loadeddata', 15000).catch(function () {})])
        .then(function () { v.pause(); });
    }).then(function () {
      // بعضی فایل‌ها (مثلاً ضبط مرورگر) مدت ندارن تا وقتی یک بار تا انتها رفته بشه
      if (isFinite(v.duration) && v.duration > 0) return;
      v.currentTime = 1e7;
      return once(v, 'seeked', 20000).then(function () { v.currentTime = 0; return once(v, 'seeked', 20000); });
    }).then(function () {
      if (!(v.duration > 0) || !v.videoWidth) throw fail('meta');
      return v;
    });
  }
  function seek(v, t) {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2) return Promise.resolve();
    v.currentTime = t;
    return once(v, 'seeked', 15000).then(function () {
      // صبر تا فریم تازه واقعاً آماده‌ی کشیدن بشه (اگه مرورگر پشتیبانی کنه)
      if (v.readyState >= 2 || !v.requestVideoFrameCallback) return;
      return new Promise(function (res) { var done = false; v.requestVideoFrameCallback(function () { if (!done) { done = true; res(); } }); setTimeout(function () { if (!done) { done = true; res(); } }, 400); });
    }).catch(function (e) { throw fail('seek', e); });
  }
  function recreateCpu() {
    return import(abs(BASE + 'vision_bundle.mjs')).then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(abs(BASE + 'wasm')).then(function (fs) {
        return mp.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: abs(MODEL), delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      });
    });
  }
  // بازه‌ی تحلیل به ثانیه‌ی واقعی (نه ثانیه‌ی فیلم): حدود ۱۰ ثانیه دویدن واقعی (۲۵ تا ۳۰ گام، برای همه‌ی اندازه‌گیری‌ها کافی)؛
  // فیلم اسلوموشن ×k یعنی k برابر ثانیه‌ی فیلم، با سقف ۴۰ ثانیه‌ی فیلم (زمان پردازش روی گوشی)
  // ضلع بزرگ تصویر تحلیل: RTMPose فقط برش دور دونده رو به مدل می‌ده، پس تصویر بزرگ‌تر برای دونده‌ی کوچیک در کادر (دور از
  // دوربین) پیکسل بیشتری روی پا می‌ذاره بدون اینکه کار مدل بیشتر بشه؛ MediaPipe کل تصویر رو کوچیک می‌کنه، پس ۱۲۸۰ کافیه
  var REAL_SEC = 10, MAX_SRC = 40, MAX_SIDE = 1280, MAX_SIDE_RTM = 1920;
  function windowSec(scale) { return scale > 1 ? Math.min(MAX_SRC, REAL_SEC * scale) : MAX_SEC; }
  // هر فریم (هر ۱/۳۰ ثانیه‌ی فیلم): جابه‌جایی روی ویدیو، کشیدن روی بوم و تشخیص بدن
  // opts: { timeScale: ضریب اسلوموشن (برای طول بازه)، from: ادامه از این ثانیه‌ی فیلم (اضافه کردن به فریم‌های قبلی)،
  //   night: فیلم شب یا نور کم (کنتراست محلی روی ورودی مدل؛ فقط RTMPose) }
  function processVideo(file, onProgress, opts) {
    opts = opts || {};
    var en, v, cv, g;
    return load().then(function (e) { en = e; en.reset(); if (en.enhance) en.enhance(!!opts.night); return openVideo(file); }).then(function (video) {
      v = video;
      var dur = Math.min(v.duration || 0, windowSec(opts.timeScale));
      if (!(dur > 0.5)) throw fail('short');
      // اندازه‌ی ورودی MediaPipe: ضلع بزرگ حداکثر ۱۲۸۰px (پا و مچ در تصویر بزرگ‌تر، زاویه‌ها دقیق‌تر)
      var sc = Math.min(1, (en.name === 'rtmpose-m' ? MAX_SIDE_RTM : MAX_SIDE) / Math.max(v.videoWidth, v.videoHeight));
      cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * sc); cv.height = Math.round(v.videoHeight * sc);
      g = cv.getContext('2d');
      var n = Math.floor(dur / STEP), frames = [], i = opts.from > 0 ? Math.ceil(opts.from / STEP - 1e-6) : 0, i0 = i;
      // مدل یکی‌درمیون (۱۵ فریم در ثانیه‌ی فیلم؛ در اسلوموشن ×۴ و بیشتر ۶۰ تا ۱۲۰ در ثانیه‌ی واقعی) و فریم‌های بین با درون‌یابی
      // پر می‌شن تا هر ۱/۳۰ ثانیه همچنان یک فریم باشه (پخش‌کننده همین رو می‌خواد). روی آیفون مدل ۸۰٪ زمان تحلیل بود؛
      // در مجموعه‌ی آزمایش آهنگ گام و زاویه‌ها با تحلیل همه‌ی فریم‌ها فرقی نکرد. ?every=1 برای مقایسه همه‌ی فریم‌ها.
      // ویدیوی کوتاه (تا ۶ ثانیه، مثلاً دونده‌ای که از جلوی دوربین رد می‌شه): همه‌ی فریم‌ها، تا هیچ لحظه‌ی فرودی جا نیفته
      // (زمان تحلیل برای ویدیوی کوتاه کمه)
      var every = /[?&]every=1\b/.test(location.search) || (dur <= 6 && !(opts.timeScale >= 4)) ? 1 : 2;
      // اندازه‌گیری برای عیب‌یابی سرعت روی گوشی (در نسخه‌ی تخصصی گزارش): زمان کل، زمان مدل، روش خوندن فریم‌ها
      var tStart = performance.now(), modelMs = 0, nDet = 0, fallback = null;
      var timed = { detect: function (c) { var a = performance.now(); return en.detect(c).then(function (lm) { modelMs += performance.now() - a; nDet++; return lm; }); } };
      // آزمایشی: چند فریم با هم در یک اجرای مدل (js/rtmpose.js)
      if (en.detectBatch && batchOn()) timed.detectBatch = function (cs) { var a = performance.now(); return en.detectBatch(cs).then(function (r) { modelMs += performance.now() - a; nDet += cs.length; return r; }); };
      var result = function () { fillSkipped(frames); return { w: v.videoWidth, h: v.videoHeight, duration: dur, full: dur >= (v.duration || 0) - STEP, frames: frames, video: v, input: { w: cv.width, h: cv.height }, engine: en.name, backend: en.backend || null,
        perf: { read: readMode, fallback: fallback, totalS: Math.round((performance.now() - tStart) / 100) / 10, frames: nDet,
          modelMs: nDet ? Math.round(modelMs / nDet) : null, otherMs: nDet ? Math.round((performance.now() - tStart - modelMs) / nDet) : null,
          every: every, night: !!(opts.night && en.enhance), batch: timed.detectBatch && readMode === 'play' && en.stats ? en.stats() : null } }; };
      var readMode = 'seek';
      // روش قبلی: جابه‌جایی روی ویدیو برای هر فریم (کند، ولی همه‌جا کار می‌کنه)
      function next() {
        // full: کل فیلم پردازش شد (برای پیشنهاد ادامه‌ی تحلیل بعد از تعیین ضریب اسلوموشن)
        if (i >= n) return result();
        var t = i * STEP + 0.001;
        if (every > 1 && (i - i0) % every && i < n - 1) { frames.push({ t: t, lm: null, skip: true }); i++; return next(); }
        return seek(v, t).then(function () {
          g.drawImage(v, 0, 0, cv.width, cv.height);
          return timed.detect(cv);
        }).then(function (lm) {
          frames.push({ t: t, lm: lm });
          i++;
          if (onProgress && (i - i0) % 3 === 0) onProgress((i - i0) / Math.max(1, n - i0));
          return next();
        });
      }
      // روش سریع: پخش خود ویدیو (بی‌صدا و پنهان) و برداشتن فریم‌ها هم‌زمان با پخش؛ تکه‌تکه، تا اجرای مدل جلوی پخش رو نگیره
      // و فریمی جا نیفته. اگه مرورگر requestVideoFrameCallback نداشت یا پخش گیر کرد، همون روش قبلی از اول.
      if (v.requestVideoFrameCallback && !/[?&]frames=seek\b/.test(location.search)) {
        return byPlayback(v, timed, cv, i0, n, every, dur, onProgress).then(function (res) {
          readMode = 'play';
          for (var k = i0; k < n; k++) {
            var hit = Object.prototype.hasOwnProperty.call(res, k);
            frames.push({ t: k * STEP + 0.001, lm: hit ? res[k] : null, skip: !hit });
          }
          return result();
        }, function (e) {
          if (root.console) console.warn('playback capture, falling back to seek', e);
          fallback = String(e && e.message || e).slice(0, 80);
          en.reset(); frames = []; i = i0;
          return next();
        });
      }
      return next();
    }).catch(function (e) { if (v) release(v); throw e.code ? e : fail('video', e); });
  }

  // پخش و برداشت تکه‌ای: تا BATCH فریم (هر ۱/۳۰ ثانیه‌ی فیلم یکی، در اسلوموشن یکی‌درمیون) در حین پخش روی بوم‌های جدا کشیده می‌شن،
  // بعد پخش مکث می‌کنه و مدل روی همون‌ها اجرا می‌شه، بعد پخش ادامه. خروجی: { شماره‌ی خونه‌ی ۱/۳۰: نقاط }؛ خونه‌ای که فریمش
  // در پخش جا افتاد (کم پیش میاد) خالی می‌مونه و با درون‌یابی پر می‌شه.
  // تعداد بوم‌های برداشته‌شده قبل از اجرای مدل: حافظه‌ی بوم‌ها روی گوشی محدوده، پس برای تصویر بزرگ‌تر از ۱۲۸۰ کمتر (حدود ۶۰ مگابایت)
  var BATCH = 16, STALL_MS = 5000, PLAY_SLOW = /[?&]slow=([\d.]+)/.test(location.search) ? +RegExp.$1 : 0.5;
  function batchFor(cv) { return cv.width * cv.height > 1280 * 720 * 1.1 ? 8 : BATCH; }
  // حالت آزمایشی دسته‌ای: یک بار ?batch=1 در آدرس روشنش می‌کنه (و می‌مونه، چون ورود به حساب ممکنه آدرس رو عوض کنه)، ?batch=0 خاموش
  function batchOn() {
    var m = /[?&]batch=([01])\b/.exec(location.search);
    try { if (m) { if (m[1] === '1') localStorage.setItem('gaam-pose-batch', '1'); else localStorage.removeItem('gaam-pose-batch'); } return localStorage.getItem('gaam-pose-batch') === '1'; }
    catch (e) { return !!m && m[1] === '1'; }
  }
  function byPlayback(v, en, cv, i0, n, every, dur, onProgress) {
    return new Promise(function (resolve, reject) {
      var pool = [], buf = [], res = {}, last = -1, done = false, working = false, timer = 0, count = 0;
      var nBatch = batchFor(cv);
      var total = Math.max(1, Math.ceil((n - i0) / every));
      function canvas() { var c = pool.pop(); if (!c) { c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; } return c; }
      function watchdog() { clearTimeout(timer); timer = setTimeout(function () { if (!done && !working) fin(new Error('stall')); }, STALL_MS); }
      function fin(err) {
        if (done) return;
        done = true; clearTimeout(timer); v.pause(); v.removeEventListener('ended', onEnd);
        if (err) { reject(err); return; }
        process(function () { resolve(res); });
      }
      function onEnd() { fin(); }
      // مدل روی فریم‌های برداشته‌شده، یکی‌یکی (یا در حالت آزمایشی دسته‌ای همه با هم)؛ cb بعد از تموم شدن
      function process(cb) {
        working = true;
        var q = buf; buf = [];
        if (en.detectBatch && q.length) {
          en.detectBatch(q.map(function (it) { return it.c; })).then(function (r) {
            q.forEach(function (it, j) { res[it.s] = r[j]; pool.push(it.c); });
            count += q.length;
            if (onProgress) onProgress(Math.min(1, count / total));
            working = false; cb();
          }, function (e) { done = true; clearTimeout(timer); v.pause(); reject(e); });
          return;
        }
        (function step() {
          if (!q.length) { working = false; cb(); return; }
          var it = q.shift();
          en.detect(it.c).then(function (lm) {
            res[it.s] = lm; pool.push(it.c); count++;
            if (onProgress && count % 3 === 0) onProgress(Math.min(1, count / total));
            step();
          }, function (e) { done = true; clearTimeout(timer); v.pause(); reject(e); });
        })();
      }
      function onFrame(now, meta) {
        if (done) return;
        var mt = meta && meta.mediaTime != null ? meta.mediaTime : v.currentTime, slot = Math.round((mt - 0.001) / STEP);
        if (mt >= dur - 1e-3 || slot >= n) { fin(); return; }
        if (slot >= i0 && slot > last && (slot - i0) % every === 0) {
          last = slot;
          var c = canvas(); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          buf.push({ s: slot, c: c });
        }
        watchdog();
        if (buf.length >= nBatch) {
          v.pause();
          process(function () { if (done) return; watchdog(); v.requestVideoFrameCallback(onFrame); var pl = v.play(); if (pl && pl.catch) pl.catch(function (e) { fin(e); }); });
          return;
        }
        v.requestVideoFrameCallback(onFrame);
      }
      v.addEventListener('ended', onEnd);
      // ویدیوی کوتاه (تا ۶ ثانیه): پخش با سرعت کمتر تا هیچ فریمی جا نیفته (هر فریم مهمه؛ چند ثانیه بیشتر طول می‌کشه)
      v.muted = true; v.playbackRate = dur - i0 * STEP <= 6 ? PLAY_SLOW : 1;
      seek(v, Math.max(0, i0 * STEP) + 0.001).then(function () {
        v.requestVideoFrameCallback(onFrame);
        watchdog();
        var pl = v.play();
        if (pl && pl.catch) pl.catch(function (e) { fin(e); });
      }, function (e) { fin(e); });
    });
  }
  // فریم‌های رد شده: میانگین وزنی دو فریم تشخیص‌داده‌شده‌ی دو طرف (اگه یکی نبود، بدون نقطه)
  function fillSkipped(F) {
    for (var i = 0; i < F.length; i++) {
      if (!F[i].skip) continue;
      var a = i - 1, b = i + 1;
      while (b < F.length && F[b].skip) b++;
      var A = a >= 0 ? F[a].lm : null, B = b < F.length ? F[b].lm : null, w = (i - a) / (b - a);
      F[i] = { t: F[i].t, lm: A && B ? A.map(function (p, k) { var q = B[k]; return [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w, Math.min(p[2], q[2]), p[3] == null ? 0 : p[3]]; }) : null };
    }
  }
  // تصویر فریم نمونه با اسکلت و زاویه‌ی مورد نظر (برای گزارش)
  // رنگ‌های بوم از متغیرهای css/theme.css (بوم var() نمی‌فهمه، پس مقدارشون خونده می‌شه)؛ a = شفافیت اختیاری
  function tok(name, a) {
    var v = (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m || a == null) return v;
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + a + ')';
  }
  var LINKS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
    [24, 26], [26, 28], [28, 30], [30, 32], [28, 32], [7, 11], [8, 12], [0, 7], [0, 8]];
  function keyImage(video, t, lm, opts) {
    opts = opts || {};
    return seek(video, t).then(function () {
      var W = Math.min(480, video.videoWidth), H = Math.round(video.videoHeight * W / video.videoWidth);
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d');
      g.drawImage(video, 0, 0, W, H);
      if (lm) {
        var pt = function (k) { return [lm[k][0] * W, lm[k][1] * H]; };
        g.lineWidth = 3; g.strokeStyle = tok('--primary', 0.9); g.lineCap = 'round';
        LINKS.forEach(function (l) { var a = pt(l[0]), b = pt(l[1]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
        (opts.focus || []).forEach(function (k) {
          var p = pt(k); g.fillStyle = tok('--error'); g.beginPath(); g.arc(p[0], p[1], 6, 0, Math.PI * 2); g.fill();
          g.lineWidth = 2; g.strokeStyle = tok('--text'); g.stroke();
        });
        if (opts.label && opts.labelAt != null) {
          var q = pt(opts.labelAt);
          g.direction = /[\u0600-\u06FF]/.test(opts.label) ? 'rtl' : 'ltr'; g.textAlign = 'left';
          g.font = '600 15px Vazirmatn, sans-serif';
          var w = g.measureText(opts.label).width + 12;
          var x = Math.min(W - w - 4, q[0] + 10), y = Math.max(4, q[1] - 30);
          g.fillStyle = tok('--bg', 0.85); g.fillRect(x, y, w, 24);
          g.fillStyle = tok('--text'); g.fillText(opts.label, x + 6, y + 17);
        }
      }
      return c.toDataURL('image/jpeg', 0.72);
    });
  }
  function release(video) {
    if (!video) return;
    if (video.src) { URL.revokeObjectURL(video.src); video.removeAttribute('src'); video.load(); }
    if (video.parentNode) video.parentNode.removeChild(video);
  }

  // ---------- پخش انیمیشنی: اسکلت روی فریم‌های خود ویدیو، هم‌زمان با دویدن ----------
  var LEFT = { 11: 1, 13: 1, 15: 1, 23: 1, 25: 1, 27: 1, 29: 1, 31: 1, 7: 1 }, RIGHT = { 12: 1, 14: 1, 16: 1, 24: 1, 26: 1, 28: 1, 30: 1, 32: 1, 8: 1 };
  // چپ = info، راست = zone-4، وسط = text، مشکل = error (موقع رسم خونده می‌شن)
  function COLS() { return { l: tok('--info'), r: tok('--zone-4'), c: tok('--text'), bad: tok('--error') }; }
  // صاف کردن ملایم برای نمایش (لرزش نقاط کمتر)، فقط بین فریم‌های پشت‌سرهم
  function smoothFrames(F) {
    return F.map(function (f, i) {
      if (!f || !f.lm) return null;
      return f.lm.map(function (p, k) {
        var sx = 0, sy = 0, c = 0;
        for (var j = i - 1; j <= i + 1; j++) { var q = F[j] && F[j].lm; if (q) { sx += q[k][0]; sy += q[k][1]; c++; } }
        return [sx / c, sy / c, p[2]];
      });
    });
  }
  // نقاط در زمان t با درون‌یابی بین دو فریم؛ dt = فاصله‌ی نمونه‌برداری همون فیلم (۳۰ یا ۶۰ در ثانیه)
  function lmAt(S, t) {
    var x = Math.max(0, (t - 0.001) / STEP), i = Math.floor(x), f = x - i, a = S[i], b = S[i + 1];
    if (a && b) return a.map(function (p, k) { return [p[0] + (b[k][0] - p[0]) * f, p[1] + (b[k][1] - p[1]) * f, p[2]]; });
    return a || b || S[i - 1] || null;
  }
  function angleAt(lm, a, b, c, W, H) {
    var v1x = (lm[a][0] - lm[b][0]) * W, v1y = (lm[a][1] - lm[b][1]) * H, v2x = (lm[c][0] - lm[b][0]) * W, v2y = (lm[c][1] - lm[b][1]) * H;
    var d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    return d ? Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180 / Math.PI : null;
  }
  // toLeft: برچسب سمت چپ نقطه (x لبه‌ی راست برچسب)، تا برچسب دو سمت بدن روی هم نیفتن
  function tag(g, text, x, y, W, color, toLeft) {
    // جهت متن بوم از صفحه (راست‌به‌چپ) ارث می‌بره و متن از جعبه‌ش جدا می‌افته؛ همیشه چپ‌به‌راست با تراز چپ
    // جهت متن بر اساس خود برچسب (فارسی راست‌به‌چپ تا علامت درجه درست بیفته)؛ تراز «left» مطلقه
    g.direction = /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr'; g.textAlign = 'left';
    g.font = '700 ' + Math.round(Math.max(13, W / 34)) + 'px Vazirmatn, sans-serif';
    var w = g.measureText(text).width + 12, h = Math.round(Math.max(20, W / 22));
    if (toLeft) x -= w;
    x = Math.max(4, Math.min(W - w - 4, x)); y = Math.max(4, y);
    g.fillStyle = tok('--bg', 0.82); g.fillRect(x, y, w, h);
    g.fillStyle = color || tok('--text'); g.fillText(text, x + 6, y + h * 0.72);
  }
  function drawOverlay(g, lm, W, H, o) {
    var pt = function (k) { return [lm[k][0] * W, lm[k][1] * H]; }, lw = Math.max(2.5, W / 160), r = Math.max(4, W / 110), COL = COLS(), TXT = tok('--text');
    g.lineCap = 'round';
    LINKS.forEach(function (l) {
      var a = pt(l[0]), b = pt(l[1]), side = LEFT[l[0]] && LEFT[l[1]] ? 'l' : RIGHT[l[0]] && RIGHT[l[1]] ? 'r' : 'c';
      g.strokeStyle = tok('--bg', 0.45); g.lineWidth = lw + 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.strokeStyle = COL[side]; g.lineWidth = lw; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    });
    for (var k = 11; k <= 32; k++) {
      if (k > 16 && k < 23) continue; // انگشت‌های دست
      var p = pt(k), bad = o.bad && o.bad.indexOf(k) >= 0;
      g.beginPath(); g.arc(p[0], p[1], bad ? r * 1.6 : r, 0, Math.PI * 2);
      g.fillStyle = bad ? COL.bad : TXT; g.fill();
      g.lineWidth = 2; g.strokeStyle = bad ? TXT : (LEFT[k] ? COL.l : COL.r); g.stroke();
    }
    // زاویه‌های زنده (مثلاً خم زانو و آرنج سمت نزدیک)
    var on = function (k) { return !o.layers || !k || !!o.layers[k]; };
    (o.angles || []).forEach(function (a) {
      if (!on(a.layer)) return;
      var v = angleAt(lm, a.k[0], a.k[1], a.k[2], W, H);
      if (v == null) return;
      var val = a.flex ? 180 - v : v, q = pt(a.k[1]);
      tag(g, a.label + ' ' + o.digits(Math.round(val)) + '°', a.left ? q[0] - r * 2 : q[0] + r * 2, a.left ? q[1] + r : q[1] - r * 4, W, a.bad ? COL.bad : TXT, a.left);
    });
    // از پشت: خط لگن و خط افق برای دیدن افت لگن
    if (o.back && on('pelvis')) {
      var l = pt(23), rr = pt(24), cx = (l[0] + rr[0]) / 2, cy = (l[1] + rr[1]) / 2, hw = Math.abs(rr[0] - l[0]) * 0.9;
      g.setLineDash([6, 5]); g.strokeStyle = tok('--text', 0.8); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx + hw, cy); g.stroke(); g.setLineDash([]);
      var tilt = Math.atan2(rr[1] - l[1], Math.abs(rr[0] - l[0]) || 1) * 180 / Math.PI;
      tag(g, o.labels.pelvis + ' ' + o.digits(Math.abs(Math.round(tilt))) + '°', cx + hw + 6, cy - 12, W, o.pelvisBad ? COL.bad : TXT);
    }
    if (o.layers) drawLayers(g, lm, W, H, o, pt, r);
  }
  // لایه‌های زاویه‌ی اضافه (قابل روشن و خاموش کردن، فقط نمایش؛ همون نقاط همون فریم):
  //  کنار: head = خط شونه تا گوش با خط عمود و جهت نگاه (گوش تا چشم)، foot = خم مچ پا (ساق و پا)
  //  پشت: kneeIn = خط لگن تا مچ پا و زاویه‌ی زانو، heel = ادامه‌ی خط ساق تا پاشنه، arms = خط وسط بدن برای عبور دست‌ها
  function drawLayers(g, lm, W, H, o, pt, r) {
    var TXT = tok('--text'), seen = function (k) { return lm[k] && lm[k][2] >= 0.3; }, n = o.near === 'l' ? 0 : 1, L = o.layers;
    var dash = function (a, b) { g.setLineDash([6, 5]); g.strokeStyle = tok('--text', 0.8); g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]); };
    var deg = function (x) { return o.digits(Math.round(x)) + '°'; };
    if (!o.back) {
      var sh = 11 + n, ear = 7 + n, eye = n ? 5 : 2, knee = 25 + n, ank = 27 + n, heel = 29 + n, toe = 31 + n;
      // همون روش گزارش: خط وسط دو شونه تا وسط دو گوش با عمود، و جهت سر از گوش سمت نزدیک تا بینی
      if (L.head && seen(11) && seen(12) && seen(7) && seen(8)) {
        var s0 = [(lm[11][0] + lm[12][0]) / 2 * W, (lm[11][1] + lm[12][1]) / 2 * H], e0 = [(lm[7][0] + lm[8][0]) / 2 * W, (lm[7][1] + lm[8][1]) / 2 * H];
        var len = Math.hypot(e0[0] - s0[0], e0[1] - s0[1]);
        g.strokeStyle = tok('--warning'); g.lineWidth = 2.5; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(e0[0], e0[1]); g.stroke();
        dash(s0, [s0[0], s0[1] - len * 1.2]);
        var neck = Math.atan2(Math.abs(e0[0] - s0[0]), s0[1] - e0[1]) * 180 / Math.PI;
        tag(g, o.labels.neck + ' ' + deg(neck), e0[0] + r * 2, e0[1] - r * 5, W, TXT);
        if (seen(ear) && seen(0)) {
          var a0 = pt(ear), n0 = pt(0), dx = n0[0] - a0[0], dy = n0[1] - a0[1], d = Math.hypot(dx, dy) || 1;
          dash(n0, [n0[0] + dx / d * len * 1.5, n0[1] + dy / d * len * 1.5]);
        }
      }
      if (L.foot && seen(knee) && seen(ank) && seen(heel) && seen(toe)) {
        var K = pt(knee), A = pt(ank), He = pt(heel), To = pt(toe), ux = K[0] - A[0], uy = K[1] - A[1], fx = To[0] - He[0], fy = To[1] - He[1];
        var dd = Math.hypot(ux, uy) * Math.hypot(fx, fy);
        if (dd) tag(g, o.labels.ankle + ' ' + deg(90 - Math.acos(Math.max(-1, Math.min(1, (ux * fx + uy * fy) / dd))) * 180 / Math.PI), A[0] + r * 2, A[1] + r, W, TXT);
      }
      return;
    }
    [0, 1].forEach(function (m) {
      var hip = 23 + m, knee = 25 + m, ank = 27 + m, heel = 29 + m;
      if (L.kneeIn && seen(hip) && seen(knee) && seen(ank)) {
        var Hp = pt(hip), K = pt(knee), A = pt(ank);
        dash(Hp, A);
        var a3 = angleAt(lm, hip, knee, ank, W, H);
        if (a3 != null) tag(g, deg(180 - a3), K[0] + (m ? r * 2 : -r * 9), K[1], W, TXT);
      }
      if (L.heel && seen(knee) && seen(ank) && seen(heel)) {
        var K2 = pt(knee), A2 = pt(ank), He = pt(heel), t = (He[1] - A2[1]) / ((A2[1] - K2[1]) || 1);
        dash(A2, [A2[0] + (A2[0] - K2[0]) * (t + 0.6), A2[1] + (A2[1] - K2[1]) * (t + 0.6)]);
      }
    });
    if (L.arms && seen(11) && seen(12) && seen(23) && seen(24)) {
      var mx = (lm[11][0] + lm[12][0]) / 2 * W, top = Math.min(lm[11][1], lm[12][1]) * H, bot = Math.max(lm[23][1], lm[24][1]) * H;
      dash([mx, top - (bot - top) * 0.15], [mx, bot]);
    }
  }
  function pickMime() {
    if (!window.MediaRecorder) return null;
    var c = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < c.length; i++) if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(c[i])) return c[i];
    return null;
  }
  // canvas: بوم صفحه؛ video: ویدیوی تحلیل‌شده (همون که پردازش شد)؛ data.frames: نقاط هر فریم
  // فریم ویدیو و اسکلت در هر لحظه با هم و با یک زمان روی همین بوم کشیده می‌شن، پس اسکلت همیشه روی بدنه.
  // پخش و توقف با لمس خود تصویر؛ کنترل‌های مرورگر نداره.
  // o: { duration, angles, bad, back, pelvisBad, strikes (زمان‌های فرود)، labels، digits }
  function player(canvas, video, data, o) {
    var S = smoothFrames(data.frames), g = canvas.getContext('2d');
    var W = Math.min(720, video.videoWidth), H = Math.round(video.videoHeight * W / video.videoWidth);
    canvas.width = W; canvas.height = H;
    var dur = Math.min(o.duration || data.duration, video.duration || 99), playing = false, raf = 0, rate = 1, rec = null, dead = false, overlay = true, nDraw = 0;
    o.digits = o.digits || String;
    function draw() {
      if (dead) return;
      if (video.readyState >= 2) g.drawImage(video, 0, 0, W, H);
      var t = video.currentTime, lm = lmAt(S, t);
      nDraw++;
      if (!overlay) return;
      if (lm) drawOverlay(g, lm, W, H, o);
      // لحظه‌ی فرود: با نوع فرود همون گام اگه اندازه‌گیری شده (پاشنه، میان‌پا، جلوی پا)
      var sm = o.strikeMarks && o.strikeMarks.filter(function (s) { return Math.abs(s.t - t) < 0.05; })[0];
      if (sm) tag(g, sm.label, 8, 8, W, tok('--warning'));
      else if (o.strikes && o.strikes.some(function (s) { return Math.abs(s - t) < 0.05; })) tag(g, o.labels.strike, 8, 8, W, tok('--warning'));
    }
    function loop() {
      if (dead) return;
      draw();
      if (video.currentTime >= dur - 0.03 || video.ended) {
        if (rec) { finish(); return; }
        video.currentTime = 0.001;
        if (playing) video.play().catch(function () {});
      }
      if (playing) raf = requestAnimationFrame(loop);
    }
    function play() { if (playing || dead) return; playing = true; video.playbackRate = rate; video.play().catch(function () {}); raf = requestAnimationFrame(loop); }
    function pause() { playing = false; cancelAnimationFrame(raf); video.pause(); draw(); }
    function step(n) {
      pause();
      return seek(video, Math.max(0.001, Math.min(dur - STEP, video.currentTime + n * STEP))).then(draw);
    }
    function setRate(r) { rate = r; video.playbackRate = r; }
    function setOverlay(on) { overlay = !!on; draw(); }
    // لایه‌های زاویه (فقط نمایش): { knee, elbow, head, foot, pelvis, kneeIn, heel, arms }
    function setLayers(L) { o.layers = Object.assign({}, L); draw(); }
    function finish() {
      var r = rec; rec = null; pause();
      if (r && r.state !== 'inactive') r.stop();
    }
    // ساخت فایل ویدیو از همین پخش (با همون سرعت انتخاب‌شده)
    function record() {
      var mime = pickMime();
      if (!mime || !canvas.captureStream) return Promise.reject(new Error('noRecorder'));
      return new Promise(function (resolve, reject) {
        pause();
        var chunks = [], stream = canvas.captureStream(30), mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 });
        mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = function () { stream.getTracks().forEach(function (tr) { tr.stop(); }); resolve(new Blob(chunks, { type: mime.split(';')[0] })); };
        mr.onerror = function (e) { reject(e.error || new Error('record')); };
        seek(video, 0.001).then(function () { draw(); rec = mr; mr.start(250); play(); }, reject);
      });
    }
    // لمس خود تصویر: پخش / توقف
    function onTap(e) { if (e) e.preventDefault(); if (playing) pause(); else play(); }
    canvas.addEventListener('click', onTap);
    var first = o.startAt != null ? o.startAt : 0.001;
    seek(video, first).then(draw).catch(function () {});
    // برای عیب‌یابی (?debug=gait): اندازه‌ها و زمان‌ها
    function debug() {
      var cr = canvas.getBoundingClientRect(), f0 = (data.frames || []).filter(function (f) { return f && f.lm; })[0];
      return { natural: [video.videoWidth, video.videoHeight], analysed: [data.w, data.h], canvasPx: [W, H], canvasCss: [Math.round(cr.width), Math.round(cr.height)],
        step: Math.round(STEP * 10000) / 10000, frames: (data.frames || []).length, duration: Math.round((video.duration || 0) * 100) / 100,
        t: Math.round(video.currentTime * 1000) / 1000, draws: nDraw, playing: playing,
        firstHip: f0 ? [f0.t, f0.lm[23][0], f0.lm[23][1]].map(function (x) { return Math.round(x * 1000) / 1000; }) : null };
    }
    // توقف کامل: حلقه‌ی رسم، پخش و ضبط؛ بوم خالی می‌شه تا حافظه‌ش آزاد بشه
    function destroy() {
      if (dead) return;
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* */ } }
      rec = null; playing = false; cancelAnimationFrame(raf); video.pause();
      canvas.removeEventListener('click', onTap);
      dead = true; canvas.width = canvas.height = 1;
    }
    return { video: video, play: play, pause: pause, toggle: function () { if (playing) pause(); else play(); return playing; }, step: step,
      setRate: setRate, rate: function () { return rate; }, isPlaying: function () { return playing; }, setOverlay: setOverlay, setLayers: setLayers,
      record: record, draw: draw, debug: debug, destroy: destroy };
  }

  root.CoachPose = { load: load, unload: unload, processVideo: processVideo, openVideo: openVideo, keyImage: keyImage, release: release, player: player, MAX_SEC: MAX_SEC, windowSec: windowSec };
})(this);
