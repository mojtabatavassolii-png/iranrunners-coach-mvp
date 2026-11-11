// بخش مرورگر شبیه‌ساز: هر ۳۰ روز شبیه‌سازی‌شده، خود اپ با داده‌ی همون شخصیت و تاریخ همون روز در Chromium بی‌سر باز می‌شه.
// صفحه‌های امروز، برنامه و پیشرفت؛ خطای صفحه، خطای کنسول، متن خراب و زمان آماده‌شدن صفحه ثبت می‌شه.
// تاریخ: ?today= برای خود اپ + ساعت ثابت مرورگر (page.clock.setFixedTime) برای بقیه‌ی جاهایی که new Date() می‌خونن.
'use strict';
var STORE_KEY = 'iranrunners-coach-mvp-v1';
var VIEWS = ['home', 'plan', 'progress'];
function now() { return Number(process.hrtime.bigint()) / 1e6; }
// متن خراب: جای‌خالی پرنشده، undefined / NaN، یا کلید ترجمه‌ی خام (مثل home.greetName)
var BAD = [
  { why: 'placeholder', re: /\{[a-zA-Z_]+\}/ },
  { why: 'bad-value', re: /\bundefined\b|\bNaN\b|\[object Object\]/ },
  { why: 'raw-key', re: /(^|[\s(«])([a-z][a-zA-Z0-9]*\.){1,3}[a-z][a-zA-Z0-9]+(?=$|[\s).»،:])/m }
];
var DOMAIN = /\.(com|org|ir|html|js|css|json|net|io|app)\b/;

async function sample(result, opt) {
  var pw = require('playwright');
  var browser = await pw.chromium.launch();
  var out = { pages: 0, issues: [], timings: [] };
  try {
    var ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fa-IR' });
    for (var i = 0; i < result.snaps.length; i++) {
      var sn = result.snaps[i];
      var page = await ctx.newPage();
      var errs = [];
      page.on('pageerror', function (e) { errs.push('pageerror: ' + String(e && e.message || e).slice(0, 300)); });
      page.on('console', function (m) { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
      await page.addInitScript(function (a) {
        try { sessionStorage.setItem('gaam-intro', '1'); sessionStorage.setItem('iranrunners-coach-session', '1'); localStorage.setItem(a.k, a.v); } catch (e) { /* */ }
      }, { k: STORE_KEY, v: sn.state });
      var parts = sn.date.split('-').map(Number);
      await page.clock.setFixedTime(new Date(parts[0], parts[1] - 1, parts[2], 8, 0, 0));
      for (var v = 0; v < VIEWS.length; v++) {
        var view = VIEWS[v], t0 = now();
        try {
          if (v === 0) await page.goto(opt.base + '?today=' + sn.date + '#' + view, { waitUntil: 'load' });
          else await page.evaluate(function (h) { location.hash = h; }, view);
          await page.waitForFunction(function (h) {
            var app = document.getElementById('app');
            return location.hash === '#' + h && app && app.children.length > 0 && !document.querySelector('.splash:not([hidden])');
          }, view, { timeout: 15000 });
          await page.waitForTimeout(150);
          var ms = Math.round(now() - t0);
          out.timings.push({ day: sn.day, view: view, ms: ms });
          var text = await page.evaluate(function () { return document.getElementById('app').innerText; });
          if (v === 0 && i === 0) out.sampleText = text.slice(0, 300);
          if (view === 'home' && text.indexOf('شخصیت') < 0) out.issues.push({ day: sn.day, date: sn.date, view: view, why: 'no-profile', text: text.slice(0, 120) });
          BAD.forEach(function (b) {
            var m = b.re.exec(text);
            if (m && !(b.why === 'raw-key' && DOMAIN.test(m[0]))) out.issues.push({ day: sn.day, date: sn.date, view: view, why: b.why, text: text.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\s+/g, ' ') });
          });
        } catch (e) {
          out.issues.push({ day: sn.day, date: sn.date, view: view, why: 'load', text: String(e.message || e).slice(0, 200) });
        }
        out.pages++;
      }
      errs.forEach(function (x) { out.issues.push({ day: sn.day, date: sn.date, view: 'any', why: 'js-error', text: x }); });
      await page.close();
    }
  } finally { await browser.close(); }
  var first = out.timings.filter(function (t) { return t.day <= 30; }), last = out.timings.filter(function (t) { return t.day >= result.snaps[result.snaps.length - 1].day - 30; });
  var avg = function (a, view) { var x = a.filter(function (t) { return t.view === view; }); return x.length ? Math.round(x.reduce(function (s, t) { return s + t.ms; }, 0) / x.length) : null; };
  out.speed = VIEWS.map(function (v) { return { view: v, first: avg(first, v), last: avg(last, v) }; });
  return out;
}
module.exports = { sample: sample };
