// ده شخصیت مرحله‌ی دوم (همه جعلی). روزها از روز شروع هر شخصیت شمرده می‌شن (روز ۰ = روز ثبت‌نام).
// days: شماره‌ی روز هفته مثل getDay (۰ = یکشنبه، ۶ = شنبه)
// temperament: disciplined منظم، erratic بی‌نظم، obsessive وسواسی، sensitive زودرنج، bored بی‌حوصله، competitive رقابت‌جو
'use strict';
function hms(h, m, s) { return (h * 60 + m) * 60 + (s || 0); }
var base = { locations: ['park'], injury: '', race: { has: false }, pb: null, pbOld: null, fitnessTests: [], races: [], easyAdjustSec: 0,
  schemaVersion: 3, activity: 'run', structured: false, hrMax: null, hrRest: null, cycle: { enabled: false } };
function prof(o) { return Object.assign(JSON.parse(JSON.stringify(base)), o); }
// چرخه‌ی فعال در پروفایل (کاربر روز شروع آخرین پریود رو وارد کرده)
function cyc(lastStart, len) { return { enabled: true, lastStart: lastStart, cycleLen: len, periodLen: 5, periodMode: 'auto', periodOverrides: {}, starts: [] }; }

module.exports = [
  { id: 'P01', title: 'زن ۲۸، تازه‌کار کامل، سلامتی، منظم', focus: 'مسیر سطح ۰ تا دویدن پیوسته', seed: 101,
    traits: { sex: 'female', temperament: 'disciplined', injuryRisk: 0.3, mind: 'detail' },
    hidden: { vdot: 24, room: 9, cycle: { mean: 29, sd: 1.5, logProb: 0.9 } },
    profile: prof({ name: 'شخصیت', lastName: 'یک', age: 28, weightKg: 64, heightCm: 165, sex: 'female', days: [6, 1, 3],
      currentWeeklyKm: 0, lastWeekKm: 0, monthAvgKm: 0, experience: 'never', runMonths: 0, goal: { type: 'none', date: null },
      startDate: '2026-11-14', cycle: cyc('2026-11-05', 29) }),
    events: [{ day: 300, type: 'goal', goal: { type: '5', dateIn: 90 } }] },

  { id: 'P02', title: 'مرد ۳۵، سطح ۴، ماراتن، رقابت‌جو، حساسیت بالا به آسیب', focus: 'بیش‌تمرینی، درد، بازگشت', seed: 202,
    traits: { sex: 'male', temperament: 'competitive', injuryRisk: 0.95, mind: 'detail' },
    hidden: { vdot: 38, room: 6 },
    profile: prof({ name: 'شخصیت', lastName: 'دو', age: 35, weightKg: 78, heightCm: 180, sex: 'male', days: [6, 0, 1, 3, 4],
      currentWeeklyKm: 40, lastWeekKm: 40, monthAvgKm: 38, experience: '1to3y', runMonths: 30, structured: true,
      pb: { distanceKm: 10, timeSec: hms(0, 54) }, goal: { type: '42', dateIn: 200 }, startDate: '2026-11-14' }),
    events: [{ day: 230, type: 'goal', goal: { type: '42', dateIn: 330 } }] },

  { id: 'P03', title: 'زن ۳۰، برگشتی بعد از ۳ سال با رکورد ۳۵ دقیقه، ۱۰ کیلومتر', focus: 'منطق برگشت و پیشرفت پیس', seed: 303,
    traits: { sex: 'female', temperament: 'disciplined', injuryRisk: 0.4, mind: 'detail' },
    hidden: { vdot: 38, room: 13, cycle: { mean: 28, sd: 2, logProb: 0.85 } },
    profile: prof({ name: 'شخصیت', lastName: 'سه', age: 30, weightKg: 58, heightCm: 168, sex: 'female', days: [6, 1, 3, 5],
      currentWeeklyKm: 0, lastWeekKm: 0, monthAvgKm: 0, experience: '1to3y', runMonths: 36, structured: true,
      gap: 'slider', gapDays: 1095, xtrain: 'some', walkMinNow: 90, pbOld: { distanceKm: 10, timeSec: hms(0, 35) },
      goal: { type: '10', dateIn: 150 }, startDate: '2026-11-14', cycle: cyc('2026-11-01', 28) }),
    events: [{ day: 170, type: 'goal', goal: { type: '21', dateIn: 200 } }] },

  { id: 'P04', title: 'زن ۴۲، نیمه‌ماراتن، چرخه‌ی نامنظم، شلوغی کاری', focus: 'چرخه و هفته‌های کم‌تمرین', seed: 404,
    traits: { sex: 'female', temperament: 'erratic', injuryRisk: 0.4, mind: 'holistic' },
    hidden: { vdot: 39, room: 4, cycle: { mean: 31, sd: 7, logProb: 0.7, absent: [[380, 470]] } },
    profile: prof({ name: 'شخصیت', lastName: 'چهار', age: 42, weightKg: 66, heightCm: 163, sex: 'female', days: [6, 1, 3, 5],
      currentWeeklyKm: 25, lastWeekKm: 22, monthAvgKm: 25, experience: '1to3y', runMonths: 28, structured: false,
      pb: { distanceKm: 10, timeSec: hms(0, 54) }, goal: { type: '21', dateIn: 180 }, startDate: '2026-11-17', cycle: cyc('2026-11-03', 31) }),
    events: [{ day: 40, type: 'busy', days: 21, doProb: 0.35 }, { day: 120, type: 'busy', days: 14, doProb: 0.3 },
      { day: 300, type: 'busy', days: 28, doProb: 0.4 }, { day: 420, type: 'goal', goal: { type: '21', dateIn: 150 } },
      { day: 500, type: 'busy', days: 21, doProb: 0.3 }] },

  { id: 'P05', title: 'مرد ۵۵، پیاده‌روی، سلامتی، بی‌حوصله', focus: 'سطح پیاده‌روی، تکرار متن، بی‌انگیزگی', seed: 505,
    traits: { sex: 'male', temperament: 'bored', injuryRisk: 0.3, mind: 'holistic', walk: true },
    hidden: { vdot: 22, room: 3 },
    profile: prof({ name: 'شخصیت', lastName: 'پنج', age: 55, weightKg: 88, heightCm: 174, sex: 'male', days: [6, 0, 1, 2, 3, 4, 5],
      activity: 'walk', walkMin: 60, walkExp: 'lt1y', walk30: 'yes', walkGoal: { kind: 'health' }, experience: null,
      currentWeeklyKm: 0, goal: { type: 'none', date: null }, startDate: '2026-11-14' }),
    events: [{ day: 90, type: 'unmotivated', days: 35 }, { day: 330, type: 'unmotivated', days: 50 }, { day: 600, type: 'sick', days: 10 }] },

  { id: 'P06', title: 'مرد ۲۴، ۵ کیلومتر، بی‌نظم، سفرهای مکرر', focus: 'وقفه‌های کوتاه پشت‌سرهم', seed: 606,
    traits: { sex: 'male', temperament: 'erratic', injuryRisk: 0.35, mind: 'holistic', travelEvery: 45 },
    hidden: { vdot: 40, room: 7 },
    profile: prof({ name: 'شخصیت', lastName: 'شش', age: 24, weightKg: 72, heightCm: 178, sex: 'male', days: [0, 2, 4],
      currentWeeklyKm: 18, lastWeekKm: 15, monthAvgKm: 18, experience: '3to12m', runMonths: 8,
      goal: { type: '5', dateIn: 90 }, startDate: '2026-11-17' }),
    events: [{ day: 110, type: 'goal', goal: { type: '5', dateIn: 200 } }, { day: 330, type: 'goal', goal: { type: '10', dateIn: 150 } }] },

  { id: 'P07', title: 'زن ۳۸، اولترا و تریل، وسواسی', focus: 'قوانین تپه و ارتفاع، ناسازگاری عددها', seed: 707,
    traits: { sex: 'female', temperament: 'obsessive', injuryRisk: 0.5, mind: 'detail' },
    hidden: { vdot: 46, room: 4, cycle: { mean: 27, sd: 1.5, logProb: 1 } },
    profile: prof({ name: 'شخصیت', lastName: 'هفت', age: 38, weightKg: 57, heightCm: 166, sex: 'female', days: [6, 0, 1, 3, 4, 5],
      locations: ['trail', 'park'], currentWeeklyKm: 55, lastWeekKm: 55, monthAvgKm: 52, experience: 'gt3y', runMonths: 72, structured: true,
      pb: { distanceKm: 21.1, timeSec: hms(1, 42) },
      goal: { type: 'ultra', dateIn: 250, ultra: { km: 50, gain: 2500, loss: 2500, terrain: 'mountain', altitude: 2200, weeklyVert: 800, hillAccess: 'yes' } },
      startDate: '2026-11-14', cycle: cyc('2026-11-08', 27) }),
    events: [{ day: 290, type: 'goal', goal: { type: 'ultra', dateIn: 280, ultra: { km: 80, gain: 4000, loss: 4000, terrain: 'mountain', altitude: 2500, weeklyVert: 1000, hillAccess: 'yes' } } }] },

  { id: 'P08', title: 'مرد ۴۵، ۱۰ کیلومتر، آسیب تأییدشده‌ی ۶ هفته‌ای وسط برنامه', focus: 'آسیب و اثرش روی هدف', seed: 808,
    traits: { sex: 'male', temperament: 'disciplined', injuryRisk: 0.5, mind: 'detail' },
    hidden: { vdot: 40, room: 4 },
    profile: prof({ name: 'شخصیت', lastName: 'هشت', age: 45, weightKg: 82, heightCm: 177, sex: 'male', days: [6, 1, 3, 5],
      currentWeeklyKm: 30, lastWeekKm: 30, monthAvgKm: 28, experience: '1to3y', runMonths: 30, structured: true,
      pb: { distanceKm: 10, timeSec: hms(0, 51) }, goal: { type: '10', dateIn: 140 }, startDate: '2026-11-14' }),
    events: [{ day: 60, type: 'injury', weeks: 6, area: 'shin' }, { day: 200, type: 'goal', goal: { type: '10', dateIn: 120 } }] },

  { id: 'P09', title: 'زن ۲۶، زودرنج، تغییر هدف از ۱۰ کیلومتر به نیمه‌ماراتن', focus: 'تغییر هدف و مسابقه‌ی فرعی', seed: 909,
    traits: { sex: 'female', temperament: 'sensitive', injuryRisk: 0.45, mind: 'holistic' },
    hidden: { vdot: 37, room: 7, cycle: { mean: 30, sd: 3, logProb: 0.6 } },
    profile: prof({ name: 'شخصیت', lastName: 'نه', age: 26, weightKg: 60, heightCm: 170, sex: 'female', days: [6, 0, 2, 4],
      currentWeeklyKm: 20, lastWeekKm: 20, monthAvgKm: 19, experience: '3to12m', runMonths: 10,
      goal: { type: '10', dateIn: 120 }, startDate: '2026-11-14', cycle: cyc('2026-11-02', 30) }),
    // روز ۷۰: هدف اصلی نیمه‌ماراتن، ۱۰ کیلومتر قبلی فرعی می‌شه (مثل «هدف اصلی کن» در اپ)
    events: [{ day: 70, type: 'swapMain', goal: { type: '21', dateIn: 140 } }, { day: 260, type: 'goal', goal: { type: '10', dateIn: 100 } }] },

  { id: 'P10', title: 'مرد ۳۳، سطح ۷، ماراتن، کل‌نگر، ۲ ماه بی‌انگیزگی وسط سال', focus: 'وقفه‌ی طولانی در سطح بالا', seed: 1010,
    traits: { sex: 'male', temperament: 'disciplined', injuryRisk: 0.45, mind: 'holistic' },
    hidden: { vdot: 56, room: 3 },
    profile: prof({ name: 'شخصیت', lastName: 'ده', age: 33, weightKg: 68, heightCm: 179, sex: 'male', days: [6, 0, 1, 2, 3, 4],
      currentWeeklyKm: 90, lastWeekKm: 92, monthAvgKm: 88, experience: 'gt3y', runMonths: 96, structured: true,
      pb: { distanceKm: 42.195, timeSec: hms(3, 4) }, goal: { type: '42', dateIn: 220 }, startDate: '2026-11-14' }),
    events: [{ day: 150, type: 'unmotivated', days: 60, doProb: 0.05 }, { day: 320, type: 'goal', goal: { type: '42', dateIn: 280 } }] }
];
