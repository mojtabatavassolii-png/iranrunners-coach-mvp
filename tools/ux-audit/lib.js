// پایه‌ی مشترک بازبینی: مرورگر، داده‌ی ثابت و صفحه‌هایی که بررسی می‌شن
'use strict';
const fs = require('fs');
const path = require('path');
const { build } = require('./fixture.js');

let pw;
try { pw = require('playwright'); } catch (e) {
  console.error('playwright نصب نیست: داخل tools/ux-audit دستور «npm install» رو اجرا کن.');
  process.exit(1);
}

const TODAY = '2026-12-19';
const ROOT = path.resolve(__dirname, '../..');
const BASE = 'file://' + path.join(ROOT, 'index.html');
const KEY = 'iranrunners-coach-mvp-v1';
const HEIGHTS = { 320: 568, 360: 740, 375: 667, 390: 844, 412: 915, 430: 932 };

async function gotoStep(p, n) {
  await p.click('.onb-dot[data-goto-step="' + n + '"]');
  await p.waitForTimeout(600);
}
async function setPlanView(p, mode) {
  const b = p.locator('[data-view-mode="' + mode + '"]');
  if (await b.count()) { await b.first().click(); await p.waitForTimeout(400); }
}
// [کلید، مسیر، آماده‌سازی]؛ فرم با پروفایل موجود باز می‌شه (حالت ویرایش) تا همه‌ی مرحله‌ها در دسترس باشن
const SCREENS = [
  ['onb-1', '#onboarding', async () => {}],
  ['onb-2', '#onboarding', async (p) => gotoStep(p, 2)],
  ['onb-3', '#onboarding', async (p) => gotoStep(p, 3)],
  ['onb-4', '#onboarding', async (p) => gotoStep(p, 4)],
  ['onb-5', '#onboarding', async (p) => gotoStep(p, 5)],
  ['home', '#home', async () => {}],
  ['plan-week', '#plan', async (p) => setPlanView(p, 'week')],
  ['plan-month', '#plan', async (p) => setPlanView(p, 'month')],
  ['profile', '#profile', async () => {}],
  ['progress', '#progress', async () => {}],
  ['checkin', '#checkin', async () => {}],
  ['settings', '#settings', async () => {}],
  ['fitness', '#fitness', async () => {}],
  ['learn', '#learn', async () => {}],
  ['learn-article', '#learn/vdot', async () => {}],
  ['guide', '#guide', async () => {}],
  ['race', '#race', async () => {}],
  ['gait', '#gait', async () => {}],
  // فرم بعد از «انجامش دادم» (مسافت و زمان واقعی + سؤال‌های ایزی ران) روی یک ایزی ران انجام‌نشده‌ی هفته‌ی قبل
  ['plan-doneform', '#plan', async (p) => {
    await setPlanView(p, 'week');
    const k = await p.evaluate(([K, today]) => {
      const s = JSON.parse(localStorage.getItem(K)), C = window.CoachLogic;
      for (let i = 1; i < 14; i++) {
        const d = C.addDays(C.parseDate(today), -i), key = C.dateKey(d), ss = C.sessionFor(s.profile, d);
        if (ss.type === 'easy') { delete s.done[key]; if (s.doneLog) delete s.doneLog[key]; delete s.postRuns[key]; localStorage.setItem(K, JSON.stringify(s)); return key; }
      }
    }, [KEY, TODAY]);
    await p.reload(); await p.waitForTimeout(400); await setPlanView(p, 'week');
    for (let w = 0; w < 3 && !(await p.locator('button#tab-' + k).count()); w++) { await p.click('[data-week="-1"]'); await p.waitForTimeout(350); }
    await p.locator('button#tab-' + k).click(); await p.waitForTimeout(300);
    await p.click('#day-panel [data-done="' + k + '"]'); await p.waitForTimeout(500);
    await p.locator('#day-panel form.postrun').scrollIntoViewIfNeeded();
  }],
  // پروفایل کاربر خانم با چرخه‌ی فعال (کارت «تمرین در روزهای پریود»)
  ['profile-cycle', '#profile', async (p) => {
    await p.evaluate(([K]) => {
      const s = JSON.parse(localStorage.getItem(K));
      s.profile.sex = 'female';
      s.profile.cycle = { enabled: true, lastStart: '2026-12-18', cycleLen: 28, periodLen: 5, periodMode: 'easy', periodOverrides: {} };
      localStorage.setItem(K, JSON.stringify(s));
    }, [KEY]);
    await p.reload(); await p.waitForTimeout(500);
  }],
];

async function launch() {
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return pw.chromium.launch(exe ? { executablePath: exe } : {});
}
// زمینه‌ی گوشی با عرض دقیق (screen هم هم‌اندازه، وگرنه مرورگر موبایل سرریز رو با پهن کردن صفحه پنهان می‌کنه)
async function newContext(browser, w) {
  const h = HEIGHTS[w] || 800;
  return browser.newContext({ ...pw.devices['Pixel 7'], viewport: { width: w, height: h }, screen: { width: w, height: h }, reducedMotion: 'reduce' });
}
async function seed(p, lang) {
  await p.goto(BASE);
  await p.evaluate(([s, l, K]) => {
    localStorage.clear();
    localStorage.setItem(K, JSON.stringify(s));
    localStorage.setItem('iranrunners-coach-lang', l);
    sessionStorage.setItem('iranrunners-coach-session', '1');
  }, [build('road', TODAY), lang, KEY]);
}
async function openScreen(p, key) {
  const sc = SCREENS.find((s) => s[0] === key);
  if (!sc) throw new Error('صفحه‌ی ناشناخته: ' + key);
  await p.goto(BASE + '?today=' + TODAY + sc[1]);
  await p.reload();
  await p.waitForTimeout(450);
  await sc[2](p);
}

module.exports = { SCREENS, TODAY, BASE, KEY, HEIGHTS, launch, newContext, seed, openScreen };
