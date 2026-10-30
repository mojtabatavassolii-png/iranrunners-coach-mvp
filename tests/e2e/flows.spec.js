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

// ---------- ۱۰. پشتیبان، حذف همه‌ی داده‌ها و بازگردانی ----------
test('پشتیبان: گرفتن فایل، حذف همه‌چیز و بازگردانی از صفحه‌ی ورود', async ({ page }, info) => {
  // منوی اشتراک گوشی در مرورگر بی‌سر باز نمی‌شه؛ مسیر دانلود فایل تست می‌شه
  await page.addInitScript(() => { try { navigator.canShare = () => false; } catch (e) { /* */ } });
  await onboard(page);
  await page.evaluate(() => { location.hash = '#checkin'; });
  await chip(page, 'fatigue', '2'); await chip(page, 'sleep', '4'); await chip(page, 'pain', 'no');
  await page.locator('#ci-form button[type=submit]').click();
  await expect(page).toHaveURL(/#home/);
  // گرفتن فایل پشتیبان
  await page.evaluate(() => { location.hash = '#settings'; });
  await page.locator('#set-data > summary').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-backup-export]').click()]);
  const file = info.outputPath('backup.json');
  await dl.saveAs(file);
  const b = JSON.parse(require('fs').readFileSync(file, 'utf8'));
  expect(b.app).toBe('gaam');
  expect(b.data.state.profile.name).toBe('تست');
  expect(Object.keys(b.data.state.checkins).length).toBe(1);
  // حذف همه‌ی داده‌ها → صفحه‌ی ورود، بدون هیچ داده‌ای
  await page.locator('#wipe').click();
  await page.locator('#confirm-ack').check();
  await page.locator('#confirm-yes').click();
  await expect(page.locator('#login-btn')).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf('iranrunners-coach-') === 0).length)).toBe(0);
  // بازگردانی از صفحه‌ی ورود
  // مسیر پوشه‌ی خروجی تست حروف فارسی داره و Chromium فایل با مسیر غیرلاتین رو انتخاب نمی‌کنه؛ محتوای فایل مستقیم داده می‌شه
  await page.locator('input[data-backup-file="login"]').setInputFiles({ name: 'gaam-backup.json', mimeType: 'application/json', buffer: require('fs').readFileSync(file) });
  await expect(page.locator('.login-import-box')).toBeVisible();
  await expect(page.locator('.login-import-text')).toContainText('تست');
  await page.locator('[data-backup-apply="login"]').click();
  await expect(page).toHaveURL(/#home/, { timeout: 15000 });
  await expect(page.locator('.ht-checkin .pill-done')).toBeVisible();
  // فایل نامعتبر: پیام خطا، بدون تغییر داده
  await page.evaluate(() => { location.hash = '#settings'; });
  await page.locator('#set-data > summary').click();
  await page.locator('input[data-backup-file="settings"]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('#set-data .backup-err')).toBeVisible();
  await expect(page.locator('#set-data .backup-confirm')).toBeHidden();
});

// ---------- ۱۱. اتصال به Health Connect (اپ نیتیو با Capacitor ساختگی) ----------
// افزونه‌های نیتیو در مرورگر نیستن؛ یک Capacitor ساختگی با یک دویدن امروز صبح و یک دوچرخه‌سواری
test('سلامت (نیتیو ساختگی): اتصال، ثبت خودکار دویدن امروز، برداشتن و ثبت نشدن دوباره', async ({ page }) => {
  await page.addInitScript(() => {
    const ok = (v) => Promise.resolve(v), prefs = {}, now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 30);
    window.__calls = [];
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
      Preferences: { keys: () => ok({ keys: Object.keys(prefs) }), get: (o) => ok({ value: prefs[o.key] }), set: (o) => { prefs[o.key] = o.value; return ok(); }, remove: (o) => { delete prefs[o.key]; return ok(); } },
      Health: {
        isAvailable: () => ok({ available: true }),
        requestAuthorization: (o) => { __calls.push('auth'); return ok({ readAuthorized: o.read }); },
        queryWorkouts: () => { __calls.push('query'); return ok({ workouts: [
          { workoutType: 'running', duration: 1830, totalDistance: 5120, startDate: start.toISOString(), endDate: new Date(start.getTime() + 1830e3).toISOString(), platformId: 'w1', sourceName: 'Watch' },
          { workoutType: 'cycling', duration: 3600, totalDistance: 20000, startDate: start.toISOString(), endDate: start.toISOString(), platformId: 'w2' }] }); },
        openHealthConnectSettings: () => ok()
      } } };
  });
  await onboard(page);
  await page.evaluate(() => { location.hash = '#profile'; });
  await expect(page.locator('a.list-row[data-set-open="sync"]')).toContainText('Health Connect');
  await page.locator('a.list-row[data-set-open="sync"]').click();
  await expect(page.locator('#set-sync')).toHaveAttribute('open', '');
  await page.locator('[data-health-connect]').click();
  await expect(page.locator('.toast').last()).toContainText('۱ تمرین از Health Connect ثبت شد');
  await expect(page.locator('#set-sync [data-health-sync]')).toBeVisible();
  await page.locator('#set-sync').scrollIntoViewIfNeeded();
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('iranrunners-coach-mvp-v1')));
  const key = Object.keys(st.done)[0];
  expect(Object.keys(st.done).length).toBe(1);
  expect(st.doneLog[key].actual).toEqual({ sec: 1830, km: 5.12, start: '00:30' });
  expect(st.doneLog[key].src).toBe('health');
  // صفحه‌ی امروز: خط «ثبت‌شده» با منبع
  await page.evaluate(() => { location.hash = '#home'; });
  await page.locator('.hcard-today').scrollIntoViewIfNeeded();
  await page.evaluate(() => { location.hash = '#plan'; });
  await expect(page.locator('.actual-line').first()).toContainText('از Health Connect');
  // برداشتن «انجام شد» و همگام‌سازی دوباره: همون تمرین برنمی‌گرده
  await page.locator('[data-done="' + key + '"]').first().click();
  await page.evaluate(() => { location.hash = '#settings'; });
  await page.locator('#set-sync [data-health-sync]').click();
  await expect(page.locator('.toast').last()).toContainText('تمرین تازه‌ای پیدا نشد');
  const st2 = await page.evaluate(() => JSON.parse(localStorage.getItem('iranrunners-coach-mvp-v1')));
  expect(st2.done[key]).toBeFalsy();
  // قطع اتصال
  await page.locator('#set-sync [data-health-off]').click();
  await expect(page.locator('#set-sync [data-health-connect]')).toBeVisible();
});

// ---------- ۱۲. ثبت دویدن با GPS (مرورگر؛ موقعیت ساختگی Playwright) ----------
// حرکت به سمت شمال، هر ثانیه ۶ متر؛ وسطش صفحه دوباره بار می‌شه (ثبت ناتموم باید برگرده)، بعد ذخیره
test('ثبت با GPS: شروع، بازگشت بعد از بستن صفحه، پایان و ذخیره در جلسه‌ی امروز', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'موقعیت ساختگی پیوسته فقط در Chromium مطمئنه');
  test.setTimeout(120000);
  const M = 111195;
  let lat = 35.7;
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: lat, longitude: 51.4, accuracy: 5 });
  async function walk(n) {
    for (let i = 0; i < n; i++) {
      await page.waitForTimeout(1000);
      lat += 6 / M;
      await context.setGeolocation({ latitude: lat, longitude: 51.4, accuracy: 5 });
    }
  }
  await onboard(page);
  await page.locator('.hcard-today .rec-entry').click();
  await expect(page).toHaveURL(/#record/);
  await page.locator('[data-rec="start"]').click();
  await walk(8);
  await expect.poll(async () => Number((await page.locator('#rec-km').innerText()).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace('٫', '.'))).toBeGreaterThan(0.02);
  // صفحه بسته و باز شد: ثبت متوقف‌شده برمی‌گرده
  await page.reload();
  await expect(page.locator('.rec-card .alert')).toContainText('ناتموم');
  // در خانه یک نوار ثبت متوقف‌شده هست که به همین صفحه برمی‌گرده
  await page.evaluate(() => { location.hash = '#home'; });
  await expect(page.locator('.rec-banner')).toContainText('ثبت متوقف شده');
  await page.locator('.rec-banner').click();
  await expect(page).toHaveURL(/#record/);
  await page.locator('[data-rec="resume"]').click();
  await walk(8);
  await page.locator('[data-rec="finish"]').click();
  await expect(page.locator('[data-rec="save"]')).toBeVisible();
  await page.locator('[data-rec="save"]').click();
  await expect(page).toHaveURL(/#plan/);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('iranrunners-coach-mvp-v1')));
  const key = Object.keys(st.done)[0];
  const a = st.doneLog[key].actual;
  expect(st.doneLog[key].src).toBe('gps');
  expect(a.km).toBeGreaterThan(0.06);
  expect(a.km).toBeLessThan(0.14);
  expect(a.sec).toBeGreaterThan(10);
  // مختصات ذخیره نمی‌شن و ثبت زنده پاک شده
  expect(JSON.stringify(st)).not.toContain('35.7');
  expect(await page.evaluate(() => localStorage.getItem('gaam-run-live'))).toBeNull();
  // فرم «بعد از دویدن» با عددهای ثبت‌شده باز می‌شه؛ بعد از بستنش خط «ثبت‌شده» با منبع
  const form = page.locator('[data-postrun-form="' + key + '"]');
  await expect(form).toBeVisible();
  await expect(form.locator('input[name=actKm]')).not.toHaveValue('');
  await page.locator('[data-postrun-cancel]').first().click();
  await expect(page.locator('.actual-line').first()).toContainText('با GPS گام');
});

// ---------- ۱۳. سنسور ضربان قلب بلوتوث حین ثبت (Web Bluetooth ساختگی) ----------
test('سنسور ضربان: اتصال، عدد زنده، ذخیره‌ی میانگین و بیشینه با دویدن', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'موقعیت ساختگی پیوسته فقط در Chromium مطمئنه');
  test.setTimeout(120000);
  const M = 111195;
  let lat = 35.7;
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: lat, longitude: 51.4, accuracy: 5 });
  await page.addInitScript(() => {
    const ch = { addEventListener: (t, f) => { ch.f = f; }, startNotifications: () => Promise.resolve(ch) };
    const dev = { id: 'dev1', name: 'HRM-Test', addEventListener() {}, removeEventListener() {},
      gatt: { connected: true, disconnect() {}, connect: () => Promise.resolve({ getPrimaryService: () => Promise.resolve({ getCharacteristic: () => Promise.resolve(ch) }) }) } };
    Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: () => Promise.resolve(dev) } });
    // بسته‌ی استاندارد: پرچم ۰، ضربان ۸ بیتی
    window.__hr = (bpm) => ch.f && ch.f({ target: { value: new DataView(new Uint8Array([0, bpm]).buffer) } });
  });
  await onboard(page);
  await page.evaluate(() => { location.hash = '#record'; });
  await page.locator('[data-hr="connect"]').click();
  await page.evaluate(() => window.__hr(120));
  await expect(page.locator('#rec-hr')).toHaveText('۱۲۰');
  await page.locator('[data-rec="start"]').click();
  // ضربان کمتر از ۳۰ ثانیه ذخیره نمی‌شه؛ ۳۴ ثانیه: نصف اول ۱۴۰، نصف دوم ۱۶۰
  for (let i = 0; i < 34; i++) {
    await page.waitForTimeout(1000);
    lat += 6 / M;
    await context.setGeolocation({ latitude: lat, longitude: 51.4, accuracy: 5 });
    await page.evaluate((b) => window.__hr(b), i < 17 ? 140 : 160);
  }
  await expect(page.locator('#rec-hr')).toHaveText('۱۶۰');
  await page.locator('[data-rec="finish"]').click();
  await page.locator('[data-rec="save"]').click();
  await expect(page).toHaveURL(/#plan/);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('iranrunners-coach-mvp-v1')));
  const key = Object.keys(st.done)[0], hr = st.doneLog[key].hr;
  expect(hr.max).toBe(160);
  expect(hr.avg).toBeGreaterThanOrEqual(140);
  expect(hr.avg).toBeLessThanOrEqual(160);
  // دستگاه برای دفعه‌ی بعد (فقط شناسه و اسم)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gaam-hr-device')))).toEqual({ id: 'dev1', name: 'HRM-Test' });
  await page.locator('[data-postrun-cancel]').first().click();
  await expect(page.locator('.actual-line').first()).toContainText('ضربان میانگین');
});
