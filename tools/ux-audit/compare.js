#!/usr/bin/env node
/*
 * مقایسه‌ی «وضعیت فعلی / وضعیت پیشنهادی» برای پیشنهادهای بازبینی، بدون دست زدن به کد اپ.
 * هر پیشنهاد یک CSS (و در صورت نیاز یک اسکریپت کوچک) داره که فقط داخل مرورگر تست تزریق می‌شه.
 *
 * اجرا:  node compare.js proposals.json [--out out/compare]
 * قالب هر مورد در proposals.json:
 *   { "id": "UX-01", "screen": "home", "width": 360, "lang": "fa",
 *     "crop": ".hcard",            // انتخاب‌گر ناحیه‌ای که بریده می‌شه (اولین مورد)
 *     "pad": 12,                    // حاشیه‌ی دور برش (px)
 *     "fullWidth": false,           // برش به پهنای کامل صفحه (برای مشکل‌های اسکرول افقی)
 *     "maxHeight": 700,             // سقف ارتفاع برش
 *     "fixed": false,               // المان ثابت روی صفحه (مثل نوار پایین): عکس از همون نمای گوشی
 *     "scroll": true,               // قبل از عکس المان به وسط صفحه بیاد
 *     "prep": "js اختیاری قبل از عکس، در هر دو حالت",
 *     "css": "CSS پیشنهادی",
 *     "js": "js اختیاری فقط برای حالت پیشنهادی" }
 * خروجی: <out>/<id>-before.png و <out>/<id>-after.png
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch, newContext, seed, openScreen } = require('./lib.js');

const args = process.argv.slice(2);
const specFile = args.find((a) => a.endsWith('.json'));
if (!specFile) { console.error('فایل پیشنهادها رو بده: node compare.js proposals.json'); process.exit(1); }
const oi = args.indexOf('--out');
const OUT = path.resolve(__dirname, oi >= 0 ? args[oi + 1] : 'out/compare');
const spec = JSON.parse(fs.readFileSync(path.resolve(specFile), 'utf8'));

async function shot(p, item, file) {
  const fixed = !!item.fixed;
  const box = await p.evaluate(([sel, pad, fullWidth, maxH, fixed, scroll]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    if (scroll && !fixed) el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const sx = fixed ? 0 : scrollX, sy = fixed ? 0 : scrollY;
    const docW = Math.max(document.documentElement.scrollWidth, innerWidth);
    const x = fullWidth ? 0 : Math.max(0, r.left + sx - pad);
    const y = Math.max(0, r.top + sy - pad);
    const w = fullWidth ? docW : Math.min(docW - x, r.width + pad * 2);
    const h = Math.min(maxH || 99999, r.height + pad * 2);
    return { x, y, width: w, height: h };
  }, [item.crop, item.pad == null ? 12 : item.pad, !!item.fullWidth, item.maxHeight || 0, fixed, item.scroll !== false]);
  if (!box) throw new Error(item.id + ': المان پیدا نشد ' + item.crop);
  await p.screenshot({ path: file, clip: box, fullPage: !fixed });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  for (const item of spec) {
    for (const mode of ['before', 'after']) {
      const ctx = await newContext(browser, item.width || 360);
      const p = await ctx.newPage();
      await seed(p, item.lang || 'fa');
      await openScreen(p, item.screen);
      if (item.prep) { await p.evaluate(item.prep); await p.waitForTimeout(250); }
      if (mode === 'after') {
        if (item.css) await p.addStyleTag({ content: item.css });
        if (item.js) await p.evaluate(item.js);
        await p.waitForTimeout(250);
      }
      await shot(p, item, path.join(OUT, `${item.id}-${mode}.png`));
      await ctx.close();
    }
    console.log('✓', item.id);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
