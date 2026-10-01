/* English translation — every fixed string of the dashboard and the plan engine */
(function (root) {
  var d = {
    // ================= Plan engine (logic.js) =================
    days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    daysShort: ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'],
    dur: { h: '{n} h', m: '{n} min', s: '{n} s', join: ' ' },

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
      dropTemp: 'Your last week ({last} km) was much lower than your monthly average ({avg} km) because of {reason}. Since this drop is temporary and your fitness is intact, your level is based on the monthly average. The plan starts at {start} km and returns to {avg} km within a few weeks (10% rule).',
      dropHealth: 'Your last week ({last} km) was much lower than your monthly average ({avg} km) because of {reason}. Your level is set cautiously from the weighted average ({w} km). The plan starts at {start} km and builds back gradually (at most 10% a week) to {avg} km.',
      dropReal: 'Your last week ({last} km) was much lower than your monthly average ({avg} km) for no particular reason, so your volume has genuinely dropped. Your level is based on the weighted average ({w} km) and the plan starts at {start} km.',
      rise: 'Your last week ({last} km) was much higher than your monthly average ({avg} km). Your level and starting volume are based on the weighted average ({w} km), so one unusual week doesn\'t make the plan too heavy.'
    },
    volReason: { injury: 'an injury', illness: 'illness', travel: 'travel', other: 'a temporary reason' },

    raceLabels: { 5: '5 km', 10: '10 km', 21: 'Half marathon (21.1 km)', 42: 'Marathon (42.2 km)' },
    goalTypes: { none: 'No specific goal', 5: '5 km', 10: '10 km', 21: 'Half marathon', 42: 'Marathon', ultra: 'Ultra & trail' },
    goalUltra: 'Ultra/trail {km} km, {gain} m climb',
    terrain: { technical: 'Technical mountain', trail: 'Easy trail', gravel: 'Gravel road', mixed: 'Mixed' },
    ultraClass: {
      flat: { label: 'Mostly flat (under 15 m of climb per km)', short: 'Mostly flat', emphasis: 'Aerobic endurance and steady-pace running; less hill work' },
      rolling: { label: 'Rolling (15–35 m per km)', short: 'Rolling', emphasis: 'A balanced mix of steady endurance and hill work' },
      hilly: { label: 'Hilly / mountainous (35–60 m per km)', short: 'Hilly / mountainous', emphasis: 'Long hills and leg strength first, plus downhill practice' },
      mountain: { label: 'Steep mountain (over 60 m per km)', short: 'Steep mountain', emphasis: 'Most focus on hills, power hiking, downhills and strength' }
    },
    types: {
      rest: 'Rest', walkrun: 'Walk & light jog', easy: 'Easy run', runwalk: 'Easy run (run-walk)', tempo: 'Tempo', interval: 'Intervals',
      reps: 'Speed reps', fartlek: 'Fartlek', hills: 'Hills', long: 'Long run', race: 'Race day', cancelled: 'Cancelled', none: 'Before start'
    },
    periods: { base: 'Base phase', build: 'Build phase', peak: 'Peak phase' },
    phase: {
      intro: 'Starter week', before: 'Before the plan starts', race: 'Race week', recovery: 'Post-race recovery',
      return: 'Post-race return', taper: 'Taper', deload: 'Easy week', first: 'First week', maintain: 'Holding volume', build: 'Building volume'
    },

    pace: { range: '{a}–{b} min/km' },
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

    // ---------- Session builders ----------
    rpe: {
      easy: 'Effort: easy (RPE 3–4 out of 10).',
      long: 'Effort: easy and steady (RPE 4 out of 10).',
      tempo: 'Effort: hard but controlled (RPE 7 out of 10).',
      interval: 'Effort: hard (RPE 8 out of 10), all reps even.',
      reps: 'Effort: fast and relaxed (RPE 8 out of 10), full recovery.'
    },
    guideLine: { pace: ' Pace: {p}.', hr: ' Heart rate: {a}–{b}.' },
    paceHint: { one: ' {label}: {a} min/km.', two: ' {label}: {a}–{b} min/km.' },
    lbl: {
      pace: 'Pace', paceT: 'T pace', paceI: 'I pace', paceReps: 'Rep pace', paceR: 'R pace', paceFast: 'Pace for the fast parts',
      pace5k: '5 km pace', paceFastParts: 'Pace for the fast sections', paceMarathon: 'Marathon pace', paceTempoPart: 'Tempo section pace'
    },
    s: {
      km: '{n} km',
      min: '{n} min',
      wuKm: '{km} km easy warm-up',
      wuMin: '10 min easy running',
      wuStrides: ' + 4 short 20-second accelerations',
      cdKm: '{km} km easy cool-down',
      runwalk: {
        warm: '5 min brisk walk to warm up',
        main: '{reps} times: {run} min very easy running + {walk} min walking',
        cool: '5 min easy walk to cool down',
        how: 'Run slowly enough that you never gasp for breath; if it gets hard, walk longer.'
      },
      easy: '{km} km continuous easy running',
      double: { variant: 'double day', target: '{am} + {pm} km', am: 'Morning: {n} km easy running', pm: 'Evening: {n} km easy running', how: ' Leave at least 6 hours between the two runs.' },
      strides: 'Finish with 6 × 20 s fast, relaxed and controlled strides, full recovery between each',
      hillSprints: 'Finish with 8 × 10 s uphill sprints (steep slope), 2 min full recovery',
      strength: '+ 30–40 min strength and plyometrics (squats, light deadlifts, lunges, short jumps)',
      tempo: {
        mildMain: '{a} km at tempo rhythm, 2 min jog, {b} km at tempo rhythm',
        main: '{km} km continuous at threshold pace (T)',
        mildHow: 'Effort: a little slower than a full tempo (RPE 6–7 out of 10).',
        vMild: 'gentle', vT: 'threshold, T'
      },
      cruise: { variant: 'cruise intervals, T', main: '{reps} × 1.6 km at threshold pace (T), 1 min rest between reps' },
      interval: {
        restShort: '2–3 min walking or very easy jogging',
        restDaniels: 'easy jog for as long as the rep',
        rest90: '90 s easy jog',
        rest23: '2–3 min easy jog',
        rest3: '3 min easy jog',
        warmKm: '{km} km warm-up + ',
        warmMin: '10 min easy running + ',
        strides4: '4 short 20-second accelerations',
        main: '{reps} × {rep} m, {rest} between reps',
        shortHow: 'Effort: fast but controlled (RPE 7–8 out of 10), not all-out.',
        vShort: 'short', vI: 'VO2max, I'
      },
      reps: {
        variant: 'R pace',
        warm: '{km} km warm-up + 4 short accelerations',
        main: '{reps} × {rep} m at R pace, {rep} m easy jog between reps (full recovery)'
      },
      fartlek: { main: '{reps} times: 2 min fast (10 km rhythm) + 2 min easy running', how: 'Effort in the fast parts: RPE 7–8 out of 10.' },
      shortInt: { variant: 'short, 5 km pace', main: '{reps} × {rep} m at 5 km pace; rest: easy jog as long as the rep or a bit longer' },
      midInt: { variant: 'medium, 5–10 km pace', main: '{reps} × {rep} m at a pace between 5 km and 10 km; 2–3 min easy jog between reps' },
      speedFartlek: {
        pyramid: 'Pyramid: 1-2-3-4-3-2-1 min fast, 1 min easy between each',
        pyramidShort: 'Short pyramid: 1-2-3-2-1 min fast, 1 min easy between each',
        vPyramid: 'pyramid',
        oneone: '{n} times: 1 min fast + 1 min easy',
        vOneone: '1-1 speed'
      },
      shortHills: { variant: 'short hills', main: '{reps} × about 100 m fast up a short hill (6–10% grade); walk back down', how: 'Effort: fast and powerful (RPE 8–9 out of 10).' },
      thresholdInt: { variant: 'threshold intervals', main: '{reps} × {min} min at threshold pace; 90 s to 2 min easy jog between reps' },
      longInt: { variant: 'long', main: '{reps} × {rep} m at a pace between 10 km and half marathon; 2–3 min jog between reps', how: 'Effort: hard but sustainable (RPE 7–8 out of 10).' },
      tempoRun: { variant: 'continuous', main: '{min} min continuous at threshold pace (a pace you could hold for about an hour)' },
      longTempo: { variant: 'long continuous', main: '{min} min continuous at threshold pace or slightly slower', how: 'Effort: RPE 6–7 out of 10, no fading to the end.' },
      mpInt: { variant: 'marathon-pace intervals', main: '{reps} × {km} km at exact marathon pace; 1 km easy running between reps', how: 'Effort: RPE 6–7 out of 10; exactly race rhythm.' },
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
        main: '{km} km on trail or uneven ground, about {time} on your feet',
        vert: 'Target total climb: about {vert} m (no big hill? repeat one climb several times)',
        hike: 'Power-hike the steep climbs; it\'s a race skill, not a weakness',
        fuel: 'Eat and drink every 30–45 minutes, using what you\'ll use on race day',
        how: 'Effort: easy (RPE 4–5 out of 10, by effort, not pace).',
        technical: ' If you can, run on technical trail.',
        day2How: ' Keep today easy too.',
        targetVert: '{km} km, +{vert} m',
        vDay1: 'back-to-back, day 1', vDay2: 'back-to-back, day 2', vTrail: 'trail'
      },
      long: {
        plain: '{km} km steady running',
        water: 'For more than 60 minutes, carry water',
        easyKm: '{km} km easy',
        mpEnd: 'Final {km} km at marathon pace (simulating late-race fatigue)',
        mpFuel: 'Practise your in-run fuelling as on race day',
        tempoSplit: '{a} km tempo, 1 km easy, {b} km tempo',
        restEasy: 'The rest, up to {km} km, easy',
        lastTempo: 'Last {km} km at tempo rhythm',
        vMp: 'marathon-pace finish', vTempo: 'with tempo sections'
      },
      rest: 'Full rest, or a light walk / stretching',
      notStarted: 'The plan starts on your sign-up day.',
      race: {
        ultraHow: 'Race day! Don\'t try anything new (shoes, food, clothing). Pace by effort (RPE), not by pace; the first half should feel easy.',
        ultraEst: ' Very rough estimated time: about {time} (equivalent to {km} km of flat running).',
        ultraSteps: ['Start very conservatively; walk the steep climbs', 'Eat and drink every 30–45 minutes', 'Take the descents under control to save your quads for the finish', 'Check the mandatory race gear (water, headlamp, warm layer)'],
        steps: ['10–15 min easy warm-up', 'Start the first kilometres a little slower than target pace', 'Use the water stations', 'After the finish: walk and drink'],
        how: 'Race day! Don\'t try anything new (shoes, food, clothing).',
        pred: ' Predicted time (Riegel, from your latest time trial/best time): about {time}.',
        runwalk: ' Stick to your run-walk routine; the only goal is to reach the finish healthy.'
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
    adapt: {
      noTrain: 'Don\'t train today',
      whyFatigue: 'Your fatigue is high ({n} out of 5)',
      whySleep: 'You\'ve slept badly two nights in a row',
      race: '{why}. It\'s race day; make your goal "finish feeling good", not a PB. If you don\'t feel well, skipping it is also the right call.',
      downgrade: '{why}, so today\'s {label} session was changed to a shorter easy run. Hard training on a tired body raises the risk of injury and brings less benefit. Check in again tomorrow.',
      note: '{why}. Today\'s session is easy and hasn\'t changed, but if you\'re very tired, cut it short{extra} or rest.',
      noteDouble: ' (for example, skip the evening run)'
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
      name: 'Be Your Own Coach',
      tagline: 'Your running plan · beta',
      metaDescription: 'Be Your Own Coach: a weekly running plan built on fixed training rules, no server.',
      navAria: 'Sections',
      nav: { plan: 'Weekly plan', checkin: 'Today\'s check-in', fitness: 'Fitness', race: 'Race goal', guide: 'Guide', profile: 'Profile' },
      langSwitch: 'فارسی',
      langSwitchAria: 'Switch language to Persian',
      bannerAria: 'Medical notice',
      bannerStrong: 'This system can replace an in-person coach for planning your training, but never a doctor.',
      bannerText: 'If you have pain or any health problem, please see a doctor.',
      footer: 'Demo version (MVP): all data is stored only in your own browser (localStorage) and is never sent to any server.',
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
    login: {
      title: 'Log in',
      welcome: 'Welcome to Be Your Own Coach',
      subtitle: 'A smart running plan built on proven training rules',
      button: 'Log in',
      langLabel: 'Language',
      note: 'Your data stays on this device only.',
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
      titleEdit: 'Edit profile',
      titleNew: 'Let\'s build your running plan',
      migTitle: 'New level system',
      migText: 'Please complete section 1 and save.',
      introEdit: 'If your mileage or level changes, the plan restarts from this week.',
      introNew: 'You can edit this later from your profile.',
      required: '(required)',
      s1: '1. Your current running',
      kmLabel: 'Right now, how many kilometres do you run per week on average?',
      kmHint: 'Average of the last few weeks; enter 0 if you don\'t run.',
      lastWeek: 'Last week\'s volume (km)',
      lastWeekHint: 'Your last complete week, Saturday to Friday.',
      monthAvg: 'Last month\'s average (km per week)',
      monthAvgHint: 'Weekly average over the past four weeks; e.g. 30+35+40+35 → 35.',
      reasonQ: 'Last week was much lower than your monthly average. Was there a particular reason?',
      reasonHint: 'Your answer tells us whether the drop is temporary or real, and where the plan should start.',
      reasons: { injury: 'Injury', illness: 'Illness', travel: 'Travel', other: 'Another temporary reason', none: 'No particular reason; I\'m really running less' },
      startPreview: 'The plan starts at {n} km per week.',
      pbIntro: 'The best time you\'ve run over one of the distances below in the last six months, with a fairly serious effort (not an ordinary training run, but an official race or an all-out time trial).',
      pbOptional: 'If you don\'t have one or aren\'t sure, leave this section empty; the system will estimate your level from your current training volume.',
      zeroNote: 'Great that you want to start! You don\'t need to know anything about kilometres or race times. Your plan starts with walking and adds very gentle running little by little; most people reach 15 minutes of continuous running within 4 to 8 weeks.',
      expQ: 'How long have you been running regularly?',
      structQ: 'Have you ever done structured training (intervals, tempo)?',
      pbQ: 'Your best recent time (optional)',
      pbDist: 'Distance',
      pbNone: 'No best time',
      pbOtherKm: 'Distance (km)',
      pbTime: 'Time (h:mm:ss)',
      pbTimeHint: 'e.g. "3:25:00" or "32500"',
      levelWait: 'Once you answer the required questions above, your level will appear here.',
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
      raceDate: 'Race date (if you have a specific race)',
      raceDateEq: '',
      ultraKm: 'Race distance (km)',
      ultraGain: 'Total climb (metres of ascent)',
      ultraLoss: 'Total descent (m, optional)',
      ultraLossHint: 'If different from the climb',
      terrain: 'Main terrain (optional)',
      notSelected: 'Not selected',
      altitude: 'Altitude above sea level (m, optional)',
      ultraRatio: '{r} m of climb per km → ',
      s7: '7. Heart rate (optional)',
      submitEdit: 'Save and update plan',
      submitNew: 'Build my plan',
      toastEdit: 'Plan updated.',
      toastNew: 'Your plan is ready!',
      err: {
        km: 'Enter how many kilometres you currently run per week on average (a number from 0 to 400).',
        lastWeek: 'Enter last week\'s volume (0 to 400 km; enter 0 if you didn\'t run).',
        monthAvg: 'Enter last month\'s average weekly volume (0 to 400 km).',
        reason: 'Tell us whether last week\'s drop had a particular reason.',
        exp: 'Tell us how long you\'ve been running regularly.',
        struct: 'Tell us whether you\'ve done structured training (intervals, tempo).',
        pb: 'Best time: enter the distance and time completely and correctly (e.g. "3:25:00" or just "32500"), or choose "No best time".',
        age: 'Age must be between 12 and 90.',
        weight: 'Weight must be between 30 and 250 kg.',
        height: 'Height must be between 120 and 230 cm.',
        days: 'Choose at least one free day.',
        locs: 'Choose at least one training location.',
        raceDate: 'The race date must be after today (or leave it empty).',
        ultraKm: 'Enter the trail race distance (10 to 400 km).',
        ultraGain: 'Enter the race\'s total climb (metres of ascent); for a flat course enter 0 or a small number.',
        ultraLoss: 'Descent must be between 0 and 20,000 m.',
        ultraAlt: 'Altitude must be between 0 and 6,000 m.'
      }
    },
    sess: { original: 'Original plan:' },
    post: {
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
      newTest: 'Log a new time trial'
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
      totalTime: 'Total time',
      nMin: '{n} min',
      volume: 'Total volume',
      nKm: '{n} km',
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
      levelApplied: 'The plan continues at level {to} (was {from}) with {km} km per week.'
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
      apply: 'Continue the plan at level {n}'
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
      sLow: '1 = very poor',
      sHigh: '5 = excellent',
      painQ: 'Do you feel any pain right now?',
      where: 'Where?',
      wherePh: 'e.g. left knee, shin, lower back',
      painNote: 'This means real pain (sharp, localised, or pain that gets worse when running), not general muscle soreness after training.',
      submit: 'Save check-in',
      err: { fatigue: 'Choose your fatigue level.', sleep: 'Choose your sleep quality.', pain: 'Answer the pain question.', where: 'Tell us where it hurts.' },
      toastDown: 'Today\'s session was changed to an easy run.',
      toastOk: 'Check-in saved.'
    },
    race: {
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
      avgPace: 'Average pace: {p} min/km',
      thDist: 'Distance',
      thTime: 'Predicted time',
      thPace: 'Pace (min/km)',
      predNeed: 'Log a time trial or a recent best time to get a prediction.',
      newTestOrPb: 'Log a time trial or new best time'
    },
    fit: {
      title: 'Fitness and paces',
      help: 'VDOT and time trials',
      entry: { test: 'Time trial', race: 'Race', baseline: 'Baseline best time (at plan creation)', record: 'Best time' },
      entryLine: '{label}: {km} km in',
      weeksAgo: { one: ' · {n} week ago', other: ' · {n} weeks ago' },
      thisWeek: ' · this week',
      none: 'No time trial or best time logged yet.',
      thPace: 'Pace',
      thMinKm: 'min/km',
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
      km: 'Distance (km)',
      time: 'Time',
      timeHint: 'e.g. "9:40" or "940"',
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
        km: 'Enter a distance between 1 and 100 km.',
        time: 'Enter the time as "9:40" or just the digits "940".',
        impossible: 'That time isn\'t possible for {km} km ({d}); please check it.',
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
      rows: {
        level: 'Level', exp: 'Running history', structured: 'Structured training', hr: 'Heart rate', fitness: 'Current fitness',
        km: 'Training volume', body: 'Age / weight / height', days: 'Free days', locs: 'Training locations',
        injury: 'Injury / limitation', goal: 'Race goal', pb: 'Best time', start: 'Plan start', stats: 'Stats'
      },
      levelVal: 'Level {n} of 10: {name}',
      structYes: 'Done before',
      structNo: 'Not yet',
      hrVal: 'Easy: {a}–{b} bpm',
      notEntered: 'Not entered',
      details: 'Details and update',
      registerTest: 'Log a time trial',
      kmVal: '{n} km per week',
      kmVal2: 'Last week {last} · monthly average {avg} · plan starts at {start} km',
      bodyVal: '{age} years · {w} kg · {h} cm',
      notRecorded: 'Not recorded',
      noDate: '(no date)',
      noGoal: 'No specific goal',
      pbVal: '{km} km in',
      statsVal: '{c} check-ins · {d} sessions done',
      edit: 'Edit profile',
      restart: 'Restart the plan from this week',
      wipe: 'Delete all data',
      confirmYes: 'Yes, do it',
      restartQ: 'Restart the plan from week 1 (at your base volume)? Your check-ins are kept.',
      restartToast: 'The plan has restarted from today.',
      wipeQ: 'Delete all data (profile, check-ins, history) from this browser? This can\'t be undone.'
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
            '<dt>Short / medium / long intervals</dt><dd>Reps of 400–800 m (5K pace), 1000–1600 m (5–10K pace) and 1600–2000 m (10K to half-marathon pace).</dd>' +
            '<dt>Fartlek</dt><dd>Free changes of speed during a run (for example 1 min fast, 1 min easy).</dd>' +
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
            '<li><b>10K and 5K pace:</b> medium and short intervals.</li><li><b>I:</b> short intervals at levels 3–4.</li><li><b>R repetition:</b> short speed reps.</li></ul>'
        },
        checkin: {
          title: 'Check-in and automatic adjustment',
          body: '<ul><li><b>Fatigue 4 or 5</b>, or <b>two bad nights of sleep in a row</b> → today\'s hard session becomes a shorter easy run.</li>' +
            '<li>Moderate fatigue or one bad night → the session stays, but you\'re advised to run the slower half of the easy range.</li>' +
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
        places: { title: 'Training location tips', body: '<ul>{tips}</ul>' },
        data: {
          title: 'Data and privacy',
          body: '<ul><li>All your information is stored only in this browser and is never sent to any server.</li>' +
            '<li>If you clear your browser data or switch devices, the information is lost.</li>' +
            '<li>Change the language any time with the button at the top of the page; your choice is remembered in this browser.</li>' +
            '<li>This plan is built from fixed training rules, not AI, and doesn\'t replace a doctor or a coach.</li></ul>'
        }
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = d;
  else root.CoachI18n.register('en', d);
})(this);
