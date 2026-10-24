/*
 * معرفی (splash) و گذار به صفحه‌ی ورود.
 * لوگوی متحرک گام فقط در اولین باز کردن هر نشست؛ وقتی انیمیشنش تموم شد، همون لوگو (عنصر مشترک)
 * با transform به جای دقیق لوگوی صفحه‌ی ورود می‌ره و کوچیک می‌شه، زمینه هم‌زمان به زمینه‌ی ورود محو می‌شه،
 * و بعد از نشستن لوگو، محتوای ورود پله‌پله ظاهر می‌شه. فقط transform و opacity انیمیت می‌شن.
 * اپ در تمام این مدت پشت معرفی بار می‌شه.
 */
(function () {
  'use strict';
  var el = document.getElementById('splash');
  if (!el) return;
  var root = document.documentElement;
  var seen = false;
  try { seen = sessionStorage.getItem('gaam-intro') === '1'; sessionStorage.setItem('gaam-intro', '1'); } catch (e) { /* */ }
  // بار دوم در همین نشست، یا حالت تست با ?today=: بدون معرفی
  if (seen || /[?&]today=/.test(location.search)) { el.parentNode.removeChild(el); root.classList.remove('pre-intro'); return; }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var logo = el.querySelector('.splash-logo'), bg = el.querySelector('.splash-bg');
  // تا معرفی تموم نشده، محتوای صفحه‌ی ورود (و لوگوی واقعیش) پنهان می‌مونه
  root.classList.add('intro');

  // انیمیشن خود SVG حدود ۱٫۲۵ ثانیه‌ست (آخرین حرف، m، از ۰٫۸۵ تا ۱٫۲۵). پرواز از لحظه‌ی آخر کشیده شدن m
  // (۲۲۰ میلی‌ثانیه بعد از شروعش، وقتی m تقریباً بالا اومده) شروع می‌شه تا کل معرفی + گذار زیر ~۲٫۵ ثانیه بمونه
  var M_LEAD = 220, FALLBACK = 1600;
  var MOVE = 700, EASE = 'cubic-bezier(.4,0,.2,1)';
  var STAGGER = 80, REVEAL = 400, STEPS = 3;
  // قبل از اندازه‌گیری: صبر برای فونت‌ها و رندر صفحه‌ی ورود، ولی حداکثر این‌قدر (فونت گوگل ممکنه کند یا مسدود باشه)
  var READY_MAX = 900, TARGET_MAX = 1500, START_MAX = 4000;
  // viewBox لوگوی صفحه‌ی ورود (public/assets/gaam-logo-transparent*.svg)؛ مسیرها با SVG معرفی در یک دستگاه مختصات‌ان
  var LOGIN_VB = { x: 1120, y: -60, w: 2174, h: 1005 };
  var state = 'play', timer = 0, anims = [];

  function remove() {
    if (el.parentNode) el.parentNode.removeChild(el);
    // زمینه‌ی تیره‌ی اولیه دیگه لازم نیست؛ رنگ نوار مرورگر به تم خود اپ برمی‌گرده
    root.classList.remove('pre-intro');
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim() || '#121214');
  }
  function loginLogo() {
    var list = document.querySelectorAll('#app .login-logo');
    for (var i = 0; i < list.length; i++) if (getComputedStyle(list[i]).display !== 'none' && list[i].getBoundingClientRect().width > 0) return list[i];
    return null;
  }
  // نگاشت مختصات viewBox به صفحه با preserveAspectRatio پیش‌فرض (xMidYMid meet)
  function mapper(rect, vb) {
    var s = Math.min(rect.width / vb.w, rect.height / vb.h);
    return { s: s, ax: rect.left + (rect.width - vb.w * s) / 2 - vb.x * s, ay: rect.top + (rect.height - vb.h * s) / 2 - vb.y * s };
  }
  // پایان: معرفی برداشته می‌شه و محتوای ورود (با پله یا بی‌پله) ظاهر می‌شه
  function reveal(stagger) {
    if (!stagger) root.classList.add('intro-instant');
    root.classList.add('intro-reveal');
    setTimeout(function () { root.classList.remove('intro', 'intro-reveal', 'intro-instant'); }, stagger ? STAGGER * (STEPS - 1) + REVEAL + 50 : 30);
  }
  function finishNow() {
    if (state === 'done') return;
    state = 'done';
    clearTimeout(timer);
    anims.forEach(function (a) { try { a.cancel(); } catch (e) { /* */ } });
    remove();
    if (!root.classList.contains('intro-instant')) reveal(false);
  }
  // بدون صفحه‌ی ورود (یا بدون Web Animations): همون محو شدن ساده
  function fadeOut() {
    state = 'fade';
    reveal(false);
    el.classList.add('out');
    setTimeout(function () { if (state === 'done') return; state = 'done'; remove(); }, 300);
  }
  // آماده شدن چیدمان: فونت‌ها بار شده باشن (با سقف زمانی)، لوگوی ورود رندر شده باشه، و دو فریم گذشته باشه
  // تا اندازه‌ها نهایی باشن (روی گوشی‌های کندتر، app.js ممکنه هنوز صفحه‌ی ورود رو نساخته باشه)
  function whenReady(cb) {
    var t0 = Date.now(), fontsDone = false;
    try {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fontsDone = true; }, function () { fontsDone = true; });
      else fontsDone = true;
    } catch (e) { fontsDone = true; }
    (function poll() {
      if (state !== 'wait') return;
      var waited = Date.now() - t0;
      var target = loginLogo();
      var fontsOk = fontsDone || waited >= READY_MAX;
      if ((target && fontsOk) || waited >= TARGET_MAX) {
        requestAnimationFrame(function () { requestAnimationFrame(function () { if (state === 'wait') cb(loginLogo()); }); });
        return;
      }
      requestAnimationFrame(poll);
    })();
  }
  function fly() {
    if (state !== 'play') return;
    if (!logo || !logo.animate) { fadeOut(); return; }
    state = 'wait';
    whenReady(flyTo);
  }
  function flyTo(target) {
    if (!target) { fadeOut(); return; }
    state = 'fly';
    var r1 = logo.getBoundingClientRect(), r2 = target.getBoundingClientRect(), vb1 = logo.viewBox.baseVal;
    var m1 = mapper(r1, { x: vb1.x, y: vb1.y, w: vb1.width, h: vb1.height }), m2 = mapper(r2, LOGIN_VB);
    // نقطه‌ی u در هر دو لوگو: ax + u·s؛ با مبدأ گوشه‌ی بالا-چپ لوگوی معرفی، transform یکی رو روی دیگری می‌ذاره
    var k = m2.s / m1.s;
    var tx = m2.ax - r1.left - k * (m1.ax - r1.left), ty = m2.ay - r1.top - k * (m1.ay - r1.top);
    var opts = { duration: MOVE, easing: EASE, fill: 'forwards' };
    anims.push(logo.animate([{ transform: 'translate(0px, 0px) scale(1)' }, { transform: 'translate(' + tx + 'px, ' + ty + 'px) scale(' + k + ')' }], opts));
    anims.push(bg.animate([{ opacity: 1 }, { opacity: 0 }], opts));
    // حالت روشن: m لوگوی ورود زغالیه؛ نسخه‌ی زغالیِ m هم‌زمان پررنگ می‌شه تا موقع نشستن هیچ پرشی دیده نشه
    var dark = el.querySelector('.o2');
    if (dark && target.classList.contains('logo-on-light')) anims.push(dark.animate([{ opacity: 0 }, { opacity: 1 }], opts));
    anims[0].onfinish = function () {
      if (state !== 'fly') return;
      state = 'done';
      // جابه‌جایی با لوگوی واقعی در یک فریم: اول لوگوی ورود دیده می‌شه، بعد معرفی برداشته می‌شه
      root.classList.add('intro-landed');
      requestAnimationFrame(function () { remove(); reveal(true); root.classList.remove('intro-landed'); });
    };
  }

  el.addEventListener('pointerdown', finishNow);
  el.addEventListener('click', finishNow);
  if (reduce) {
    // کاهش حرکت: لوگوی ثابت کوتاه، بعد محو شدن ساده (بدون جابه‌جایی و پله)
    timer = setTimeout(function () { fadeOut(); }, 500);
  } else {
    var mPath = el.querySelector('.m'), started = false;
    if (mPath) mPath.addEventListener('animationstart', function () { if (started) return; started = true; clearTimeout(timer); timer = setTimeout(fly, M_LEAD); });
    // انیمیشن SVG (روی Safari/iOS) روی رشته‌ی اصلی اجرا می‌شه؛ اگه هم‌زمان با بار شدن اسکریپت‌های سنگین اپ پخش بشه،
    // ساعتش جلو می‌ره ولی فریمی کشیده نمی‌شه و فقط حالت آخر دیده می‌شه. پس تا وقتی اپ بار نشده و دو فریم واقعی
    // کشیده نشده، روی زمینه‌ی تیره متوقف می‌مونه و بعد از اول پخش می‌شه
    var go = function () {
      if (state !== 'play' || el.classList.contains('go')) return;
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        if (state !== 'play') return;
        el.classList.add('go');
        timer = setTimeout(fly, FALLBACK);
      }); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    // اگه DOMContentLoaded خیلی دیر شد (شبکه‌ی کند)، بیشتر از این منتظر نمی‌مونه
    setTimeout(go, START_MAX);
  }
})();
