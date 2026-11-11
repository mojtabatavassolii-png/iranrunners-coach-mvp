// اعداد تصادفی با بذر ثابت (mulberry32): هر شخصیت با همون بذر همیشه همون دو سال رو می‌سازه
'use strict';
module.exports = function rng(seed) {
  var a = seed >>> 0;
  function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  next.chance = function (p) { return next() < p; };
  next.range = function (lo, hi) { return lo + (hi - lo) * next(); };
  next.int = function (lo, hi) { return Math.floor(lo + (hi - lo + 1) * next()); };
  next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
  // تقریب نرمال (جمع ۴ عدد یکنواخت)
  next.normal = function (mu, sd) { return mu + sd * ((next() + next() + next() + next()) - 2) * 1.732; };
  return next;
};
