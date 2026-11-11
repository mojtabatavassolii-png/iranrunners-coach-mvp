#!/usr/bin/env node
// شبیه‌ساز کاربران مجازی گام (فقط داده‌ی جعلی، روی همون موتور اپ)
//   node tests/sim/run.js                       همه‌ی شخصیت‌ها، ۷۳۰ روز، گزارش در tests/sim/out/
//   node tests/sim/run.js --persona P07 --until 214   فقط یک شخصیت تا روز ۲۱۴ (بازتولید یک ایراد)
//   node tests/sim/run.js --browser             به‌علاوه‌ی باز کردن خود اپ در مرورگر بی‌سر هر ۳۰ روز (سرور محلی لازمه: BASE_URL)
//   node tests/sim/run.js --json                خروجی کامل JSON کنار گزارش
'use strict';
var fs = require('fs'), path = require('path');
var clock = require('./lib/clock.js');
var sim = require('./simulate.js');
var PERSONAS = require('./personas.js');

var args = process.argv.slice(2), opt = {};
for (var i = 0; i < args.length; i++) {
  var a = args[i];
  if (a === '--persona') opt.persona = args[++i].split(',');
  else if (a === '--until') opt.until = Number(args[++i]);
  else if (a === '--browser') opt.browser = true;
  else if (a === '--browser-every') opt.browserEvery = Number(args[++i]);
  else if (a === '--json') opt.json = true;
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--quiet') opt.quiet = true;
}
var OUT = path.resolve(opt.out || path.join(__dirname, 'out'));
fs.mkdirSync(OUT, { recursive: true });
var list = PERSONAS.filter(function (p) { return !opt.persona || opt.persona.indexOf(p.id) >= 0; });
var SEV_FA = { critical: 'بحرانی', major: 'مهم', minor: 'جزئی', info: 'اطلاع' };

(async function main() {
  var results = [], t0 = clock.RealDate.now();
  list.forEach(function (persona) {
    var t = clock.RealDate.now();
    var r = sim.simulate(persona, { until: opt.until || 730, snapEvery: opt.browserEvery || 30 });
    r.ms = clock.RealDate.now() - t;
    results.push(r);
    if (!opt.quiet) {
      console.log('\n' + persona.id + ' · ' + persona.title + ' (' + (r.ms / 1000).toFixed(1) + 's)');
      r.findings.forEach(function (f) {
        console.log('  [' + SEV_FA[f.sev] + '] ' + f.code + ' ×' + f.count + ' · روز ' + f.day + ' (' + f.date + ') · ' + f.msg + ' · ' + JSON.stringify(f.data).slice(0, 220));
      });
      r.churn.forEach(function (c) { console.log('  [ریزش؟] روز ' + c.day + ' · ' + c.why + ' · ' + c.score); });
    }
  });
  if (opt.browser) {
    var browser = require('./browser.js');
    for (var j = 0; j < results.length; j++) {
      results[j].browser = await browser.sample(results[j], { base: process.env.BASE_URL || 'http://localhost:8000/' });
      if (!opt.quiet) console.log(results[j].persona.id + ' مرورگر: ' + results[j].browser.pages + ' صفحه، ' + results[j].browser.issues.length + ' ایراد');
    }
  }
  var report = require('./report.js');
  var meta = { generated: new clock.RealDate().toISOString(), until: opt.until || 730, personas: list.length, ms: clock.RealDate.now() - t0, browser: !!opt.browser };
  fs.writeFileSync(path.join(OUT, 'report.html'), report.html(results, meta));
  fs.writeFileSync(path.join(OUT, 'report-page.html'), report.fragment(results, meta));
  if (opt.json) fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results.map(function (r) { var o = Object.assign({}, r); delete o.snaps; return o; })));
  var crit = results.reduce(function (n, r) { return n + r.findings.filter(function (f) { return f.sev === 'critical'; }).length; }, 0);
  console.log('\nگزارش: ' + path.join(OUT, 'report.html') + ' · ' + ((clock.RealDate.now() - t0) / 1000).toFixed(1) + 's · ایراد بحرانی: ' + crit);
})().catch(function (e) { console.error(e); process.exit(1); });
