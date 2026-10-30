// مسیرهای اصلی گام، هر کدوم با یک مرورگر خالی (اکانت آزمایشی تازه، بدون هیچ داده‌ی واقعی).
// هر تست یا موفقه یا ناموفق؛ در شکست، اسکرین‌شات و trace (از تنظیمات) و لاگ کنسول و خطاهای صفحه ضمیمه می‌شن.
'use strict';
const path = require('path');
const { test, expect } = require('@playwright/test');
const J = require('../../js/vendor/jalaali.js');

// ---------- ابزار ----------
// خطاهای جاوااسکریپت صفحه و پیام‌های خطای کنسول؛ هر خطای صفحه تست رو ناموفق می‌کنه
test.beforeEach(async ({ page }, info) => {
  info.pageErrors = [];
  info.consoleLog = [];
  page.on('pageerror', (e) => info.pageErrors.push(String(e && e.stack || e).slice(0, 800)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') info.consoleLog.push(m.type() + ': ' + m.text().slice(0, 400)); });
  // معرفی (انیمیشن لوگو) فقط در تست «ورود» بررسی می‌شه
  if (!info.title.startsWith('ورود')) await page.addInitScript(() => { try { sessionStorage.setItem('gaam-intro', '1'); } catch (e) { /* */ } });
});
test.afterEach(async ({}, info) => {
  if (info.consoleLog.length) await info.attach('console.txt', { body: info.consoleLog.join('\n'), contentType: 'text/plain' });
  if (info.pageErrors.length) await info.attach('page-errors.txt', { body: info.pageErrors.join('\n\n'), contentType: 'text/plain' });
  expect(info.pageErrors, 'خطای جاوااسکریپت در صفحه').toEqual([]);
});

const RUNNER = { first: 'تست', exp: '3to12m', last: 20, avg: 20, goal: '10', goalInDays: 100, days: [0, 1, 2, 3, 4, 5, 6] };

function addDays(days) { const d = new Date(); d.setDate(d.getDate() + days); return d; }
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
async function chip(page, name, value) { await page.locator(`label:has(> input[name="${name}"][value="${value}"])`).first().click(); }
// تاریخ: در تقویم شمسی سه فهرست روز / ماه / سال؛ وگرنه فیلد تاریخ مرورگر
async function setDate(page, id, d) {
  if (await page.locator('#' + id + '-jd').count()) {
    const j = J.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate()), box = page.locator('#' + id + ' + .jdate');
    await box.locator('select[data-jd-part=y]').selectOption(String(j.jy));
    await box.locator('select[data-jd-part=m]').selectOption(String(j.jm));
    await box.locator('select[data-jd-part=d]').selectOption(String(j.jd));
  } else await page.fill('#' + id, iso(d));
  await expect(page.locator('#' + id)).toHaveValue(iso(d));
}
async function next(page) {
  await page.click('#onb-next');
  await expect(page.locator('#onb-errors')).toBeHidden();
}
async function enter(page) {
  await page.goto('./');
  await page.locator('#login-btn').click();
  await expect(page).toHaveURL(/#onboarding/);
}
// فرم اولیه‌ی کامل (۵ مرحله)
async function onboard(page, o) {
  o = Object.assign({}, RUNNER, o || {});
  await enter(page);
  await chip(page, 'activity', 'run');
  await page.fill('#fname', o.first);
  await next(page);
  await page.fill('#age', '33'); await page.fill('#height', '172'); await page.fill('#weight', '68');
  await next(page);
  await chip(page, 'experience', o.exp);
  await page.fill('#lastkm', String(o.last)); await page.fill('#avgkm', String(o.avg));
  await chip(page, 'structured', 'no');
  await next(page);
  await expect(page.locator('#level-preview .level-card')).toBeVisible();
  await next(page);
  await page.selectOption('#gtype', o.goal);
  if (o.goal !== 'none' && o.goalInDays) await setDate(page, 'rdate', addDays(o.goalInDays));
  for (const d of o.days) await chip(page, 'days', String(d));
  await chip(page, 'locations', 'park');
  await page.click('#onb-next');
  await expect(page).toHaveURL(/#home/, { timeout: 15000 });
  await expect(page.locator('.hcard-today')).toBeVisible();
}

// ---------- ۱. ثبت‌نام ----------
test('ثبت‌نام: فرم اولیه‌ی ۵ مرحله‌ای و ساخت برنامه', async ({ page }) => {
  await onboard(page);
  await expect(page.locator('.home-head h1')).toBeVisible();
  await expect(page.locator('#tabbar')).toBeVisible();
});

// ---------- ۲. ورود ----------
test('ورود: معرفی، صفحه‌ی ورود و برگشت کاربر با برنامه', async ({ page, context }) => {
  await page.goto('./');
  // انیمیشن معرفی بار اول؛ صفحه‌ی ورود حداکثر ظرف ۱۰ ثانیه
  await expect(page.locator('#login-btn')).toBeVisible({ timeout: 10000 });
  await page.locator('#login-btn').click();
  await expect(page).toHaveURL(/#onboarding/);
  await page.close();
  // کاربر با برنامه: یک برگه‌ی تازه (نشست تازه) → ورود → مستقیم خانه
  const p1 = await context.newPage();
  await p1.addInitScript(() => { try { sessionStorage.setItem('gaam-intro', '1'); } catch (e) { /* */ } });
  await onboard(p1);
  const p2 = await context.newPage();
  await p2.goto('./');
  await p2.locator('#login-btn').click();
  await expect(p2).toHaveURL(/#home/);
  await expect(p2.locator('.hcard-today')).toBeVisible();
});

// ---------- ۳. چک‌لیست شروع ----------
test('چک‌لیست شروع: قدم‌ها و رفتن به چک‌این', async ({ page }) => {
  await onboard(page);
  const card = page.locator('.ob-check');
  await expect(card).toBeVisible();
  await expect(card).toContainText('۳ از ۵');
  await card.locator('a[href="#checkin"]').first().click();
  await expect(page).toHaveURL(/#checkin/);
  await expect(page.locator('#ci-form')).toBeVisible();
});

// ---------- ۴. انتخاب هدف ----------
test('انتخاب هدف: هدف اصلی در چک‌لیست و صفحه‌ی مسابقه و هدف', async ({ page }) => {
  await onboard(page, { goal: '21', goalInDays: 120 });
  await expect(page.locator('body')).toContainText('هدف اول: نیمه‌ماراتن');
  await page.evaluate(() => { location.hash = '#race'; });
  await expect(page.locator('#app h1')).toBeVisible();
  await expect(page.locator('#app')).toContainText('نیمه‌ماراتن');
  await expect(page.locator('#app')).toContainText(/\d|[۰-۹]/);
});

// ---------- ۵. تمرین امروز ----------
test('تمرین امروز: کارت امروز و جزئیات در صفحه‌ی برنامه', async ({ page }) => {
  await onboard(page);
  const today = page.locator('.hcard-today');
  await expect(today.locator('.badge').first()).toBeVisible();
  await today.locator('[data-goto-today]').click();
  await expect(page).toHaveURL(/#plan/);
  await expect(page.locator('.week-grid')).toBeVisible();
  await expect(page.locator('.day.is-today')).toBeVisible();
  await expect(page.locator('.day-panel')).toBeVisible();
});

// ---------- ۶. ثبت چک‌این ----------
test('چک‌این: ثبت خستگی، خواب و بدون درد', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => { location.hash = '#checkin'; });
  await chip(page, 'fatigue', '2');
  await chip(page, 'sleep', '4');
  await page.fill('#ci-hours', '7');
  await chip(page, 'pain', 'no');
  await page.locator('#ci-form button[type=submit]').click();
  await expect(page).toHaveURL(/#home/);
  await expect(page.locator('.ht-checkin .pill-done')).toBeVisible();
});

// ---------- ۷. پروفایل ----------
test('پروفایل: اسم و بخش‌ها', async ({ page }) => {
  await onboard(page);
  await page.locator('#tabbar a[data-tab="profile"]').click();
  await expect(page).toHaveURL(/#profile/);
  await expect(page.locator('#app')).toContainText('تست');
  expect(await page.locator('#app .list-row').count()).toBeGreaterThan(3);
});

// ---------- ۸. مسابقه و هدف ----------
test('مسابقه و هدف: افزودن هدف فرعی ۵ کیلومتر', async ({ page }) => {
  await onboard(page, { goal: '21', goalInDays: 150 });
  await page.evaluate(() => { location.hash = '#race'; });
  await page.locator('#race-add > summary').click();
  await page.fill('#ra-name', 'مسابقه‌ی آزمایشی');
  await page.locator('#race-add-form label:has(> input[name="dist"][value="5"])').click();
  await setDate(page, 'ra-date', addDays(60));
  await page.locator('#race-add-form button[type=submit]').click();
  // اگه هشدار تداخل اومد، «همین رو نگه دار»
  const keep = page.locator('[data-race-add-opt="keep"]');
  if (await keep.count()) await keep.first().click();
  await expect(page.locator('.race-list .race-item')).toHaveCount(1);
  await expect(page.locator('.race-list')).toContainText('مسابقه‌ی آزمایشی');
});

// ---------- ۹. آپلود ویدیوی بیومکانیک ----------
// کلیپ ساختگی ۳ ثانیه‌ای بدون آدم: انتظار اینه که تحلیل با یک نتیجه‌ی قابل فهم تموم بشه
// (گزارش «قابل ارزیابی نیست» یا پیام خطای فیلم)، نه گیر کردن یا خطای جاوااسکریپت
test('بیومکانیک: آپلود فیلم و پایان تحلیل با نتیجه‌ی قابل فهم', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  await onboard(page);
  await page.evaluate(() => { location.hash = '#gait'; });
  await page.locator('input[type=file][data-gait-file="side"]').setInputFiles(path.join(__dirname, 'synthetic-clip.mp4'));
  await page.locator('label:has(> input[data-gait-cond="side"][value="easy"])').click();
  const run = page.locator('[data-gait-run]');
  await expect(run).toBeEnabled();
  await run.click();
  // پایان: یا گزارش ساخته شده یا پیام خطای فیلم نشون داده شده
  await expect(page.locator('#gait-report, #app .form-errors').first()).toBeVisible({ timeout: 5 * 60 * 1000 });
  await expect(page.locator('#gait-stage')).toHaveCount(0);
});
