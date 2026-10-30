// بررسی اپ اندروید در WebView واقعی (Capacitor) روی شبیه‌ساز، با Playwright از طریق DevTools.
// فقط اکانت آزمایشی و کلیپ ساختگی؛ نتیجه در smoke/result.md و اسکرین‌شات‌ها در smoke/
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// WebView اندروید «مرورگر» کامل نیست و connectOverCDP بهش وصل نمی‌شه؛ API اندروید Playwright مستقیم به WebView اپ وصل می‌شه
const { _android } = require('playwright-core');

const OUT = path.join(__dirname, '..', 'smoke');
const WEBM = path.join(OUT, 'clip.webm');
const CLIP = fs.existsSync(WEBM) ? WEBM : path.join(__dirname, '..', '..', 'tests', 'e2e', 'synthetic-clip.mp4');
const STORE_KEY = 'iranrunners-coach-mvp-v1';   // همون STORE_KEY در js/app.js
const results = [];
let page, shot = 0;

async function step(name, fn) {
  const t0 = Date.now();
  try { const note = await fn(); results.push(['✅', name, note || '', Date.now() - t0]); }
  catch (e) { results.push(['❌', name, String(e && e.message || e).split('\n')[0].slice(0, 300), Date.now() - t0]); }
  try { await page.screenshot({ path: path.join(OUT, String(++shot).padStart(2, '0') + '.png') }); } catch (e) { /* */ }
}
function adb(cmd) { return execSync('adb ' + cmd, { encoding: 'utf8', timeout: 30000 }); }
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
  // «Share canceled»: پل Capacitor رد شدن هر فراخوانی رو در کنسول می‌نویسه؛ اپ لغو اشتراک رو عادی در نظر می‌گیره.
  // «INFO: …»: پیام‌های اطلاعاتی MediaPipe (مثل ساخته شدن XNNPACK) که با console.error چاپ می‌شن.
  // «Error injecting safe area CSS»: کد خود Capacitor که موقع reload پیش از ساخته شدن صفحه اجرا می‌شه؛ اپ از env(safe-area-inset-*) استفاده می‌کنه
  page.on('console', (m) => { if (m.type() === 'error' && !/Share canceled|Error injecting safe area CSS|^INFO: /.test(m.text())) errors.push('console: ' + m.text()); });

  await step('اجرای نیتیو و افزونه‌ها', async () => {
    const info = await page.evaluate(() => ({
      native: !!(window.Capacitor && Capacitor.isNativePlatform()), kind: CoachPlatform.kind, origin: location.origin,
      plugins: ['Preferences', 'LocalNotifications', 'Filesystem', 'Share', 'App', 'Health', 'BackgroundGeolocation'].filter((n) => Capacitor.Plugins[n]),
      sw: CoachPlatform.sw.supported(), print: CoachPlatform.files.canPrint(), ua: navigator.userAgent
    }));
    must(info.native && info.kind === 'android', 'not native: ' + JSON.stringify(info));
    must(info.plugins.length === 7, 'plugins: ' + info.plugins.join(','));
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
    must(keys.indexOf(STORE_KEY) >= 0, 'keys: ' + keys.join(','));
    return keys.length + ' کلید';
  });

  await step('بازگشت داده بعد از پاک شدن حافظه‌ی WebView', async () => {
    await page.evaluate(() => { localStorage.clear(); sessionStorage.removeItem('gaam-restored'); location.reload(); });
    await wait(4000);
    await page.locator('#login-btn, .hcard-today').first().waitFor();
    const name = await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)).profile.name; } catch (e) { return null; } }, STORE_KEY);
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

  // اجازه‌ی Health Connect پنجره‌ی سیستمی داره و این‌جا زده نمی‌شه؛ در دسترس بودن و نمایش بخش تنظیمات بررسی می‌شه
  await step('Health Connect: در دسترس و بخش اتصال در تنظیمات', async () => {
    const a = await page.evaluate(() => CoachPlatform.health.available());
    await page.evaluate(() => { location.hash = '#settings'; });
    await page.locator('#set-sync').waitFor();
    must(await page.locator('#set-sync [data-health-connect]').count() === 1, 'no connect button');
    must(a.available, 'not available: ' + JSON.stringify(a));
    return JSON.stringify(a);
  });

  // ثبت با GPS: موقعیت با «adb emu geo fix» (هر ثانیه ۴ متر به شمال)؛ وسطش اپ به پس‌زمینه می‌ره (دکمه‌ی Home)
  // و باید هم اعلان سرویس دیده بشه و هم مسافت در پس‌زمینه زیاد بشه
  await step('GPS: ثبت دویدن، در پس‌زمینه هم، و ذخیره در جلسه‌ی امروز', async () => {
    const M = 111195;
    let lat = 35.7;
    const fix = () => { lat += 4 / M; adb(`emu geo fix 51.4 ${lat.toFixed(7)}`); };
    const live = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('gaam-run-live')).st.dist; } catch (e) { return null; } });
    adb(`emu geo fix 51.4 ${lat}`);
    await page.evaluate(() => { location.hash = '#record'; });
    await page.locator('[data-rec="start"]').click();
    for (let i = 0; i < 12; i++) { await wait(1000); fix(); }
    await wait(5500); fix();
    const fg = await live();
    adb('shell input keyevent KEYCODE_HOME');
    await wait(1500);
    const notif = /app\.gaam\.run/.test(adb('shell dumpsys notification --noredact'));
    for (let i = 0; i < 15; i++) { await wait(1000); fix(); }
    adb('shell am start -n app.gaam.run/.MainActivity');
    await wait(2500);
    for (let i = 0; i < 6; i++) { await wait(1000); fix(); }
    const all = await live();
    must(fg > 20, 'foreground distance ' + fg);
    must(all - fg > 35, 'background distance ' + fg + ' → ' + all);
    must(notif, 'no foreground-service notification while in background');
    await page.locator('[data-rec="finish"]').click();
    await page.locator('[data-rec="save"]').click();
    await page.waitForURL(/#plan/);
    const log = await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); const d = Object.keys(s.done)[0]; return s.doneLog[d]; }, STORE_KEY);
    must(log && log.src === 'gps' && log.actual.km > 0.05, JSON.stringify(log));
    return `پیش‌زمینه ${Math.round(fg)} m · کل ${Math.round(all)} m · ذخیره ${log.actual.km} km در ${log.actual.sec}s · اعلان سرویس: ${notif ? 'بله' : 'نه'}`;
  });

  await step('دکمه‌ی برگشت اندروید', async () => {
    await page.evaluate(() => { location.hash = '#settings'; });
    await page.waitForURL(/#settings/);
    await wait(1000);
    adb('shell input keyevent KEYCODE_BACK');
    // تا ۵ ثانیه برای رسیدن رویداد برگشت از سیستم به اپ
    let h = await hash();
    for (let i = 0; i < 10 && h === '#settings'; i++) { await wait(500); h = await hash(); }
    must(h !== '#settings', 'still on ' + h + ' · canGoBack=' + (await page.evaluate(() => history.length)));
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

  // تحلیل ویدیو در شبیه‌ساز: GPU-delegate مدیاپایپ از ترجمه‌ی GL شبیه‌ساز رد می‌شه و خود شبیه‌ساز رو از کار می‌اندازه
  // (۳ اجرا، با H.264 و VP8). پس این‌جا همون اجزای نیتیو‌حساس با CPU بررسی می‌شن: بارگذاری wasm و مدل از https://localhost،
  // باز کردن ویدیو با CoachPose.openVideo، و تشخیص بدن روی فریم‌های واقعی کلیپ. مسیر کامل با GPU فقط روی گوشی واقعی.
  try { fs.writeFileSync(path.join(OUT, 'meminfo-before-gait.txt'), adb('shell cat /proc/meminfo')); } catch (e) { /* */ }
  await step('MediaPipe در WebView (CPU): wasm و مدل، ویدیو و تشخیص روی ۱۰ فریم', async () => {
    const b64 = fs.readFileSync(CLIP).toString('base64'), type = CLIP.endsWith('.webm') ? 'video/webm' : 'video/mp4';
    const r = await page.evaluate(async ({ b64, type }) => {
      const t0 = performance.now(), abs = (p) => new URL(p, document.baseURI).href;
      const bin = atob(b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const v = await CoachPose.openVideo(new File([u8], 'clip', { type }));
      const mp = await import(abs('js/vendor/mediapipe/vision_bundle.mjs'));
      const fset = await mp.FilesetResolver.forVisionTasks(abs('js/vendor/mediapipe/wasm'));
      const lm = await mp.PoseLandmarker.createFromOptions(fset, { baseOptions: { modelAssetPath: abs('models/pose_landmarker_full.task'), delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1 });
      const tLoad = performance.now() - t0;
      const cv = document.createElement('canvas'); cv.width = 480; cv.height = Math.round(480 * v.videoHeight / v.videoWidth);
      const g = cv.getContext('2d');
      let frames = 0, people = 0, clock = 1;
      for (let i = 0; i < 10; i++) {
        v.currentTime = Math.min(v.duration - 0.05, i * 0.25);
        await new Promise((ok) => { v.addEventListener('seeked', ok, { once: true }); setTimeout(ok, 3000); });
        g.drawImage(v, 0, 0, cv.width, cv.height);
        const res = lm.detectForVideo(cv, clock += 40);
        frames++; if (res.landmarks && res.landmarks.length) people++;
      }
      const out = { w: v.videoWidth, h: v.videoHeight, dur: +v.duration.toFixed(1), frames, people, loadMs: Math.round(tLoad), totalMs: Math.round(performance.now() - t0) };
      lm.close(); CoachPose.release(v);
      return out;
    }, { b64, type });
    must(r.frames === 10 && r.w > 0, JSON.stringify(r));
    // کلیپ ساختگی آدم نداره؛ انتظار: صفر
    return `${r.w}×${r.h} ${r.dur}s · ${r.frames} فریم، ${r.people} آدم · بارگذاری ${r.loadMs}ms · کل ${r.totalMs}ms`;
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
