// بررسی اپ اندروید در WebView واقعی (Capacitor) روی شبیه‌ساز، با Playwright از طریق DevTools.
// فقط اکانت آزمایشی و کلیپ ساختگی؛ نتیجه در smoke/result.md و اسکرین‌شات‌ها در smoke/
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// WebView اندروید «مرورگر» کامل نیست و connectOverCDP بهش وصل نمی‌شه؛ API اندروید Playwright مستقیم به WebView اپ وصل می‌شه
const { _android } = require('playwright-core');

const OUT = path.join(__dirname, '..', 'smoke');
const CLIP = path.join(__dirname, '..', '..', 'tests', 'e2e', 'synthetic-clip.mp4');
const results = [];
let page, shot = 0;

async function step(name, fn) {
  const t0 = Date.now();
  try { const note = await fn(); results.push(['✅', name, note || '', Date.now() - t0]); }
  catch (e) { results.push(['❌', name, String(e && e.message || e).split('\n')[0].slice(0, 300), Date.now() - t0]); }
  try { await page.screenshot({ path: path.join(OUT, String(++shot).padStart(2, '0') + '.png') }); } catch (e) { /* */ }
}
function adb(cmd) { return execSync('adb ' + cmd, { encoding: 'utf8' }); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function must(cond, msg) { if (!cond) throw new Error(msg); }
async function chip(name, value) { await page.locator(`label:has(> input[name="${name}"][value="${value}"])`).first().click(); }
async function next() { await page.click('#onb-next'); await page.locator('#onb-errors').waitFor({ state: 'hidden' }); }
async function hash() { return page.evaluate(() => location.hash); }

(async () => {
  const [device] = await _android.devices();
  if (!device) throw new Error('no android device');
  const webview = await device.webView({ pkg: 'app.gaam.run' }, { timeout: 60000 });
  page = await webview.page();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await step('اجرای نیتیو و افزونه‌ها', async () => {
    const info = await page.evaluate(() => ({
      native: !!(window.Capacitor && Capacitor.isNativePlatform()), kind: CoachPlatform.kind, origin: location.origin,
      plugins: ['Preferences', 'LocalNotifications', 'Filesystem', 'Share', 'App'].filter((n) => Capacitor.Plugins[n]),
      sw: CoachPlatform.sw.supported(), print: CoachPlatform.files.canPrint(), ua: navigator.userAgent
    }));
    must(info.native && info.kind === 'android', 'not native: ' + JSON.stringify(info));
    must(info.plugins.length === 5, 'plugins: ' + info.plugins.join(','));
    must(!info.sw && !info.print, 'sw/print should be off');
    return info.origin + ' · ' + info.plugins.join(', ') + ' · ' + (info.ua.match(/Chrome\/[\d.]+/) || [''])[0];
  });

  await step('صفحه‌ی ورود و ثبت‌نام (۵ مرحله)', async () => {
    await page.evaluate(() => { sessionStorage.setItem('gaam-intro', '1'); location.reload(); });
    await page.locator('#login-btn').click();
    await page.waitForURL(/#onboarding/);
    await chip('activity', 'run'); await page.fill('#fname', 'تست'); await next();
    await page.fill('#age', '33'); await page.fill('#height', '172'); await page.fill('#weight', '68'); await next();
    await chip('experience', '3to12m'); await page.fill('#lastkm', '20'); await page.fill('#avgkm', '20'); await chip('structured', 'no'); await next();
    await page.locator('#level-preview .level-card').waitFor(); await next();
    await page.selectOption('#gtype', 'none');
    for (const d of [0, 1, 2, 3, 4, 5, 6]) await chip('days', String(d));
    await chip('locations', 'park');
    await page.click('#onb-next');
    await page.waitForURL(/#home/, { timeout: 20000 });
    await page.locator('.hcard-today').waitFor();
    must(await page.locator('#tabbar').isVisible(), 'no tabbar');
  });

  await step('ذخیره‌ی نیتیو: داده در Preferences کپی شده', async () => {
    await wait(1500);
    const keys = await page.evaluate(() => Capacitor.Plugins.Preferences.keys().then((r) => r.keys));
    must(keys.indexOf('iranrunners-coach-state') >= 0, 'keys: ' + keys.join(','));
    return keys.length + ' کلید';
  });

  await step('بازگشت داده بعد از پاک شدن حافظه‌ی WebView', async () => {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.removeItem('gaam-restored'); location.reload(); });
    await wait(4000);
    await page.locator('#login-btn, .hcard-today').first().waitFor();
    const name = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('iranrunners-coach-state')).profile.name; } catch (e) { return null; } });
    must(name === 'تست', 'state not restored: ' + name);
    if (await page.locator('#login-btn').isVisible()) await page.locator('#login-btn').click();
    await page.waitForURL(/#home/, { timeout: 20000 });
  });

  await step('اعلان محلی: زمان‌بندی و لغو', async () => {
    const r = await page.evaluate(async () => {
      const P = CoachPlatform, LN = Capacitor.Plugins.LocalNotifications;
      const perm = P.notify.permission();
      P.notify.schedule([{ at: new Date(Date.now() + 3600e3), title: 'Gaam smoke', body: 'test' }]);
      await new Promise((ok) => setTimeout(ok, 1500));
      const n = (await LN.getPending()).notifications.length;
      P.notify.cancelAll();
      await new Promise((ok) => setTimeout(ok, 1500));
      return { perm, n, after: (await LN.getPending()).notifications.length };
    });
    must(r.perm === 'granted' && r.n >= 1 && r.after === 0, JSON.stringify(r));
    return JSON.stringify(r);
  });

  await step('دکمه‌ی برگشت اندروید', async () => {
    await page.evaluate(() => { location.hash = '#settings'; });
    await page.waitForURL(/#settings/);
    adb('shell input keyevent KEYCODE_BACK');
    await wait(1500);
    const h = await hash();
    must(h !== '#settings', 'still on ' + h);
    return 'به ' + h;
  });

  await step('پشتیبان: فایل و منوی اشتراک سیستم', async () => {
    await page.evaluate(() => { location.hash = '#settings'; });
    await page.locator('#set-data > summary').click();
    await page.locator('[data-backup-export]').click();
    await wait(3000);
    const top = adb('shell dumpsys activity activities').split('\n').filter((l) => /topResumedActivity|mResumedActivity/.test(l)).join(' ').trim();
    adb('shell input keyevent KEYCODE_BACK');
    await wait(1500);
    must(/chooser|Chooser|ResolverActivity|intentresolver/i.test(top), 'share sheet not shown: ' + top);
    return top.slice(0, 160);
  });

  await step('بیومکانیک: MediaPipe در WebView و پایان تحلیل', async () => {
    await page.evaluate(() => { location.hash = '#gait'; });
    await page.locator('input[type=file][data-gait-file="side"]').setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: fs.readFileSync(CLIP) });
    await page.locator('label:has(> input[data-gait-cond="side"][value="easy"])').click();
    await page.locator('[data-gait-run]').click();
    await page.locator('#gait-report, #app .form-errors').first().waitFor({ timeout: 8 * 60 * 1000 });
    return (await page.locator('#gait-report, #app .form-errors').first().innerText()).replace(/\s+/g, ' ').slice(0, 140);
  });

  await step('بدون خطای جاوااسکریپت', async () => { must(!errors.length, errors.slice(0, 5).join(' | ')); });

  const md = ['| | مرحله | جزئیات | زمان |', '|---|---|---|---|']
    .concat(results.map((r) => `| ${r[0]} | ${r[1]} | ${String(r[2]).replace(/\|/g, '/')} | ${(r[3] / 1000).toFixed(1)}s |`)).join('\n');
  fs.writeFileSync(path.join(OUT, 'result.md'), md + '\n');
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Android emulator\n\n' + md + '\n');
  await device.close().catch(() => {});
  process.exit(results.some((r) => r[0] === '❌') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
