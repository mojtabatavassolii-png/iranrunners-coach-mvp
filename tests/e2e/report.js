// گزارش اجرای دوره‌ای: خلاصه، شکست‌ها (دستگاه و مرورگر)، مقایسه با اجرای قبلی، و اسکرین‌شات شکست‌ها برای پیوست ایمیل.
// ورودی: out/results.json (این اجرا) و prev/results.json (اجرای قبلی، اگه هست).
// خروجی: out/email.html، out/subject.txt، out/summary.md (برای صفحه‌ی اجرا در گیت‌هاب)، out/failures/*.png، out/status.json
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
const cur = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8'));
const prevPath = path.join(__dirname, 'prev', 'results.json');
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')) : null;
const MAX_SHOTS = 12;

const ENGINE = { chromium: 'Chromium', webkit: 'WebKit (شبیه Safari)', firefox: 'Firefox' };
const DEVICE = {
  'android-pixel7': 'اندروید Pixel 7', 'android-small-360': 'اندروید کوچیک ۳۶۰ پیکسلی', 'desktop-chrome': 'دسکتاپ Chrome',
  'iphone-se': 'آیفون SE', 'iphone-15': 'آیفون ۱۵', 'iphone-15-pro-max': 'آیفون ۱۵ Pro Max', 'ipad': 'آیپد', 'ipad-mini': 'آیپد مینی',
  'desktop-safari': 'دسکتاپ Safari', 'desktop-firefox': 'دسکتاپ Firefox', 'firefox-phone-width': 'Firefox با پهنای گوشی'
};
const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');

// همه‌ی تست‌ها به‌صورت {key, project, title, status, error, shot}
function flatten(r) {
  const engines = {};
  (r.config.projects || []).forEach((p) => { engines[p.name] = (p.metadata && p.metadata.engine) || ''; });
  const out = [];
  const walk = (s) => {
    (s.specs || []).forEach((sp) => sp.tests.forEach((t) => {
      const last = t.results[t.results.length - 1] || {};
      const shot = t.results.map((x) => (x.attachments || []).find((a) => a.name === 'screenshot' && a.path)).filter(Boolean).pop();
      const status = t.status === 'expected' ? 'pass' : t.status === 'flaky' ? 'flaky' : t.status === 'skipped' ? 'skip' : 'fail';
      out.push({ key: t.projectName + ' | ' + sp.title, project: t.projectName, engine: engines[t.projectName] || '', title: sp.title, status,
        error: stripAnsi((last.error && last.error.message) || '').split('\n').slice(0, 4).join(' ').slice(0, 300), shot: shot && shot.path });
    }));
    (s.suites || []).forEach(walk);
  };
  (r.suites || []).forEach(walk);
  return out;
}

const now = flatten(cur);
const before = prev ? flatten(prev) : [];
const prevByKey = new Map(before.map((t) => [t.key, t]));
const curKeys = new Set(now.map((t) => t.key));
const failing = now.filter((t) => t.status === 'fail');
const flaky = now.filter((t) => t.status === 'flaky');
const passed = now.filter((t) => t.status === 'pass');
const newlyBroken = failing.filter((t) => !prevByKey.has(t.key) || prevByKey.get(t.key).status !== 'fail');
const stillBroken = failing.filter((t) => prevByKey.has(t.key) && prevByKey.get(t.key).status === 'fail');
const fixed = before.filter((t) => t.status === 'fail' && curKeys.has(t.key) && now.find((x) => x.key === t.key).status !== 'fail');

// اسکرین‌شات شکست‌ها (اول تازه خراب‌شده‌ها)
const shotDir = path.join(OUT, 'failures');
fs.mkdirSync(shotDir, { recursive: true });
const shots = [];
newlyBroken.concat(stillBroken).forEach((t) => {
  if (!t.shot || shots.length >= MAX_SHOTS || !fs.existsSync(t.shot)) return;
  const name = String(shots.length + 1).padStart(2, '0') + '-' + t.project + '.png';
  fs.copyFileSync(t.shot, path.join(shotDir, name));
  shots.push({ name, t });
});

const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
const target = process.env.BASE_URL || cur.config.projects[0] && cur.config.projects[0].use && cur.config.projects[0].use.baseURL || '';
const projects = [...new Set(now.map((t) => t.project))];
const ok = !failing.length;

const subject = 'گام، تست دوره‌ای: ' + (ok ? 'همه موفق' : fa(failing.length) + ' ناموفق') + ' (' + fa(passed.length + flaky.length) + ' از ' + fa(now.length) + ' موفق)' +
  (newlyBroken.length ? '، ' + fa(newlyBroken.length) + ' تازه خراب' : '');

const row = (t) => `<tr><td>${esc(DEVICE[t.project] || t.project)}</td><td>${esc(ENGINE[t.engine] || t.engine)}</td><td>${esc(t.title)}</td><td style="color:#8a5a00;font-size:12px" dir="ltr">${esc(t.error)}</td></tr>`;
const table = (list) => list.length ? `<table cellpadding="6" style="border-collapse:collapse;font-size:13px;width:100%" border="1" bordercolor="#e2dbcd"><tr style="background:#f6f3ec"><th>دستگاه</th><th>مرورگر</th><th>تست</th><th>خطا</th></tr>${list.map(row).join('')}</table>` : '<p>—</p>';

let html = `<div dir="rtl" style="font-family:Tahoma,Vazirmatn,sans-serif;line-height:1.8;color:#1f1a12;max-width:760px">
<h2 style="margin:0 0 6px">${esc(subject)}</h2>
<p style="margin:0;color:#6b6257">${esc(new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }))}، نشانی تست‌شده: <span dir="ltr">${esc(target)}</span></p>
<table cellpadding="8" style="margin:14px 0;border-collapse:collapse;font-size:14px"><tr>
<td style="background:#e3f0e4">موفق: <b>${fa(passed.length)}</b></td>
<td style="background:${failing.length ? '#fbe9e7' : '#f6f3ec'}">ناموفق: <b>${fa(failing.length)}</b></td>
<td style="background:#fdf0dc">ناپایدار (موفق در تلاش دوم): <b>${fa(flaky.length)}</b></td>
<td style="background:#f6f3ec">دستگاه‌ها: <b>${fa(projects.length)}</b></td></tr></table>`;
if (!prev) html += '<p style="color:#6b6257">اجرای قبلی برای مقایسه پیدا نشد (اولین اجرا، یا نتیجه‌ی قبلی منقضی شده).</p>';
html += `<h3>تازه خراب‌شده نسبت به اجرای قبلی (${fa(newlyBroken.length)})</h3>${table(newlyBroken)}`;
html += `<h3>هنوز خراب (${fa(stillBroken.length)})</h3>${table(stillBroken)}`;
html += `<h3>تازه درست‌شده (${fa(fixed.length)})</h3>${fixed.length ? '<ul>' + fixed.map((t) => `<li>${esc(DEVICE[t.project] || t.project)}: ${esc(t.title)}</li>`).join('') + '</ul>' : '<p>—</p>'}`;
if (flaky.length) html += `<h3>ناپایدار (${fa(flaky.length)})</h3><ul>${flaky.map((t) => `<li>${esc(DEVICE[t.project] || t.project)}: ${esc(t.title)}</li>`).join('')}</ul>`;
if (shots.length) html += `<p>اسکرین‌شات ${fa(shots.length)} شکست پیوست این ایمیله (${shots.map((s) => esc(s.name)).join('، ')}).</p>`;
if (runUrl) html += `<p>جزئیات، trace و همه‌ی اسکرین‌شات‌ها: <a href="${esc(runUrl)}">صفحه‌ی این اجرا در گیت‌هاب</a> (بخش Artifacts، ۱۴ روز نگه داشته می‌شه).</p>`;
html += `<p style="color:#6b6257;font-size:12px;border-top:1px solid #e2dbcd;padding-top:8px">محدودیت: همه‌ی دستگاه‌ها شبیه‌سازی‌شده‌ان (Playwright روی سرور لینوکس گیت‌هاب)، نه گوشی واقعی. WebKit شبیه Safari است ولی خود Safari آیفون نیست. Firefox شبیه‌سازی کامل گوشی (لمس و حالت موبایل) نداره و فقط پهنای صفحه شبیه‌سازی می‌شه. ویدیوی بیومکانیک یک کلیپ ساختگی بدون آدمه؛ فقط بررسی می‌شه که آپلود و تحلیل بدون گیر کردن یا خطا تموم بشه. شرایط اینترنت ایران و CDN بررسی نمی‌شه. هر تست با یک مرورگر خالی (اکانت آزمایشی تازه) اجرا می‌شه و به داده‌ی هیچ کاربری دست نمی‌زنه.</p></div>`;

const md = [`### ${subject}`, '', `موفق: ${passed.length} · ناموفق: ${failing.length} · ناپایدار: ${flaky.length} · دستگاه‌ها: ${projects.length}`, '',
  `**تازه خراب‌شده (${newlyBroken.length})**`, ...newlyBroken.map((t) => `- ${DEVICE[t.project] || t.project} (${ENGINE[t.engine] || t.engine}): ${t.title}`), '',
  `**هنوز خراب (${stillBroken.length})**`, ...stillBroken.map((t) => `- ${DEVICE[t.project] || t.project}: ${t.title}`), '',
  `**تازه درست‌شده (${fixed.length})**`, ...fixed.map((t) => `- ${DEVICE[t.project] || t.project}: ${t.title}`)].join('\n');

fs.writeFileSync(path.join(OUT, 'email.html'), html);
fs.writeFileSync(path.join(OUT, 'subject.txt'), subject);
fs.writeFileSync(path.join(OUT, 'summary.md'), md + '\n');
fs.writeFileSync(path.join(OUT, 'status.json'), JSON.stringify({ total: now.length, passed: passed.length, failed: failing.length, flaky: flaky.length, newlyBroken: newlyBroken.length, fixed: fixed.length }, null, 1));
console.log(subject);
