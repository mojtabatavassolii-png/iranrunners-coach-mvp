/*
 * استخراج نقاط کلیدی بدن از ویدیو با MediaPipe Pose، کاملاً داخل مرورگر.
 * کتابخانه (js/vendor/mediapipe) و مدل (models/) از خود اپ بارگذاری می‌شن و فقط وقتی کاربر تحلیل رو شروع کنه؛
 * ویدیو هیچ‌وقت از دستگاه خارج نمی‌شه (CSP در index.html هم هر اتصال بیرونی رو می‌بنده).
 * خروجی: { w, h, duration, frames: [{ t, lm: [[x, y, visibility] × ۳۳] | null }] } برای js/gait.js
 */
(function (root) {
  'use strict';
  var BASE = 'js/vendor/mediapipe/', MODEL = 'models/pose_landmarker_full.task';
  var MAX_SEC = 12, STEP = 1 / 30;
  var landmarker = null, loading = null, clock = 0;

  function abs(p) { return new URL(p, document.baseURI).href; }
  function load() {
    if (landmarker) return Promise.resolve(landmarker);
    if (loading) return loading;
    loading = import(abs(BASE + 'vision_bundle.mjs')).then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(abs(BASE + 'wasm')).then(function (fs) {
        var opts = function (delegate) {
          return { baseOptions: { modelAssetPath: abs(MODEL), delegate: delegate }, runningMode: 'VIDEO', numPoses: 1,
            minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 };
        };
        // GPU اگه باشه؛ وگرنه CPU
        return mp.PoseLandmarker.createFromOptions(fs, opts('GPU')).catch(function () { return mp.PoseLandmarker.createFromOptions(fs, opts('CPU')); });
      });
    }).then(function (lm) { landmarker = lm; return lm; }, function (e) { loading = null; throw e; });
    return loading;
  }

  // آزاد کردن کامل تحلیلگر (گرافیک WebGL و حافظه‌ی WebAssembly)؛ بار بعد از کش دوباره ساخته می‌شه.
  // روی آیفون نگه داشتنش بعد از تحلیل، حافظه‌ی صفحه رو پر می‌کرد و بقیه‌ی صفحه‌ها کشیده نمی‌شدن.
  function unload() {
    var l = landmarker;
    landmarker = null; loading = null;
    if (l) { try { l.close(); } catch (e) { /* */ } }
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
    landmarker = null; loading = null;
    return import(abs(BASE + 'vision_bundle.mjs')).then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(abs(BASE + 'wasm')).then(function (fs) {
        return mp.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: abs(MODEL), delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1,
          minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      });
    }).then(function (l) { landmarker = l; return l; });
  }
  // هر فریم (۳۰ در ثانیه، حداکثر ۱۲ ثانیه): جابه‌جایی روی ویدیو، کشیدن روی بوم و تشخیص بدن
  function processVideo(file, onProgress) {
    var lmk, v, cv, g, retried = false;
    return load().then(function (l) { lmk = l; return openVideo(file); }).then(function (video) {
      v = video;
      var dur = Math.min(v.duration || 0, MAX_SEC);
      if (!(dur > 0.5)) throw fail('short');
      // اندازه‌ی کار: ضلع بزرگ حداکثر ۹۶۰px (دقت کافی، سرعت بیشتر)
      var sc = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight));
      cv = document.createElement('canvas'); cv.width = Math.round(v.videoWidth * sc); cv.height = Math.round(v.videoHeight * sc);
      g = cv.getContext('2d');
      var n = Math.floor(dur / STEP), frames = [], i = 0;
      function detect() {
        clock += 34; // زمان‌های ارسالی به MediaPipe باید همیشه صعودی باشن (بین دو ویدیو هم)
        try { return Promise.resolve(lmk.detectForVideo(cv, clock)); } catch (e) {
          // پردازنده‌ی گرافیکی بعضی گوشی‌ها: یک بار دیگه با CPU
          if (retried) return Promise.reject(fail('detect', e));
          retried = true;
          return recreateCpu().then(function (l) { lmk = l; clock += 34; return lmk.detectForVideo(cv, clock); }).catch(function (e2) { throw fail('detect', e2); });
        }
      }
      function next() {
        if (i >= n) return { w: v.videoWidth, h: v.videoHeight, duration: dur, frames: frames, video: v };
        var t = i * STEP + 0.001;
        return seek(v, t).then(function () {
          g.drawImage(v, 0, 0, cv.width, cv.height);
          return detect();
        }).then(function (r) {
          var p = r && r.landmarks && r.landmarks[0];
          frames.push({ t: t, lm: p ? p.map(function (q) { return [q.x, q.y, q.visibility == null ? 1 : q.visibility]; }) : null });
          i++;
          if (onProgress && i % 3 === 0) onProgress(i / n);
          return next();
        });
      }
      return next();
    }).catch(function (e) { if (v) release(v); throw e.code ? e : fail('video', e); });
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
  function tag(g, text, x, y, W, color) {
    // جهت متن بوم از صفحه (راست‌به‌چپ) ارث می‌بره و متن از جعبه‌ش جدا می‌افته؛ همیشه چپ‌به‌راست با تراز چپ
    // جهت متن بر اساس خود برچسب (فارسی راست‌به‌چپ تا علامت درجه درست بیفته)؛ تراز «left» مطلقه
    g.direction = /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr'; g.textAlign = 'left';
    g.font = '700 ' + Math.round(Math.max(13, W / 34)) + 'px Vazirmatn, sans-serif';
    var w = g.measureText(text).width + 12, h = Math.round(Math.max(20, W / 22));
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
    (o.angles || []).forEach(function (a) {
      var v = angleAt(lm, a.k[0], a.k[1], a.k[2], W, H);
      if (v == null) return;
      var val = a.flex ? 180 - v : v, q = pt(a.k[1]);
      tag(g, a.label + ' ' + o.digits(Math.round(val)) + '°', q[0] + r * 2, q[1] - r * 4, W, a.bad ? COL.bad : TXT);
    });
    // از پشت: خط لگن و خط افق برای دیدن افت لگن
    if (o.back) {
      var l = pt(23), rr = pt(24), cx = (l[0] + rr[0]) / 2, cy = (l[1] + rr[1]) / 2, hw = Math.abs(rr[0] - l[0]) * 0.9;
      g.setLineDash([6, 5]); g.strokeStyle = tok('--text', 0.8); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx - hw, cy); g.lineTo(cx + hw, cy); g.stroke(); g.setLineDash([]);
      var tilt = Math.atan2(rr[1] - l[1], Math.abs(rr[0] - l[0]) || 1) * 180 / Math.PI;
      tag(g, o.labels.pelvis + ' ' + o.digits(Math.abs(Math.round(tilt))) + '°', cx + hw + 6, cy - 12, W, o.pelvisBad ? COL.bad : TXT);
    }
  }
  function pickMime() {
    if (!window.MediaRecorder) return null;
    var c = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < c.length; i++) if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(c[i])) return c[i];
    return null;
  }
  // canvas: بوم صفحه؛ video: ویدیوی تحلیل‌شده (همون که پردازش شد)؛ data.frames: نقاط هر فریم
  // o: { duration, angles, bad, back, pelvisBad, strikes (زمان‌های فرود)، labels، digits }
  function player(canvas, video, data, o) {
    var S = smoothFrames(data.frames), g = canvas.getContext('2d');
    var W = Math.min(720, video.videoWidth), H = Math.round(video.videoHeight * W / video.videoWidth);
    canvas.width = W; canvas.height = H;
    var dur = Math.min(o.duration || data.duration, video.duration || 99), playing = false, raf = 0, rate = 1, rec = null, dead = false;
    o.digits = o.digits || String;
    function draw() {
      if (dead) return;
      if (video.readyState >= 2) g.drawImage(video, 0, 0, W, H);
      var t = video.currentTime, lm = lmAt(S, t);
      if (lm) drawOverlay(g, lm, W, H, o);
      if (o.strikes && o.strikes.some(function (s) { return Math.abs(s - t) < 0.05; })) tag(g, o.labels.strike, 8, 8, W, tok('--warning'));
      // نوار زمان
      g.fillStyle = tok('--text', 0.35); g.fillRect(0, H - 4, W, 4);
      g.fillStyle = tok('--primary'); g.fillRect(0, H - 4, W * Math.min(1, t / dur), 4);
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
    var first = o.startAt != null ? o.startAt : 0.001;
    seek(video, first).then(draw).catch(function () {});
    // توقف کامل: حلقه‌ی رسم، پخش و ضبط؛ بوم خالی می‌شه تا حافظه‌ش آزاد بشه
    function destroy() {
      if (dead) return;
      if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch (e) { /* */ } }
      rec = null; playing = false; cancelAnimationFrame(raf); video.pause();
      dead = true; canvas.width = canvas.height = 1;
    }
    return { play: play, pause: pause, toggle: function () { if (playing) pause(); else play(); return playing; }, step: step,
      setRate: setRate, rate: function () { return rate; }, isPlaying: function () { return playing; }, record: record, draw: draw, destroy: destroy };
  }

  root.CoachPose = { load: load, unload: unload, processVideo: processVideo, openVideo: openVideo, keyImage: keyImage, release: release, player: player, MAX_SEC: MAX_SEC };
})(this);
