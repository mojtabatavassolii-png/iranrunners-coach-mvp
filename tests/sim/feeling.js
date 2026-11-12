// حس پیشرفت شخصیت‌ها: هر ۳۰ روز یک جمله‌ی اول‌شخص از چیزهایی که خود اون آدم حس می‌کنه یا در اپ می‌بینه.
// این یک مدل ساده‌ست، نه نظر آدم واقعی: از داده‌ی همون ماه ساخته می‌شه (آمادگی پنهانی که بدن حس می‌کنه، VDOT و سطحی که اپ نشون می‌ده،
// حجم هفتگی، پایبندی، درد و آسیب، پیام‌های تکراری، نتیجه‌ی مسابقه) و با وزن‌های هر خلق‌وخو جمع می‌شه.
// خروجی: { day, score (-۳ تا ۳)، mood، line (جمله)، parts (سهم هر عامل)، hiddenGain، visibleGain }
'use strict';
// وزن هر عامل برای هر خلق‌وخو: بدن (حس دویدن)، عدد (VDOT، سطح، تست)، حجم، منظم بودن، درد، تکرار و یکنواختی، مسابقه
var W = {
  disciplined: { body: 1.0, num: 0.8, vol: 1.3, cons: 1.3, pain: 1.0, mono: 0.6, race: 1.0 },
  erratic:     { body: 1.0, num: 0.6, vol: 0.7, cons: 0.6, pain: 1.0, mono: 0.8, race: 0.8 },
  obsessive:   { body: 0.8, num: 1.5, vol: 1.2, cons: 1.2, pain: 1.0, mono: 0.6, race: 1.3 },
  sensitive:   { body: 1.2, num: 0.7, vol: 0.8, cons: 1.0, pain: 1.6, mono: 0.8, race: 0.8 },
  bored:       { body: 1.0, num: 0.7, vol: 0.7, cons: 0.7, pain: 1.0, mono: 1.6, race: 0.9 },
  competitive: { body: 0.9, num: 1.6, vol: 1.0, cons: 0.9, pain: 0.9, mono: 0.7, race: 1.6 }
};
var MOODS = [[1.5, 'great', 'حس پیشرفت دارم'], [0.5, 'good', 'راضی‌ام'], [-0.5, 'neutral', 'مطمئن نیستم پیشرفت کردم'], [-1.5, 'stuck', 'حس درجا زدن دارم'], [-99, 'down', 'ناامید شدم']];
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function f1(x) { return (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, ''); }

// m: داده‌ی ماه { walk, dHidden, vis0, vis1, lv0, lv1, km4, kmPrev4, min4, minPrev4, planned, ran, painDays, injured, why (امتیاز ریزش ماه با دلیل), raceHit, raceMiss, lastTestAgo }
function monthFeeling(m, traits) {
  var w = W[traits.temperament] || W.disciplined, detail = traits.mind === 'detail';
  var parts = {}, say = [];
  // ۱) بدن: آمادگی پنهان (دویدن آسون راحت‌تر یا سخت‌تر حس می‌شه)؛ حدود نیم واحد VDOT در ماه محسوسه
  var body = clamp(m.dHidden / 0.5, -1.5, 1.5);
  parts.body = body * w.body;
  if (body >= 0.6) say.push([parts.body, m.walk ? 'پیاده‌روی‌ها راحت‌تر شده' : 'دویدن‌های آسون راحت‌تر شده']);
  else if (body <= -0.6) say.push([parts.body, m.walk ? 'حس می‌کنم آمادگیم کم شده' : 'حس می‌کنم آمادگیم پایین اومده']);
  // ۲) عددها در اپ: VDOT نمایش‌داده‌شده و سطح
  var num = 0;
  if (m.lv1 > m.lv0) { num += 1.5; say.push([1.5 * w.num, 'سطحم از ' + m.lv0 + ' به ' + m.lv1 + ' رسید']); }
  else if (m.lv1 < m.lv0) { num -= 1.2; say.push([-1.2 * w.num, 'سطحم از ' + m.lv0 + ' به ' + m.lv1 + ' پایین اومد']); }
  if (m.vis0 != null && m.vis1 != null && Math.abs(m.vis1 - m.vis0) >= 0.3) {
    var dv = m.vis1 - m.vis0, dn = clamp(dv, -1.5, 1.5);
    // تست ضعیف‌تر با توضیح دلیل‌ها و «سطحت با یک تست عوض نمی‌شه»: نصف ناامیدی
    if (dn < 0 && m.weakCtx) dn *= 0.5;
    num += dn;
    say.push([dn * w.num, 'VDOT از ' + f1(m.vis0) + ' به ' + f1(m.vis1) + ' ' + (dv > 0 ? 'رسید' : 'افتاد') + (dn < 0 && m.weakCtx ? ' (اپ دلیلش رو توضیح داد)' : '')]);
  }
  // پیشرفت واقعی که اپ نشون نمی‌ده: بدن بهتر شده ولی عدد تازه‌ای نیست (تست چند هفته‌ست داده نشده)
  var invisible = !m.walk && m.dHiddenSinceTest >= 1.0 && m.lastTestAgo >= 56 && m.lv1 === m.lv0;
  // اپ پیشرفت پیس ایزی رو بدون تایم‌تست نشون داده (fitNotes.paceTrend): پیشرفت دیگه نامرئی نیست
  if (m.paceTrend != null && m.paceTrend >= 5) {
    invisible = false; num += 0.6; say.push([0.6 * w.num, 'اپ نشون داد پیس دویدن آسونم ' + m.paceTrend + ' ثانیه تندتر شده']);
  }
  if (invisible) { num -= detail ? 0.8 : 0.4; say.push([-(detail ? 0.8 : 0.4) * w.num, 'حس می‌کنم بهتر شدم ولی عددی در اپ عوض نشده']); }
  parts.num = num * w.num * (detail ? 1.15 : 0.9);
  // ۳) حجم: چهار هفته‌ی اخیر در برابر چهار هفته‌ی قبل
  var a = m.walk ? m.min4 : m.km4, b = m.walk ? m.minPrev4 : m.kmPrev4;
  if (b > 0) {
    var ch = a / b - 1, vol = clamp(ch * 4, -1.2, 1);
    parts.vol = vol * w.vol;
    if (ch >= 1) say.push([parts.vol, (m.walk ? 'زمان پیاده‌رویم ' : 'حجم هفتگیم ') + 'بیش از دو برابر شده']);
    else if (ch >= 0.08) say.push([parts.vol, (m.walk ? 'زمان پیاده‌رویم ' : 'حجم هفتگیم ') + Math.round(ch * 100) + '٪ بیشتر شده']);
    else if (ch <= -0.15 && m.dropExplained > 0 && vol < 0) {
      // کاهش عمدی برنامه (هفته‌ی سبک، تیپر، برگشت) که اپ دلیلش رو زیر نوار هفته گفته: کمتر آزاردهنده
      vol *= 0.4; parts.vol = vol * w.vol;
      say.push([parts.vol, 'حجمم ' + Math.round(-ch * 100) + '٪ کمتر شد ولی اپ گفت چرا (کاهش عمدی برنامه)']);
    }
    else if (ch <= -0.15) say.push([parts.vol, (m.walk ? 'زمان پیاده‌رویم ' : 'حجم هفتگیم ') + Math.round(-ch * 100) + '٪ کمتر شده']);
  } else parts.vol = 0;
  // ۴) منظم بودن
  var adh = m.planned ? m.ran / m.planned : 1;
  parts.cons = (adh >= 0.85 ? 0.5 : adh < 0.5 ? -1 : 0) * w.cons;
  if (adh >= 0.85) say.push([parts.cons, 'تقریباً همه‌ی جلسه‌ها رو رفتم']);
  else if (adh < 0.5) say.push([parts.cons, 'کمتر از نصف جلسه‌ها رو رفتم']);
  // اپ چند جلسه رو به‌خاطر خستگی یا درد استراحت کرده: حس «عقب افتادن» (ملایم)
  if ((m.restByApp || 0) >= 4) { parts.cons -= 0.4 * w.cons; say.push([-0.4 * w.cons, 'خیلی خسته بودم و برنامه چند جلسه رو استراحت گذاشت']); }
  // ۵) درد و آسیب
  var pain = m.injured ? -2 : m.painDays >= 7 ? -1.5 : m.painDays >= 3 ? -0.7 : 0;
  parts.pain = pain * w.pain;
  if (m.injured) say.push([parts.pain, 'آسیب دیدم و مجبور شدم بایستم']);
  else if (m.painDays >= 3) say.push([parts.pain, m.painDays + ' روز درد داشتم']);
  // ۶) یکنواختی و پیام‌های تکراری، برگشت سخت، روز بد
  var mono = -(clamp((m.why.repeat || 0) / 3, 0, 1) * 0.9 + clamp((m.why.hardAfterBadDay || 0) / 6, 0, 1) * 0.6 + clamp((m.why.hardReturn || 0) / 3, 0, 1) * 0.5);
  parts.mono = mono * w.mono;
  if ((m.why.repeat || 0) >= 1.5) say.push([parts.mono, 'یه پیام هر روز تکرار می‌شه و خسته‌کننده‌ست']);
  if ((m.why.hardAfterBadDay || 0) >= 3) say.push([-0.6 * w.mono, 'بعد از روزهای بد، جلسه هنوز سخت بود']);
  // ۷) مسابقه و هدف
  var race = (m.raceHit ? 1.5 : 0) - (m.raceMiss ? 1.5 : 0) - clamp((m.why.goalSlip || 0) / 4, 0, 1);
  parts.race = race * w.race;
  if (m.raceHit) say.push([1.5 * w.race, 'به هدف مسابقه‌ام رسیدم']);
  if (m.raceMiss) say.push([-1.5 * w.race, 'به زمان هدفم در مسابقه نرسیدم']);
  if ((m.why.goalSlip || 0) >= 2) say.push([-w.race, 'حس می‌کنم از هدفم عقب افتادم']);

  var score = Object.keys(parts).reduce(function (s, k) { return s + parts[k]; }, 0);
  score = clamp(score, -3, 3);
  var mood = MOODS.filter(function (x) { return score >= x[0]; })[0];
  // جمله: حالت + مهم‌ترین دلیل هم‌جهت + (اگه هست) مهم‌ترین دلیل مخالف
  var pos = say.filter(function (x) { return x[0] > 0; }).sort(function (x, y) { return y[0] - x[0]; });
  var neg = say.filter(function (x) { return x[0] < 0; }).sort(function (x, y) { return x[0] - y[0]; });
  var main = score >= 0 ? pos : neg, other = score >= 0 ? neg : pos;
  var line = mood[2] + (main[0] ? '؛ ' + main[0][1] : '') + (main[1] ? ' و ' + main[1][1] : '') + (other[0] && Math.abs(other[0][0]) >= 0.5 ? '، ولی ' + other[0][1] : '') + '.';
  var top = say.slice().sort(function (x, y) { return Math.abs(y[0]) - Math.abs(x[0]); }).slice(0, 3).map(function (x) { return x[1]; });
  return { score: Math.round(score * 10) / 10, mood: mood[1], line: line, parts: parts, reasons: top, invisible: invisible };
}
module.exports = { monthFeeling: monthFeeling, MOODS: MOODS };
