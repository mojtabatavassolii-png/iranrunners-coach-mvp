#!/usr/bin/env node
/*
 * بازبینی خودکار UX/UI «مربی خودت باش»
 * صفحه‌های اصلی رو در چند عرض گوشی و هر دو زبان باز می‌کنه و این‌ها رو اندازه می‌گیره:
 *   touch    — اندازه‌ی ناحیه‌ی لمس دکمه‌ها و لینک‌ها (WCAG 2.5.8 حداقل ۲۴px، توصیه‌ی ۴۴px)
 *   contrast — کنتراست متن با پس‌زمینه‌ی واقعی (WCAG 1.4.3: ۴٫۵ برای متن معمولی، ۳ برای متن درشت)
 *   spacing  — فاصله‌ها (margin/padding/gap) خارج از شبکه‌ی ۴px و تعداد مقدارهای متفاوت
 *   type     — اندازه‌ی فونت‌های ریز، فاصله‌ی خطوط، سلسله‌مراتب عنوان‌ها و تعداد اندازه‌های متفاوت
 *   layout   — اسکرول افقی، المان‌های بیرون‌زده از صفحه، متن بریده‌شده، پوشیده شدن محتوا زیر نوار پایین
 *   justify  — پاراگراف‌های چندخطی که تراز دوطرفه ندارن، و فاصله‌ی بین کلمه‌ها در تراز دوطرفه (یا اگه دوطرفه بشن)
 *
 * اجرا (از ریشه‌ی مخزن):
 *   cd tools/ux-audit && npm install && node audit.js
 * گزینه‌ها:
 *   --widths 320,360,390,430   --langs fa,en   --screens home,plan-week,...   --out out   --no-shots
 *   --css proposal.css   (CSS پیشنهادی قبل از اندازه‌گیری تزریق می‌شه تا اثر یک پیشنهاد سنجیده بشه؛ اپ تغییر نمی‌کنه)
 * خروجی: out/report.json (همه‌ی یافته‌ها)، out/report.md (خلاصه‌ی اولویت‌بندی‌شده)، out/shots/*.jpg (با علامت‌گذاری)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { SCREENS, launch, newContext, seed, openScreen } = require('./lib.js');

// ---------- تنظیمات ----------
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const WIDTHS = opt('widths', '320,360,390,430').split(',').map(Number);
const LANGS = opt('langs', 'fa,en').split(',');
const OUT = path.resolve(__dirname, opt('out', 'out'));
const SHOTS = !args.includes('--no-shots');
const ONLY = opt('screens', null);
const CSS = opt('css', null) ? fs.readFileSync(path.resolve(opt('css')), 'utf8') : null;
const screens = ONLY ? SCREENS.filter((s) => ONLY.split(',').includes(s[0])) : SCREENS;

// ---------- کاوشگر داخل صفحه ----------
// یک تابع خودبسنده که در مرورگر اجرا می‌شه و اندازه‌گیری‌های خام رو برمی‌گردونه
function probe(screenW) {
  // عرض واقعی صفحه‌ی گوشی؛ اگه محتوا پهن‌تر باشه، مرورگر موبایل innerWidth رو بزرگ می‌کنه و مشکل پنهان می‌مونه
  const vw = screenW || innerWidth, vh = innerHeight;
  const out = { vw, touch: [], contrast: [], type: [], spacing: [], layout: [], headings: [], justify: [], fontSizes: {}, spaceValues: {} };
  const cs = (el) => getComputedStyle(el);
  const visible = (el) => {
    if (!el.isConnected) return false;
    // محتوای <details> بسته (به‌جز خود عنوانش) دیده نمی‌شه، هرچند getComputedStyle نمایشش رو none نشون نده
    const dt = el.closest('details:not([open])');
    if (dt && !el.closest('summary')) return false;
    for (let e = el; e; e = e.parentElement) {
      const s = cs(e);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      if (e.hasAttribute('hidden')) return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false; // sr-only و ورودی‌های پنهان
    // بیرون از قاب یک ناحیه‌ی اسکرول‌دار (مثل عددهای دور چرخ زمان) دیده نمی‌شه
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = cs(e);
      if (s.overflowY !== 'visible' || s.overflowX !== 'visible') {
        const pr = e.getBoundingClientRect();
        if (r.bottom <= pr.top + 2 || r.top >= pr.bottom - 2 || r.right <= pr.left + 2 || r.left >= pr.right - 2) return false;
      }
    }
    return true;
  };
  const sel = (el) => {
    const parts = [];
    for (let e = el, i = 0; e && e !== document.body && i < 4; e = e.parentElement, i++) {
      let s = e.tagName.toLowerCase();
      // شناسه‌های تاریخ‌دار (tab-2026-12-19) گروه‌بندی رو خراب می‌کنن؛ فقط شناسه‌های ثابت
      if (e.id && !/\d/.test(e.id)) { s += '#' + e.id; parts.unshift(s); break; }
      const cls = [...e.classList].filter((c) => !/^(is-|onb-in|onb-out|view-in|day-(?!panel|target|date|name))/.test(c)).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };

  // ---- ۱. ناحیه‌ی لمس ----
  const seen = new Set();
  const cands = document.querySelectorAll('a[href], button, input, select, textarea, summary, [role=button], [role=spinbutton], [tabindex]:not([tabindex="-1"])');
  cands.forEach((el) => {
    let t = el;
    // ورودی پنهانِ چیپ/چک‌باکس: ناحیه‌ی واقعی لمس، برچسب دورشه
    if (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox' || el.type === 'file')) {
      const lb = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]'));
      if (lb) t = lb;
    }
    if (el.type === 'hidden' || seen.has(t) || !visible(t)) return;
    seen.add(t);
    const r0 = t.getBoundingClientRect();
    // ناحیه‌ی لمس نامرئی با ::after/::before (position:absolute و inset منفی) هم جزو هدف حساب می‌شه
    let ex = { t: 0, r: 0, b: 0, l: 0 };
    ['::after', '::before'].forEach((ps) => {
      const s = getComputedStyle(t, ps);
      if (s.content === 'none' || s.position !== 'absolute') return;
      const v = (k) => { const x = parseFloat(s[k]); return isNaN(x) ? 0 : Math.max(0, -x); };
      ex = { t: Math.max(ex.t, v('top')), r: Math.max(ex.r, v('right')), b: Math.max(ex.b, v('bottom')), l: Math.max(ex.l, v('left')) };
    });
    const r = { left: r0.left - ex.l, top: r0.top - ex.t, width: r0.width + ex.l + ex.r, height: r0.height + ex.t + ex.b };
    // لینک داخل جمله استثنای WCAG داره
    const inline = t.tagName === 'A' && cs(t).display === 'inline' && t.parentElement && /^(P|LI|SPAN|SMALL|DD)$/.test(t.parentElement.tagName) &&
      (t.parentElement.innerText || '').trim().length > (t.innerText || '').trim().length + 3;
    out.touch.push({ sel: sel(t), label: label(t), w: Math.round(r.width), h: Math.round(r.height), inline, rect: rect(t) });
  });
  // فاصله تا نزدیک‌ترین هدف دیگه (برای استثنای فاصله‌ی ۲۴px)
  out.touch.forEach((a) => {
    let best = Infinity;
    out.touch.forEach((b) => {
      if (a === b) return;
      const dx = Math.max(0, Math.max(a.rect.x, b.rect.x) - Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w));
      const dy = Math.max(0, Math.max(a.rect.y, b.rect.y) - Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h));
      best = Math.min(best, Math.hypot(dx, dy));
    });
    a.gap = best === Infinity ? null : Math.round(best);
  });

  // ---- ۲. کنتراست ----
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const v = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const bgOf = (el) => {
    // لایه‌های پس‌زمینه از خود المان تا ریشه؛ گرادیان = تقریبی
    const layers = [];
    let grad = false;
    for (let e = el; e; e = e.parentElement) {
      const s = cs(e);
      if (s.backgroundImage && s.backgroundImage !== 'none' && /gradient/.test(s.backgroundImage)) {
        grad = true;
        const m = s.backgroundImage.match(/rgba?\([^)]+\)/);
        if (m) { const c = parse(m[0]); if (c) { layers.push(c); if (c.a >= 1) break; } }
      }
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return { bg, grad };
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const done = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || done.has(el) || !n.textContent.trim() || !visible(el)) continue;
    if (/^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName)) continue;
    done.add(el);
    const s = cs(el);
    let fg = parse(s.color);
    if (!fg) continue;
    let op = 1;
    for (let e = el; e; e = e.parentElement) op *= Number(cs(e).opacity);
    const { bg, grad } = bgOf(el);
    fg = over({ ...fg, a: fg.a * op }, bg);
    const size = parseFloat(s.fontSize), weight = Number(s.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const rr = ratio(fg, bg);
    const decorative = !!el.closest('[aria-hidden="true"]') || op < 0.6 || (el.classList.contains('tp-item') && !el.classList.contains('is-center'));
    out.contrast.push({ sel: sel(el), text: n.textContent.trim().slice(0, 40), fg: hex(fg), bg: hex(bg), ratio: Math.round(rr * 100) / 100, need, size, weight, grad, decorative, rect: rect(el) });

    // ---- ۴. تایپوگرافی (روی همون المان‌های متنی) ----
    const lh = s.lineHeight === 'normal' ? size * 1.2 : parseFloat(s.lineHeight);
    const key = Math.round(size * 10) / 10 + 'px/' + weight;
    out.fontSizes[key] = (out.fontSizes[key] || 0) + 1;
    const lines = Math.round(el.getBoundingClientRect().height / lh);
    out.type.push({ sel: sel(el), text: n.textContent.trim().slice(0, 40), size, weight, lh: Math.round(lh / size * 100) / 100, lines, rect: rect(el) });
  }
  document.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
    if (!visible(h)) return;
    const s = cs(h);
    out.headings.push({ tag: h.tagName, size: parseFloat(s.fontSize), weight: Number(s.fontWeight), text: h.innerText.trim().slice(0, 40) });
  });

  // ---- ۳. فاصله‌گذاری ----
  const PROPS = ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'rowGap', 'columnGap'];
  document.querySelectorAll('#app *, .tabbar, .tabbar *').forEach((el) => {
    if (!visible(el)) return;
    const s = cs(el);
    PROPS.forEach((pr) => {
      const v = parseFloat(s[pr]);
      if (!v || isNaN(v) || v < 0) return;
      const rv = Math.round(v * 10) / 10;
      out.spaceValues[rv] = (out.spaceValues[rv] || 0) + 1;
      if (rv % 4 !== 0 && rv > 2) out.spacing.push({ sel: sel(el), prop: pr, v: rv });
    });
  });
  // فاصله‌ی عمودی بین کارت‌های پشت‌سرهم
  const cards = [...document.querySelectorAll('#app .card, #app > section, #app > header')].filter(visible);
  const cardGaps = [];
  for (let i = 1; i < cards.length; i++) {
    const a = cards[i - 1].getBoundingClientRect(), b = cards[i].getBoundingClientRect();
    if (b.top >= a.bottom - 1 && Math.abs(a.left - b.left) < 4) cardGaps.push(Math.round(b.top - a.bottom));
  }
  out.cardGaps = cardGaps;

  // ---- ۵. چیدمان ----
  const sw = Math.max(document.documentElement.scrollWidth, innerWidth);
  if (sw > vw + 1) out.layout.push({ kind: 'hscroll', sel: 'html', v: sw - vw });
  // المانی که از ظرف خودش بیرون زده (عامل معمول اسکرول افقی)
  const flagged = new Set();
  document.querySelectorAll('#app *').forEach((el) => {
    if (!visible(el)) return;
    const s = cs(el);
    if (s.position === 'absolute' || s.position === 'fixed') return;
    // حاشیه‌ی منفی عمدی (مثلاً برای جا دادن سایه‌ی فوکوس) خطا نیست
    if (parseFloat(s.marginLeft) < 0 || parseFloat(s.marginRight) < 0) return;
    // داخل ناحیه‌ی اسکرول‌دار افقی (جدول‌ها، نمودارها) طبیعیه
    for (let e = el.parentElement; e && e.id !== 'app'; e = e.parentElement) {
      if (flagged.has(e)) return;
      const ox = cs(e).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return;
    }
    // برچسب‌های داخل نمودار (SVG) می‌تونن تا لبه‌ی کارت برن؛ ملاک لبه‌ی کارته، نه خود نمودار
    const par = el.closest('svg') && el.tagName !== 'svg' ? el.closest('.card') : el.parentElement;
    if (!par || par.id === 'app') return;
    const r = el.getBoundingClientRect(), pr = par.getBoundingClientRect();
    const over = Math.max(pr.left - r.left, r.right - pr.right);
    if (over > 1 && r.width > 0) { flagged.add(el); out.layout.push({ kind: 'overflow', sel: sel(el), v: Math.round(over), text: (el.innerText || '').trim().slice(0, 30), rect: rect(el) }); }
  });
  document.querySelectorAll('#app *').forEach((el) => {
    if (!visible(el) || el.classList.contains('tp-wheel')) return;
    const s = cs(el);
    if ((s.overflowX === 'hidden' || s.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && (el.innerText || '').trim())
      out.layout.push({ kind: 'clipped', sel: sel(el), v: el.scrollWidth - el.clientWidth, text: el.innerText.trim().slice(0, 40), rect: rect(el) });
  });
  // محتوای آخر صفحه نباید زیر نوار پایین بمونه
  const bar = document.querySelector('#tabbar');
  if (bar && visible(bar)) {
    scrollTo(0, document.documentElement.scrollHeight);
    const last = [...document.querySelectorAll('#app *')].filter(visible).pop();
    if (last) {
      const lb = last.getBoundingClientRect().bottom, bt = bar.getBoundingClientRect().top;
      if (lb > bt + 1) out.layout.push({ kind: 'under-tabbar', sel: sel(last), v: Math.round(lb - bt) });
    }
    scrollTo(0, 0);
  }
  // ---- ۶. تراز دوطرفه ----
  // هر پاراگراف چندخطی (نزدیک‌ترین والد بلوکی متن): ترازش، و بیشترین فاصله‌ی بین کلمه‌ها وقتی دوطرفه چیده بشه
  // (اگه الان دوطرفه نیست، موقتاً دوطرفه می‌شه تا اثرش اندازه‌گیری بشه و بعد برمی‌گرده)
  const SKIP = 'button, .btn, .chip, .chip-btn, .pill, .badge, summary, h1, h2, h3, h4, label, legend, nav, .tabbar, svg, table, input, select, textarea, .tpick, .scale, .mini-stats, .kv-list dt';
  // صاحب متن = اولین والد غیر inline؛ اگه flex/grid باشه، متن جزو چیدمان اجزاست نه پاراگراف
  const ownerOf = (n) => { let b = n.parentElement; while (b && b.id !== 'app' && cs(b).display === 'inline') b = b.parentElement; return b; };
  const blocks = new Set();
  const bw = document.createTreeWalker(document.querySelector('#app') || document.body, NodeFilter.SHOW_TEXT);
  for (let n = bw.nextNode(); n; n = bw.nextNode()) {
    if (n.textContent.trim().length < 2) continue;
    const b = ownerOf(n);
    if (b && b.id !== 'app' && /^(block|list-item|flow-root|table-cell)$/.test(cs(b).display) && !b.closest(SKIP) && visible(b)) blocks.add(b);
  }
  const canvas = document.createElement('canvas').getContext('2d');
  const maxGap = (el) => {
    const s = cs(el), lines = {};
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (ownerOf(n) !== el) continue; // متن بلوک‌های تودرتو جدا سنجیده می‌شه
      const re = /\S+/g; let m;
      while ((m = re.exec(n.textContent))) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const rc = r.getClientRects(); if (!rc.length) continue;
        const q = rc[0], k = Math.round(q.top / 4);
        (lines[k] = lines[k] || []).push(q);
      }
    }
    const keys = Object.keys(lines).map(Number).sort((a, b) => a - b);
    let worst = 0;
    keys.slice(0, -1).forEach((k) => { // خط آخر دوطرفه نمی‌شه
      const ws = lines[k].sort((a, b) => a.left - b.left);
      for (let i = 1; i < ws.length; i++) worst = Math.max(worst, ws[i].left - ws[i - 1].right);
    });
    canvas.font = s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily;
    return { gap: Math.round(worst), space: Math.max(2, canvas.measureText(' ').width), lines: keys.length };
  };
  blocks.forEach((el) => {
    // فقط متن خود بلوک (نه بلوک‌های تودرتو)
    let txt = '';
    const tw0 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw0.nextNode(); n; n = tw0.nextNode()) if (ownerOf(n) === el) txt += n.textContent;
    txt = txt.replace(/\s+/g, ' ').trim();
    if (txt.length < 40) return;
    const s = cs(el), align = s.textAlign;
    const lh = s.lineHeight === 'normal' ? parseFloat(s.fontSize) * 1.2 : parseFloat(s.lineHeight);
    if (el.getBoundingClientRect().height / lh < 1.8) return; // تک‌خطی
    const was = el.style.textAlign;
    if (align !== 'justify') el.style.textAlign = 'justify';
    const g = maxGap(el);
    el.style.textAlign = was;
    out.justify.push({ sel: sel(el), text: txt.slice(0, 40), align, justified: align === 'justify', gap: g.gap, space: Math.round(g.space * 10) / 10, ratio: Math.round(g.gap / g.space * 10) / 10, lines: g.lines, width: Math.round(el.getBoundingClientRect().width), rect: rect(el) });
  });

  out.pageHeight = document.documentElement.scrollHeight;
  return out;
}

// ---------- تبدیل اندازه‌گیری‌ها به یافته ----------
function findingsOf(m, ctx) {
  const F = [];
  const add = (rule, sev, sel, detail, extra) => F.push(Object.assign({ rule, sev, sel, detail, ...ctx }, extra || {}));
  m.touch.forEach((t) => {
    if (t.inline) return;
    const minSide = Math.min(t.w, t.h);
    if (minSide < 24 && !(t.gap !== null && t.gap >= 24)) add('touch-min', 'high', t.sel, `${t.w}×${t.h}px «${t.label}»`, { value: minSide, rect: t.rect });
    else if (minSide < 44) add('touch-rec', minSide < 32 ? 'medium' : 'low', t.sel, `${t.w}×${t.h}px «${t.label}»`, { value: minSide, rect: t.rect });
  });
  m.contrast.forEach((c) => {
    if (c.ratio >= c.need) return;
    const sev = c.decorative ? 'info' : c.ratio < 3 ? 'high' : 'medium';
    add('contrast', sev, c.sel, `${c.ratio}:1 (لازم ${c.need}:1) ${c.fg} روی ${c.bg}${c.grad ? ' (گرادیان، تقریبی)' : ''} «${c.text}»`, { value: c.ratio, rect: c.rect });
  });
  m.type.forEach((t) => {
    if (t.size < 12) add('font-small', 'medium', t.sel, `${t.size}px «${t.text}»`, { value: t.size, rect: t.rect });
    if (t.lines >= 2 && t.lh < 1.35 && t.size < 20) add('line-height', 'low', t.sel, `ارتفاع خط ${t.lh} برای متن چندخطی «${t.text}»`, { value: t.lh, rect: t.rect });
  });
  const hs = m.headings;
  for (let i = 1; i < hs.length; i++) {
    const a = hs[i - 1], b = hs[i];
    if (Number(b.tag[1]) > Number(a.tag[1]) + 1) add('heading-skip', 'low', b.tag, `${a.tag} → ${b.tag} «${b.text}»`);
  }
  const byTag = {};
  hs.forEach((h) => { (byTag[h.tag] = byTag[h.tag] || []).push(h.size); });
  ['H1', 'H2', 'H3'].forEach((t, i, arr) => {
    const nx = arr[i + 1];
    if (byTag[t] && byTag[nx] && Math.min(...byTag[t]) <= Math.max(...byTag[nx])) add('heading-scale', 'medium', t + '/' + nx, `${t} ${Math.min(...byTag[t])}px ≤ ${nx} ${Math.max(...byTag[nx])}px`);
  });
  if (hs.filter((h) => h.tag === 'H1').length > 1) add('heading-h1', 'low', 'h1', `${hs.filter((h) => h.tag === 'H1').length} عنوان h1 در یک صفحه`);
  // فاصله‌ها: یک یافته برای هر مقدار ناهماهنگ (نه برای هر المان) تا گزارش شلوغ نشه؛ ۲px‌های میانی (۶، ۱۰، ۱۴...) هم جزو مقیاس حساب می‌شن
  const odd = {};
  m.spacing.forEach((s) => { if (s.v % 2 !== 0) (odd[s.v] = odd[s.v] || []).push(s.sel + ' ' + s.prop); });
  Object.entries(odd).forEach(([v, list]) => add('spacing-grid', 'low', v + 'px', `${list.length} مورد، مثلاً ${list[0]}`, { value: Number(v) }));
  // تراز دوطرفه: خواسته‌ی صاحب اپ اینه که همه‌ی متن‌های بلند دوطرفه باشن (فارسی و انگلیسی)؛
  // فاصله‌ی بیش از ۴ برابر فاصله‌ی عادی بین کلمه‌ها (و بیشتر از ۱۶px) سوراخ دیده می‌شه
  (m.justify || []).forEach((j) => {
    const holes = j.ratio >= 4 && j.gap >= 16;
    if (!j.justified) add('justify-missing', 'medium', j.sel, `تراز ${j.align}، ${j.lines} خط، عرض ${j.width}px؛ اگه دوطرفه بشه بیشترین فاصله ${j.gap}px (${j.ratio}× فاصله‌ی عادی) «${j.text}»`, { value: j.ratio, rect: j.rect });
    if (holes) add('justify-gap', j.justified ? 'medium' : 'low', j.sel, `${j.justified ? '' : '(پیش‌بینی) '}فاصله‌ی ${j.gap}px بین کلمه‌ها (${j.ratio}× عادی) در عرض ${j.width}px «${j.text}»`, { value: j.ratio, rect: j.rect });
  });
  m.layout.forEach((l) => add('layout-' + l.kind, l.kind === 'hscroll' || l.kind === 'under-tabbar' || (l.kind === 'overflow' && l.v > 8) ? 'high' : 'medium', l.sel, `${l.kind} ${l.v}px${l.text ? ' «' + l.text + '»' : ''}`, { value: l.v, rect: l.rect }));
  return F;
}

// ---------- علامت‌گذاری روی اسکرین‌شات ----------
async function annotate(p, F) {
  await p.evaluate((boxes) => {
    const layer = document.createElement('div');
    layer.id = 'ux-audit-layer';
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:99999;pointer-events:none';
    const COL = { 'touch-min': '#e5007e', 'touch-rec': '#ff9500', contrast: '#7b2ff7', 'font-small': '#0a84ff', layout: '#ff2d2d', 'justify-missing': '#00a3a3', 'justify-gap': '#c9a400' };
    boxes.forEach((b) => {
      const d = document.createElement('div');
      const c = COL[b.rule] || COL[b.rule.split('-')[0]] || '#ff2d2d';
      d.style.cssText = `position:absolute;left:${b.rect.x - 2}px;top:${b.rect.y - 2}px;width:${b.rect.w + 4}px;height:${b.rect.h + 4}px;border:2px solid ${c};border-radius:4px;box-shadow:0 0 0 1px #fff`;
      layer.appendChild(d);
    });
    document.body.appendChild(layer);
  }, F.filter((f) => f.rect && f.sev !== 'info' && f.rule !== 'spacing-grid' && f.rule !== 'justify-missing'));
}

// ---------- اجرا ----------
(async () => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const browser = await launch();
  const all = [], raw = [], pageErrors = [];
  for (const lang of LANGS) for (const w of WIDTHS) {
    const ctx = await newContext(browser, w);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => pageErrors.push(`${lang}/${w}: ${e.message}`));
    await seed(p, lang);
    for (const [key] of screens) {
      await openScreen(p, key);
      if (CSS) { await p.addStyleTag({ content: CSS }); await p.waitForTimeout(150); }
      const m = await p.evaluate(probe, w);
      const ctxInfo = { screen: key, lang, width: w };
      const F = findingsOf(m, ctxInfo);
      all.push(...F);
      raw.push({ ...ctxInfo, fontSizes: m.fontSizes, spaceValues: m.spaceValues, headings: m.headings, cardGaps: m.cardGaps, pageHeight: m.pageHeight, touchCount: m.touch.length, textCount: m.contrast.length });
      if (SHOTS) {
        await annotate(p, F);
        await p.screenshot({ path: path.join(OUT, 'shots', `${key}-${lang}-${w}.jpg`), fullPage: true, type: 'jpeg', quality: 70 });
      }
    }
    await ctx.close();
  }
  await browser.close();

  // ---------- گروه‌بندی: یک مشکل = یک قاعده روی یک المان، در هر صفحه/عرض/زبانی که دیده بشه ----------
  const SEV = { high: 0, medium: 1, low: 2, info: 3 };
  const groups = {};
  all.forEach((f) => {
    const k = f.rule + '|' + f.sel;
    const g = groups[k] || (groups[k] = { rule: f.rule, sel: f.sel, sev: f.sev, count: 0, screens: new Set(), widths: new Set(), langs: new Set(), worst: f.value, sample: f.detail });
    g.count++;
    g.screens.add(f.screen); g.widths.add(f.width); g.langs.add(f.lang);
    if (SEV[f.sev] < SEV[g.sev]) { g.sev = f.sev; g.sample = f.detail; }
    if (f.value !== undefined && (g.worst === undefined || (/^touch|^contrast|^font/.test(f.rule) ? f.value < g.worst : f.value > g.worst))) { g.worst = f.value; g.sample = f.detail; }
  });
  const list = Object.values(groups).map((g) => ({ ...g, screens: [...g.screens], widths: [...g.widths].sort((a, b) => a - b), langs: [...g.langs] }))
    .sort((a, b) => SEV[a.sev] - SEV[b.sev] || b.screens.length - a.screens.length || b.count - a.count);

  // آمار کلی: مقیاس فونت و فاصله‌ها
  const fontAgg = {}, spaceAgg = {};
  raw.forEach((r) => {
    Object.entries(r.fontSizes).forEach(([k, v]) => { fontAgg[k] = (fontAgg[k] || 0) + v; });
    Object.entries(r.spaceValues).forEach(([k, v]) => { spaceAgg[k] = (spaceAgg[k] || 0) + v; });
  });
  const summary = {
    when: new Date().toISOString(), widths: WIDTHS, langs: LANGS, screens: screens.map((s) => s[0]),
    counts: list.reduce((o, g) => { o[g.sev] = (o[g.sev] || 0) + 1; return o; }, {}),
    distinctFontStyles: Object.keys(fontAgg).length, distinctFontSizes: [...new Set(Object.keys(fontAgg).map((k) => k.split('/')[0]))].length,
    distinctSpacings: Object.keys(spaceAgg).length, offGridSpacings: Object.keys(spaceAgg).filter((v) => Number(v) % 4 !== 0 && Number(v) > 2).length,
    pageErrors,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ summary, findings: list, fontAgg, spaceAgg, raw }, null, 1));

  // ---------- خلاصه‌ی Markdown ----------
  const L = [];
  L.push('# بازبینی UX/UI: ' + summary.when.slice(0, 10), '');
  L.push(`عرض‌ها: ${WIDTHS.join('، ')} · زبان‌ها: ${LANGS.join('، ')} · صفحه‌ها: ${summary.screens.join('، ')}`, '');
  L.push(`یافته‌ها: بالا ${summary.counts.high || 0} · متوسط ${summary.counts.medium || 0} · پایین ${summary.counts.low || 0} · اطلاعاتی ${summary.counts.info || 0}`, '');
  L.push(`مقیاس فونت: ${summary.distinctFontSizes} اندازه‌ی متفاوت (${summary.distinctFontStyles} ترکیب اندازه/وزن) · فاصله‌ها: ${summary.distinctSpacings} مقدار متفاوت، ${summary.offGridSpacings} مقدار خارج از شبکه‌ی ۴px`, '');
  if (pageErrors.length) L.push('**خطای صفحه:** ' + pageErrors.join(' | '), '');
  L.push('| اولویت | قاعده | المان | بدترین نمونه | صفحه‌ها | عرض‌ها | تکرار |', '|---|---|---|---|---|---|---|');
  list.filter((g) => g.sev !== 'info').forEach((g) => L.push(`| ${g.sev} | ${g.rule} | \`${g.sel}\` | ${g.sample.replace(/\|/g, '/')} | ${g.screens.join('، ')} | ${g.widths.join('، ')} | ${g.count} |`));
  L.push('', '## اندازه‌های فونت در حال استفاده (px/وزن ← تعداد)', '');
  L.push(Object.entries(fontAgg).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([k, v]) => `${k} ← ${v}`).join(' · '));
  L.push('', '## مقدارهای فاصله (px ← تعداد)', '');
  L.push(Object.entries(spaceAgg).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${k} ← ${v}`).join(' · '));
  fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n') + '\n');
  console.log(`انجام شد: ${list.length} یافته (بالا ${summary.counts.high || 0}، متوسط ${summary.counts.medium || 0}، پایین ${summary.counts.low || 0}) → ${path.relative(process.cwd(), OUT)}/report.md`);
  if (pageErrors.length) console.log('خطای صفحه:', pageErrors);
})().catch((e) => { console.error(e); process.exit(1); });
