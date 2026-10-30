// تست‌های دوره‌ای مسیرهای اصلی گام روی گوشی، تبلت و دسکتاپ شبیه‌سازی‌شده.
// BASE_URL: نشانی اپ (پیش‌فرض: نسخه‌ی منتشرشده روی GitHub Pages). همه‌چیز در مرورگر خالی (اکانت آزمایشی تازه) اجرا می‌شه.
// LOCAL_CHROMIUM: مسیر Chromium نصب‌شده (فقط برای اجرای محلی؛ در CI خالیه)
'use strict';
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://mojtabatavassolii-png.github.io/iranrunners-coach-mvp/';
const local = process.env.LOCAL_CHROMIUM ? { launchOptions: { executablePath: process.env.LOCAL_CHROMIUM } } : {};
// ONLY: فهرست پروژه‌ها با کاما (مثلاً برای اجرای محلی فقط Chromium)
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

const projects = [
  { name: 'android-pixel7', engine: 'chromium', use: { ...devices['Pixel 7'] } },
  { name: 'android-small-360', engine: 'chromium', use: { ...devices['Galaxy S8'] } },
  { name: 'desktop-chrome', engine: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  { name: 'iphone-se', engine: 'webkit', use: { ...devices['iPhone SE (3rd gen)'] } },
  { name: 'iphone-15', engine: 'webkit', use: { ...devices['iPhone 15'] } },
  { name: 'iphone-15-pro-max', engine: 'webkit', use: { ...devices['iPhone 15 Pro Max'] } },
  { name: 'ipad', engine: 'webkit', use: { ...devices['iPad (gen 7)'] } },
  { name: 'ipad-mini', engine: 'webkit', use: { ...devices['iPad Mini'] } },
  { name: 'desktop-safari', engine: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } } },
  { name: 'desktop-firefox', engine: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
  // Firefox شبیه‌سازی گوشی (لمس، حالت موبایل) نداره؛ فقط اندازه‌ی صفحه‌ی گوشی
  { name: 'firefox-phone-width', engine: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 390, height: 844 } } }
].filter((p) => !only || only.includes(p.name))
  .map((p) => ({ name: p.name, metadata: { engine: p.engine }, use: { ...p.use, ...(p.engine === 'chromium' ? local : {}) } }));

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  timeout: 90 * 1000,
  expect: { timeout: 10 * 1000 },
  retries: 1,
  workers: process.env.CI ? 3 : 4,
  outputDir: 'test-results',
  reporter: [['list'], ['json', { outputFile: 'out/results.json' }], ['html', { outputFolder: 'out/html', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000
  },
  projects
});
