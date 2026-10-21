// داده‌ی ثابت چند هفته تمرین برای بازبینی UX (همیشه همون خروجی، تا نتیجه‌ی اجراها قابل مقایسه باشه)
const C = require('../../js/logic.js');
function rnd(seed) { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
function build(kind, todayKey) {
  const r = rnd(kind === 'ultra' ? 7 : 3);
  const profile = kind === 'ultra'
    ? { age: 38, weightKg: 70, heightCm: 176, days: [0,1,2,3,4,5,6], locations: ['trail'], injury: '', currentWeeklyKm: 50, lastWeekKm: 50, monthAvgKm: 48, experience: 'gt3y', structured: true, schemaVersion: 3,
        goal: { type: 'ultra', date: '2027-04-10', ultra: { km: 60, gain: 3000, terrain: 'technical' } }, pb: { distanceKm: 21.1, timeSec: 6300, date: '2026-09-01' }, startDate: '2026-09-26', sex: 'male' }
    : { age: 33, weightKg: 68, heightCm: 175, days: [0,1,2,3,4,5,6], locations: ['park'], injury: '', currentWeeklyKm: 42, lastWeekKm: 42, monthAvgKm: 40, experience: 'gt3y', structured: true, schemaVersion: 3,
        goal: { type: '10', date: '2027-03-12' }, pb: { distanceKm: 10, timeSec: 2700, date: '2026-09-10' }, startDate: '2026-09-26', sex: 'male',
        fitnessTests: [{ date: '2026-10-24', distanceKm: 5, timeSec: 1290, kind: 'test' }, { date: '2026-11-21', distanceKm: 5, timeSec: 1262, kind: 'test' }, { date: '2026-12-12', distanceKm: 3, timeSec: 735, kind: 'test' }] };
  const st = { profile, checkins: {}, done: {}, ackPain: {}, postRuns: {}, cycleChoices: {}, doneLog: {} };
  const today = C.parseDate(todayKey);
  for (let d = C.parseDate(profile.startDate); d <= today; d = C.addDays(d, 1)) {
    const k = C.dateKey(d), wk = Math.floor(C.daysBetween(C.parseDate(profile.startDate), d) / 7);
    const tired = wk % 4 === 2 ? 1.2 : 0; // خستگی تجمعی در هفته‌ی سوم هر بلوک
    if (r() < 0.85) {
      const fatigue = Math.max(1, Math.min(5, Math.round(2 + tired + (r() - 0.4) * 2)));
      const sleep = Math.max(1, Math.min(5, Math.round(4 - tired * 0.8 + (r() - 0.5) * 2)));
      const pain = (k === '2026-11-05' || k === '2026-12-03');
      st.checkins[k] = { fatigue, sleep, pain, painWhere: pain ? 'knee' : '', at: k + 'T07:00:00Z' };
      if (pain) st.ackPain[k] = true;
    }
    const s = C.sessionFor(profile, d);
    if (!s || ['rest', 'none'].includes(s.type)) continue;
    if (st.checkins[k] && st.checkins[k].pain) continue;
    if (k === todayKey || r() < 0.88) {
      st.done[k] = true;
      if (['easy', 'long', 'runwalk'].includes(s.type)) st.postRuns[k] = { rpe: Math.max(2, Math.min(7, Math.round(3.5 + tired + (r() - 0.5) * 2))), pace: 'ok' };
    }
  }
  return st;
}
module.exports = { build };
if (require.main === module) {
  const st = build(process.argv[2] || 'road', process.argv[3] || '2026-12-19');
  const a = C.analytics(st, C.parseDate(process.argv[3] || '2026-12-19'), null);
  console.log('weeks', a.weeks.map(w => w.start.slice(5) + ':' + w.km + (w.maKm ? '/' + w.maKm.toFixed(1) : '') + (w.vert ? ' v' + w.vert : '')).join(' '));
  const last = a.pmc[a.pmc.length - 1]; console.log('pmc days', a.pmc.length, 'last', JSON.stringify(last), 'max load', Math.max(...a.pmc.map(x => x.load)));
  console.log('samples', a.samples.map(s => s.date.slice(5) + ':' + (s.vdot ? s.vdot.toFixed(1) + ' e' + Math.round(s.e) + ' t' + Math.round(s.t) + ' i' + Math.round(s.i) + ' R' + (s.riegel ? Math.round(s.riegel) : '-') + ' V' + (s.vdotTime ? Math.round(s.vdotTime) : '-') : '-')).join(' | '));
  console.log('checkins', a.checkins.length, 'pain', a.checkins.filter(c => c.pain).length, 'adh', JSON.stringify(a.adherence), 'runs', a.runsDone, 'goal', JSON.stringify(a.goal));
}
