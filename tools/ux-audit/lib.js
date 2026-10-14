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
