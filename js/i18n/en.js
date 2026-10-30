/* English translation — every fixed string of the dashboard and the plan engine */
(function (root) {
  var d = {
    // ================= Plan engine (logic.js) =================
    days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    daysShort: ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'],
    dur: { h: '{n} h', m: '{n} min', s: '{n} s', join: ' ' },

    walkLevels: {
      1: { name: 'Gentle start', desc: 'Under 30 minutes a week so far; easy 5 to 10 minute walks' },
      2: { name: 'Building the habit', desc: '30 to 60 minutes a week; easy 10 to 15 minute walks' },
      3: { name: 'More steps', desc: '60 to 90 minutes; first short brisk segments' },
      4: { name: 'Regular', desc: '90 to 120 minutes; one brisk walk a week' },
      5: { name: 'Health target', desc: '120 to 150 minutes; reaching the WHO-recommended 150 minutes' },
      6: { name: 'Active', desc: '150 to 200 minutes; brisk walks, one long walk and strength training' },
      7: { name: 'Power', desc: '200 to 250 minutes; first power-walking intervals' },
      8: { name: 'Advanced', desc: '250 to 300 minutes; intervals, a 75-minute long walk and cross-training' },
      9: { name: 'Endurance', desc: '300 to 400 minutes; two interval sessions, hills and stairs, a 90-minute long walk' },
      10: { name: 'Expert', desc: 'Over 400 minutes; ready for long-distance walks and hiking' }
    },
    walkNote: {
      start: 'Your volume matches level {from}, but we start at level {to} because {why}.',
      why: { exp: 'your regular walking history is still short', no30: 'you can\'t walk 30 minutes non-stop yet', age: 'recovery takes a little longer at your age' },
      and: ' and ',
      slow: ' We also add at most 5% a week.'
    },
    walk: {
      easyMain: '{n} minutes of easy, continuous walking',
      segMain: '{n} minutes of easy walking with {reps} two-minute brisk segments (after the first 5 minutes)',
      segVariant: 'with brisk segments',
      warm: '{n} minutes easy to warm up', cool: '{n} minutes easy to cool down',
      briskMain: '{n} minutes of continuous brisk walking',
      briskTarget: '{n} minutes ({b} brisk)',
      powerMain: '{reps} times: {on} min very fast with active arms, {off} min easy',
      powerTarget: '{n} minutes ({reps} reps)',
      hillsVariant: 'hills or stairs',
      hillsMain: '{reps} times: {on} min fast uphill or up stairs, easy on the way back',
      longMain: '{n} minutes of continuous walking at an easy to slightly brisk pace',
      longHow: ' Bring water; over 60 minutes, take a small snack too.',
      strengthStep: 'After the walk: 20 to 25 minutes of strength (2 to 3 sets of 10 to 15): squats, lunges, glute bridges, step-ups, calf raises, plank.',
      strengthMoves: 'squats, lunges, glute bridges, step-ups, calf raises, plank',
      crossStep: 'Optional: today you can cycle or swim easy for the same time instead of walking.',
      fewerReps: 'Do one or two fewer reps.',
      eventTarget: '{km} km walking event',
      eventMain: 'Event day! Start at an easy pace and pick it up in the second half if you feel good.',
      eventHow: 'Bring water and a snack; wear tested shoes and clothes, nothing new.',
      eventBefore: 'Your event is tomorrow; rest today, drink enough water and sleep early.',
      eventAfter: 'The event was yesterday; rest today with some gentle stretching.',
      int: {
        easy: 'Intensity: easy; you can talk comfortably (RPE 3 to 4 out of 10).',
        brisk: 'Intensity: brisk; slightly out of breath, you can talk but not sing (RPE 5 to 6, about 100 to 120 steps a minute).',
        power: 'Intensity: very fast; only a few words at a time, arms bent and active (RPE 7 to 8, about 130+ steps a minute).',
        hr: ' Target heart rate: {a} to {b}.'
      }
    },
    levels: {
      0: { name: 'Complete beginner', desc: 'Has never run regularly and wants to start from zero' },
      1: { name: 'Novice', desc: 'A little running experience (under three months), can run a few minutes without stopping' },
      2: { name: 'Beginner', desc: 'Three to twelve months of regular running' },
      3: { name: 'Advanced novice', desc: 'Over a year of running, first races done' },
      4: { name: 'Lower intermediate', desc: 'Several races, some training structure' },
      5: { name: 'Intermediate', desc: 'Several years of regular training, knows training paces' },
      6: { name: 'Upper intermediate', desc: 'Competitive locally, structured training with varied intensity' },
      7: { name: 'Advanced', desc: 'Many years of serious training, races regularly' },
      8: { name: 'Advanced / semi-pro', desc: 'Serious racing background, probably with a personal coach' },
      9: { name: 'Sub-elite', desc: 'Competes at national level' },
      10: { name: 'World-class elite', desc: 'International professional, sponsored or national team' }
    },
    exp: { never: 'I\'ve never run / I want to start from zero', lt3m: 'Less than three months', '3to12m': 'Three to twelve months', '1to3y': 'One to three years', gt3y: 'More than three years' },
    tier: {
      0: 'Brisk walking with very short, gentle running bits that grow a little each week, up to 15 minutes of continuous running.',
      A: 'Run-walk and easy runs only; no intervals or tempo.',
      B: 'Mostly easy running, one gentle tempo a week and very short intervals (200–400 m) with long rests.',
      C: 'A full mix of easy runs, tempo, structured intervals (400–1000 m) and long runs with tempo sections.',
      D: 'A periodised plan (base/build/peak) with Daniels sessions: repetitions (R), VO2max (I), threshold (T) and marathon pace (M).',
      E: 'A professional plan with double days, uphill sprints, strength work and careful recovery management.'
    },
    levelNote: {
      structuredCap: 'You haven\'t done structured training (intervals/tempo) yet, so your level was capped from {from} to {to}.',
      expCap: 'Based on your running history ({exp}), your level was capped from {from} to {to}.',
      cautious: 'We\'ll increase your volume cautiously, because your current mileage doesn\'t match your speed yet.',
      pbLower: 'Your level comes from your best time, which reflects your real fitness better. Your current mileage is kept, but the intensity matches your speed.',
      dropTemp: 'Your last week ({last:d} {u}) was much lower than your monthly average ({avg:d} {u}) because of {reason}. Since this drop is temporary and your fitness is intact, your level is based on the monthly average. The plan starts at {start:d} {u} and returns to {avg:d} {u} within a few weeks (10% rule).',
      dropHealth: 'Your last week ({last:d} {u}) was much lower than your monthly average ({avg:d} {u}) because of {reason}. Your level is set cautiously from the weighted average ({w:d} {u}). The plan starts at {start:d} {u} and builds back gradually (at most 10% a week) to {avg:d} {u}.',
      dropReal: 'Your last week ({last:d} {u}) was much lower than your monthly average ({avg:d} {u}) for no particular reason, so your volume has genuinely dropped. Your level is based on the weighted average ({w:d} {u}) and the plan starts at {start:d} {u}.',
      rise: 'Your last week ({last:d} {u}) was much higher than your monthly average ({avg:d} {u}). Your level and starting volume are based on the weighted average ({w:d} {u}), so one unusual week doesn\'t make the plan too heavy.'
    },
    volReason: { injury: 'an injury', illness: 'illness', travel: 'travel', other: 'a temporary reason' },

    raceLabels: { 5: '5 km', 10: '10 km', 21: 'Half marathon (21.1 km)', 42: 'Marathon (42.2 km)' },
    goalTypes: { none: 'No specific goal', 5: '5 km', 10: '10 km', 21: 'Half marathon', 42: 'Marathon', ultra: 'Ultra & trail' },
    goalUltra: 'Ultra/trail {km:d} {u}, {gain} m climb',
    terrain: { technical: 'Technical mountain', trail: 'Easy trail', gravel: 'Gravel road', mixed: 'Mixed' },
    ultraClass: {
      flat: { label: 'Mostly flat (under 15 m of climb per km)', short: 'Mostly flat', emphasis: 'Aerobic endurance and steady-pace running; less hill work' },
      rolling: { label: 'Rolling (15–35 m per km)', short: 'Rolling', emphasis: 'A balanced mix of steady endurance and hill work' },
      hilly: { label: 'Hilly / mountainous (35–60 m per km)', short: 'Hilly / mountainous', emphasis: 'Long hills and leg strength first, plus downhill practice' },
      mountain: { label: 'Steep mountain (over 60 m per km)', short: 'Steep mountain', emphasis: 'Most focus on hills, power hiking, downhills and strength' }
    },
    types: {
      rest: 'Rest', walkrun: 'Walk & light jog', easy: 'Easy run', runwalk: 'Easy run (run-walk)', tempo: 'Tempo', interval: 'Intervals',
      reps: 'Speed reps', fartlek: 'Fartlek', hills: 'Hills', long: 'Long run', race: 'Race day', cancelled: 'Cancelled', none: 'Before start',
      walkEasy: 'Easy walk', walkBrisk: 'Brisk walk', walkPower: 'Power intervals', walkLong: 'Long walk', walkEvent: 'Event day'
    },
    periods: { base: 'Base phase', build: 'Build phase', peak: 'Peak phase' },
    phase: {
      intro: 'Starter week', before: 'Before the plan starts', race: 'Race week', recovery: 'Post-race recovery',
      return: 'Post-race return', taper: 'Taper', deload: 'Easy week', first: 'First week', maintain: 'Holding volume', build: 'Building volume',
      injury: 'No running (injury)', injuryReturn: 'Gradual return after injury'
    },

    pace: { range: '{a}–{b} {pu}' },
    talkTest: 'Talk test: you should be able to talk comfortably. If you can\'t, slow down, even below the target pace.',
    easyRpeWarning: 'This pace doesn\'t seem easy for you right now. We suggest setting your easy pace a little slower or logging a new time trial.',
    feedback: {
      ok: 'Great, that\'s exactly how an easy run should feel.',
      runwalk: 'This session felt hard. Next time make the walking breaks longer and the running slower; if it happens again, repeat the same stage for another week.',
      fast: 'You ran faster than the easy range, which is why it felt hard. Next time stay inside the range or even slower; easy runs should feel easy.',
      check: 'This session was too hard for an "easy" run. Next time use the talk test to set your speed and keep an eye on your pace.'
    },
    dayHint: {
      slow: 'Given today\'s fatigue or sleep, aim for the slower half of the range (or even slower).',
      any: 'Anywhere in the range that passes the talk test is fine today; in hot weather (above 25 °C) run the slower half.'
    },
    reminder: {
      none: 'You haven\'t logged a best time or time trial yet. A 2 or 5 km time trial lets us calculate your training paces (including your easy range) accurately.',
      stale: { one: 'Your last time trial or best time was {weeks} week ago. Fitness changes over time; log a new time trial to update your paces (every 4–6 weeks is ideal).',
        other: 'Your last time trial or best time was {weeks} weeks ago. Fitness changes over time; log a new time trial to update your paces (every 4–6 weeks is ideal).' }
    },


    // ---------- Level 0: starting from zero (simple, encouraging, no jargon) ----------
    zero: {
      warm: '5 min easy walk to warm up',
      cool: '5 min easy walk to cool down, then a little stretching',
      mainPower: 'Brisk walking (long steps, arms moving); during it, {reps} times run very gently for just {run}, then walk for {walk}',
      main: '{reps} times: {run} very gentle running + {walk} brisk walking',
      continuous: '15 min of slow, continuous running; if you need to, walk a few steps and start again',
      how: 'Run slowly enough that you can talk easily. Whenever you feel tired, walk; walking is part of the training, not a failure.',
      cheer: {
        0: 'Just starting means you\'ve taken the most important step. This week is mostly walking.',
        1: 'Your body is getting used to it. The running bits are still very short; there\'s no rush.',
        2: 'Now each running bit is one minute. Go slowly; speed doesn\'t matter at all.',
        3: 'You\'re running more and more. If you get out of breath, just slow down.',
        4: 'You\'re halfway there! Two minutes of running seemed hard a few weeks ago.',
        5: 'Three minutes in a row: your legs and heart are getting stronger.',
        6: 'Seven-minute stretches! You\'re almost there.',
        7: 'The big goal: 15 minutes of continuous running. Start slowly; you can do this.'
      },
      feedbackOk: 'Well done! Keep going like this, slow and steady.',
      feedbackHard: 'It\'s fine that it felt hard. Next time run slower and walk more. If the whole week felt hard, tap "It was hard" at the end of the week and we\'ll repeat this stage.',
      cardTitle: 'Your path to 15 minutes of continuous running',
      stage: 'Stage {n} of {total}',
      stageLabel: 'Stage',
      weeksLeft: { one: 'At this rate, you\'ll get there in about {n} week.', other: 'At this rate, you\'ll get there in about {n} weeks.' },
      q: 'How was this week?',
      qHint: 'Your answer sets next week\'s stage.',
      easy: 'It was easy',
      ok: 'It was about right',
      hard: 'It was hard',
      answer: { easy: 'Next week you\'ll move up two stages.', ok: 'Next week you\'ll move up one stage.', hard: 'Next week we\'ll repeat this stage; there\'s no rush.' },
      autoHard: 'One of your sessions felt hard, so this week counts as "hard". If that\'s not right, change it.',
      readyTitle: 'Congratulations! You\'re ready for level 1',
      readyText: 'You can now run for 15 minutes without stopping. From here, the plan will slowly add more running.',
      readyBtn: 'Move to level 1',
      toastSaved: 'Saved. Thank you!',
      toastGraduated: 'Well done! Your plan continues at level 1 from today.'
    },

    // ---------- Session-specific warm-up and cool-down ----------
    wu: {
      easyBasic: '5–10 min brisk walking or very slow running, then ease into your easy pace.',
      easyJog: 'Run the first 5–10 minutes very slowly and ease into your easy pace; the session itself is low intensity, so no separate warm-up is needed.',
      mobility: 'Before you start, 1–2 minutes of light mobility: leg swings and hip circles.',
      coolLong: '5 min walking and light stretching.',
      jog: '{min} min of slow running that gradually gets faster.',
      drills: {
        tempo: {
          basic: 'Simple dynamic moves (about 20 s each): front-back and side leg swings, hip circles, gentle high knees.',
          mid: 'Dynamic moves (20–30 m each): leg swings, walking lunges, hip circles, high knees.',
          adv: 'Dynamic moves (20–30 m each): leg swings, walking lunges, hip circles, high knees, A-skips.'
        },
        interval: {
          basic: 'Simple activation drills (about 20 m each): high knees, skips, butt kicks, walking lunges.',
          mid: 'Activation drills (20–30 m each): high knees, skips, bounds, butt kicks, walking lunges with a torso twist.',
          adv: 'Activation drills (20–30 m each): high knees, A- and B-skips, bounds, butt kicks, carioca, walking lunges with a torso twist.'
        },
        hills: {
          basic: 'Leg and glute activation: 10 glute bridges, walking lunges, leg swings, high knees.',
          mid: 'Leg and glute activation: single-leg glute bridges, walking lunges, skips, ankle pogo hops, high knees.',
          adv: 'Leg and glute activation: single-leg glute bridges, walking lunges, ankle pogo hops, bounds and A-skips on a gentle incline.'
        }
      },
      strides: {
        tempo: '{n} × 20 s strides: accelerate gradually to near top speed, then ease off; full recovery between each (60–90 s walking or very easy jogging).',
        interval: '{n} short strides accelerating to near the main session pace; full rest between each. Do the last one right before your first main rep.',
        hills: '{n} short strides (one or two uphill) accelerating to near session speed; full rest between each.'
      },
      stridesAdv: 'Run the last two strides at exactly your rep pace.',
      whyTempo: 'Purpose: prepare your neuromuscular system for a sustained effort.',
      whyInterval: 'A short warm-up isn\'t enough for this session; don\'t start the first rep on cold legs.',
      whyHills: 'Purpose: prepare your leg and glute muscles for explosive efforts.',
      light: 'The first 15 minutes of the session are easy and build up gradually; they act as your warm-up.',
      lightStrides: 'Before the first fast section: 2–3 short strides.',
      cool: '{min} min easy running, then light stretching.',
      raceShort: ['15 min easy running.', 'Activation drills: high knees, skips, butt kicks, walking lunges.', '4–6 strides up to near race pace; finish your warm-up 5–10 minutes before the start.'],
      raceHalf: ['10 min easy running.', '2–3 short strides; save your energy for the race.'],
      raceLong: ['5–10 min walking and very easy jogging; the first kilometres of the race are your warm-up.'],
      raceCool: 'After the finish: walk, drink and have a snack.'
    },
    // ---------- Session builders ----------
    rpe: {
      easy: 'Effort: easy (RPE 3–4 out of 10).',
      long: 'Effort: easy and steady (RPE 4 out of 10).',
      tempo: 'Effort: hard but controlled (RPE 7 out of 10).',
      interval: 'Effort: hard (RPE 8 out of 10), all reps even.',
      reps: 'Effort: fast and relaxed (RPE 8 out of 10), full recovery.'
    },
    guideLine: { pace: ' Pace: {p}.', hr: ' Heart rate: {a}–{b}.' },
    paceHint: { one: ' {label}: {a} {pu}{est}.', two: ' {label}: {a}–{b} {pu}{est}.' },
    rg: {
      secs: '{a}–{b} s', clock: '{a}–{b}', sec: '{n} s', min: '{t} min',
      timeFirst: ', {t} each ({pa}–{pb} {pu}{est})',
      paceFirst: ' ({pa}–{pb} {pu}, {t} each{lap}{est})',
      pace: ' ({pa}–{pb} {pu}{est})',
      lap: ', {a}–{b} s per 400 m lap',
      est: ', estimated',
      restJog: 'about {t} easy jog (as long as the rep)',
      basisTest: ' Paces come from your latest race or time trial (Daniels method).',
      basisEst: ' Paces are estimated from your level; log a race or time trial to make them exact.'
    },
    lbl: {
      pace: 'Pace', paceT: 'T pace', paceI: 'I pace', paceReps: 'Rep pace', paceR: 'R pace', paceFast: 'Pace for the fast parts',
      pace5k: '5 km pace', paceFastParts: 'Pace for the fast sections', paceMarathon: 'Marathon pace', paceTempoPart: 'Tempo section pace'
    },
    s: {
      km: '{n:d} {u}',
      min: '{n} min',
      wuKm: '{km:d} {u} easy warm-up',
      wuMin: '10 min easy running',
      wuStrides: ' + 4 short 20-second accelerations',
      cdKm: '{km:d} {u} easy cool-down',
      runwalk: {
        warm: '5 min brisk walk to warm up',
        main: '{reps} times: {run} min very easy running + {walk} min walking',
        cool: '5 min easy walk to cool down',
        how: 'Run slowly enough that you never gasp for breath; if it gets hard, walk longer.'
      },
      easy: '{km:d} {u} continuous easy running',
      double: { variant: 'double day', target: '{am} + {pm:d} {u}', am: 'Morning: {n:d} {u} easy running', pm: 'Evening: {n:d} {u} easy running', how: ' Leave at least 6 hours between the two runs.' },
      strides: 'Finish with 6 × 20 s fast, relaxed and controlled strides, full recovery between each',
      hillSprints: 'Finish with 8 × 10 s uphill sprints (steep slope), 2 min full recovery',
      hillStrides: 'Finish with 6–8 × 10–15 s uphill strides at controlled effort (not sprints), walk back down',
      downStrides: 'Finish with 3–4 × 30–60 s on a gentle downhill (3–5%) with short, quick steps, walk back up',
      hillAccess: {
        short: ' No long climb nearby: repeat your short hill back to back to fill each rep.',
        treadmill: ' On a treadmill: 6–10% incline for the same times; most treadmills cannot go downhill, so find a gentle outdoor descent or keep that part short.'
      },
      strength: '+ 30–40 min strength and plyometrics (squats, light deadlifts, lunges, short jumps)',
      tempo: {
        mildMain: '{a:d} {u} at tempo rhythm, 2 min jog, {b:d} {u} at tempo rhythm{g}',
        main: '{km:d} {u} continuous at threshold pace{g}',
        mildHow: 'Effort: a little slower than a full tempo (RPE 6–7 out of 10).',
        vMild: 'gentle', vT: 'threshold, T'
      },
      cruise: { variant: 'cruise intervals, T', main: '{reps} × {rk:d} {u} at threshold pace{g}, 1 min rest between reps' },
      interval: {
        restShort: '2–3 min walking or very easy jogging',
        restDaniels: 'easy jog for as long as the rep',
        rest90: '90 s easy jog',
        rest23: '2–3 min easy jog',
        rest3: '3 min easy jog',
        warmKm: '{km:d} {u} warm-up + ',
        warmMin: '10 min easy running + ',
        strides4: '4 short 20-second accelerations',
        main: '{reps} × {rep} m{g}, {rest} between reps',
        shortHow: 'Effort: fast but controlled (RPE 7–8 out of 10), not all-out.',
        vShort: 'short', vI: 'VO2max, I'
      },
      reps: {
        variant: 'R pace',
        warm: '{km:d} {u} warm-up + 4 short accelerations',
        main: '{reps} × {rep} m at R pace{g}, {rep} m easy jog between reps (full recovery)'
      },
      fartlek: { main: '{reps} times: 2 min fast (10 km rhythm) + 2 min easy running', how: 'Effort in the fast parts: RPE 7–8 out of 10.' },
      shortInt: { variant: 'short, 5 km pace', main: '{reps} × {rep} m at 5 km pace{g}; rest: {rest}', rest: 'easy jog as long as the rep or a bit longer' },
      midInt: { variant: 'medium, 5–10 km pace', main: '{reps} × {rep} m at a pace between 5 km and 10 km{g}; 2–3 min easy jog between reps' },
      speedFartlek: {
        pyramid: 'Pyramid: 1-2-3-4-3-2-1 min fast, 1 min easy between each',
        pyramidShort: 'Short pyramid: 1-2-3-2-1 min fast, 1 min easy between each',
        vPyramid: 'pyramid',
        oneone: '{n} times: 1 min fast + 1 min easy',
        vOneone: '1-1 speed',
        vMona: 'Mona',
        monaSteps: ['2 × 90 s hard (around 5 km pace) + 90 s "float"', '4 × 60 s hard + 60 s float', '4 × 30 s hard + 30 s float', '4 × 15 s hard + 15 s float'],
        monaHow: 'The "Mona" fartlek (named after Steve Moneghetti, devised by coach Chris Wardlaw): the main set is exactly 20 minutes with no stopping. Start the hard bits at about 5 km pace and, if you can, get a little quicker as they shorten. The "float" is a fairly quick jog (the fast end of your easy pace), never walking or standing; the floats are what make it hard.',
        vLandmark: 'free, landmark-based',
        landmark1: '{min} min of continuous running; {n} times along the way, surge to a landmark (a lamp post, the top of a rise, the next junction).',
        landmark2: 'Vary the surges from 15 s to 2 min: some short and very fast, some longer at about 10 km pace.',
        landmark3: 'After each surge, recover by jogging slowly until your breathing settles; don\'t stop. Keep the first and last 10 minutes surge-free.',
        landmarkHow: 'Surge effort: RPE 6 to 9 depending on length; the shorter, the faster.',
      },
      fartlekVsInterval: ' A fartlek is continuous: you never stop between the fast bits, and recovery is easy running; intervals have fuller rests and a stricter structure.',
      intervalVsFartlek: ' Intervals have a precise structure and fuller rests between reps so each rep is high quality; a fartlek, by contrast, is continuous.',
      shortHills: { variant: 'short hills', main: '{reps} × about 100 m fast up a short hill (6–10% grade); walk back down', how: 'Effort: fast and powerful (RPE 8–9 out of 10).' },
      thresholdInt: { variant: 'threshold intervals', main: '{reps} × {min} min at threshold pace{g}; 90 s to 2 min easy jog between reps' },
      longInt: { variant: 'long', main: '{reps} × {rep} m at a pace between 10 km and half marathon{g}; 2–3 min jog between reps', how: 'Effort: hard but sustainable (RPE 7–8 out of 10).' },
      tempoRun: { variant: 'continuous', main: '{min} min continuous at threshold pace{g}; a pace you could hold for about an hour' },
      longTempo: { variant: 'long continuous', main: '{min} min continuous at threshold pace or slightly slower{g}', how: 'Effort: RPE 6–7 out of 10, no fading to the end.' },
      mpInt: { variant: 'marathon-pace intervals', main: '{reps} × {km:d} {u} at exact marathon pace{g}; {j:d} {u} easy running between reps', how: 'Effort: RPE 6–7 out of 10; exactly race rhythm.' },
      longFartlek: {
        variant: 'long',
        main: '{dur} min run including {n} 10-minute sections at marathon pace or slightly faster',
        rest: 'At least 5 min easy between sections; first 15 and last 10 minutes easy',
        how: 'Effort in the fast sections: RPE 6–7 out of 10.'
      },
      longHills: {
        variant: 'long hills',
        main: '{reps} × {min} min continuous uphill running at a controlled effort (RPE 6–7, not a sprint)',
        back: 'Back down: an easy descent (jog or walk) as recovery',
        how: 'Effort: RPE 6–7 out of 10 (by effort, not pace). Approximate climb: {vert} m.'
      },
      downhill: {
        variant: 'downhill',
        main: '{reps} × 60–90 s controlled downhill on a gentle slope (4–8%)',
        back: 'Walk or jog very easily back up',
        how: 'Effort: controlled, not letting go (RPE 6 out of 10). Short, quick steps and soft landings.'
      },
      steady: {
        variant: 'steady',
        easy15: '15 min easy',
        main: '{min} min at a "steady" effort (RPE 5–6): a bit harder than easy, you can still speak in short sentences',
        how: 'Effort: RPE 5–6 out of 10 (by effort, not pace).'
      },
      hillsB: {
        variant: 'controlled short hills',
        main: '{reps} × 30–45 s uphill at a controlled effort (RPE 6–7)',
        back: 'Walk all the way back down',
        how: 'Effort: controlled (RPE 6–7 out of 10), not all-out.'
      },
      ultraLong: {
        day2Prefix: 'Second back-to-back day, on legs tired from yesterday: ',
        main: '{km:d} {u} on trail or uneven ground, about {time} on your feet',
        vert: 'Target total climb: about {vert} m (no big hill? repeat one climb several times)',
        hike: 'Power-hike the steep climbs; it\'s a race skill, not a weakness',
        fuel: 'Eat and drink every 30–45 minutes, using what you\'ll use on race day',
        how: 'Effort: easy (RPE 4–5 out of 10, by effort, not pace).',
        technical: ' If you can, run on technical trail.',
        day2How: ' Keep today easy too.',
        targetVert: '{km:d} {u}, +{vert} m',
        vDay1: 'back-to-back, day 1', vDay2: 'back-to-back, day 2', vTrail: 'trail'
      },
      long: {
        plain: '{km:d} {u} steady running',
        water: ' This session takes more than 60 minutes; carry water.',
        easyKm: '{km:d} {u} easy',
        mpEnd: 'Final {km:d} {u} at marathon pace (simulating late-race fatigue)',
        mpFuel: 'Practise your in-run fuelling as on race day',
        tempoSplit: '{a:d} {u} tempo, {j:d} {u} easy, {b:d} {u} tempo',
        restEasy: 'The rest, up to {km:d} {u}, easy',
        lastTempo: 'Last {km:d} {u} at tempo rhythm',
        vMp: 'marathon-pace finish', vTempo: 'with tempo sections'
      },
      rest: 'Full rest, or a light walk / stretching',
      notStarted: 'Your plan starts on the start date you chose.',
      firstEasy: 'The first session of the plan is easy on purpose, so you and your body get used to the plan; long runs and hard sessions start from the next sessions.',
      race: {
        ultraHow: 'Race day! Don\'t try anything new (shoes, food, clothing). Pace by effort (RPE), not by pace; the first half should feel easy.',
        ultraEst: ' Very rough estimated time: about {time} (equivalent to {km:d} {u} of flat running).',
        ultraSteps: ['Start very conservatively; walk the steep climbs', 'Eat and drink every 30–45 minutes', 'Take the descents under control to save your quads for the finish', 'Check the mandatory race gear (water, headlamp, warm layer)'],
        steps: ['Start the first kilometres a little slower than target pace', 'Use the water stations'],
        how: 'Race day! Don\'t try anything new (shoes, food, clothing).',
        pred: ' Predicted time (Riegel, from your latest time trial/best time): about {time}.',
        runwalk: ' Stick to your run-walk routine; the only goal is to reach the finish healthy.'
      },
      race2: {
        howTest: 'Time trial: full warm-up, then the whole distance at the hardest effort you can hold evenly. Log the result to update your paces and estimates.',
        howTrain: 'As training: run at controlled effort (around your main-goal pace or a little slower), not a record attempt; the main plan continues without a taper.',
        mini: 'Mini-taper before {race}: a little lighter, but the short fast session stays so you stay sharp.',
        trainAround: 'Close to {race} (as training); easy today.',
        how: 'Secondary race: enjoy it and run at a controlled effort; your main goal plan stays as it is.',
        pre: 'Lighter, because the {race} race is coming up.',
        post: 'Recovery after the {race} race; easy running only.'
      },
      taper: {
        dayBefore: 'Day before the race: rest, drink enough, get your race kit ready.',
        recovery: 'Post-race recovery. A light walk is fine.',
        recoveryWeekRw: 'Post-race recovery week.',
        recoveryWeek: 'Post-race recovery week; easy running only.',
        note: 'Taper: volume is reduced so you\'re fresh on race day.',
        raceStrides: 'Finish with 4 × 20 s near race pace, full recovery'
      }
    },

    painMessage: 'This could be a sign of injury. The coach can\'t diagnose this. Please see a doctor.',
    painPlan: {
      msg: {
        mild: 'Because of the pain you logged, we made today lighter: less volume and no intervals, hills or fast parts. If the pain gets worse while running, stop.',
        moderate: 'Because of the pain you logged, today we suggest a low-impact activity instead of running, or rest. Running returns once you log "no pain".',
        severe: 'With the pain you logged, stop running and see a doctor or physiotherapist. Gaam does not diagnose; it only pauses your plan.',
        recovering: 'A few days after pain: easing back in with lighter sessions and no hard training.'
      },
      severeStep: 'Do not run today.', severeStep2: 'If the pain is there at rest or at night, there is swelling or you cannot put weight on it, see a doctor or physiotherapist soon.',
      crossTarget: 'Low-impact activity or rest', crossStep: '20–40 min cycling, swimming or easy walking, only if pain-free while doing it', crossStep2: 'If it hurts, rest completely',
      raceNo: 'With this pain, racing is not recommended.', mildRw: 'If the pain gets worse during the session, just walk.'
    },
    inj: {
      crossTarget: 'Alternative training (no running)', offNote: 'As advised by your specialist, no running until {d}. Only activities they allowed (for example cycling, swimming or strength work), pain-free.',
      raceNo: 'This race falls in your no-running period.'
    },
    rtr: {
      main: '{reps} × ({run} min easy running + {walk} min walking)', cont: '{min} min continuous easy running',
      warm: '5 min brisk walking', restNote: 'Return after injury: a rest or low-impact day between running days.',
      how: 'Gradual return, stage {a} of {b}. If pain is 2/10 or less during the run and the next morning, you move up a stage next week; if you log pain, you go back a stage.'
    },
    adapt: {
      noTrain: 'Don\'t train today',
      race: '{why}. It\'s race day; make your goal "finish feeling good", not a PB. If you don\'t feel well, skipping it is also the right call.',
      tier: { mild: 'Light adjustment', moderate: 'Moderate adjustment', severe: 'Major adjustment' },
      changed: 'Today\'s session was adjusted', kept: 'Session unchanged, with one tip',
      whyL: 'Why?', actL: 'Decision:', impactL: 'Effect on your week and goal:',
      because: 'Because {reasons},',
      comma: ', ', and: ' and ',
      r: {
        fatigue: 'your fatigue today was {n} out of 5',
        sleep: 'last night\'s sleep was poor ({n} out of 5)',
        hours: 'you slept only {n} hours last night',
        sleepStreak: 'you\'ve had {n} nights of poor sleep in a row',
        streak3: { one: 'you were also a little tired at your previous check-in', other: 'you were also a little tired at your previous {n} check-ins' },
        streak4: { one: 'your fatigue was also high at your previous check-in', other: 'your fatigue was also high at your previous {n} check-ins' }
      },
      mean: {
        mild: 'your body is a little tired but still ready to train.',
        moderate: 'this combination shows your body hasn\'t fully recovered yet.',
        severe: 'this level of fatigue means your body needs recovery more than anything right now.',
        accum: ' Fatigue has built up over several days, so today\'s response is stronger than it would be for one random tired day.'
      },
      risk: {
        hard: 'If you do the full {label} session today, your injury risk goes up and the quality of the rest of the week\'s sessions drops.',
        long: 'A full long run on a tired body needs days of recovery and weakens the rest of the week.',
        easy: 'Even easy running, if long, delays recovery on a very tired body.',
        mildHard: 'The full session is still possible, but a small cut keeps its quality and speeds up your recovery.'
      },
      act: {
        fewer: 'Instead, do a lighter version of the same session: {main}. The session type and its purpose stay, just with less strain.',
        fewerRest: ' Take about 50% more rest between reps.',
        mildTempo: 'Instead, run a mild tempo: {main}. It still gives a training stimulus, but tires you far less than {label}.',
        shorterLong: 'Instead, run a shorter long run: {km:d} {u} instead of {orig:d}, at a fully easy effort.',
        shorterEasy: 'Shorten the session: {km:d} {u} instead of {orig:d}, at a very easy effort.',
        easy: 'Instead, run a short {km:d} {u} easy run at a very easy effort.',
        rest: 'Active rest today: 20–30 minutes of light walking or gentle movement. Your body gets stronger through recovery, not by training on fatigue.',
        keepHard: 'The session stays. If the first rep or block feels harder than usual, drop one rep (or a few minutes of the fast part).',
        keepLong: 'The session stays; keep the effort fully easy and drop the last few kilometres if the second half feels heavy.',
        keepEasy: 'Today\'s session is easy and hasn\'t changed; keep the effort truly gentle and cut it short if you don\'t feel good.',
        keepWalk: 'The session stays; walk at a pace where you can talk easily and cut it short if you don\'t feel good.',
        walkShorter: 'Make it shorter: {km} minutes instead of {orig}, at a pace where you can talk easily.',
        walkEasier: 'Instead, walk easy for {km} minutes (instead of {orig}): you still move, without piling up fatigue.',
        rwShorter: 'Today, do only about two-thirds of the session and walk the rest.',
        dropPm: ' If today is a double day, skip the evening run.'
      },
      moreRestStep: 'Take about 50% more rest than usual between reps (easy jog).',
      impact: {
        raceNear: 'Your race is {n} days away. This change is small and won\'t have much effect on your readiness; your fitness was built over the past weeks, and now being fresh matters more than one session. Don\'t worry.',
        tiny: 'This change is small and has no noticeable effect on this week\'s goals.',
        makeup: 'This change took away part of this week\'s training. If you feel back to normal by {day} (fatigue 2 or lower and good sleep), {what} will be added to that day\'s easy run to make up part of it; a full make-up isn\'t needed or recommended.',
        noRoom: 'There\'s no good opportunity to make it up this week, and there\'s no need: one lighter session doesn\'t change your multi-week training trend. Next week continues as planned.',
        persist: ' If this fatigue continues for a few more days, look at your sleep, nutrition and stress, and see a doctor if it persists.'
      },
      what: { strides: '6 × 20 s strides (full recovery)', steady: '10 minutes at a steady effort (RPE 5–6)', km: 'about {n:d} {u}' },
      makeupBox: {
        title: 'Optional add-on',
        text: 'Since you feel good today, you can add {what} at the end of this session to make up part of {day}\'s lighter training. It\'s optional; skip it if you don\'t feel good.'
      },
      summary: {
        line: 'Your week so far: {a} as planned, {b} adjusted to how you felt.',
        n: { one: '{n} session', other: '{n} sessions' },
        ok: ' Your overall path toward {goal} is still on track.',
        many: ' Several sessions this week were lightened; that\'s the right response, but if the fatigue continues, take next week easier. Your path toward {goal} can still be kept.'
      },
      goal: { race: 'the {race} on {date}', general: 'your overall fitness' }
    },
    warn: {
      structured: 'Since you haven\'t done structured training yet, the quality sessions in the first 4 weeks are simpler (gentle tempo and short intervals); after that you reach your full level.',
      prep: { one: 'About {weeks} week is left until the race, but for level {level} ("{name}") and a {goal}, at least {need} weeks of preparation are recommended. Make your goal simply "finish healthy", or pick a shorter race.',
        other: 'About {weeks} weeks are left until the race, but for level {level} ("{name}") and a {goal}, at least {need} weeks of preparation are recommended. Make your goal simply "finish healthy", or pick a shorter race.' },
      ultraEarly: 'At level {level}, long ultras and trail races are too early. For now the plan focuses on building a base and controlled hills; back-to-back runs unlock from level 5 with enough base.',
      altitude: 'The race is held at {alt} m altitude. At altitude, heart rate and breathing are higher for the same speed, so go by RPE. If you can, arrive a few days early or do at least one session at a similar altitude.',
      downhill: 'Your course has much more descent than climb, so downhill practice gets more weight to prepare your quads.',
      recentInjury: 'You ran less last week because of an injury. Only start when you can walk and run without pain; if you still have pain, see a doctor or physiotherapist first.',
      recentIllness: 'You ran less last week because of illness. Only start once you\'ve fully recovered; if you had a fever or a chest infection, wait a few more days.',
      injury: 'You\'ve recorded an injury or limitation. The plan starts from your current mileage and never goes more than 10% above it. Please consult a doctor or physiotherapist before starting.',
      age50: 'Over 50, volume grows more slowly (at most 20% above your current mileage). A heart check-up before starting is recommended.',
      under18: 'Under 18, this plan should be followed under the supervision of a parent or coach.',
      bmi: 'To reduce stress on your joints, volume grows more slowly; prefer soft surfaces (park, treadmill).',
      oneDay: 'With only one day a week, progress will be slow; if you can, free up at least 3 days.',
      elite: 'At level {level}, this plan is only a general framework; working with a personal coach and regular medical monitoring (blood tests, iron, recovery) is essential.'
    },
    location: {
      labels: { park: 'Park', gym: 'Gym', treadmill: 'Treadmill', road: 'Road / street' },
      tips: {
        park: 'Park: dirt or grass is great for easy and long runs and is gentler on your joints.',
        gym: 'Gym: on rest days, light strength work (squats, lunges, planks) goes a long way towards preventing injury.',
        treadmill: 'Treadmill: set the incline to 1% to feel closer to outdoor running. For intervals, set the speed in advance.',
        road: 'Road / street: wear well-cushioned shoes, run facing traffic, and wear reflective clothing in the dark.'
      }
    },

    // ================= User interface (app.js and index.html) =================
    app: {
      name: 'Gaam',
      tagline: 'Your training plan · beta', profileLink: 'Your profile',
      metaDescription: 'Gaam: a weekly running plan built on fixed training rules, no server.',
      navAria: 'Sections',
      back: 'Back',
      nav: { plan: 'Plan', checkin: 'Today\'s check-in', fitness: 'Fitness', race: 'Race goal', progress: 'My progress', learn: 'Learn', guide: 'Guide', profile: 'Profile' },
      langSwitch: 'فارسی',
      langSwitchAria: 'Switch language to Persian',
      bannerAria: 'Medical notice',
      bannerStrong: 'This system can replace an in-person coach for planning your training, but never a doctor.',
      bannerText: 'If you have pain or any health problem, please see a doctor.',
      saveFailed: 'Couldn\'t save in the browser; your data will only last until you close this page.',
      help: 'Explained in the Guide',
      helpMark: '?',
      timeBad: 'Couldn\'t read that time; try "9:40" or "940"',
      listSep: ', ',
      cancel: 'Cancel',
      yes: 'Yes',
      no: 'No',
      kmUnit: 'km'
    },
    signout: {
      title: 'Sign out',
      hint: 'To try creating a profile from scratch. Your current profile and all its data are set aside on this device and come back from the sign-in page.',
      hintStashed: 'A profile is already set aside and stays safe. Signing out deletes this current (test) profile.',
      btn: 'Sign out and start a new profile',
      confirm: 'Sign out? Your profile is not deleted; it is set aside and you can return to it from the sign-in page.',
      confirmStashed: 'This test profile will be deleted. Your set-aside profile stays safe and comes back from the sign-in page.',
      yes: 'Sign out', done: 'Signed out. Tap "Sign in" to create a new profile.',
      restore: 'Back to your previous profile ({n})', restoreHint: 'The profile you set aside comes back with all its data.',
      restoreHintTest: 'The current test profile is deleted and your previous profile comes back.',
      restored: 'Welcome back, {n}! Your profile is restored.'
    },
    login: {
      title: 'Log in',
      welcome: 'Welcome to Gaam',
      subtitle: 'A smart running plan built on proven training rules',
      button: 'Log in',
      langLabel: 'Language',
      logout: 'Log out'
    },
    pbDist: { m1500: '1500 m', m3000: '3000 m', 5: '5 km', 10: '10 km', 21: 'Half marathon', 42: 'Marathon', other: 'Another distance' },
    level: {
      of10: 'of 10',
      title: 'Level {n}: {name}',
      help: 'How do levels work?',
      fromPb: 'From your best time (VDOT {v})',
      fromVolume: 'From your current mileage and history',
      fromZero: 'Starting from zero, step by step'
    },
    onb: {
      activityQ: 'What do you want to start with?',
      activity: { run: 'Running', runSub: 'Running plans from zero to marathon', walk: 'Walking', walkSub: 'Walking plans from easy to power walking' },
      walkExpQ: 'How long have you been walking regularly?',
      walkExp: { never: 'Not regularly', lt3m: 'Under 3 months', '3to12m': '3 to 12 months', gt1y: 'Over a year' },
      walkMin: 'How many minutes a week do you usually walk?',
      walkMinHint: 'Average of the last 4 weeks; purposeful walks only, not short errands. For example 3 × 20 minutes = 60.',
      walk30Q: 'Can you walk briskly for 30 minutes without stopping?',
      pbWalk: 'Walking needs no best time; your level comes from your history and weekly minutes.',
      walkStartPreview: 'The plan starts at about {n} minutes a week and grows a little each week.',
      titleEdit: 'Edit profile',
      titleNew: 'Let\'s build your running plan', titleNewWalk: 'Let\'s build your walking plan',
      migTitle: 'New level system',
      migText: 'Please complete section 1 and save.',
      introEdit: 'If your mileage or level changes, the plan restarts from this week.',
      introNew: 'You can edit this later from your profile.',
      required: '(required)',
      s1: '1. Your current running',
      kmLabel: 'Right now, how many {uw} do you run per week on average?',
      kmHint: 'Average of the last few weeks; enter 0 if you don\'t run.',
      lastWeek: 'Last week\'s volume ({u})',
      lastWeekHint: 'Your last complete week, Saturday to Friday.',
      monthAvg: 'Last month\'s average ({u} per week)',
      monthAvgHint: 'Weekly average over the past four weeks; e.g. 30+35+40+35 → 35.',
      reasonQ: 'Last week was much lower than your monthly average. Was there a particular reason?',
      reasonHint: 'Your answer tells us whether the drop is temporary or real, and where the plan should start.',
      reasons: { injury: 'Injury', illness: 'Illness', travel: 'Travel', other: 'Another temporary reason', none: 'No particular reason; I\'m really running less' },
      startPreview: 'The plan starts at {n:d} {u} per week.',
      pbIntro: 'The best time you\'ve run over one of the distances below in the last six months, with a fairly serious effort (not an ordinary training run, but an official race or an all-out time trial).',
      pbOptional: 'If you don\'t have one or aren\'t sure, leave this section empty; the system will estimate your level from your current training volume.',
      zeroNote: 'Great that you want to start! You don\'t need to know anything about kilometres or race times. Your plan starts with walking and adds very gentle running little by little; most people reach 15 minutes of continuous running within 4 to 8 weeks.',
      expQ: 'How long have you been running regularly?',
      structQ: 'Have you ever done structured training (intervals, tempo)?',
      pbQ: 'Your best recent time (optional)',
      pbDist: 'Distance',
      pbNone: 'No best time',
      pbOtherKm: 'Distance ({u})',
      pbTime: 'Finish time',
      pbTimeHint: 'Tap the field and pick the hours, minutes and seconds of your result on the wheels.',
      levelWait: 'Once you answer the required questions in "Your running right now", your level will appear here.',
      pbInvalid: 'The best time is incomplete or invalid and isn\'t being used for your level yet.',
      s2: '2. Body details',
      age: 'Age (years)',
      weight: 'Weight (kg)',
      height: 'Height (cm)',
      s3: '3. Which days are you free?',
      s4: '4. Where can you train?',
      s5: '5. Injuries or physical limitations',
      injuryLabel: 'If any, describe briefly (optional)',
      injuryPh: 'e.g. right knee pain last year, asthma',
      s6: '6. Race goal',
      goalType: 'Target race type',
      startDate: 'When should your plan start?',
      startDateHint: 'Your plan is laid out from this exact day. If it is mid-week, you get a few intro sessions until the next week starts.',
      raceDate: 'Race date (if you have a specific race)',
      raceDateEq: 'Solar Hijri date: {d}',
      ultraKm: 'Race distance ({u})',
      ultraGain: 'Total climb (metres of ascent)',
      ultraLoss: 'Total descent (m, optional)',
      ultraLossHint: 'If different from the climb',
      weeklyVert: 'Climbing you do per week now (m)', weeklyVertHint: 'Leave empty if unsure; it is estimated from your current volume',
      hillAccess: 'What hills can you use?', hill: { long: 'Long climbs', short: 'Short slope only', treadmill: 'Incline treadmill' },
      terrain: 'Main terrain (optional)',
      notSelected: 'Not selected',
      altitude: 'Altitude above sea level (m, optional)',
      ultraRatio: '{r} m of climb per km → ',
      s7: '7. Heart rate (optional)',
      stepOf: 'Step {n} of {total}',
      progressAria: 'Form steps',
      steps: {
        1: { t: 'About you', sub: 'Choose running or walking; name, photo and gender are optional.' },
        2: { t: 'Body', sub: 'Age, height and weight help set training intensity and volume.' },
        3: { t: 'Your running right now', sub: 'Your experience and current volume decide where the plan starts.' , tw: 'Your walking now', subw: 'So the plan starts where you are.' },
        4: { t: 'Recent best time', sub: 'A real result lets us calculate your training paces accurately.' , tw: 'Walking level', subw: 'Based on your answers.' },
        5: { t: 'Goal and weekly schedule', sub: 'Your target race, free days, training places and heart rate.' }
      },
      next: 'Next',
      back: 'Back',
      photo: 'Profile photo (optional)',
      firstName: 'First name',
      firstNamePh: 'e.g. Sara',
      lastName: 'Last name',
      lastNamePh: 'e.g. Rezaei',
      injuryQ: 'Injury history or physical limitations',
      pbNever: 'You\'re just starting, so no best time is needed. Go to the next step; you can log a time trial later.',
      daysQ: 'Which days are you free?',
      locsQ: 'Where can you train?',
      hrQ: 'Heart rate (optional)',
      submitEdit: 'Save and update plan',
      submitNew: 'Build my plan',
      toastEdit: 'Plan updated.',
      toastNew: 'Your plan is ready!',
      err: { walkExp: 'Tell us how long you have been walking regularly.', walkMin: 'Enter your weekly walking minutes between 0 and 2000.', walk30: 'Tell us whether you can walk 30 minutes non-stop.',
        km: 'Enter how many {uw} you currently run per week on average (a number from 0 to {max}).',
        lastWeek: 'Enter last week\'s volume (0 to {max} {u}; enter 0 if you didn\'t run).',
        monthAvg: 'Enter last month\'s average weekly volume (0 to {max} {u}).',
        reason: 'Tell us whether last week\'s drop had a particular reason.',
        exp: 'Tell us how long you\'ve been running regularly.',
        struct: 'Tell us whether you\'ve done structured training (intervals, tempo).',
        pb: 'Best time: choose the distance and set its time with the hour, minute and second wheels, or choose "No best time".',
        age: 'Age must be between 12 and 90.',
        weight: 'Weight must be between 30 and 250 kg.',
        height: 'Height must be between 120 and 230 cm.',
        days: 'Choose at least one free day.',
        locs: 'Choose at least one training location.',
        startDate: 'Choose the date your plan starts.',
        startPast: 'The start date can\'t be before today.',
        startFar: 'The start date can be at most {n} days from today.',
        raceBeforeStart: 'The race date must be after your plan start date.',
        raceDate: 'The race date must be after today (or leave it empty).',
        ultraKm: 'Enter the trail race distance ({min} to {max} {u}).',
        ultraGain: 'Enter the race\'s total climb (metres of ascent); for a flat course enter 0 or a small number.',
        ultraLoss: 'Descent must be between 0 and 20,000 m.',
        ultraAlt: 'Altitude must be between 0 and 6,000 m.',
        weeklyVert: 'Weekly climbing must be between 0 and 10,000 m.'
      }
    },
    cycle: {
      sexQ: 'Sex (optional)',
      sexHint: 'Only used for training suggestions.',
      sex: { female: 'Woman', male: 'Man', na: 'Prefer not to say' },
      title: 'Adapting to your menstrual cycle (optional)',
      intro: 'If you like, you can enter details of your menstrual cycle so your training plan can take it into account. This is completely optional, and you can turn it off or change it at any time.',
      enable: 'I\'d like my plan to adapt to my cycle',
      lastStart: 'First day of your last period',
      cycleLen: 'Average cycle length (days)',
      cycleLenHint: 'From the first day of one period to the first day of the next; usually 21 to 35 days.',
      periodLen: 'Average period length (days)',
      err: {
        lastStart: 'Enter the first day of your last period (today or earlier, at most 120 days ago).',
        cycleLen: 'Cycle length must be between 21 and 45 days.',
        periodLen: 'Period length must be between 2 and 10 days.',
        periodMode: 'Choose how you can train on period days.'
      },
      phase: { period: 'Period days', follicular: 'Follicular phase', ovulation: 'Around ovulation', luteal: 'Luteal phase', lateLuteal: 'Days before your period' },
      when: { today: 'today', date: 'on {d}' },
      promptPeriod: 'Based on your calendar, {when} is probably day {day} of your period. Shall we change the "{label}" session to a lighter easy run, or keep the original plan?',
      promptHeavy: 'The first days are often the hardest; active rest is also an option.',
      promptLuteal: 'Based on your calendar, {when} is probably a few days before your next period, when some people feel more tired. If that\'s you, shall we make the "{label}" session lighter?',
      decide: 'It\'s your call; symptoms differ from person to person and month to month.',
      btnAdapt: 'Make it lighter',
      btnRest: 'Active rest',
      btnKeep: 'Keep the original plan',
      chosen: {
        adapt: 'As you chose, this session was changed to a lighter easy run.',
        rest: 'As you chose, this day is now active rest.',
        keep: 'As you chose, the original plan is kept. If you don\'t feel good while running, cut it short.',
        move: 'As you chose, this session moved to {d} and today is a light easy run.'
      },
      btnMove: 'Move to {d}', movedHere: 'As you chose, this session was moved here from {d}.',
      undo: 'Change my choice',
      follicularNote: 'Some people feel more energetic these days (after the period until around ovulation); the evidence is limited and varies between people.',
      altNote: 'Lighter because of your period; if you feel good, you can run a little more.',
      altNoteLuteal: 'Lighter, as you chose; listen to your body.',
      activeRestTarget: '20–30 min',
      activeRestStep: 'Easy walking, stretching or gentle yoga',
      activeRestHow: 'Light movement can help you feel better; stop whenever you like.',
      cardTitle: 'Your cycle',
      today: 'Today: cycle day {day} · {phase}',
      next: { one: 'Your next period is expected around {date} (in {n} day).', other: 'Your next period is expected around {date} (in {n} days).' },
      nextSoon: { one: 'Reminder: your next period is expected around {date}, in {n} day. If you like, keep those days in mind when planning.', other: 'Reminder: your next period is expected around {date}, in {n} days. If you like, keep those days in mind when planning.' },
      inPeriod: 'You\'re probably on day {day} of your period. If you have a hard session, you can make it lighter.',
      started: 'My period started today',
      startedToast: 'Period start updated; the estimates are now more accurate.',
      estimate: 'All dates are estimates and don\'t replace medical advice.',
      settingsTitle: 'Menstrual cycle',
      settingsEnabled: 'Adapt to my cycle',
      settingsMarkers: 'Show cycle phases on the calendar',
      settingsEdit: 'Change dates and cycle length under "Edit profile".',
      settingsNeedData: 'To turn this on, first enter the first day of your last period under "Edit profile".',
      profileRow: 'Cycle adaptation',
      profileOn: 'On · {len}-day cycle, {p}-day period',
      profileOff: 'Off',
      periodQ: 'On period days, how can you train?',
      periodQHint: 'Your period days are adjusted automatically every month based on this; "light only" lowers both intensity and volume (about 65%, 50% on the first two days, at most 10 km). In your profile you can decide differently for a specific period (for example close to a race).',
      mode: { normal: 'Normal training, as planned', easy: 'Light training and easy runs only', rest: 'No training; full rest' },
      modeShort: { normal: 'Normal', easy: 'Light only', rest: 'Rest' },
      fullRestTarget: 'Full rest',
      fullRestStep: 'No training today; rest.',
      fullRestHow: 'Following your setting, period days are rest days. A short walk or gentle stretching is fine if you feel like it, but not required.',
      periodEasyNote: 'Both intensity and volume were lowered for your period, following your setting; if you feel good, running a little more is fine.',
      periodShortSteps: 'About {min} min today; once you reach it, skip the remaining reps.',
      periodBox: 'Probably day {day} of your period. Setting for this period: "{mode}"{src}.',
      src: { def: ' (default)', override: ' (this period only)' },
      periodResult: {
        easy: '"{label}" was made lighter automatically, in both intensity (easy run) and volume: {from:d} to {to:d} {u}.',
        shorter: 'Today\'s easy run is shorter: {from:d} to {to:d} {u}.',
        shorterMin: 'Today\'s session is shorter: {from} to {to} min.',
        rest: '"{label}" was automatically changed to rest.',
        normal: 'Your original plan stays; if you don\'t feel good during the run, cut it short.',
        race: 'It\'s race day; race plans are never changed automatically.'
      },
      periodChange: 'Change for this period',
      inPeriodMode: 'You\'re probably on day {day} of your period. Plan for these days: "{mode}".',
      pcTitle: 'Training on period days',
      pcDefault: 'Default for every month: "{mode}"',
      pcDefaultNone: 'You haven\'t chosen how to train on period days yet. Pick one so those days are adjusted automatically:',
      pcEditDefault: 'Change default',
      pcIntro: 'You can decide separately for each period, for example close to a race or if this month is different. The change affects only that period; your default for later months stays the same.',
      pcRange: '{a} – {b}',
      pcNow: 'Now',
      pcRaceIn: 'Race during this period',
      pcRaceAfter: { one: 'Race {n} day later', other: 'Race {n} days later' },
      pcUseDefault: 'Default',
      pcAria: 'Setting for the period starting {d}',
      pcSaved: 'Saved for the period starting {d}.',
      pcReset: 'The period starting {d} is back to your default.',
      pcDefaultSaved: 'Default for period days saved.',
      pcEstimate: 'Dates are estimates; tapping "My period started today" on the Today page makes them more accurate.'
    },
    plan: { week: 'Weekly view', month: 'Monthly view', viewAria: 'Plan view' },
    month: {
      prev: 'Previous month', next: 'Next month', back: 'Back to this month', gridAria: 'Month calendar',
      stats: { one: 'Done: {d} of {n} session · {dkm:d} of {km:d} {u}', other: 'Done: {d} of {n} sessions · {dkm:d} of {km:d} {u}' },
      statsMin: { one: 'Done: {d} of {n} session · {dmin} of {min} min', other: 'Done: {d} of {n} sessions · {dmin} of {min} min' }
    },
    settings: {
      title: 'Language and calendar',
      language: 'Language',
      calendar: 'Calendar',
      weekStart: 'First day of the week',
      auto: 'Automatic (from language)',
      jalali: 'Solar Hijri (Jalali)',
      gregorian: 'Gregorian',
      current: 'Now: {cal} calendar, weeks start on {day}.',
      note: 'Defaults: Persian → Solar Hijri and Saturday; English → Gregorian and Monday. Changing the first day of the week moves the plan\'s week boundaries (the long run falls on the last day of the week); your free days stay the same.',
      saved: 'Settings saved.',
      units: 'Distance units',
      unitsNote: 'All distances, weekly volume and paces are shown in this unit. Race names (like 5 km and 10 km), time trials and metre-based interval reps stay as they are.'
    },
    units: { km: 'km', mi: 'mi', word: { km: 'kilometres', mi: 'miles' }, pace: { km: 'min/km', mi: 'min/mi' }, short: { km: 'km', mi: 'mi' },
      opt: { km: 'Kilometres (km)', mi: 'Miles (mi)' } },
    sess: { original: 'Original plan:', warmup: 'Warm-up', main: 'Main set', cooldown: 'Cool-down', about: 'about {n} min' },
    post: {
      walkKm: 'Distance (optional)', walkSteps: 'Steps (optional)', walkRpeQ: 'How hard was it? 1 (very easy) to 10 (very hard); optional',
      errSteps: 'Steps must be a whole number between 0 and 100,000.',
      summary: 'After the run: effort {rpe} out of 10',
      paceOk: ' · pace as planned',
      paceFast: ' · faster than the range',
      q1: 'How easy was this run? From 1 (very light) to 10 (very hard).',
      rpeAria: 'Session effort',
      low: '1 = very light',
      high: '10 = very hard',
      q2: 'How was your pace?',
      ok: 'Inside the easy range or slower',
      fast: 'Faster than the range',
      unknown: 'I didn\'t check my pace',
      submit: 'Save',
      errBoth: 'Choose the session effort and your pace.',
      errRpe: 'Choose the session effort.',
      slower10: 'Make my easy pace 10 s slower',
      newTest: 'Log a new time trial',
      actTitle: 'Actual distance and time (optional)',
      actHint: 'If you recorded this run on a watch or another app, enter the real numbers so your stats and charts are more accurate. Left empty, the planned volume is used.',
      actKm: 'Actual distance ({u})',
      actTime: 'Actual time',
      actTimeHint: 'Tap the field to pick the time; if you skip it, no time is saved.',
      actStart: 'Start time',
      actStartVal: 'started {t}',
      errStart: 'Enter the start time as hours:minutes (or leave it empty).',
      errStartFuture: 'The start time can\'t be later than now.',
      saveDone: 'Mark as done',
      actRecorded: 'Recorded:',
      actKmVal: '{km:d} {u}',
      actPlan: '(plan: {km:d} {u})',
      actPace: 'pace {p} {pu}',
      actAdd: '+ Add actual distance and time',
      actEdit: 'Edit distance and time',
      errKm: 'Actual distance must be between {min} and {max} {u} (or leave it empty).',
      errTime: 'Actual time must be between 1 minute and 24 hours.',
      errPace: 'That time doesn\'t look right for this distance (pace {p} {pu}); please check it.'
    },
    pain: {
      cancelled: 'Today\'s session is cancelled.',
      whereReported: 'Reported pain location: {w}',
      noRun: 'Don\'t resume running until the pain is gone and a doctor has cleared you.',
      yesterdayStrong: 'You reported pain yesterday.',
      yesterdayText: 'If you still have pain, don\'t train today either and see a doctor. Answer today\'s check-in carefully.',
      modalTitle: 'Today\'s session is cancelled',
      where: 'Pain location: {w}',
      li1: 'Don\'t run today, not even slowly.',
      li2: 'If the pain is severe, comes with swelling, or is there when walking, see a doctor as soon as possible.',
      li3: 'Don\'t resume training until a doctor has cleared you.',
      ack: 'I have read and understood that this coach cannot diagnose pain and that I should see a doctor.',
      ok: 'I understand'
    },
    adaptBox: { changed: 'Today\'s plan has changed' },
    today: {
      eyebrow: 'Today\'s session · {day} {date}',
      waiting: '— waiting for check-in',
      cta: 'Check in before you start.',
      ctaHelp: 'What does the check-in do?',
      ctaBtn: 'Pre-run check-in',
      preview: 'Preview the planned session',
      summary: 'Today\'s check-in: fatigue {f}/5 · sleep {s}/5 · pain: {p}',
      hours: ' · {n} h of sleep',
      edit: 'Edit check-in',
      done: 'I did it',
      doneDone: '✓ Done'
    },
    week: {
      prev: 'Previous week',
      next: 'Next week',
      n: 'Week {n} of the plan',
      intro: 'Starter week',
      before: 'Before start',
      range: '{a} – {b}',
      back: 'Back to this week',
      phase: 'Phase',
      phaseHelp: 'Plan phases',
      sessions: 'Sessions',
      nSessions: { one: '{n} session', other: '{n} sessions' },
      emptyStart: 'No sessions left this week. Your first session: {day} {date}.', emptyStartNone: 'No sessions left this week.',
      totalTime: 'Total time',
      nMin: '{n} min',
      volume: 'Total volume',
      nKm: '{n:d} {u}',
      plannedKm: 'Original plan: {n:d} {u}',
      doneSessions: '{n} of {total} done',
      doneKm: '{n:d} {u} done',
      doneMin: '{n} min done',
      plannedMin: 'Original plan: {n} min',
      vert: 'Climb: +{n} m',
      ratio: 'Easy / hard ratio',
      ratioHelp: 'The 80/20 rule',
      daysAria: 'Days of the week',
      minUnit: 'min',
      today: 'Today',
      doneMark: 'Done',
      todaySuffix: ' · today'
    },
    toast: {
      slowed: 'Easy pace set {n} s slower than the VDOT calculation.',
      levelApplied: 'The plan continues at level {to} (was {from}) with {km:d} {u} per week.'
    },
    fitNotes: {
      title: 'Fitness update',
      register: 'Log a time trial',
      trendStrong: 'Recurring pattern:',
      trend: { one: 'In the last two weeks, {n} easy run at the planned pace felt hard (RPE above 6).', other: 'In the last two weeks, {n} easy runs at the planned pace felt hard (RPE above 6).' },
      suggestA: 'Based on your latest time trial, your fitness matches',
      suggestLevel: 'level {n}',
      suggestB: '(current plan: level {from}).',
      up: 'If you like, the plan can continue from this week at the new level, starting from your current mileage.',
      down: 'If you\'ve had a break or an injury, it\'s better to continue at the lower level from your current mileage.',
      apply: 'Continue the plan at level {n}',
      step: '{n} weeks have passed since your latest result and your easy runs felt easy. Following the Daniels method, it is time to move your paces one step toward your target time (VDOT {a} to {b}).',
      stepApply: 'Move up one step', stepTest: 'or run a time trial', stepDone: 'Paces updated to VDOT {v}.'
    },
    checkin: {
      title: 'Today\'s check-in',
      painLocked: 'You reported pain today and the session is cancelled.',
      lockedText: 'Today\'s check-in is locked. Check in again tomorrow; if the pain continues, don\'t train and see a doctor.',
      back: 'Back to the plan',
      heading: 'Pre-run check-in',
      help: 'How does the check-in change the plan?',
      planned: '{day} {date} · planned session:',
      fatigueQ: 'How tired are you right now?',
      fLow: '1 = fresh',
      fHigh: '5 = very tired',
      sleepQ: 'Last night\'s sleep quality',
      hoursQ: 'How many hours did you sleep? (optional)',
      hoursPh: 'e.g. 7',
      sLow: '1 = very poor',
      sHigh: '5 = excellent',
      painQ: 'Do you feel any pain right now?',
      where: 'Where?',
      wherePh: 'e.g. left knee, shin, lower back',
      painNote: 'This means real pain (sharp, localised, or pain that gets worse when running), not general muscle soreness after training.',
      painNoteWalk: 'This means real pain (sharp, localised, or pain that gets worse when walking), not general muscle soreness after training.',
      submit: 'Save check-in',
      err: { fatigue: 'Choose your fatigue level.', sleep: 'Choose your sleep quality.', pain: 'Answer the pain question.', where: 'Tell us where it hurts, or tick the consent box to choose the area and level.' },
      toastDown: 'Today\'s session was adjusted to your check-in; see why.',
      toastOk: 'Check-in saved.'
    },
    gait: {
      title: 'Running form analysis',
      linkSub: 'From two short videos, side and back; on this phone',
      intro: 'Record two short videos of your running; the app finds your body points and checks your form against research-based standards. All processing happens on this phone and the videos are never sent anywhere.',
      howTitle: 'How to film',
      how: [
        'Keep the phone still (tripod or propped up), about hip height and 3 to 5 m away.',
        'Your whole body, head to feet, should be in frame; good light and a plain background help.',
        'Side video: phone at a right angle to your running line. Back video: phone behind you, on your running line.',
        'A treadmill is best; outdoors, film from further away so several full steps are in frame.',
        'At your usual easy pace, for at least 10 seconds. If your phone records at 60 fps, turn it on.',
        'Fitted clothes help the knees and hips be found more accurately.'
      ],
      side: 'Side video',
      sideHint: 'head, trunk, elbows, knees, foot strike, cadence',
      back: 'Back video',
      backHint: 'pelvis, knees caving in, arms, left/right symmetry',
      pick: 'Choose video',
      change: 'Change',
      analyze: 'Start analysis',
      needSide: 'At least one video (side or back) is needed.',
      oneEnough: 'One video is enough; with both the analysis is more complete. Each video\'s angle is detected automatically.',
      firstLoad: 'The first time, about 35 MB of analysis files are downloaded; after that it works offline too.',
      stage: { load: 'Preparing the analyser…', side: 'Analysing the side video… {p}%', back: 'Analysing the back video… {p}%', report: 'Building the report…' },
      etaMin: ' (about {n} min left)', etaSec: ' (less than a minute left)',
      busyHint: 'Keep this page open until the analysis finishes.',
      err: {
        load: 'The analyser could not be loaded. The first time needs internet; please try again.',
        video: 'This video could not be read. Try another one (mp4 or mov).'
      },
      reason: {
        noPerson: 'Your body was not clearly visible in this video. Your whole body should be in frame, in good light.',
        notSide: 'This is not a side view; hold the phone at a right angle to your running line.',
        notBack: 'This is not a back view; place the phone behind you, on your running line.',
        fewSteps: 'Not enough steps were seen; film for at least 10 seconds with your feet fully in frame.',
        sameView: 'Same angle as the other video; for a full analysis, film one from the side and one from behind.'
      },
      report: 'Running form report',
      cond: { label: 'What kind of run is this video from?', hint: 'Each video has its own run type, and the two can differ; some numbers (like cadence) change with speed.', need: 'Choose the run type for each video.', easy: 'Easy run', tempo: 'Tempo', interval: 'Intervals or high speed', race: 'Race pace', in: 'Run type: {c}' },
      speedQ: 'Video speed (optional)', speed: { 1: 'Normal', 4: 'Slow motion ×4 (120 fps)', 8: 'Slow motion ×8 (240 fps)' }, speedHint: 'If you filmed in your phone\'s slow-motion mode, pick its factor so cadence is computed in real time. If unsure, keep “Normal”; you can change it after the analysis too.',
      view: { more: 'Other descriptive measurements ({n})', side: 'Side view analysis', back: 'Back view analysis', measured: 'Measured from this view', notFrom: 'Cannot be measured reliably from this view: {list} (these need the {other}).' },
      scoreOf: '{n} / 100',
      inRangeShort: '{a} of {b}',
      inRangeNote: 'within the usual range',
      noneTitle: 'Your form can\'t be assessed from this video',
      noneText: 'None of the measurements were accurate enough, so we draw no conclusion about your form. The most common reason is that your body is small in the frame: film from closer so you fill at least half the frame height from head to toe, keep the phone steady at hip height, and get several full strides in view.',
      status: { good: 'Within the usual range', warn: 'Slightly outside the usual range', bad: 'Outside the usual range', info: 'Descriptive', na: 'Not reliable' },
      conf: { label: 'Confidence: ', sure: 'Reliable measurement', est: 'Estimate', low: 'Not reliable' },
      priorities: 'What stood out most',
      noIssues: 'In this video, everything that has a reference range was within the usual range.',
      naText: 'This could not be measured accurately enough in this video (camera angle, light, joint visibility or number of steps), so no number is shown.',
      naWhy: {
        slow: 'Unreliable: the timing of this video does not match real running (steps are far slower than any run), so it is probably slow motion. Set the slow-motion factor to get cadence in real time.',
        range: 'Unreliable: the number is outside the possible running range (130–230 steps per minute); the video time is probably not real time (slow motion or sped up).',
        footSmall: 'Unreliable: the foot is too small in the picture; a few pixels of error at the heel and toe points shift the foot angle by several degrees (more than the gap between heel, midfoot and forefoot). For this item, film closer or zoomed in so the foot looks bigger.',
        fewSteps: 'Unreliable: fewer than 3 steps showed the heel and toe clearly at landing.'
      },
      slow: {
        q: 'Was this video slow motion?',
        why: 'Steps in this video are far slower than any running. If it is slow motion, choose the factor so cadence is counted like a running watch (steps per minute, real time). Your phone knows the factor: 240 fps slow-mo played at 30 fps = ×8, 120 fps = ×4.',
        yes: 'Yes, slow motion ×{k} (about {c} steps per minute)',
        other: 'Other factor:',
        no: 'No, normal speed',
        applied: 'Times in this video were converted to real time with slow-motion factor ×{k}.',
        done: 'Analysis updated with factor ×{k}'
      },
      whyLabel: 'Why it may matter: ',
      sideTitle: 'Side view',
      backTitle: 'Back view',
      keySide: 'Moment of foot strike',
      keyBack: 'Mid-stance',
      kneeLabel: 'Knee {n}°',
      ref: 'Usual range: ',
      look: { down: 'down', up: 'up', ahead: 'ahead' },
      strikeName: { heel: 'heel', mid: 'midfoot', fore: 'forefoot' },
      items: {
        cadence: { t: 'Cadence', v: '{n} steps per minute', ref: 'depends on speed and height',
          seen: 'About {n} steps per minute were counted in this video.', low: 'About {n} steps per minute were counted in this video, which looks lower than usual for “{c}” (about {f} or more).',
          why: 'In lab studies, a small cadence increase (5–10%) went along with less load on the knee; a direct link between cadence and injury is still unclear.' },
        overstride: { t: 'Where the foot lands', v: 'ankle {n} × leg length ahead of the pelvis · shin {s}°', ref: 'foot close to under the body, shin near vertical',
          good: 'In this video the foot lands roughly under the body and the shin is near vertical at landing.', warn: 'In this video the foot lands a little ahead of the body.', bad: 'In this video the foot clearly lands ahead of the body and the shin is tilted forward at landing.',
          why: 'In research, landing far ahead of the body has been linked with more braking each step and more load on the knee and shin; this is an association, not a proven cause.' },
        kneeIc: { t: 'Knee at foot strike', v: '{n}° bent', ref: 'about 10–30° bent',
          good: 'In this video the knee is slightly bent at landing.', straight: 'In this video the knee is fairly straight at landing.', bent: 'In this video the knee is more bent than usual at landing.',
          why: 'In one study, injured runners landed with a straighter knee; a bent knee is part of how impact is absorbed.' },
        peakKnee: { t: 'Peak knee bend during stance', v: '{n}° bent', ref: 'usually reported around 40–45°',
          seen: 'In this video the knee bent to about {n}° while the foot was on the ground.', why: 'This is mainly descriptive; no reference range linked to injury was found for it.' },
        strike: { t: 'Foot strike', v: '{s} ({n}°)', ref: 'none is “right” or “wrong”',
          pct: '{p}% {s}', sep: ', ', seenPct: 'Of the {n} steps where the foot was clearly visible at landing: {list}; mostly {s}.',
          seen: 'In this video landing is mostly on the {s}.', why: 'Research has not shown one strike pattern to be better; heel striking shifts more load to the knee, forefoot striking more to the calf and Achilles.' },
        gct: { t: 'Ground contact time', v: '{n} ms', ref: 'shorter at higher speed; no fixed standard',
          seen: 'In this video each foot contact lasted about {n} ms.', why: 'This depends mostly on running speed and is only approximate with a phone camera.' },
        vo: { t: 'Vertical oscillation', v: '{n} cm', ref: 'less has gone with better economy',
          seen: 'In this video the pelvis moved up and down about {n} cm each step.', why: 'In a study of 97 runners, less bounce went with lower energy cost; no link with injury has been shown.' },
        trunk: { t: 'Trunk lean', v: '{n}° forward', ref: 'a slight forward lean is common',
          ok: 'In this video the trunk leans slightly forward.', forward: 'In this video the trunk leans forward more than usual.', back: 'In this video the trunk is upright or leaning slightly back.',
          why: 'Trunk lean is a trade-off: a little forward lean lowers knee load and raises hip muscle work; evidence about injury is mixed.' },
        head: { t: 'Head and gaze', v: 'head {n}° ahead of the shoulder · gaze {g}° ({look})', ref: 'no valid range found for running',
          seen: 'In this video the head is about {n}° ahead of the shoulder and the gaze is {look}.', why: 'No valid reference range for head position while running was found; this is only an observation.' },
        elbow: { t: 'Elbow angle', v: '{n}°', ref: 'about 90° is coaching convention, not a research finding',
          seen: 'In this video the elbow is open about {n}° on average.', why: 'Arm swing lowered energy cost in research; there is no evidence about the elbow angle itself.' },
        timing: { t: 'Step timing symmetry', v: 'left/right difference {n}%', ref: 'some difference is normal',
          seen: 'In this video the timing difference between the two legs was about {n}%.', why: 'Some asymmetry is common in healthy runners too; its link with injury is unclear.' },
        pelvic: { t: 'Pelvic drop on one leg', v: 'left {l}° · right {r}°', ref: 'small',
          good: 'In this video the pelvis stays fairly level during stance.', warn: 'In this video the opposite side of the pelvis drops slightly during stance.', bad: 'In this video the opposite side of the pelvis clearly drops during stance.',
          why: 'In one study, pelvic drop was the biggest difference between injured runners (knee, outer knee, shin and Achilles) and healthy ones; that study was cross-sectional and does not show cause and effect.' },
        valgus: { t: 'Knee moving inward', v: 'left {l}° · right {r}°', ref: 'small',
          good: 'In this video the knee stays roughly in line with the foot.', warn: 'In this video the knee moves slightly inward during stance.', bad: 'In this video the knee clearly moves inward during stance.',
          why: 'In some studies, especially in women, the thigh moving inward went with front-of-knee and outer-knee pain; evidence is limited.' },
        crossover: { t: 'Step width', v: '{n}% of contacts cross the midline', ref: 'each foot close to under the same hip',
          good: 'In this video the feet land roughly under the same side of the body.', warn: 'In this video the foot crosses the body’s midline in some steps.',
          why: 'In modelling studies, a narrower step went with more strain on the outer-thigh band and more stress on the shin bone; a direct link with injury has not been tested.' },
        armCross: { t: 'Arm movement (back view)', v: 'hands cross the midline {n}% of the time', ref: 'no evidence for a clear limit',
          seen: 'In this video the hands cross the body’s midline about {n}% of the time.', why: 'Arm swing balances upper-body rotation; there is no evidence that one particular pattern is “right”.' },
        trunkLat: { t: 'Trunk and pelvis alignment (side lean)', v: '{n}° side lean', ref: 'no valid reference range used',
          seen: 'In this video the trunk leans about {n}° to the side relative to the pelvis during stance.', why: 'Some clinical running assessments look at side lean together with pelvic drop; no direct evidence for a clear limit was found.' },
        armSym: { t: 'Arm swing symmetry', v: 'left/right difference {n}%', ref: 'some difference is normal',
          seen: 'In this video the swing range of the two arms differs by about {n}%.', why: 'Arm swing balances upper-body rotation; research has not set a clear limit for its symmetry.' },
        sides: { t: 'Left/right symmetry (back view)', v: 'contact time difference {n}%', ref: 'some difference is normal',
          seen: 'In this video the contact time difference between the legs was about {n}%.', why: 'Some asymmetry is common in healthy runners too; its link with injury is unclear.' }
      },
      axesCard: { performance: 'Efficiency', form: 'Form', risk: 'Injury patterns' },
      axes: { performance: 'Movement efficiency', form: 'Biomechanical form', risk: 'Patterns linked to injury', perfSub: 'braking each step and bouncing', formSub: 'how the joints move', riskSub: 'a combination of findings, not a prediction' },
      levelShort: { low: 'None seen', moderate: 'A few', high: 'Several' },
      level: { low: 'No particular pattern seen', moderate: 'A few related patterns', high: 'Several related patterns, clearer' },
      factorsLabel: 'Related findings in this video: ',
      noFactors: 'No combination of findings related to this area was seen.',
      partial: 'Only {a} of {b} related items were measured (for example, no back-view video).',
      injuries: {
        runnersKnee: { t: 'Front of the knee (kneecap)', why: 'Patterns such as pelvic drop, landing ahead of the body with a straight knee, and the knee moving inward have been linked in research with more load on the kneecap joint.' },
        itbs: { t: 'Outside of the knee (IT band)', why: 'Patterns such as pelvic drop, the knee moving inward and a narrow step have been linked in research with more strain on the outer-thigh band.' },
        shin: { t: 'Shin', why: 'Patterns such as pelvic drop, landing ahead of the body, low cadence and a narrow step have been linked in research with more load on the shin.' },
        achilles: { t: 'Achilles tendon', why: 'In one study, runners with Achilles problems also showed more pelvic drop and landing ahead of the body with a straighter knee.' }
      },
      factorName: { overstride: 'landing ahead of the body', kneeIc: 'knee at landing', valgus: 'knee moving inward', pelvic: 'pelvic drop', cadence: 'cadence lower than usual', crossover: 'narrow step' },
      seeExpert: 'If you have pain or discomfort in this area, an assessment by a professional (physiotherapist or sports doctor) can help.',
      load: { high: 'Context: your running volume in the last 7 days ({a} km) was about {r}× your weekly average of the previous 4 weeks ({c} km). Rapid increases in volume have also been linked with injury in research, though that evidence is debated.', ok: 'Context: your running volume in the last 7 days ({a} km) was close to your weekly average of the previous 4 weeks ({c} km).' },
      anim: { title: 'Analysis video', tap: 'Tap the picture to play or pause', overlay: 'Show skeleton', err: { format: 'This browser cannot play this video format (for example HEVC). Your analysis results are unaffected; to play it, record in a more compatible format (H.264) or open it in Safari.', load: 'This video could not be played. Your analysis results are unaffected.' }, hint: 'Your body points and lines, in sync with your running; red points = joints seen outside the usual range. Tap the picture to play or pause; use “Show skeleton” to switch between the original and the skeleton version.', play: 'Play', pause: 'Pause', speed: 'Speed {r}×', prev: 'Previous frame', next: 'Next frame', save: 'Save video', saving: 'Building video…', strike: 'Strike', knee: 'Knee', elbow: 'Elbow', pelvis: 'Pelvis', noRecord: 'Building a video is not supported in this browser.', sessionOnly: 'The analysis video is only available right after the analysis (the video is not saved); tap “Save video” to keep it.' },
      riskIntro: 'These are not injury predictions. An area only shows “related patterns” when several related findings appear together; a single number is never enough.',
      disclaimer: 'This analysis is an educational tool and not a substitute for an assessment by a professional. It comes from a 2D phone video, and its accuracy depends on camera angle, light and video quality; none of these findings is an injury diagnosis.',
      methodsTitle: 'How are these numbers calculated?',
      methods: 'MediaPipe Pose (open source, running on your phone) finds 33 body points in each frame. Foot strike is found from the lowest point of the foot, and angles are calculated from those points. Each number has a confidence level: “reliable” when the needed joints were clearly visible over enough steps, “estimate” when accuracy is limited (for example contact time with a 30 fps camera), and “not reliable”, for which no number is shown. Sources and details are in the “Professional version”.',
      expert: {
        title: 'Professional version',
        sub: 'For a physiotherapist or sports doctor: raw values, confidence, reference range and source for each parameter.',
        print: 'Print / save as PDF',
        meta: 'Analysis details', date: 'Date', condition: 'Run type', height: 'Height entered', cm: 'cm', video: 'Video', fps: 'Effective frame rate', frames: 'Frames', valid: 'Frames with a detected body', steps: 'Foot contacts', scale: 'Time factor', near: 'Side nearer the camera',
        cadDetail: '{n} contacts in {s} s real time · time factor ×{k}', cadSlow: 'if slow motion ×{k}: about {c}', strikeN: '{n} steps · foot length in picture {px} px', left: 'left', right: 'right',
        cols: { param: 'Parameter', view: 'View', value: 'Raw value', conf: 'Confidence', ref: 'Reference range', src: 'Source', ev: 'Evidence' },
        views: { side: 'side', back: 'back' },
        ev: { mod: 'moderate', weak: 'weak', mixed: 'conflicting', none: 'insufficient' },
        noData: '—',
        limitsTitle: 'Limitations',
        limits: [
          'Cadence uses real time: step time comes from the autocorrelation of the distance between the ankles (independent of left/right labels and camera motion), checked against foot contacts. A value outside 130–230 steps per minute means the video time is not real; slow-motion videos (especially screen recordings) carry no factor, so the user is asked.',
          'Foot strike is classified for each step: initial contact from foot motion relative to the pelvis (similar to Zeni 2008): near the widest foot spread, where the foot stops descending; foot angle minus the same foot\'s angle at mid-stance (instead of the standing calibration of Altman & Davis 2012). In normal 30 fps phone video the foot can flatten between two frames, so the landing angle is underestimated; 120 or 240 fps slow motion and a foot at least 40 px long in the picture are needed.',
          '2D single-camera analysis: frontal-plane angles (pelvis, knee) and rotations are 2D projections of 3D motion and are sensitive to camera angle.',
          'Body points are estimated with MediaPipe Pose (BlazePose), not markers; reported knee-angle error in running is about 2–6° and larger at peak angles.',
          'Temporal resolution is one frame (33 ms at 30 fps); 120 fps or more has been recommended for contact time and exact foot strike (Souza 2016).',
          'Vertical oscillation is converted to cm from the entered height and a fixed leg-to-height ratio, and depends on a static camera.',
          'Pronation is deliberately not measured: the MediaPipe heel point is not the calcaneal bisection.',
          'Reference values marked “estimate” do not come from a specific paper and are design judgements of this tool.',
          'Prospective evidence linking running biomechanics to injury is sparse and inconsistent (Ceyssens 2019).'
        ],
        refsTitle: 'References',
        refs: [
          'Zeni JA, Richards JG, Higginson JS. Two simple methods for determining gait events during treadmill and overground walking using kinematic data. Gait Posture. 2008;27(4):710-4.',
          'Altman AR, Davis IS. A kinematic method for footstrike pattern detection in barefoot and shod runners. Gait Posture. 2012.',
          'Anderson LM et al. What are the benefits and risks associated with changing foot strike pattern during running? Sports Med. 2020;50(5):885-917.',
          'Arellano CJ, Kram R. The metabolic cost of human running: is swinging the arms worth it? J Exp Biol. 2014;217(14):2456-2461.',
          'Bramah C et al. Is there a pathological gait associated with common soft tissue running injuries? Am J Sports Med. 2018;46(12):3023-3031.',
          'Cavanagh PR, Kram R. Stride length in distance running: velocity, body dimensions, and added mass effects. Med Sci Sports Exerc. 1989.',
          'Ceyssens L et al. Biomechanical risk factors associated with running-related injuries: a systematic review. Sports Med. 2019;49(7):1095-1115.',
          'Dingenen B et al. Test-retest reliability of two-dimensional video analysis during running. Phys Ther Sport. 2018;33:40-47.',
          'Folland JP et al. Running technique is an important component of running economy and performance. Med Sci Sports Exerc. 2017;49(7):1412-1423.',
          'Heiderscheit BC et al. Effects of step rate manipulation on joint mechanics during running. Med Sci Sports Exerc. 2011.',
          'Meardon SA et al. Step width alters iliotibial band strain during running. Sports Biomech. 2012.',
          'Meardon SA, Derrick TR. Effect of step width manipulation on tibial stress during running. J Biomech. 2014.',
          'Nielsen RO et al. Foot pronation is not associated with increased injury risk in novice runners wearing a neutral shoe. Br J Sports Med. 2014;48(6):440.',
          'Noehren B, Davis I, Hamill J. Prospective study of the biomechanical factors associated with iliotibial band syndrome. Clin Biomech. 2007.',
          'Novacheck TF. The biomechanics of running. Gait Posture. 1998.',
          'Souza RB. An evidence-based videotaped running biomechanics analysis. Phys Med Rehabil Clin N Am. 2016;27(1):217-236.',
          'Teng HL, Powers CM. Sagittal plane trunk posture influences patellofemoral joint stress during running. J Orthop Sports Phys Ther. 2014;44(10):785-792.'
        ],
        refNote: 'Reference values taken from secondary sources are marked ⚠ and should be checked against the full text.',
        p: {
          cadence: { n: 'Cadence', en: 'Cadence (step rate)', u: 'steps/min', ref: 'Lower bound of usual (estimate): easy 160, tempo 165, intervals and race 170', src: 'Heiderscheit 2011; Cavanagh & Kram 1989', ev: 'weak' },
          gct: { n: 'Ground contact time', en: 'Ground contact time', u: 'ms', ref: 'Speed dependent; no reference range used', src: 'Folland 2017 (duty factor)', ev: 'weak' },
          vo: { n: 'Vertical oscillation', en: 'Vertical oscillation (pelvis)', u: 'cm', ref: 'No reference range used; less ↔ better economy', src: 'Folland 2017', ev: 'none' },
          overstride: { n: 'Overstride', en: 'Overstride (ankle ahead of pelvis at IC, × leg length)', u: '× L', ref: 'Usual ≤ 0.22; slightly outside ≤ 0.32 (estimate)', src: 'Souza 2016; Bramah 2018', ev: 'mod' },
          shank: { n: 'Shank angle at IC', en: 'Tibia (shank) angle at IC', u: '°', ref: '⚠ near vertical (about 5°); usual ≤ 7°, slightly outside ≤ 12° (estimate)', src: 'Souza 2016; Folland 2017', ev: 'mod' },
          kneeIc: { n: 'Knee flexion at IC', en: 'Knee flexion at initial contact', u: '°', ref: '⚠ about 15–20° reported; usual in this tool 10–30°', src: 'Souza 2016; Bramah 2018', ev: 'weak' },
          peakKnee: { n: 'Peak knee flexion', en: 'Peak knee flexion in stance', u: '°', ref: '⚠ about 40–45° reported (descriptive only)', src: 'Novacheck 1998', ev: 'weak' },
          strike: { n: 'Foot strike angle', en: 'Foot strike angle', u: '°', ref: '> 8° rearfoot; −1.6 to 8° midfoot; < −1.6° forefoot', src: 'Altman & Davis 2012; Anderson 2020', ev: 'weak' },
          trunk: { n: 'Trunk forward lean', en: 'Trunk forward lean', u: '°', ref: 'Descriptive only', src: 'Teng & Powers 2014; Bramah 2018', ev: 'mixed' },
          head: { n: 'Head forward / gaze', en: 'Head forward / gaze angle', u: '°', ref: 'No valid range for running found', src: '—', ev: 'none' },
          elbow: { n: 'Elbow angle', en: 'Elbow angle', u: '°', ref: 'Descriptive only (90° is coaching convention)', src: 'Arellano & Kram 2014 (arm swing)', ev: 'none' },
          timing: { n: 'Step timing asymmetry', en: 'Step timing asymmetry', u: '%', ref: 'Descriptive only', src: '—', ev: 'weak' },
          pelvic: { n: 'Contralateral pelvic drop', en: 'Contralateral pelvic drop', u: '°', ref: 'Usual ≤ 5°; slightly outside ≤ 8° (estimate)', src: 'Bramah 2018; Noehren 2007; Dingenen 2018', ev: 'mod' },
          valgus: { n: 'Knee frontal plane angle', en: 'Knee frontal plane projection angle', u: '°', ref: 'Usual ≤ 8°; slightly outside ≤ 14° (estimate)', src: 'Ceyssens 2019; Souza 2016', ev: 'weak' },
          crossover: { n: 'Crossover contacts', en: 'Crossover / narrow step width', u: '%', ref: 'Usual ≤ 30% (estimate)', src: 'Meardon 2012; Meardon 2014', ev: 'weak' },
          armCross: { n: 'Arm crossing midline', en: 'Arm crossing midline', u: '%', ref: 'Descriptive only', src: 'Arellano & Kram 2014', ev: 'none' },
          trunkLat: { n: 'Lateral trunk lean', en: 'Lateral trunk lean (mid-stance)', u: '°', ref: 'Descriptive only', src: 'Dingenen 2018', ev: 'none' },
          armSym: { n: 'Arm swing asymmetry', en: 'Arm swing asymmetry', u: '%', ref: 'Descriptive only', src: '—', ev: 'none' },
          sides: { n: 'L/R asymmetry', en: 'L/R asymmetry (GCT, pelvic drop, knee)', u: '% / °', ref: 'Descriptive only', src: '—', ev: 'weak' }
        }
      },
      history: 'Previous analyses',
      histRow: '{s}% within the usual range',
      histNone: 'Could not be assessed',
      histRowOld: 'earlier analysis version',
      again: 'New analysis',
      remove: 'Remove',
      saved: 'Report saved; the videos are not stored.'
    },
    goalTiles: { title: 'Pick a goal', titleNext: 'What\'s your next goal?', main: 'Main goal', eta: 'Ready in: {w}', names: { 5: '5 km', 10: '10 km', 21: 'Half marathon', 42: 'Marathon' } },
    wgoal: {
      pageTitle: 'Walking goal', intro: 'Pick a goal and your weekly plan will steer toward it. You can change it any time.',
      onbQ: 'What is your walking goal?', later: 'I\'ll choose later', onbHint: 'You can change it later from your profile.',
      min150: { t: '150 minutes a week', big: '150', short: 'WHO recommendation', desc: 'Reach the minimum recommended activity for health: 150 minutes of brisk walking a week.' },
      steps: { t: 'Daily steps', big: 'Steps', short: 'A step target every day', desc: 'Hit a set number of steps each day; read them from your phone or watch and log them.' },
      faster: { t: 'Walk faster', big: 'Pace', short: 'Speed and endurance', desc: 'More brisk sessions in your plan so you cover more ground for the same effort.' },
      event: { t: 'Walking event', big: 'Event', short: 'A set distance', desc: 'Get ready for a 5 to 42 km walk; your weekly long walk grows step by step.' },
      run: { t: 'Get ready to run', big: 'Run', short: 'Next step: running', desc: 'We build your walking base so you can start running with confidence.' },
      eta: 'Estimated arrival: {a} to {b} weeks', stepsQ: 'Daily step target', eventKmQ: 'Event distance', dateQ: 'Event date (optional)',
      choose: 'Choose this goal', update: 'Update', clear: 'Remove goal', cleared: 'Goal removed',
      saved: 'Goal saved: {g}', errDate: 'The event date must be at least a week away.',
      manage: 'Change goal →', stepsLine: 'Target: {n} steps a day', eventLine: '{km} km event'
    },
    theme: {
      title: 'Appearance', auto: 'Automatic', light: 'Light', dark: 'Dark',
      nowLight: 'light now', nowDark: 'dark now',
      hint: 'Automatic follows your phone setting, for example light by day and dark at night.'
    },
    inbox: {
      title: 'Messages', aria: 'Messages', ariaN: 'Messages, {n} unread', unread: '(unread)',
      today: 'Today', earlier: 'Earlier', readAll: 'Mark all read', clear: 'Clear read',
      empty: 'No messages yet. Reminders, plan changes and suggestions will collect here.'
    },
    msg: {
      welcome: { t: 'Welcome to Gaam', b: 'Reminders, plan changes and important suggestions collect here.', a: 'App guide' },
      week: { t: 'Your week {n} plan is ready', b: '{s} sessions this week.', a: 'See plan' },
      remind: { t: 'Workout reminder', b: '{s} is waiting for you today.', a: 'See session' },
      adapt: { t: 'Today\'s session is lighter', b: 'Based on your check-in, today is now: {s}.', a: 'See session' },
      pain: { t: 'Pain logged', b: 'Skip training today. If the pain continues, see a doctor.', a: 'Today\'s plan' },
      vdot: { t: 'New result saved', b: 'Your VDOT is now {v} and your paces are updated.', a: 'See paces' },
      fit: { t: 'Time for a fitness test', b: 'A fresh time trial makes your paces more accurate.', a: 'Log a test' },
      wlevel: { t: 'Ready for the next level', b: 'The plan has become easy; you can move from level {from} to level {to}.', a: 'See suggestion' }
    },
    wpath: {
      none: 'Your path: no goal yet', noneSub: 'Pick a walking goal to see your path',
      weekMin: 'This week: {n} min', stepsAvg: 'Average steps, last 7 days: {n} of {t}',
      faster: 'More brisk sessions each week', event: 'Event in {n} days ({d})', tight: 'Tight; build up gently'
    },
    stepsCard: {
      title: 'Today\'s steps', target: 'Target: {n} steps', label: 'Steps today', ph: 'e.g. 7500', save: 'Save',
      saved: 'Today\'s steps saved', hint: 'Read the number from your phone\'s health app or your watch; you can change it any time.', hit: 'You hit today\'s target!'
    },
    wlevel: {
      title: 'Ready for the next level',
      text: 'For two weeks you have walked about {n} minutes a week and the plan has become easy. Time to move from level {from} to level {to}.',
      done: 'Your walking level is now {n}'
    },
    bridge: {
      title: 'Ready to run?', text: 'Your walking base is solid. If you like, we can start a from-scratch running plan (run-walk intervals).',
      go: 'Yes, let\'s run', no: 'Keep walking for now', confirm: 'The running plan replaces your walking plan from today. Your training history stays. Continue?',
      yes: 'Start running', done: 'Your from-scratch running plan has started'
    },
    remind: {
      title: 'Reminders', subOn: 'Every day at {t}', subOff: 'Off',
      bannerT: 'Today\'s workout reminder', banner: '{s} is waiting for you today ({n} min).',
      inApp: 'Show in-app reminders', time: 'Reminder time',
      calHint: 'To be reminded even when the app is closed, add the next 12 weeks of sessions to your phone calendar.',
      cal: 'Add to calendar (.ics)', calDone: 'Calendar file downloaded; open it to add it to your calendar',
      notify: 'Allow notifications', notifyOn: 'Notifications on', notifyOk: 'Notifications on (only while the app is open)', notifyNo: 'Notification permission was not granted'
    },
    path: {
      title: 'Your path', now: 'Now', goal: 'Goal', level: 'Level {n}', aria: 'Progress toward your goal',
      week: 'Week {a} of about {b} weeks of preparation', notStarted: 'Your plan starts on {d}',
      race: 'Race in {n} days ({d})', eta: 'Estimated readiness: {a} to {b} weeks', etaMonth: 'Estimated arrival: around {m}', ready: 'In mileage and preparation, you are ready',
      st: { ok: 'You have enough time', tight: 'Tight; check an intermediate goal', ready: 'Ready' },
      more: 'Details →', seePlans: 'Suggested plans →',
      none: 'Your path: no goal yet', noneSub: 'See the suggested plans for your level and pick one'
    },
    start: {
      title: 'Getting started', count: '{a} of {b}', close: 'Close the getting-started list',
      plan: 'Your plan is ready',
      goal: 'Pick your first goal', goalSub: 'From the suggested plans for your level', goalSubWalk: '150 minutes a week, daily steps or an event', goalDone: 'First goal: {g}',
      checkin: 'Your first check-in', checkinSub: 'Under a minute; tunes today\'s session to how you feel',
      run: 'Mark your first run as done', runSub: 'After your run, from today\'s plan',
      walk: 'Mark your first walk as done', walkSub: 'After your walk, from today\'s plan',
      name: 'Add your name', nameSub: 'Makes the plan more personal; you can add a photo too',
      srDone: '(done)', srTodo: '(not done)',
      allDone: 'All steps done!', allDoneSub: 'Now just keep going; this card will now fold away.'
    },
    cele: {
      title: 'Well done, you took the first step!',
      text: 'Your first run is logged: {s}. From now on the plan adapts to your own data.',
      next: 'Next session', cont: 'Continue'
    },
    plans: {
      title: 'Suggested plans',
      linkSub: '5 km, 10 km, half and full marathon for your level',
      intro: 'Ready-made templates for each distance, based on your current level and mileage and built with the same rules as your main plan. They are only suggestions: your plan does not change unless you add a race yourself.',
      volNow: 'current mileage {n:d} {u} per week',
      modeVolume: 'At your level, suggestions are based on mileage and distance only; the goal is to finish the distance healthy. From level 3 you can also set a target time.',
      modePace: 'You can set a target time for each distance. The time to reach it uses the Jack Daniels method: VDOT rises one point at a time, and each step takes 4 to 6 weeks.',
      ageNote: 'Because of your age, the estimates include about 10 to 15% more time so your body has enough room to recover.',
      goalFinish: 'Goal: finish', goalPace: 'Goal: faster time',
      weeks: '{a} to {b} weeks', months: '{a} to {b} months', untilReady: 'until race-ready (approx.)', cycle: 'full preparation cycle (approx.)',
      zero: 'Starting from zero', zeroVal: 'about {n} weeks of walk-run',
      volume: 'Weekly mileage', volVal: 'from {a:d} to {b:d} {u}', volKeep: '{n:d} {u} (your current mileage is enough)',
      long: 'Longest long run', longVal: '{n:d} {u}',
      sessions: 'Sessions per week', sesVal: '{n} sessions',
      now: 'Current time (predicted):', nowEst: '(estimated from your level; a time trial makes it accurate)',
      target: 'Target time', presetsAria: 'Suggested targets', presetWeeks: 'about {n} weeks',
      already: 'Your current fitness already reaches this time; pick a faster target or work on mileage and endurance.',
      targetPace: 'Target pace', steps: '{n} steps, about {w} weeks each',
      howPace: 'Training starts at your current paces (easy about {e}, threshold about {t} {pu}) and, if easy runs feel easy, moves up one step every {w} weeks.',
      ambitious: 'This goal is more than one training season away (about {n} weeks); an intermediate goal first is better.',
      midUse: 'Intermediate goal: {t} in about {n} weeks',
      use: 'Add to my goals',
      useHint: 'Opens the add-goal form with the suggested date {d} (the date is optional); if you have no main goal, this becomes it.',
      foot: 'Times are approximate and come from the 10% mileage rule, an easy week every fourth week, the minimum preparation for each level and the Jack Daniels method. Injury, illness or breaks make them longer.'
    },
    health: {
      title: 'Pain, injury and cycle',
      rowSub: 'Log pain, confirmed injury, gradual return',
      disclaimer: 'Gaam does not give a medical diagnosis or prescribe treatment; it only adapts your training load to what you log. For anything serious, see a doctor or physiotherapist.',
      privacy: 'Pain, injury and cycle data are stored only with your consent and only on this device, never sent anywhere, and can be deleted at any time.',
      consentTitle: 'Consent for health data',
      consentText: 'Pain, injuries and your menstrual cycle are sensitive health data. Gaam keeps them only with your explicit consent.',
      consentList: ['Stored only on this device (browser storage); there is no server.', 'Never used in aggregate statistics or shared with anyone.', 'Used only to adapt your own training plan.', 'You can delete all of it from this page at any time.'],
      consentShort: 'I agree that my health data (pain, injury and cycle) is stored only on this device',
      consentAsk: 'To adjust your plan to where and how much it hurts, we need your consent first. Without it, you can still just write where it hurts.',
      consentBtn: 'Continue', consentHint: 'Tick the box above to continue.',
      statusTitle: 'Current status', noIssue: 'No active pain or injury logged.',
      painFree: 'No pain today',
      logTitle: 'Log pain', logHint: 'Whenever you feel pain (even outside the check-in), log it here so your plan can adapt.',
      logNew: 'Log today\'s pain', logEdit: 'Update today\'s pain', logSave: 'Save',
      history: 'Last 3 weeks', noPain: 'No pain', histRow: '{a} · {n}/10',
      areaQ: 'Where does it hurt?', levelQ: 'Pain level (0 = none, 10 = worst)', levelLow: 'Mild', levelHigh: 'Very severe',
      whenQ: 'When does it hurt? (all that apply)', flagsQ: 'Do you have any of these?',
      area: { knee: 'Knee', shin: 'Shin (front)', achilles: 'Achilles', calf: 'Calf', foot: 'Sole of the foot', ankle: 'Ankle', hip: 'Hip and buttock', thigh: 'Thigh', back: 'Lower back', other: 'Somewhere else' },
      when: { during: 'While running', after: 'After running', rest: 'Also at rest', night: 'At night' },
      flags: { swelling: 'Swelling', limp: 'Limping or changed stride', weight: 'Can\'t put weight on it', worse: 'Worse with every step' },
      tier: { none: 'No pain', mild: 'Mild', moderate: 'Moderate', severe: 'Severe' },
      tierTitle: { mild: 'Lighter training because of pain', moderate: 'No running today', severe: 'Running paused; see a specialist', recovering: 'Easing back after pain' },
      reported: 'Logged: {w} · pain {n}/10',
      reportedNoLevel: 'Logged: {w}',
      warn: {
        worse: 'The pain is worse than last time; the plan is now one step more cautious.',
        persistent: 'The pain has continued for several days; the plan is now one step more cautious.',
        long: 'This pain has lasted 10 days or more; it is best to have a doctor or physiotherapist look at it.',
        stale: 'You have not updated your pain for over a week; if it is gone, tap "No pain today".'
      },
      raceMild: 'Your race stays; it is your call. If the pain gets worse during the race, stop.',
      update: 'Update pain and injury',
      checkinDone: 'Today\'s check-in was logged with pain. To update the level or log "no pain", go to the pain and injury page.',
      toast: { mild: 'Today\'s session was made lighter because of pain.', moderate: 'Today: low-impact activity or rest instead of running.', free: 'Logged: no pain.' },
      err: { area: 'Choose where it hurts.', level: 'Choose the pain level.', consent: 'To save pain details, tick the consent box at the top of this section.', consentCycle: 'To track your cycle, tick the health data consent box.' },
      painGoal: 'You have logged moderate or severe pain for {n} days. If a doctor or physiotherapist confirmed an injury, log it so we can check whether your goal is still realistic.',
      inj: {
        title: 'Confirmed injury', hint: 'If a doctor or physiotherapist confirmed an injury and told you how long to stop running, log it here. You will not run during that time, then a gradual return starts.',
        add: 'Log an injury', label: 'Type of injury (as your specialist said, optional)', labelPh: 'e.g. shin splints',
        start: 'Start date', stop: 'No running until', stopHint: 'As advised by your doctor or physiotherapist', retQ: 'Approximate full return date (optional)',
        save: 'Save injury', saved: 'Injury saved; your plan has been adjusted.',
        dates: 'From {a} · no running until {b}', ret: 'approximate full return {d}', setbacks: 'Pain {n} time(s) during the return (one stage back)',
        cleared: 'My specialist cleared me to run', clearedToast: 'Gradual return starts today.', remove: 'Remove',
        phase: { off: 'No running', return: 'Gradual return', ramp: 'Rebuilding volume' },
        offUntil: 'until {d}', stage: 'stage {a} of {b}', ramp: 'this week about {n}% of your pre-injury volume',
        err: { start: 'Enter a valid start date (today or earlier).', stop: 'The end of the no-running period must be after the start.', ret: 'The full return date cannot be before the end of the no-running period.' }
      },
      impact: {
        title: 'Your goal and race after the injury',
        ok: 'Estimated full return: {d}. There is still time before your race ({r}); the plan continues more lightly.',
        tight: 'Estimated full return: {d}, close to your race ({r}). There is not enough time to fully prepare; probably only to finish, not for a target time.',
        unlikely: 'Estimated full return: {d}, after your race ({r}). Taking part in this race does not look realistic.',
        note: 'The estimate assumes pain-free return stages; it may be sooner or later. The decision is yours.',
        opt: { lighter: 'Continue with a lighter plan (no target time)', date: 'Move the date', secondary: 'Make it a secondary goal', new: 'New goal' },
        done: { lighter: 'Target time removed; the plan continues more lightly.', secondary: 'Previous goal is now secondary; choose a new main goal.' }
      },
      cyc: {
        title: 'Menstrual cycle', off: 'Cycle tracking is off.', enable: 'Turn on cycle tracking',
        lenComputed: 'Your cycle length from your data: about {n} days (from your last {k} cycles).', lenManual: 'Cycle length: {n} days (the number you entered; once you log each start it is calculated from your own data).',
        gap: '{n} days', logQ: 'Start of your period', logBtn: 'Log start', logged: 'Logged; predictions updated.',
        flag: {
          variable: 'The gaps between your periods have varied a lot recently. This is not a diagnosis; if it is new for you, it is worth talking to a doctor.',
          late: 'Your next period is later than predicted. If you forgot to log the start, add it; if it continues, a doctor can help.',
          absent: 'No period start has been logged for over 3 months. If you really have not had a period, it is worth seeing a doctor; in athletes it is sometimes related to nutrition and energy intake.'
        },
        evidence: 'How the cycle affects training differs from person to person, and the evidence is limited and mixed; that is why Gaam only suggests (lightening or moving a hard session) and the decision is yours.'
      },
      wipeTitle: 'Delete health data', wipeText: 'All pain logs, injuries, cycle history and your consent are deleted. The rest of your plan and training stays.',
      wipeBtn: 'Delete all health data', wipeConfirm: 'Are you sure? This cannot be undone.', wipeYes: 'Yes, delete', wiped: 'Health data deleted.'
    },
    race: {
      pageTitle: 'Races and goals',
      mainLabel: 'Main goal',
      noneHint: 'Your weeks, taper and volume are built around the main goal.',
      changeMain: 'Change main goal',
      others: 'Secondary goals',
      othersHint: 'Your main race is the backbone of the plan. A secondary goal (race or time trial) does not replace it: normal training continues, with a mini-taper before and a short recovery after. Its result updates your paces and estimates. To make a goal the main one, drag its handle onto the main goal card or tap "Make main goal".',
      kind: { race: 'Race', test: 'Time trial / test run' },
      source: { self: 'My choice', coach: 'Coach suggestion' },
      kindQ: 'Type of goal', sourceQ: 'Who chose this goal?',
      asTraining: 'As training',
      mini: 'Mini-taper from {d} (about {c}% less volume) · {n} recovery days after',
      miniTrain: 'As training: no taper; only the day before and after have no hard session.',
      issue: {
        taperBlock: 'This date is in the last two weeks before your main race. You are tapering then, so racing or a record attempt is not appropriate; this goal will not be applied to the plan.',
        spacing: 'Only {n} days before your main race; this distance needs about {m} weeks in between for full recovery.',
        keyLong: 'Clashes with your key {km} km long run ({d}); this goal\'s mini-taper or recovery would shorten it.',
        afterMain: '{n} days after your main race; you are still recovering.',
        overlap: 'Only {n} days from "{g}"; the recovery of one overlaps the taper of the other.'
      },
      opt: { move: 'Move to {d}', train: 'As training', keep: 'Keep as is', keepAdd: 'Add anyway', saved: 'Secondary goal updated.' },
      tilesTitle: 'Distance goals', tilesHint: 'For each distance, roughly how long until you are ready at your current level; tap one to see its suggested plan (optional).',
      hills: {
        title: 'Hills and climbing',
        stage0: 'Stage 1 of 3: introduction — short uphill strides and gentle downhills',
        stage1: 'Stage 2 of 3: 2–3 minute climbs and short downhills',
        stage2: 'Stage 3 of 3: long climbs and specific vertical sessions',
        week: 'This week: {v} m of planned climbing (cap {c} m)',
        rules: 'Weekly climbing grows by at most 10% a week, with a lighter week every 4 weeks. No session climbs more than 110% of your biggest session in the last month. Hill sessions never sit next to another hard day, and downhill work grows separately and more slowly.',
        start: 'Starting point: {v} m per week', startEst: 'Starting point: estimated from your current volume',
        edit: 'Change'
      },
      othersEmpty: 'No secondary goals yet.',
      noDateSec: 'No date; does not change your plan',
      dragAria: 'Drag "{g}" onto the main goal',
      dropHint: 'Drop to make it your main goal',
      swapped: 'Plan rebuilt around "{g}".', undo: 'Undo', undone: 'Previous main goal restored.',
      toastAddedMain: 'Set as your main goal; your plan is built around it.', toastAddedSec: 'Secondary goal added.',
      past: 'Done',
      inDays: { one: 'in {n} day', other: 'in {n} days' },
      makeMain: 'Make main goal',
      remove: 'Remove',
      add: 'Add a goal',
      name: 'Race name (optional)',
      namePh: 'e.g. City Half Marathon',
      dist: 'Distance',
      distOther: 'Other distance',
      km: 'Distance ({u})',
      date: 'Race date (optional)',
      addSave: 'Add',
      target: 'Target time (optional)', targetPh: 'e.g. 25:00 or 1:45:00',
      targetHint: 'Race-pace parts are trained toward this goal; all other paces come from your current fitness.',
      targetErr: 'Enter the time as minutes:seconds or hours:minutes:seconds.',
      targetLine: 'Target time: {t}', targetPace: 'pace {p} {pu}', targetSet: 'Set a target time',
      targetHow: 'Daniels method: training paces stay at your current fitness and only race-pace parts move toward the goal (at most two steps ahead). Every 4 to 6 weeks, if easy runs feel easy, we suggest moving up one step.',
      targetSave: 'Save', targetClear: 'Remove target time', targetSaved: 'Target time saved; race pace in your sessions is updated.', targetCleared: 'Target time removed.',
      fromPlan: 'Filled from a suggested plan; you can change anything.',
      err: {
        km: 'Distance must be between {min} and {max} {u}.',
        date: 'Pick a race date from today on.',
        sameMain: 'That day is your main race day.',
        dup: 'Another race is already on that day.'
      },
      toastAdded: 'Race added; the days around it are adjusted.',
      toastRemoved: 'Race removed.',
      toastMain: 'Main goal changed; your plan is rebuilt around it.',
      resultLabel: 'Result:',
      resultAdd: 'Record result',
      resultTime: 'Finish time',
      resultSave: 'Save result',
      resultErr: 'Set the time with the wheels.',
      resultSaved: 'Result saved; new VDOT {v} and your paces are updated.',
      title: 'Race goal',
      none: 'You haven\'t chosen a race goal yet.',
      choose: 'Choose a race goal',
      daysLeft: { one: 'day to go', other: 'days to go' },
      todayBang: 'Today!',
      goodLuck: 'Good luck',
      done: 'Race completed',
      noDate: 'No date',
      addDate: 'Add a date',
      taperStart: 'Taper starts: {d}',
      taperHelp: 'What is a taper?',
      route: 'Course',
      routeHelp: 'How is a trail plan built?',
      ratio: '{r} m of climb per km → ',
      focus: 'Focus: {t}',
      loss: 'Descent: {n} m',
      terrain: 'Main terrain: {t}',
      altitude: 'Altitude: {n} m',
      estTitle: 'Time estimate',
      estHelp: 'How accurate is this estimate?',
      estRough: 'Very rough estimate',
      estNeed: 'Log a time trial to get an estimate.',
      newTest: 'Log a new time trial',
      predTitle: 'Time prediction',
      predHelp: 'How is the prediction calculated?',
      predFor: 'Predicted time for {race}',
      avgPace: 'Average pace: {p} {pu}',
      thDist: 'Distance',
      thTime: 'Predicted time',
      thPace: 'Pace ({pu})',
      predNeed: 'Log a time trial or a recent best time to get a prediction.',
      newTestOrPb: 'Log a time trial or new best time'
    },
    fit: {
      title: 'Fitness and paces',
      help: 'VDOT and time trials',
      entry: { test: 'Time trial', race: 'Race', baseline: 'Baseline best time (at plan creation)', record: 'Best time', step: 'VDOT step' },
      entryLine: '{label}: {d} in',
      weeksAgo: { one: ' · {n} week ago', other: ' · {n} weeks ago' },
      thisWeek: ' · this week',
      none: 'No time trial or best time logged yet.',
      thPace: 'Pace',
      thMinKm: '{pu}',
      thFor: 'Used for',
      rows: {
        E: ['Easy (E)', 'Easy and long runs'],
        M: ['Marathon (M)', 'Marathon pace'],
        HM: ['Half marathon', 'Long intervals'],
        T: ['Threshold (T)', 'Tempo and threshold intervals'],
        K10: ['10 km', 'Medium and long intervals'],
        K5: ['5 km', 'Short intervals'],
        I: ['Interval (I)', 'Short intervals, levels 3–4'],
        R: ['Repetition (R)', 'Speed reps']
      },
      adjusted: 'Easy pace set {n} s slower.',
      fromVdot: 'Easy pace from VDOT.',
      slower: '10 s slower',
      reset: 'Reset to VDOT',
      hr: 'Easy heart rate:',
      hrRange: '{a}–{b}',
      hrUnit: 'bpm',
      hrEst: '(estimated max heart rate: {n})',
      formTitle: 'Log a time trial or new best time',
      formHelp: 'How should I run a time trial?',
      kind: 'Type',
      kinds: { t2: '2 km time trial', t3: '3 km time trial', t5: '5 km time trial', race: 'Race or another distance' },
      km: 'Distance ({u})',
      time: 'Time',
      timeHint: 'Tap the field and set your time on the wheels.',
      date: 'Date',
      submit: 'Save and recalculate paces',
      history: 'Fitness history',
      thDate: 'Date',
      thKind: 'Type',
      thDist: 'Distance',
      thTime: 'Time',
      del: 'Delete',
      hrTitle: 'Heart rate (optional)',
      hrSave: 'Save heart rate',
      err: {
        km: 'Enter a distance between {min} and {max} {u}.',
        time: 'Set your time by turning the hours, minutes and seconds wheels.',
        impossible: 'That time isn\'t possible for {km:d} {u} ({d}); please check it.',
        date: 'The date must be today or earlier.'
      },
      toast: 'VDOT: {vdot} · new easy range: {a} to {b}',
      hrSaved: 'Heart rate saved; your easy heart-rate range is updated.',
      hrCleared: 'Heart rate cleared.'
    },
    hr: {
      intro: 'If you have a watch or heart-rate strap',
      help: 'How is heart rate used?',
      max: 'Approximate max heart rate',
      rest: 'Resting heart rate (in the morning, before getting up)',
      err: {
        max: 'Max heart rate must be between 120 and 230.',
        rest: 'Resting heart rate must be between 30 and 100.',
        gap: 'Resting heart rate must be well below your max heart rate.'
      }
    },
    profile: {
      title: 'My profile',
      warningsTitle: 'Important notes for you',
      editOnb: 'Edit your details (setup form)',
      photoPick: 'Choose photo', photoChange: 'Change photo', photoRemove: 'Remove photo', photoSaved: 'Profile photo saved.',
      photoBad: 'This image can\'t be read; please choose another photo.', photoFull: 'Browser storage is full; the photo wasn\'t saved.',
      rowProgress: 'Charts for mileage, training load, pace and check-ins', rowProgressWalk: 'Charts for weekly minutes, daily steps and check-ins', rowGait: 'Running form analysis from a short video', rowGaitLast: 'Latest analysis: {d} · {s}% within the usual range',
      joined: 'Joined {d}', edit: 'Edit profile', levelLink: 'Suggested plans for your level', levelLinkWalk: 'This week\'s walking plan', goalSetShort: 'No goal set yet',
      groups: { mine: 'My stuff', prefs: 'My preferences' },
      privacy: 'Privacy and support', privacySub: 'Your data stays on this device',
      noName: 'Runner', noNameHint: 'Add your name in {link}.', noNameLink: 'Edit profile',
      tabs: { aria: 'Profile sections', progress: 'Progress', gait: 'Biomechanics' },
      goalOthers: { one: '+{n} more race', other: '+{n} more races' }, goalSet: 'Set a goal →', goalManage: 'Races and results →', levelNum: '{n} of 10', goalIn: { one: '{n} day to go', other: '{n} days to go' }, fitnessSub: 'log a time trial or new result',
      editHint: 'If your level, training volume or circumstances have changed, fill in the form again so the plan updates.',
      cycleLast: 'Last period started: {d}',
      cycleEdit: 'Edit cycle data',
      moreTitle: 'More',
      linkFitness: 'Fitness and time trials',
      detailsTitle: 'Full profile details',
      accountTitle: 'Account and data',
      rows: {
        age: 'Age',
        level: 'Level', exp: 'Running history', structured: 'Structured training', hr: 'Heart rate', fitness: 'Current fitness',
        km: 'Training volume', body: 'Age / weight / height', days: 'Free days', locs: 'Training locations',
        sex: 'Sex', cycle: 'Cycle adaptation', injury: 'Injury / limitation', goal: 'Race goal', pb: 'Best time', start: 'Plan start', stats: 'Stats'
      },
      levelVal: 'Level {n} of 10: {name}',
      structYes: 'Done before',
      structNo: 'Not yet',
      hrVal: 'Easy: {a}–{b} bpm',
      notEntered: 'Not entered',
      details: 'Details and update',
      registerTest: 'Log a time trial',
      kmVal: '{n:d} {u} per week',
      kmVal2: 'Last week {last:d} · monthly average {avg:d} · plan starts at {start:d} {u}',
      bodyVal: '{age} years · {w} kg · {h} cm',
      notRecorded: 'Not recorded',
      noDate: '(no date)',
      noGoal: 'No specific goal',
      pbVal: '{d} in',
      statsVal: '{c} check-ins · {d} sessions done',
      edit: 'Edit profile',
      restart: 'Restart the plan from this week',
      wipe: 'Delete all data',
      confirmYes: 'Yes, do it',
      restartQ: 'Restart the plan from week 1 (at your base volume)? Your check-ins are kept.',
      restartToast: 'The plan has restarted from today.',
      wipeQ: 'Delete all Gaam data on this device? Profile, plan, check-ins, workouts, health data, running form reports, photo, the set-aside profile and settings. This can\'t be undone; if you may need them later, save a backup first.'
    },

    tpick: { h: 'hours', m: 'min', s: 'sec', ih: '{n}h', im: '{n}m', is: '{n}s', choose: 'Choose time', done: 'Done' },

    // ---------- Install the app (PWA) ----------
    install: {
      title: 'Install the app',
      bannerTitle: 'Install Gaam on your phone',
      bannerText: 'It opens from your home screen like a real app, loads faster and works offline.',
      btn: 'Install app', how: 'How do I install on iPhone?', dismiss: 'Close', done: 'The app is installed.',
      short: { installed: 'Installed', prompt: 'Ready to install', ios: 'Install via Safari', other: 'From the browser menu' },
      status: {
        installed: 'The app is installed on this device and is open in app mode.',
        prompt: 'You can install the app on this device right now.',
        ios: 'iPhone doesn\'t support automatic install; it takes a few taps in Safari to add it to your home screen.',
        other: 'This browser hasn\'t offered us a direct install button.'
      },
      otherHelp: 'In Chrome or Edge on Android or a computer, open the browser menu (three dots) and choose "Install app" or "Add to Home screen". If the app is already installed, the option won\'t appear.',
      offline: 'Once installed, the app opens without internet too.',
      iosTitle: 'Install on iPhone',
      iosStep1: 'In <b>Safari</b>, tap the <b>Share</b> button (a square with an up arrow) in the bottom bar.',
      iosStep2: 'Scroll down the list and choose <b>Add to Home Screen</b>.',
      iosAdd: 'Add',
      iosStep3: 'Tap <b>Add</b> at the top. The "Gaam" icon appears on your home screen.',
      iosNote: 'If you opened this page in another browser, open the link in Safari first.',
      close: 'Got it'
    },

    // ---------- Settings page ----------
    settingsPage: {
      account: 'My account',
      title: 'Settings',
      lang: 'Language and units', cal: 'Calendar', health: 'Menstrual cycle', person: 'Personal details', data: 'Data',
      cycleOn: 'Cycle adaptation is on', cycleOff: 'Cycle adaptation is off', cycleNA: 'Only for female users',
      cycleHint: 'Menstrual cycle settings become available when "female" is selected as sex in the setup form.',
      personSub: '{age} years old, level {n}',
      dangerTitle: 'Delete all data', dangerText: 'Everything is removed from this device: profile, plan, check-ins, workouts and results, health data (pain, injury, cycle), running form reports, profile photo, the set-aside profile and settings. Gaam has no server, so no other copy remains. This can\'t be undone.',
      wipeAck: 'I understand this can\'t be undone.'
    },

    // ---------- Bottom navigation and home page ----------
    // Apple Health / Health Connect ({name}); native app only
    sync: {
      title: 'Connect {name}',
      subOn: 'Connected; watch and phone workouts are logged automatically',
      subOff: 'Mark sessions done from your watch or phone',
      intro: 'Runs and walks your watch or phone recorded in {name} mark that day\'s planned session as done, with the real distance, time and start time. Gaam only reads workouts, never writes to {name}, and no data leaves your phone.',
      rules: 'Only workouts of 10 minutes or more, only on days with a session, and only the last 14 days. If you untick “done”, that workout isn\'t logged again.',
      connect: 'Connect {name}',
      now: 'Sync now',
      off: 'Disconnect',
      settings: 'Manage permissions',
      last: 'Last sync: {t}',
      never: 'Not synced yet',
      iosNote: 'Permissions are in iPhone Settings → Health → Data Access & Devices → Gaam. Without permission, no workouts are found.',
      offDone: 'Disconnected. To fully revoke access, use the {name} settings.',
      notAvail: '{name} isn\'t available on this phone. On Android 13 and older, install the Health Connect app from Google Play.',
      denied: 'Permission to read workouts wasn\'t granted.',
      err: 'Sync failed. Try again.',
      added: { one: '{n} workout logged from {name}', other: '{n} workouts logged from {name}' },
      none: 'No new workouts found',
      from: 'from {name}'
    },

    backup: {
      title: 'Backup and transfer',
      hint: 'All your data (profile, plan, check-ins, workouts, health data, running form reports, photo and settings) in one file. Use it to move your data to another phone or browser, or to the next version of the app. The file contains health data; keep it somewhere safe and don\'t send it to anyone.',
      export: 'Save a backup file', import: 'Restore from file',
      exported: 'Backup file created.',
      summary: '{n}, backup of {d}: {c} check-ins and {s} completed sessions',
      importQ: 'The data on this device will be replaced with this file: {s}.',
      importAck: 'I understand the current data on this device will be replaced.',
      importYes: 'Restore', imported: 'Your data was restored from the backup file.',
      bad: 'This isn\'t a Gaam backup file, or it\'s damaged.', big: 'This file is too large for a Gaam backup.',
      newer: 'This file was made by a newer version of Gaam; update the app first.',
      saveFailed: 'This browser doesn\'t have enough storage for this file.',
      loginLink: 'Already have data? Restore from a backup file'
    },
    jdate: { day: 'Day', month: 'Month', year: 'Year' },
    tabs: { aria: 'Main sections', home: 'Today', plan: 'Plan', progress: 'Progress', learn: 'Learn', profile: 'Profile' },
    home: {
      date: '{day} {date}',
      startsOn: 'Your plan starts on {d}.',
      nextSession: 'Next session: {day} {date}, {s}, {t}',
      greet: { morning: 'Good morning', day: 'Good afternoon', evening: 'Good evening' },
      todayTitle: 'Today\'s session', done: 'Done', adjusted: 'Adjusted',
      cancelled: 'Don\'t train today because of pain.',
      withWarmup: '(with about {n} min of warm-up)',
      startCheckin: 'Start check-in', checkinHint: 'Before you train; under a minute.', preview: 'Preview session',
      sessionDetails: 'Session details',
      ci: { title: 'Today\'s check-in', done: 'Logged', edit: 'View or edit', todo: 'Not logged yet. It takes less than a minute and tunes today\'s session to how you feel.',
        afterRun: 'Today\'s session is done; no check-in needed.', rest: 'Rest day today; the check-in is optional.', optional: 'Log a check-in' },
      details: 'View details', weekPlan: 'This week\'s plan', minutes: '{n} min', more: 'More',
      smartTitle: 'Coach message',
      whyMore: 'Why? And the effect on your week and goal',
      ready: {
        title: 'Readiness',
        fresh: 'You\'re ready today', ok: 'Well balanced; go ahead as planned', tired: 'Fatigue has built up; take today easy',
        recover: 'Your body needs recovery', pain: { _: 'You reported pain; today\'s plan was adjusted', mild: 'Mild pain; lighter today, no hard training', moderate: 'Moderate pain; no running today', severe: 'Severe pain; don\'t train today and see a doctor or physio' },
        fromCheckin: 'Based on today\'s check-in and the days before.',
        noData: 'As you log sessions and daily check-ins, your readiness will show up here.'
      },
      prog: {
        title: 'This week', lastWeek: 'No sessions logged this week yet; last week:', none: 'Once you mark your first session as done, your weekly stats will appear here.',
        km: '{n:d} {u} run', runs: { one: '{n} session', other: '{n} sessions' }, prev: 'last week {n:d} {u}', vdot: 'New result: VDOT went from {a} to {b}.'
      },
      race: { title: 'Race countdown', days: 'days to the {race}', today: 'It\'s race day!', taper: 'taper starts in {n} days' }
    },

    // ---------- My progress (charts) ----------
    progress: {
      title: 'My progress',
      intro: 'Every chart is built from your own data: the sessions you marked done, your daily check-ins, the RPE you logged after runs, and your race results and time trials.',
      rangeAria: 'Chart time range',
      r4w: 'Last 4 weeks', r3m: 'Last 3 months', rAll: 'From the start',
      table: 'Show data table',
      date: 'Date', week: 'Week',
      weekOf: 'Week of {d}',
      partialTag: 'in progress',
      sep: ' · ',
      volW: {
        title: 'Weekly walking minutes', desc: 'Total minutes of completed sessions each week, with a 4-week average and the recommended 150-minute line.',
        bars: 'Minutes per week', unit: 'min', val: '{n} min', who: 'WHO guideline', empty: 'Fills in as you log your walks'
      },
      steps: {
        title: 'Daily steps', desc: 'Steps you logged each day (or a walk session\'s steps), with your step target line.',
        bars: 'Steps per day', unit: 'thousand steps', val: '{n} steps', avg: 'Daily average', target: 'Step target',
        hit: 'Target hit on {n} of {d} days', empty: 'Log steps in the box at the top'
      },
      vol: {
        title: 'Weekly volume', desc: 'Distance from completed sessions each week, with a 4-week moving average.',
        bars: 'Weekly {u}', ma: '4-week average', thisWeek: 'This week (so far)', avg4: '4-week average', trend: 'Trend',
        up: 'Rising', down: 'Falling', flat: 'Steady', unit: '{u}', val: '{n} {u}',
        empty: 'Fills in as you log runs'
      },
      pmc: {
        title: 'Fitness and fatigue', desc: 'The standard CTL / ATL / TSB model. Each session\'s load = duration (minutes) × perceived effort (RPE).',
        ctl: 'Fitness (CTL)', atl: 'Fatigue (ATL)', tsb: 'Form (TSB)',
        ctlDesc: 'Weighted average of training load over the last 42 days; long-term fitness.',
        atlDesc: 'Weighted average of load over the last 7 days; short-term fatigue.',
        tsbDesc: 'Fitness minus fatigue; positive means you\'re fresh, negative means fatigue has built up.',
        fresh: 'Fresh and ready', neutral: 'Balanced', tired: 'Fatigue building', veryTired: 'Heavy fatigue; take recovery seriously',
        load: 'Session load', unit: 'load',
        empty: 'Fills in as you log runs'
      },
      pace: {
        title: 'Pace improvement', desc: 'Easy, tempo and interval paces from the VDOT of each race result or time trial. Higher on the chart = faster.',
        e: 'Easy', t: 'Tempo', i: 'Interval', vdot: 'VDOT', unit: '{pu}', faster: '↑ faster',
        diffFaster: '{n} s faster', diffSlower: '{n} s slower', diffSame: 'No change', newTest: 'New result or time trial',
        empty: 'Fills in with a race result or time trial'
      },
      checkins: {
        title: 'Check-in trends', desc: 'Fatigue and sleep quality (1–5) and the days you reported pain; useful for spotting recurring patterns.',
        fatigue: 'Fatigue', sleep: 'Sleep quality', pain: 'Pain', painYes: 'Pain reported',
        avgF: 'Average fatigue', avgS: 'Average sleep', painDays: 'Pain days', of5: '{n} of 5',
        weeklyAvg: 'weekly average', painN: { one: '{n} pain day', other: '{n} pain days' },
        empty: 'Fills in with daily check-ins'
      },
      pred: {
        title: '{race} prediction trend', desc: 'Each week\'s prediction from your latest result or time trial up to that week. Higher on the chart = faster.',
        riegel: 'Riegel formula', vdot: 'VDOT tables', now: 'Current prediction (Riegel)', delta: 'Change in this range',
        better: '{t} faster', worse: '{t} slower', same: 'No change',
        empty: 'Fills in with a race result or time trial'
      },
      vert: {
        title: 'Weekly climbing', desc: 'Metres of ascent from completed sessions each week, with a 4-week moving average.',
        bars: 'Weekly ascent', ma: '4-week average', unit: 'm', val: '{n} m', thisWeek: 'This week (so far)', avg4: '4-week average',
        empty: 'Fills in as you log runs'
      },
      tod: {
        title: 'Morning or evening?',
        desc: 'Easy and long runs with a start time recorded in "Mark as done", grouped by time of day (all time).',
        slot: { morning: 'Mornings', afternoon: 'Afternoons', evening: 'Evenings' },
        slotS: { morning: 'mornings', afternoon: 'afternoons', evening: 'evenings' },
        range: { morning: 'before 12:00', afternoon: '12:00 to 17:00', evening: 'from 17:00' },
        empty: 'To compare, log the start time of at least {n} easy or long runs in two parts of the day (in "I did it").',
        better: 'You run better in the {best} than in the {next}.',
        same: 'No meaningful difference between {a} and {b}; run whenever suits you.',
        paceDiff: 'your easy pace is {n} s per {u} faster on average',
        rpeDiff: 'with lower perceived effort ({a} vs {b} out of 10)',
        runs: { one: '{n} run', other: '{n} runs' },
        pace: 'pace {p}',
        rpe: 'effort {n}',
        note: 'This is only a correlation: weather, sleep, food and weekly fatigue also affect pace. The more runs you record, the more reliable it gets.'
      },
      adh: {
        title: 'Plan adherence', desc: 'Of the sessions planned in this range (up to today), how many you actually did.',
        rate: 'completed', of: '{n} of {total} sessions', count: { one: '{n} session ({p}%)', other: '{n} sessions ({p}%)' }, pct: '{n}%',
        completed: 'As planned', adapted: 'Adapted (fatigue, sleep or cycle)', pain: 'Cancelled for pain', missed: 'Not done',
        empty: 'No past sessions yet'
      }
    },

    // ---------- Guide page (HTML content) ----------
    guide: {
      title: 'Guide',
      tocAria: 'Guide contents',
      levelOf: 'Level {ns}:',
      levelJoin: ' and ',
      focus: {
        speed: 'VO2max and speed: short intervals (400–800 m at 5 km pace), medium intervals (1000–1600 m), speed fartlek (1-1 or pyramid) and short hills.',
        half: 'A mix of VO2max and threshold: threshold intervals (3–4 × 8–10 min), long intervals (1600–2000 m) and continuous tempo (20–40 min).',
        marathon: 'Threshold and specific endurance: long tempo (30–50 min), marathon-pace intervals (3–5 km), long runs with a marathon-pace finish and long fartlek.',
        ultra: 'Time on feet, climbing and accumulated fatigue: long hills, downhill practice, long runs with a climbing target, and back-to-back runs (from level 5 with enough base). Intensity by RPE and time, not pace.',
        general: 'Without a specific goal, sessions rotate between short intervals, tempo, fartlek, hills and threshold work, so different energy systems are trained and training never gets monotonous.'
      },
      sections: {
        start: {
          title: 'Quick start: what do I do each day?',
          body: '<ol><li><b>Check in before training</b>: fatigue, sleep and pain. If needed, today\'s session automatically becomes lighter or is cancelled.</li>' +
            '<li>See <b>today\'s session</b> on the plan page and run it.</li>' +
            '<li>Then tap <b>"I did it"</b>. After an easy run, two quick questions (effort and pace feel) fine-tune your easy pace.</li>' +
            '<li>Log a <b>time trial</b> every 4–6 weeks so your paces keep matching your current fitness.</li></ol>' +
            '<p>Next to some headings there is a <span class="help-link" aria-hidden="true">?</span>; tap it to jump straight to the explanation of that section.</p>'
        },
        levels: {
          title: 'The 10-level system',
          body: '<p>We calculate your level (1 to 10) for you; you don\'t pick it:</p>' +
            '<ul><li><b>If you entered a best time:</b> we compute your VDOT (Jack Daniels\' fitness index) from it and read your level from a table of reference marathon times. A best time takes priority because it shows your real fitness.</li>' +
            '<li><b>Without a best time:</b> from your current weekly mileage, then capped by your running history. If you haven\'t done structured training (intervals/tempo) yet, the level is at most 4.</li>' +
            '<li>If your best time is much faster than your current mileage suggests, volume increases more cautiously.</li>' +
            '<li>Your level sets the <b>type and complexity of sessions</b>; weekly volume starts from your real current mileage.</li>' +
            '<li><b>Level 0 (complete beginner):</b> if you\'ve never run regularly, choose "I\'ve never run". The plan starts with brisk walking and very short running bits that slowly get longer. At the end of each week you say how it went: "easy" moves you up two stages, "about right" one stage, and "hard" repeats the stage. Most people reach 15 minutes of continuous running, and level 1, within 4 to 8 weeks.</li></ul>' +
            '<div class="table-wrap"><table class="pred-table"><thead><tr><th>Level</th><th>Name</th><th>Typical volume (km/week)</th><th>Group</th></tr></thead><tbody>{levelRows}</tbody></table></div>' +
            '<h3>Sessions in each group</h3><ul>{tiers}</ul>' +
            '<p>After you log a new time trial, if your fitness now matches a different level, you\'ll see a suggestion to change level; it only changes when you confirm.</p>'
        },
        week: {
          title: 'The weekly plan and its rules',
          body: '<ul><li><b>The first week</b> matches your current volume. If you start mid-week, the first week only covers the remaining days (the "starter week").</li>' +
            '<li><b>The 10% rule:</b> from week two, each week\'s volume is at most 10% above the previous week, up to a ceiling suited to your level.</li>' +
            '<li><b>Easy week:</b> every fourth week the volume drops so your body can absorb the training.</li>' +
            '<li><b>80/20:</b> about 80% of volume is easy and at most 20% is hard (from level 3 up).</li>' +
            '<li><b>48 hours:</b> there is at least one easy or rest day between two hard sessions; never two hard days in a row (except ultra back-to-back runs).</li>' +
            '<li><b>Quality early in the week:</b> hard sessions fall early in the week, the long run at the weekend.</li>' +
            '<li><b>Periodisation (level 7 and up):</b> base phase (volume and threshold), build (intervals and goal-specific work), peak (close to the race, race-pace work).</li></ul>' +
            '<h3>Phase names</h3><ul><li><b>First week / Holding volume:</b> volume stays the same.</li><li><b>Building volume:</b> growth of up to 10%.</li><li><b>Easy week:</b> planned recovery.</li>' +
            '<li><b>Taper:</b> reduced volume before a race.</li><li><b>Post-race return:</b> starts at 70% volume and grows 10% each week.</li></ul>'
        },
        sessions: {
          title: 'Session types',
          body: '<dl class="glossary">' +
            '<dt>Walk & light jog</dt><dd>For level 0: mostly brisk walking with short bits of very gentle running.</dd>' +
            '<dt>Easy run</dt><dd>Easy running at a pace where you can talk comfortably. The foundation of every plan.</dd>' +
            '<dt>Run-walk</dt><dd>Alternating running and walking, for starting from zero.</dd>' +
            '<dt>Long run</dt><dd>The longest run of the week, at an easy effort. Because of its volume load it counts as a hard day. Sometimes with a tempo or marathon-pace finish.</dd>' +
            '<dt>Tempo</dt><dd>Continuous running at threshold pace (T): "hard but controlled".</dd>' +
            '<dt>Threshold intervals</dt><dd>Several 5–10 minute pieces at T pace with short rests.</dd>' +
            '<dt>Short / medium / long intervals</dt><dd>Reps of 400–800 m (5 km pace), 1000–1600 m (5–10 km pace) and 1600–2000 m (10 km to half-marathon pace).</dd>' +
            '<dt>Fartlek</dt><dd>Changes of speed within one continuous run; recovery is easy running and you never stop. Types: 1-1 (1 min fast, 1 min easy), pyramid (1-2-3-4-3-2-1), <b>Mona</b> for level 6 and up (2×90, 4×60, 4×30, 4×15 s with an equal "float"; 20 minutes), and <b>free, landmark-based</b> (6 to 10 surges of 15 s to 2 min to landmarks such as lamp posts).</dd>' +
            '<dt>Intervals vs fartlek</dt><dd>Intervals have a precise structure and fuller rests between reps; a fartlek is continuous.</dd>' +
            '<dt>Session-specific warm-up</dt><dd>Every session has its own warm-up: easy and long runs just start slowly; tempo gets 10–15 min of building running + dynamic moves + 3–4 strides; intervals and speed get a fuller warm-up with activation drills and 4–6 strides; hills emphasise leg and glute activation. Lower levels get simpler, more gradual warm-ups; higher levels more compact ones with more drills.</dd>' +
            '<dt>Hills</dt><dd>Short uphill reps (power and speed) or long ones (strength endurance). Easy on the way down.</dd>' +
            '<dt>Downhill practice</dt><dd>Controlled descents to prepare your quads for mountain courses.</dd>' +
            '<dt>Steady</dt><dd>Continuous running a little faster than easy.</dd>' +
            '<dt>Repetitions (R)</dt><dd>Short, fast 200–400 m reps with full recovery; for form and speed.</dd>' +
            '<dt>Marathon pace (MP)</dt><dd>Multi-kilometre pieces at your goal marathon pace.</dd>' +
            '<dt>Strides</dt><dd>4–6 accelerations of 20 seconds after an easy run; fast but relaxed.</dd>' +
            '<dt>Back-to-back runs (B2B)</dt><dd>For ultras, from level 5 with enough base: longer on Thursday, shorter on Friday on tired legs. Simulates late-race fatigue.</dd>' +
            '<dt>Warm-up and cool-down</dt><dd>A few easy kilometres before and after hard sessions. They count towards your weekly volume.</dd></dl>'
        },
        intensity: {
          title: 'Intensity: pace, perceived effort and heart rate',
          body: '<ul><li><b>Easy pace is a range, not a single number:</b> its centre is about 70% of VDOT. The faster end is for good days, the slower end for heat, fatigue or poor sleep.</li>' +
            '<li><b>The talk test matters more than pace:</b> if you can\'t talk comfortably, slow down, even below the range.</li>' +
            '<li><b>Perceived effort (RPE) from 1 to 10:</b> easy 3–4, tempo and threshold 6–7, intervals 8–9. On trails and ultras, intensity is judged by RPE and time, not pace.</li>' +
            '<li><b>Heart rate (optional):</b> if you enter your max and resting heart rate, the easy range = 60–75% of heart-rate reserve (Karvonen formula). Without a resting value, 65–78% of max. If you don\'t know your max, it\'s estimated from your age.</li>' +
            '<li>Measure your resting heart rate in the morning, before getting up.</li></ul>'
        },
        fitness: {
          title: 'Fitness and time trials',
          body: '<ul><li><b>VDOT</b> is a number calculated from a best time or time trial; all training paces come from it.</li>' +
            '<li><b>The latest result counts, not the best</b>, because your pace should match your fitness today.</li>' +
            '<li><b>When should I test?</b> Every 4–6 weeks, or after a break, an injury or a change of season. After 6 weeks you\'ll see a reminder.</li>' +
            '<li>A new test recalculates all paces (including easy) and resets any manual "slower" adjustment.</li>' +
            '<li>If several easy runs in a row don\'t feel easy at the planned pace, you\'ll get a suggestion to slow your easy pace (10 s at a time, up to 30 s) or to test again.</li></ul>' +
            '<h3>How do I run a time trial?</h3><ol>' +
            '<li>15 min easy running + 4 strides to warm up.</li><li>2, 3 or 5 km on a flat route or track, at the hardest effort you can hold evenly to the end.</li>' +
            '<li>On a day you feel fresh (not after a hard session or poor sleep) and it isn\'t too hot.</li><li>10 min cool-down. If you feel pain, stop the test.</li></ol>' +
            '<h3>The pace table</h3><ul><li><b>E easy:</b> easy and long runs.</li><li><b>M marathon:</b> marathon-pace pieces.</li><li><b>T threshold:</b> tempo and threshold intervals.</li>' +
            '<li><b>10 km and 5 km pace:</b> medium and short intervals.</li><li><b>I:</b> short intervals at levels 3–4.</li><li><b>R repetition:</b> short speed reps.</li></ul>'
        },
        checkin: {
          title: 'Check-in and automatic adjustment',
          body: '<p>Adjustments are graded and also take your last few check-ins into account (several tired days in a row are treated more seriously than one random tired day):</p>' +
            '<ul><li><b>Light</b> (fatigue 3 or one poor night): the same session with less volume or fewer reps.</li>' +
            '<li><b>Moderate</b> (fatigue 4, two poor nights, or fatigue 3 over several days): a lighter version of the same session with more rest; if several factors stack up, a mild tempo.</li>' +
            '<li><b>Major</b> (fatigue 5, very poor sleep several nights running, or high fatigue over several days): a short easy run or active rest.</li>' +
            '<li>Every adjustment shows its reason (cause, meaning, risk), the decision, its effect on your week and goal, and a weekly summary. If a hard session was lightened and you feel good later that week, a small optional add-on is suggested to make up part of it; close to a race no make-up is needed, and that\'s said plainly.</li>' +
            '<li>Sleep hours in the check-in are optional; under 6 hours counts as poor sleep.</li>' +
            '<li><b>Pain</b> → today\'s session is cancelled and the message "{pain}" is shown, which only closes when you confirm it.</li>' +
            '<li>On race day the session doesn\'t change; you just get a reminder to aim to "finish feeling good".</li>' +
            '<li>After an easy run: if the effort was above 6 or the pace felt hard, you\'ll see a suggestion to slow your easy pace.</li></ul>'
        },
        goals: {
          title: 'Race goal',
          body: '<h3>Focus of the hard sessions</h3><ul>' +
            '<li><b>5 and 10 km:</b> {speed}</li><li><b>Half marathon:</b> {half}</li>' +
            '<li><b>Marathon:</b> {marathon}</li><li><b>Ultra and trail:</b> {ultra}</li>' +
            '<li><b>No goal:</b> {general}</li></ul>' +
            '<h3>Ultra and trail: course steepness</h3><p>Metres of climb ÷ kilometres shows how mountainous a course is, and the training focus changes with it:</p><ul>{ultraRows}</ul>' +
            '<p>If the descent is much larger than the climb, downhill practice gets more weight. Back-to-back runs only from level 5 with enough base.</p>' +
            '<h3>Taper</h3><p>Before the race the volume drops so you reach the start line fresh: 1 week for 5 and 10 km, 2 weeks for the half marathon, marathon and ultras. Some intensity is kept but the volume comes down. Without a race date, sessions are goal-specific but there is no taper.</p>' +
            '<h3>After the race</h3><p>Volume restarts at 70% and grows 10% each week until you\'re back to normal.</p>' +
            '<h3>Time prediction</h3><p>Calculated with the Riegel formula from your latest test or best time. When the target distance is much longer than the test distance, or you haven\'t done enough endurance training, the real time is usually slower. For ultras, every 100 m of climb counts as 1 km and a terrain factor is added, so it\'s only a very rough estimate.</p>'
        },
        cycle: {
          title: 'Adapting to your menstrual cycle',
          body: '<ul><li>Completely optional: only if you choose "Woman" in the form and turn it on yourself. Switch it off any time in Profile → Settings.</li>' +
            '<li>From the first day of your last period, your cycle length and period length, each day\'s phase is estimated: <b>period days</b>, the <b>follicular phase</b> (after your period until around ovulation; often more energy), <b>around ovulation</b> (about 14 days before the next period), the <b>luteal phase</b> and the <b>days before your period</b> (you may feel more tired).</li>' +
            '<li>The plan <b>never changes on its own</b>. If you have a hard session on period days or just before your period, we ask whether to make it lighter, switch to active rest (period days) or keep the original plan.</li>' +
            '<li>The dashboard shows when your next period is expected and reminds you a few days ahead. If it starts earlier or later, the "My period started today" button makes the estimates more accurate.</li>' +
            '<li>Small markers on the calendar show the phases and can be switched off in Settings.</li></ul>'
        },
        places: { title: 'Training location tips', body: '<ul>{tips}</ul>' },
        data: {
          title: 'Data and privacy',
          body: '<ul><li>All your information is stored only in this browser and is never sent to any server.</li>' +
            '<li>If you clear your browser data or switch devices, the information is lost, unless you save a backup file in “Profile → Settings → Data” and restore it on the new device.</li>' +
            '<li>Change the language any time with the button at the top of the page; your choice is remembered in this browser.</li>' +
            '<li>Change the calendar (Solar Hijri or Gregorian) and the first day of the week in Profile → Calendar settings, independently of the language.</li>' +
            '<li>This plan is built from fixed training rules, not AI, and doesn\'t replace a doctor or a coach.</li></ul>'
        }
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = d;
  else root.CoachI18n.register('en', d);
})(this);
