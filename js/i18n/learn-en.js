/* "Learn" section: short articles on the science behind the plan (English). Bodies are fixed, trusted HTML. */
(function (root) {
  var d = {
    title: 'Learn',
    intro: '',
    listAria: 'Articles',
    guideSub: 'Levels, the week, check-in, goals and privacy',
    readMin: '{n} min read',
    backTo: { home: 'Back to home', progress: 'Back to progress', list: 'All articles', article: 'Previous article', plan: 'Back to plan', fitness: 'Back to fitness', checkin: 'Back to check-in', race: 'Back to race goal', guide: 'Back to guide', profile: 'Back to profile', other: 'Back' },
    more: 'Learn more:',
    others: 'More articles',
    guideTag: 'How the app works',
    groups: { start: 'Getting started and levels', pace: 'Pace and fitness', train: 'Training', injury: 'Injury prevention', goals: 'Goals and plans', progress: 'Progress', cycle: 'Menstrual cycle', data: 'Data and privacy', walkUse: 'Using the walking plan', walkWhy: 'Walking and health', walkHow: 'Intensity and the plan', walkCare: 'Safety and gear', walkNext: 'Next step' },
    articles: {
      vdot: {
        title: 'VDOT and the Jack Daniels method',
        summary: 'What VDOT is, how it comes from a single race result, and where easy, marathon, threshold, interval and repetition paces come from.',
        body:
          '<h2>What is VDOT?</h2>' +
          '<p>VDOT is a number created by <b>Jack Daniels</b>, the American coach and exercise physiologist, together with <b>Jimmy Gilbert</b>, to express a runner\'s current fitness as a single value. The name comes from VO2max (the most oxygen your body can use), but it isn\'t the same thing. VO2max is measured in a lab; VDOT comes from a real race or time trial. That means it also captures <b>running economy</b> (how much energy you need at a given speed) and your ability to hold a pace. That\'s why it\'s sometimes called a "functional" VO2max.</p>' +
          '<h2>How is it calculated?</h2>' +
          '<p>Daniels and Gilbert derived two relationships from measurements on runners:</p>' +
          '<ul><li><b>The oxygen cost of speed:</b> how much oxygen it takes to run at any given speed.</li>' +
          '<li><b>The share of capacity you can sustain:</b> the longer the race, the smaller the fraction of your maximum you can hold; about 100% for a 10-minute effort and around 80–85% for a marathon.</li></ul>' +
          '<p>Put your race speed into the first relationship, divide by the second, and you get your VDOT. For example, 10 km in 44 minutes gives a VDOT of about 46. The same number also predicts your times at other distances.</p>' +
          '<p>The result must be <b>recent</b> (the last few weeks), on a roughly flat course and run at full effort; an old result or a mountain race gives the wrong number. That\'s why the plan uses a 2, 3 or 5 km time trial or a recent race, and reminds you to repeat it every few weeks.</p>' +
          '<h2>The five training paces</h2>' +
          '<p>Each kind of training is a set share of that capacity:</p>' +
          '<ul><li><b>Easy (E):</b> roughly 65–75%. Builds the aerobic base (heart, capillaries, mitochondria) and aids recovery. Most of your weekly volume is at this pace.</li>' +
          '<li><b>Marathon (M):</b> your predicted marathon pace at this VDOT; for marathon-specific training.</li>' +
          '<li><b>Threshold (T):</b> roughly 86–90%. "Comfortably hard"; a pace a fit runner could hold for about an hour. Raises your lactate threshold.</li>' +
          '<li><b>Interval (I):</b> roughly 96–100%; close to 3–5 km race pace, in 3–5 minute reps. Targets VO2max.</li>' +
          '<li><b>Repetition (R):</b> a little faster than interval pace, in short reps with full recovery; for speed, form and running economy.</li></ul>' +
          '<h2>Why it matters</h2>' +
          '<p>The most common mistake is training at a "dream pace" or a friend\'s pace. VDOT ties your paces to your fitness <b>today</b>, so each session has exactly the effect it was designed for. Running faster than prescribed rarely speeds up progress; it mostly adds fatigue and injury risk. As you get fitter, a new time trial raises your VDOT and every pace updates together.</p>' +
          '<h2>Limitations</h2>' +
          '<p>VDOT tables assume standard conditions: cool weather, flat ground, low altitude. In heat, wind, on hills or at altitude, adjust by <b>perceived effort (RPE)</b>. If you have no result at all, the plan uses the talk test and RPE instead of paces.</p>' +
          '<p class="learn-src"><b>Sources:</b> Jack Daniels, <i>Daniels\' Running Formula</i>, 4th ed. (2022); Daniels &amp; Gilbert, <i>Oxygen Power</i> (1979).</p>'
      },
      rpe: {
        title: 'Perceived effort (RPE) and the talk test',
        summary: 'What the 1–10 scale is, how to use it, and why on hot or tired days it matters more than pace.',
        body:
          '<h2>What is RPE?</h2>' +
          '<p>RPE (Rating of Perceived Exertion) is a number you give to how hard a session feels. The idea comes from the Swedish psychologist <b>Gunnar Borg</b>, and his 1–10 version is now widely used in endurance training. Research shows RPE tracks heart rate, breathing and blood lactate well: your body senses intensity more accurately than you might think.</p>' +
          '<h2>The 1–10 scale</h2>' +
          '<ul><li><b>1–2:</b> very easy; like walking.</li>' +
          '<li><b>3–4:</b> easy; calm breathing, full sentences are comfortable. <b>Easy and long runs.</b></li>' +
          '<li><b>5–6:</b> moderate; deeper breathing, short sentences. Steady running.</li>' +
          '<li><b>7:</b> hard but controlled; only a few words. <b>Tempo and threshold.</b></li>' +
          '<li><b>8–9:</b> very hard; a word or two. <b>Intervals and repetitions.</b></li>' +
          '<li><b>10:</b> maximal; you can\'t talk. The end of a race.</li></ul>' +
          '<h2>The talk test</h2>' +
          '<p>The simplest tool for easy days: if you can speak in full sentences, you\'re at easy intensity. Studies have found that the point where you can no longer talk comfortably lines up closely with the <b>first ventilatory threshold</b>, the upper edge of low intensity. If you\'re breathing hard on an easy run, slow down, even below the target pace.</p>' +
          '<h2>Why it sometimes matters more than pace</h2>' +
          '<p>Pace is the outcome; effort is the cost. Your body feels the cost, not the number on your watch. The cost of a fixed pace goes up with:</p>' +
          '<ul><li><b>Heat and humidity:</b> some of your blood goes to the skin for cooling and your heart rate gradually drifts up, so the same pace feels harder. Slowing by 10–30 seconds per km in hot weather is normal.</li>' +
          '<li><b>Fatigue, poor sleep, stress or an oncoming illness.</b></li>' +
          '<li><b>Hills, wind, soft ground and altitude.</b></li></ul>' +
          '<p>On those days, forcing the pace turns an easy run into a hard one and spoils the next recovery. A simple rule: <b>on easy days, effort is the boss; pace is only a guide.</b></p>' +
          '<h2>In hard sessions</h2>' +
          '<p>In tempo and interval sessions the target pace leads, but RPE is your warning light. If the first rep already feels like a 10, ease the pace or shorten the session. A controlled session is far better than one you grind through and pay for over the next few days.</p>' +
          '<h2>In this plan</h2>' +
          '<p>Every session has its own target RPE. After each easy run the plan asks for your RPE; if several easy runs in a row land above 6, it suggests slowing your easy pace. Over time you\'ll learn to compare RPE with pace and heart rate, and your sense of effort will sharpen.</p>' +
          '<p class="learn-src"><b>Sources:</b> Borg (1982), <i>Med Sci Sports Exerc</i>; Foster et al. (2001), <i>J Strength Cond Res</i>; Persinger et al. (2004), <i>Med Sci Sports Exerc</i> (talk test).</p>'
      },
      eighty: {
        title: 'The 80/20 ratio',
        summary: 'Why most of your training should be easy with only a small part hard, and the research behind it.',
        body:
          '<h2>The idea</h2>' +
          '<p>About <b>80%</b> of training time at low intensity (easy, conversational) and about <b>20%</b> at moderate to high intensity. It may sound odd, but to get faster you should run slowly most of the time.</p>' +
          '<h2>Where it came from</h2>' +
          '<p><b>Stephen Seiler</b>, an American physiologist based in Norway, studied the training logs of elite endurance athletes: rowers, cross-country skiers and runners. Across sports and countries he found a shared pattern: roughly 80% of sessions easy and 20% hard. These athletes had arrived at the same answer independently, by trial and error.</p>' +
          '<h2>Controlled studies</h2>' +
          '<ul><li><b>Esteve-Lanao et al. (2007):</b> sub-elite runners trained for five months. The group doing about 80% easy improved more over a roughly 10 km race than the group doing more threshold work.</li>' +
          '<li><b>Stöggl &amp; Sperlich (2014):</b> 48 trained endurance athletes over nine weeks. The "polarised" model (mostly easy, a little very hard) produced the largest gains in VO2max and time to exhaustion, ahead of high volume, lots of threshold, or lots of intervals.</li>' +
          '<li><b>Muñoz et al. (2014):</b> recreational 10 km runners over ten weeks. The group training about 80% easy improved its 10 km time slightly more.</li></ul>' +
          '<h2>Why it works</h2>' +
          '<ul><li><b>The aerobic engine is built at low cost:</b> easy running increases mitochondria, capillaries and the heart\'s stroke volume without wearing you down, so you can run more volume.</li>' +
          '<li><b>Hard sessions need a fresh body:</b> if every day is "medium-hard" (the so-called grey zone), your easy days aren\'t easy enough and your hard days never get hard enough.</li>' +
          '<li><b>Lower risk:</b> fewer overuse injuries, less overtraining and less mental burnout.</li></ul>' +
          '<h2>A common mistake</h2>' +
          '<p>Most recreational runners run their easy days too fast, because slow running feels "pointless". They then arrive at hard sessions already tired. If you can\'t talk comfortably on an easy run, you\'re going faster than you should.</p>' +
          '<h2>In this plan</h2>' +
          '<p>From level 3 up, the hard part of the week (the main sets of tempo, interval, repetition and fartlek sessions and the fast part of long runs) is at most <b>20%</b> of weekly volume; warm-ups, recovery jogs and cool-downs count as easy. At lower levels nearly everything is easy, because the base comes first. Two hard days are never back to back.</p>' +
          '<p class="learn-src"><b>Sources:</b> Seiler &amp; Kjerland (2006), <i>Scand J Med Sci Sports</i>; Esteve-Lanao et al. (2007), <i>J Strength Cond Res</i>; Stöggl &amp; Sperlich (2014), <i>Front Physiol</i>; Muñoz et al. (2014), <i>Int J Sports Physiol Perform</i>.</p>'
      },
      types: {
        title: 'Types of hard sessions and how they differ',
        summary: 'Intervals, tempo and threshold, fartlek and hills: which energy system each targets and when to use it.',
        body:
          '<h2>First: the energy systems</h2>' +
          '<ul><li><b>Aerobic:</b> makes energy from fat and carbohydrate using oxygen. Slow but almost limitless. In any race of 5 km or longer, more than 85% of the energy comes from here.</li>' +
          '<li><b>Anaerobic glycolytic:</b> burns carbohydrate without enough oxygen. Fast but limited; efforts of 30 seconds to 2 minutes and that "burning" feeling.</li>' +
          '<li><b>Phosphocreatine:</b> instant energy for about 10 seconds; starts and sprints.</li></ul>' +
          '<p>Every hard session targets one of these, or the boundary between them.</p>' +
          '<h2>Tempo and threshold</h2>' +
          '<p><b>Target:</b> the lactate threshold, the highest intensity at which your body can still clear lactate as fast as it makes it. <b>Format:</b> 20–40 minutes continuous, or 8–10 minute blocks with short rests (threshold intervals). <b>Feel:</b> hard but controlled (RPE 7). <b>Result:</b> you hold a faster pace for longer; key for 10 km to the marathon.</p>' +
          '<h2>Intervals (VO2max)</h2>' +
          '<p><b>Target:</b> your aerobic ceiling, the most oxygen your body can use. <b>Format:</b> 3–5 minute reps (for example 800–1200 m) at about 3–5 km race pace, with a recovery jog slightly shorter than or equal to the rep. <b>Feel:</b> hard (RPE 8). <b>Result:</b> a higher ceiling for the engine; key for 5 and 10 km.</p>' +
          '<h2>Repetitions (R)</h2>' +
          '<p>Short 200–400 m reps, a little faster than interval pace, with <b>full recovery</b>. The aim is speed, form and running economy, not fatigue. When your form breaks down, the session is over.</p>' +
          '<h2>Fartlek</h2>' +
          '<p><b>Continuous</b> changes of pace with no stopping; recovery is running too. It trains several systems at once and teaches you to feel rhythm and change pace, as in a race. It needs no track, and it suits the base phase and runners who tire of rigid structure. The key difference from intervals: intervals have a precise structure and fuller rests so every rep is high quality.</p>' +
          '<h2>Hill training</h2>' +
          '<ul><li><b>Short hills (10–30 s):</b> strength and power in the legs and glutes, plus neuromuscular coordination; full recovery walking back down.</li>' +
          '<li><b>Medium hills (60–90 s):</b> an effect similar to intervals, with less impact on the joints.</li>' +
          '<li><b>Long hills and downhills:</b> muscular endurance and resilience to descending; essential for trail and ultra.</li></ul>' +
          '<h2>When to use which</h2>' +
          '<ul><li><b>Base phase:</b> mostly easy, plus strides, short hills and light fartlek.</li>' +
          '<li><b>Build phase:</b> threshold and intervals are added.</li>' +
          '<li><b>Close to the race:</b> goal-specific work; intervals for 5 km, marathon pace and long tempos for the marathon.</li>' +
          '<li><b>Taper:</b> volume drops but some intensity stays to keep you sharp.</li></ul>' +
          '<p>The plan follows this order based on your level and goal, and always puts at least one easy day between two hard ones.</p>' +
          '<p class="learn-src"><b>Sources:</b> Daniels, <i>Daniels\' Running Formula</i> (2022); Midgley et al. (2007), <i>Sports Med</i>; Barnes &amp; Kilding (2015), <i>Sports Med</i> (running economy).</p>'
      },
      fartleks: {
        title: 'Famous fartleks from around the world',
        summary: 'From the original Swedish fartlek to the Mona and the pyramid: where they come from and why they\'re respected in athletics.',
        body:
          '<h2>Origin: "speed play"</h2>' +
          '<p>"Fartlek" is Swedish for <b>speed play</b>. The method was developed in the late 1930s by Swedish coach <b>Gösta Holmér</b> for Sweden\'s cross-country team, which had been beaten for years by the Finns (with stars like Paavo Nurmi). Holmér\'s idea was to combine speed and endurance in one continuous session through forests and countryside. Two of his best-known pupils, <b>Gunder Hägg</b> and <b>Arne Andersson</b>, traded the mile world record five times between 1942 and 1945.</p>' +
          '<h2>The Mona fartlek</h2>' +
          '<p>Named after <b>Steve Moneghetti</b>, the Australian marathoner who went to four Olympic Games and won the 1994 Commonwealth Games marathon, and designed by his coach <b>Chris Wardlaw</b>. The structure (after a full warm-up):</p>' +
          '<ul><li>2 × 90 s hard + 90 s "float"</li><li>4 × 60 s hard + 60 s float</li><li>4 × 30 s hard + 30 s float</li><li>4 × 15 s hard + 15 s float</li></ul>' +
          '<p>Exactly <b>20 minutes</b> in total, without stopping. The key is the "float": a fairly quick jog, never walking or standing. That\'s where the difficulty comes from; your body learns to recover while still running fairly fast and to clear lactate on the move.</p>' +
          '<p><b>Why it\'s respected:</b> because the duration is fixed, you can measure the total distance covered in the 20 minutes and compare it every few weeks, a simple benchmark of progress. It\'s used by elite and recreational runners alike. In this plan it\'s offered from <b>level 6</b>.</p>' +
          '<h2>The pyramid fartlek</h2>' +
          '<p>Hard sections of 1, 2, 3, 4, 3, 2 and 1 minutes with an easy jog in between. The long pieces in the middle sit near threshold effort and the short ones are faster. It teaches you to pace by the length of the effort and not to start the long ones too hard.</p>' +
          '<h2>The 1-1 fartlek</h2>' +
          '<p>One minute hard, one minute jog, several times in a row. The simplest way into speed work, suited to lower levels.</p>' +
          '<h2>Free, landmark-based fartlek</h2>' +
          '<p>The closest to Holmér\'s original idea: during a continuous run you surge to a landmark several times (a lamppost, the top of a rise, the next junction), with lengths varying from 15 seconds to 2 minutes. You jog until your breathing settles. It sharpens your sense of effort without a watch. In this plan it appears from <b>level 4</b>.</p>' +
          '<h2>Why fartleks earn their place</h2>' +
          '<ul><li>They train several energy systems in one session.</li><li>They simulate the pace changes of a race.</li><li>They need no track or precise distances.</li><li>They\'re more varied and more fun.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Canadian Running Magazine and The Morning Shakeout (Mona fartlek); Athletics Weekly, "Fartlek running: Playing with speed".</p>'
      },
      tenpct: {
        title: 'The 10% rule and gradual adaptation',
        summary: 'Why sudden jumps in volume raise injury risk, and how the plan increases volume gently.',
        body:
          '<h2>What is the 10% rule?</h2>' +
          '<p>Each week\'s running volume is at most <b>10%</b> more than the week before; for example from 30 km to 33 km, not 40. The rule doesn\'t come from one specific study; it\'s a coaches\' rule of thumb that fits today\'s evidence reasonably well.</p>' +
          '<h2>Why gradual? Tissues adapt at different speeds</h2>' +
          '<ul><li><b>Heart and lungs:</b> adapt within weeks.</li>' +
          '<li><b>Muscle:</b> weeks to a few months.</li>' +
          '<li><b>Tendons, ligaments and bone:</b> months or longer. In the first weeks of a new load, bone is briefly a little more vulnerable before it gets stronger, because remodelling starts by removing old tissue.</li></ul>' +
          '<p>That\'s the catch: cardiovascular fitness arrives first, so you feel ready to run more, but your tendons and bones aren\'t yet. The result is overuse injuries: shin splints, Achilles problems, runner\'s knee and stress fractures.</p>' +
          '<h2>What the research says</h2>' +
          '<ul><li><b>Nielsen et al. (2014):</b> novice runners who raised their weekly volume by more than 30% had more of certain common running injuries than those who stayed under 10%.</li>' +
          '<li><b>Frandsen et al. (2025):</b> over 5,200 runners with GPS watch data. When a single run was more than 10% longer than the longest run of the previous 30 days, injury risk rose significantly, and the bigger the spike, the higher the risk. So it\'s not only the weekly total; <b>a single-session spike</b> matters too.</li>' +
          '<li><b>Buist et al. (2008):</b> a graded 10% programme on its own did not reduce injuries in novices compared with a standard programme. So 10% isn\'t magic; history, sleep, nutrition, intensity and past injuries matter as well.</li></ul>' +
          '<h2>The principle of gradual adaptation</h2>' +
          '<p>The body gets stronger through <b>load, recovery, adaptation</b>. Load beyond your capacity, or too little recovery, brings injury instead of adaptation. That\'s why a few weeks of increases need a lighter week so the body can catch up with the new load. Intensity is part of the load too: raising volume and intensity at the same time compounds the risk.</p>' +
          '<h2>In this plan</h2>' +
          '<ul><li>Week one equals your current volume; after that each week is at most 10% more (5% in cautious mode).</li>' +
          '<li>Every fourth week is a recovery week at about 80% volume.</li>' +
          '<li>The long run has a limited share of the week so no single session spikes.</li>' +
          '<li>If your volume dropped temporarily because of travel, illness or injury, the return to your previous monthly average is faster, because your body had already adapted to it, but never beyond it.</li></ul>' +
          '<p><b>Warning signs:</b> pain that changes how you run, pain that gets worse during a run, or pinpoint pain on a bone. These mean stop and see a doctor, not carry on.</p>' +
          '<p class="learn-src"><b>Sources:</b> Nielsen et al. (2014), <i>J Orthop Sports Phys Ther</i>; Frandsen et al. (2025), <i>Br J Sports Med</i>; Buist et al. (2008), <i>Am J Sports Med</i>; Gabbett (2016), <i>Br J Sports Med</i>.</p>'
      },
      warmup: {
        title: 'The science of warming up',
        summary: 'Why the warm-up should match the session, dynamic drills versus static stretching, and why static stretching belongs after training.',
        body:
          '<h2>What a warm-up does</h2>' +
          '<ul><li><b>Raises muscle temperature:</b> warm muscle contracts faster and more forcefully, and nerve signals travel faster.</li>' +
          '<li><b>"Switches on" the aerobic system:</b> after a warm-up, oxygen uptake rises faster at the start of a hard effort, so the first rep leans less on anaerobic energy and doesn\'t tire you early.</li>' +
          '<li><b>Improves range of motion and coordination.</b></li>' +
          '<li><b>Mental readiness:</b> you focus for the hard work ahead.</li></ul>' +
          '<h2>Why it should match the session</h2>' +
          '<p>The harder the start of the main set, the bigger the gap between "at rest" and "first rep", and the more complete the warm-up needs to be:</p>' +
          '<ul><li><b>Easy and long runs:</b> the first few minutes of the run itself, slower than easy pace, are enough.</li>' +
          '<li><b>Tempo and threshold:</b> 10–15 minutes of progressive jogging, a few dynamic drills and 3–4 strides.</li>' +
          '<li><b>Intervals, hills and short races:</b> 10–15 minutes of jogging, activation drills and 4–6 strides near session pace, the last one right before the first rep. A short warm-up isn\'t enough here.</li></ul>' +
          '<p>Level matters too: a beginner needs a simpler, more gradual warm-up; an advanced runner usually does a more compact one with more drills.</p>' +
          '<h2>Dynamic versus static</h2>' +
          '<p><b>Dynamic drills:</b> controlled movement through a range of motion, close to running itself: leg swings, walking lunges, hip circles, high knees, skips, butt kicks. They warm the muscle and prepare it to move.</p>' +
          '<p><b>Static stretching:</b> holding a stretch still for 20–60 seconds or longer.</p>' +
          '<h2>Why static stretching after training?</h2>' +
          '<ul><li>Reviews show that long static stretches (around 60 seconds or more per muscle) right before activity can temporarily reduce strength and power slightly. Holds under 30 seconds have very little effect, but they don\'t help your running either.</li>' +
          '<li>Static stretching before running doesn\'t reliably prevent injury. In a large meta-analysis, stretching showed no protective effect, while <b>strength training</b> markedly reduced injury risk.</li>' +
          '<li>After training, when the muscle is warm, static stretching is better suited to flexibility and relaxation. It\'s optional.</li></ul>' +
          '<h2>Cooling down</h2>' +
          '<p>5–15 minutes of easy running or walking brings your heart rate and breathing down gradually. The evidence that a cool-down prevents next-day soreness is weak, but easing back to normal feels better and is a good time for light stretching.</p>' +
          '<p class="learn-src"><b>Sources:</b> Bishop (2003), <i>Sports Med</i>; Kay &amp; Blazevich (2012), <i>Med Sci Sports Exerc</i>; Behm et al. (2016), <i>Appl Physiol Nutr Metab</i>; Lauersen et al. (2014), <i>Br J Sports Med</i>; Van Hooren &amp; Peake (2018), <i>Sports Med</i>.</p>'
      },
      cycle: {
        title: 'The menstrual cycle and training',
        summary: 'A scientific summary of how the phases of the cycle may affect energy and performance.',
        body:
          '<h2>The phases</h2>' +
          '<p>A typical cycle lasts 21–35 days (28 days is used here as an example):</p>' +
          '<ul><li><b>Menstruation (about days 1–5):</b> oestrogen and progesterone are at their lowest. Cramps, fatigue or poor sleep are possible.</li>' +
          '<li><b>Follicular (to about day 14):</b> oestrogen gradually rises. Many people feel more energetic in this phase.</li>' +
          '<li><b>Ovulation (around mid-cycle).</b></li>' +
          '<li><b>Luteal (until the next period):</b> progesterone rises; core body temperature goes up by about 0.3–0.5 °C and breathing increases slightly. In the last days, as hormones fall, premenstrual symptoms may appear.</li></ul>' +
          '<h2>How it can affect training</h2>' +
          '<ul><li><b>Heat:</b> in the luteal phase, the higher body temperature may make running in hot weather a little harder. Enough fluid and electrolytes matter more.</li>' +
          '<li><b>Symptoms:</b> cramps, bloating, headaches, poor sleep and mood changes in the days before and at the start of a period can make a hard session genuinely harder.</li>' +
          '<li><b>Iron:</b> heavy bleeding raises the risk of iron deficiency, and low iron directly hurts endurance.</li></ul>' +
          '<h2>What the research says</h2>' +
          '<p>The largest meta-analysis (McNulty et al., 2020) concluded that exercise performance <b>might</b> be <b>trivially</b> reduced in the early follicular phase (the days of the period) compared with the other phases. But the effect is small, varies a lot between people, and many of the studies are low quality. The authors\' advice: rather than general rules for everyone, take a <b>personalised approach</b> based on how your own body responds.</p>' +
          '<h2>Practical tips</h2>' +
          '<ul><li>Log your cycle and symptoms alongside your training for two or three months to see your own pattern.</li>' +
          '<li>If symptoms are strong on a given day, a lighter option or active rest is perfectly sensible, but not required. For many people, light activity even eases the pain.</li>' +
          '<li>If you use the pill or another hormonal contraceptive, your hormone pattern is different and phase predictions are less useful.</li></ul>' +
          '<h2>Warning signs</h2>' +
          '<p>Missing your period for three months or more (without pregnancy or another known reason) is <b>not normal</b>, even for runners. It\'s often a sign of too little energy intake for the training load (RED-S) and can harm your bones and overall health. Very heavy bleeding or severe pain also needs a medical check.</p>' +
          '<h2>In this plan</h2>' +
          '<p>This feature is entirely optional. The plan <b>estimates</b> phases from the dates you enter and, for hard sessions on period or pre-period days, suggests a lighter option. Nothing changes without your choice, and the data stays only in your browser.</p>' +
          '<p class="learn-src"><b>Sources:</b> McNulty et al. (2020), <i>Sports Med</i> 50:1813–1827; Mountjoy et al. (2023), <i>Br J Sports Med</i> (RED-S).</p>'
      },
      returning: {
        title: 'Levels and returning to running',
        summary: 'How your starting level comes from your history, current volume and best time, and how a return after a break is set.',
        body:
          '<h2>History and current volume</h2>' +
          '<p>In the setup form, "history" means the total time you ran at least twice a week. Your starting level comes from your current volume (last week and the monthly average), and your history caps it.</p>' +
          '<h2>An old best is not today\'s pace</h2>' +
          '<p>After a break, your old best time is not used as today\'s pace. For breaks up to 10 weeks it is adjusted with Jack Daniels\' detraining factor and your paces come from the adjusted time. For longer breaks there is no reliable data, so until your first time trial intensity is set by the talk test, and your old best only sets your progress ceiling.</p>' +
          '<p>People who kept up other aerobic exercise (cycling, swimming, hiking) during the break lose less fitness in the same table. If you walk regularly now, run/walk starts one step further.</p>' +
          '<h2>Why carefully?</h2>' +
          '<p>Heart and lungs come back faster than tendons and joints. So even with a good old best, weekly volume rises by at most 10–15% (depending on the break), and after a break of 3 months or more the first 4 weeks are easy running only. With a good base, run/walk advances faster and paces return toward your old best sooner.</p>' +
          '<p class="learn-src"><b>Sources:</b> Daniels, <i>Daniels\' Running Formula</i> (VDOT adjustment after a break); Coyle et al. (1984), <i>J Appl Physiol</i> 57:1857; Nielsen et al. (2014), <i>JOSPT</i> 44(10):739; Kjaer et al. (2009), <i>Scand J Med Sci Sports</i>.</p>'
      },
      goals: {
        title: 'Goals, races and suggested plans',
        summary: 'Main and secondary races, time-to-ready estimates, target times and hill rules.',
        body:
          '<h2>Plan start</h2>' +
          '<p>Your plan is laid out from the exact start date you choose. If it is mid-week, you get a few intro sessions until the next week starts.</p>' +
          '<h2>Main and secondary races</h2>' +
          '<p>Your main race is the backbone of the plan. A secondary goal (race or time trial) does not replace it: normal training continues, with a mini-taper before and a short recovery after. Its result updates your paces and estimates. To make a goal the main one, drag its handle onto the main goal card or tap "Make main goal".</p>' +
          '<h2>Time to be ready</h2>' +
          '<p>The tiles for each distance show roughly how long until you are ready at your current level. The times come from the 10% volume rule, an easy week every fourth week, the minimum preparation for each level and the Jack Daniels method; injury, illness or breaks make them longer.</p>' +
          '<h2>Suggested plans</h2>' +
          '<p>Ready-made templates for each distance, built with the same rules as your main plan. They are only suggestions: your plan does not change unless you add a race yourself. Up to level 2, suggestions are based on volume and distance only (finishing healthy); from level 3 you can set a target time.</p>' +
          '<h2>Target time</h2>' +
          '<p>Daniels method: training paces stay at your current fitness and only race-pace parts move toward the goal (at most two steps ahead). VDOT rises one point at a time and each step takes 4 to 6 weeks; if easy runs feel easy, the next step is suggested.</p>' +
          '<h2>Hills and climbing (ultra and trail)</h2>' +
          '<p>Weekly climbing grows by at most 10% a week, with a lighter week every 4 weeks. No session climbs more than 110% of your biggest session in the last month. Hill sessions never sit next to another hard day, and downhill work grows separately and more slowly.</p>' +
          '<p class="learn-src"><b>Sources:</b> Daniels, <i>Daniels\' Running Formula</i>, 4th ed. (2022).</p>'
      },
      progress: {
        title: 'Progress charts',
        summary: 'What data each chart on the progress page is built from, and how to read it.',
        body:
          '<p>Every chart is built from your own data: the sessions you marked done, your daily check-ins, the RPE you logged after runs, and your race results and time trials.</p>' +
          '<h2>The charts</h2>' +
          '<ul><li><b>Weekly volume:</b> distance from completed sessions each week, with a 4-week moving average. For walking, total minutes with the recommended 150-minute line.</li>' +
          '<li><b>Steps:</b> steps you logged each day (or a walk session\'s steps), with your step target line.</li>' +
          '<li><b>Climbing:</b> metres of ascent from completed sessions each week, with a 4-week moving average.</li>' +
          '<li><b>Training load (CTL / ATL / TSB):</b> each session\'s load = duration (minutes) × perceived effort (RPE). CTL is long-term fitness (a 42-day weighted average); TSB is fitness minus fatigue: positive means fresh, negative means accumulated fatigue.</li>' +
          '<li><b>Paces:</b> easy, tempo and interval paces from the VDOT of each result or time trial. Higher on the chart means faster.</li>' +
          '<li><b>Race prediction:</b> each week\'s prediction from your latest result or time trial up to that week.</li>' +
          '<li><b>Check-ins:</b> fatigue and sleep quality (1–5) and the days you reported pain, to spot recurring patterns.</li>' +
          '<li><b>Time of day:</b> easy and long runs with a recorded start time, grouped by time of day. This is correlation only; weather, sleep and fatigue matter too, and more logged runs make it more reliable.</li>' +
          '<li><b>Adherence:</b> of the sessions planned in this range (up to today), how many you actually did.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Banister et al. (1975), impulse-response model; Foster et al. (2001), <i>J Strength Cond Res</i> 15(1):109 (session RPE).</p>'
      },
      // ---------- Walking articles (shown only on the walking path) ----------
      walk150: {
        title: 'Why 150 minutes a week?',
        summary: 'The World Health Organization\'s physical activity recommendation, and where walking fits in.',
        body:
          '<h2>What does the recommendation say?</h2>' +
          '<p>The WHO guidelines (2020) recommend that adults do at least <b>150 to 300 minutes of moderate-intensity aerobic activity</b> a week (such as brisk walking), or 75 to 150 minutes of vigorous activity, or a mix of the two. The same amounts are recommended for people aged 65 and over.</p>' +
          '<ul><li><b>Some is better than none:</b> if you are not at 150 minutes yet, any activity beats sitting. Start small and build up gradually.</li>' +
          '<li><b>Splitting it up is fine:</b> the 2020 guidelines dropped the requirement for bouts of at least 10 minutes; several shorter walks a day count too.</li>' +
          '<li><b>Strength training:</b> at least 2 days a week of exercise for the major muscle groups.</li>' +
          '<li><b>65 and over:</b> in addition, at least 3 days a week of activity focused on balance and strength, to help prevent falls.</li>' +
          '<li><b>Sit less:</b> replacing sitting time with activity of any intensity is also recommended.</li></ul>' +
          '<h2>What is "moderate intensity"?</h2>' +
          '<p>Your breathing is a little faster; you can talk but not sing. See "Walking intensity and the talk test" for details.</p>' +
          '<h2>In this plan</h2>' +
          '<ul><li>Walking level 5 ("Health recommendation") is about reaching 150 minutes a week, and the "150 minutes a week" goal steers your plan toward it.</li>' +
          '<li>From level 6, strength training after your walk is added to the plan.</li>' +
          '<li>The weekly volume chart on the Progress page shows the 150-minute line.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Bull et al. (2020), <i>Br J Sports Med</i> 54:1451–1462; WHO, <i>Guidelines on physical activity and sedentary behaviour</i> (2020).</p>'
      },
      walkIntensity: {
        title: 'Walking intensity and the talk test',
        summary: 'The plan\'s three intensities (easy, brisk, power) and simple ways to judge them without a smartwatch.',
        body:
          '<h2>The talk test</h2>' +
          '<p>The simplest way to judge intensity is to talk while you walk. Research shows the talk test lines up well with the ventilatory threshold (the point where breathing gets hard).</p>' +
          '<ul><li><b>Easy:</b> you can chat comfortably, even sing.</li>' +
          '<li><b>Brisk (moderate):</b> full sentences, but no singing.</li>' +
          '<li><b>Very brisk (vigorous):</b> only a few words before you need a breath.</li></ul>' +
          '<h2>Rating of perceived exertion (RPE)</h2>' +
          '<p>On a 1 to 10 scale, ask yourself how hard it feels: easy 3 to 4, brisk 5 to 6, power intervals 7 to 8.</p>' +
          '<h2>Counting steps per minute</h2>' +
          '<p>Count your steps for 15 seconds and multiply by 4. In the CADENCE-Adults study of adults aged 21 to 40, about <b>100 steps a minute</b> marked moderate intensity and about <b>130 steps a minute</b> marked vigorous intensity. These are averages that shift with height, age and fitness, so use them alongside the talk test.</p>' +
          '<h2>In this plan</h2>' +
          '<ul><li><b>Easy:</b> most sessions, plus warm-ups and cool-downs.</li>' +
          '<li><b>Brisk:</b> about 100 to 120 steps a minute; from level 3, starting with short 2-minute segments.</li>' +
          '<li><b>Power intervals:</b> 130 steps or more with an active arm swing; from level 7.</li>' +
          '<li>Two hard days (intervals or a long walk) never come back to back.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Persinger et al. (2004), <i>Med Sci Sports Exerc</i> (talk test); Tudor-Locke et al. (2019), <i>Int J Behav Nutr Phys Act</i> 16:8 (CADENCE-Adults); Borg (1982), <i>Med Sci Sports Exerc</i>.</p>'
      },
      walkSteps: {
        title: 'Daily steps: how many are enough?',
        summary: 'Where 10,000 steps came from, and what research says about daily steps.',
        body:
          '<h2>Where did 10,000 steps come from?</h2>' +
          '<p>Not from a scientific study. It goes back to a Japanese pedometer from the 1960s whose name meant "10,000-step meter". Later research showed the right number is not the same for everyone.</p>' +
          '<h2>What does research say?</h2>' +
          '<p>A meta-analysis of 15 cohorts with about 47,000 adults (Paluch et al., 2022) found that more daily steps went with a lower risk of death in later years, up to a point where the extra benefit levelled off: about <b>6,000 to 8,000</b> steps a day for people 60 and over, and about <b>8,000 to 10,000</b> for people under 60.</p>' +
          '<ul><li>This is a statistical association, not proof that the steps themselves were the cause.</li>' +
          '<li>In the same study, once total steps were taken into account, stepping speed showed no clear association; the total mattered more.</li></ul>' +
          '<h2>How do I add steps?</h2>' +
          '<ul><li>Check your usual average over a few days first, then build up gradually; for example 1,000 more steps a day every few weeks.</li>' +
          '<li>Everyday steps (stairs, walking short trips) count too.</li></ul>' +
          '<h2>In this plan</h2>' +
          '<ul><li>With the "Daily steps" goal you pick a target between 6,000 and 12,000 (default 8,000).</li>' +
          '<li>Read each day\'s steps from your phone or watch and log them on Home; the steps chart on the Progress page shows them against your target line.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Paluch et al. (2022), <i>Lancet Public Health</i> 7:e219–e228; Tudor-Locke &amp; Bassett (2004), <i>Sports Med</i> 34:1–8.</p>'
      },
      walkLong: {
        title: 'Long walks and getting ready for an event',
        summary: 'How the weekly long walk grows, and the final weeks before a walking event.',
        body:
          '<h2>The long walk</h2>' +
          '<p>From level 6 you have one walk each week that is longer than the rest: up to 60 minutes at levels 6 and 7, 75 at level 8, 90 at level 9 and 120 at level 10. Keep it steady, at an easy to slightly brisk pace.</p>' +
          '<ul><li>Bring water; for more than 60 minutes, bring a small snack too.</li>' +
          '<li>Try shoes and socks on shorter walks first, not on a long walk or event day.</li>' +
          '<li>There is no hard session the day after a long walk.</li></ul>' +
          '<h2>Walking events</h2>' +
          '<p>With the "Walking event" goal (on the walking goal page) you choose the distance (5, 10, 21 or 42 km) and the date:</p>' +
          '<ul><li>The final week is about 70% of the volume, with no intervals.</li>' +
          '<li>Rest the day before and the day after the event.</li>' +
          '<li>On the day, start easy and pick up the pace in the second half if you feel good.</li></ul>' +
          '<h2>Warning signs</h2>' +
          '<p>Blisters, sharp pain or limping mean shorten or stop the session. Dizziness, chest pain or unusual shortness of breath mean stop right away and see a doctor.</p>' +
          '<p class="learn-src"><b>Sources:</b> Garber et al. (2011), <i>Med Sci Sports Exerc</i> 43:1334–1359 (ACSM); Sawka et al. (2007), <i>Med Sci Sports Exerc</i> 39:377–390 (fluid replacement).</p>'
      },
      walkProgress: {
        title: 'Building up walking gradually',
        summary: 'Why walking volume grows step by step, and how the plan does it.',
        body:
          '<h2>Why gradually?</h2>' +
          '<p>Heart and lungs adapt to training within a few weeks, but muscles, tendons and joints adapt more slowly. Sudden jumps in duration or intensity, especially for beginners, raise the chance of pain and injury. The American College of Sports Medicine (ACSM) also recommends increasing frequency, duration and intensity gradually.</p>' +
          '<p>The "at most 10% more each week" rule is a common, cautious rule of thumb, not a number research has pinned down exactly; that is why the plan also listens to how your body feels in check-ins.</p>' +
          '<h2>In this plan</h2>' +
          '<ul><li>The first week is close to what you walk now.</li>' +
          '<li>Each week grows by at most 10%; for people 60 and over by at most 5%, starting one level lower.</li>' +
          '<li>Every fourth week is lighter.</li>' +
          '<li>Two hard days never come back to back, and there is at least one rest day a week.</li>' +
          '<li>When you have reached your level\'s ceiling for two full weeks and done most sessions, the next level is suggested.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Garber et al. (2011), <i>Med Sci Sports Exerc</i> 43:1334–1359 (ACSM); Bull et al. (2020), <i>Br J Sports Med</i> 54:1451–1462.</p>'
      },
      walkGear: {
        title: 'Shoes, warm-up and cool-down',
        summary: 'Choosing comfortable shoes, and a few easy minutes at the start and end of each session.',
        body:
          '<h2>Shoes</h2>' +
          '<ul><li><b>Comfort comes first:</b> a shoe that feels comfortable from the start and does not press anywhere. Research on sports shoes suggests perceived comfort is a better guide than technical features such as pronation control.</li>' +
          '<li>Leave room for your toes. A common tip is to try shoes on late in the day, when feet are slightly larger.</li>' +
          '<li>Wear new shoes on a few short walks before a long one.</li>' +
          '<li>Sports socks without rough seams that wick moisture (rather than plain cotton) lower the chance of blisters.</li></ul>' +
          '<h2>Warm-up</h2>' +
          '<p>A few minutes of easy walking before the brisk part raises your heart rate and breathing gradually and warms up your muscles. Long static stretching before exercise is not needed.</p>' +
          '<h2>Cool-down</h2>' +
          '<p>A few minutes of easy walking at the end brings your breathing back to normal. Evidence that cooling down prevents next-day soreness is weak, but an easy finish feels better.</p>' +
          '<h2>In this plan</h2>' +
          '<p>Brisk and power-interval sessions include a few minutes of easy warm-up and cool-down, listed in the session details.</p>' +
          '<p class="learn-src"><b>Sources:</b> Nigg et al. (2015), <i>Br J Sports Med</i> 49:1290–1294 (shoe comfort); Bishop (2003), <i>Sports Med</i>; Behm et al. (2016), <i>Appl Physiol Nutr Metab</i>; Van Hooren &amp; Peake (2018), <i>Sports Med</i>.</p>'
      },
      walkSafe: {
        title: 'Walking in later life and with joint pain',
        summary: 'Safety tips for people 60 and over, and for anyone with knee or hip pain.',
        body:
          '<h2>Before you start</h2>' +
          '<p>If you have heart disease, diabetes or kidney disease, or you get chest pain, dizziness or unusual shortness of breath during activity, talk to your doctor before starting or stepping up.</p>' +
          '<h2>60 and over</h2>' +
          '<ul><li>The same 150 minutes is recommended for people 65 and over, plus at least 3 days a week of balance and strength training to help prevent falls.</li>' +
          '<li>If you are not there yet, be as active as your condition allows.</li>' +
          '<li>Shoes with non-slip soles, a flat and well-lit route, and on very hot or icy days a better time of day or an indoor space.</li></ul>' +
          '<h2>Knee or hip pain (osteoarthritis)</h2>' +
          '<p>Clinical guidelines (American College of Rheumatology and OARSI, 2019) count exercise, including walking, as a core treatment for knee and hip osteoarthritis. Some discomfort while walking can be normal; however:</p>' +
          '<ul><li>If pain keeps getting worse during the walk, or is worse than usual a few hours later and into the next morning, walk less next time.</li>' +
          '<li>Sudden swelling, a joint locking or limping means stop and see a doctor or physiotherapist.</li></ul>' +
          '<h2>In this plan</h2>' +
          '<ul><li>For people 60 and over, weekly growth is at most 5% and the plan starts one level lower.</li>' +
          '<li>If you log pain in your check-in, that day\'s session is made lighter or cancelled.</li>' +
          '<li>Gaam does not diagnose and does not replace a doctor or physiotherapist.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Bull et al. (2020), <i>Br J Sports Med</i> 54:1451–1462; Kolasinski et al. (2020), <i>Arthritis Care Res</i> 72:149–162 (ACR 2019); Bannuru et al. (2019), <i>Osteoarthritis Cartilage</i> 27:1578–1589 (OARSI); Riebe et al. (2015), <i>Med Sci Sports Exerc</i> 47:2473–2479.</p>'
      },
      walkToRun: {
        title: 'From walking to running',
        summary: 'When and how to start running: mixing running and walking.',
        body:
          '<h2>When are you ready?</h2>' +
          '<p>In running, the force on your legs with each step is roughly two to three times body weight, compared with about once in walking. That is why it helps to build a walking base first.</p>' +
          '<ul><li>When you reach walking level 5 (about 120 to 150 minutes a week), you will see a suggestion to start running.</li>' +
          '<li>With the "Get ready to run" goal, the plan works toward 120 minutes of walking a week; 150 if you cannot yet walk briskly for 30 minutes without stopping.</li></ul>' +
          '<h2>Run-walk</h2>' +
          '<p>Start with short running segments between walking, for example 1 minute of easy running and 2 minutes of walking, then gradually lengthen the running and shorten the walking. Keep the running easy: you should be able to say full sentences. If running causes pain, going back to a few more weeks of walking is fine.</p>' +
          '<h2>In this plan</h2>' +
          '<ul><li>Saying "yes" on the running suggestion card replaces your walking plan with the running plan from scratch (run-walk, starting at 1 minute running and 2 minutes walking); your training history is kept.</li>' +
          '<li>At the end of each week we ask how it went; if it was too hard, the same stage is repeated.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Nilsson &amp; Thorstensson (1989), <i>Acta Physiol Scand</i> 136:217–227 (ground reaction forces in walking and running); Garber et al. (2011), <i>Med Sci Sports Exerc</i> 43:1334–1359.</p>'
      },
      freeruns: {
        title: 'Free runs and plan suggestions',
        summary: 'How runs outside the plan are counted and why the plan suggests changes afterwards.',
        body:
          '<p>Whenever you like, even on a rest day, you can run with “Log a free run”. It counts toward your weekly volume and history.</p>' +
          '<h2>Why do you get a suggestion afterwards?</h2>' +
          '<ul><li><b>Weekly volume:</b> if the week goes above 110% of the plan, the next easy runs are suggested shorter. This is the plan’s own 10% growth limit.</li>' +
          '<li><b>One very long run:</b> a run more than 10% longer than your longest run of the past month has been linked to more injuries (Frandsen et al., 2025).</li>' +
          '<li><b>Two hard days in a row:</b> hard sessions need at least 48 hours between them; after a hard free run, tomorrow’s hard session is suggested easy.</li>' +
          '<li><b>80/20:</b> if the hard share of the week goes above about 20%, the next quality session is suggested easy.</li></ul>' +
          '<h2>Your call</h2>' +
          '<p>Nothing changes unless you tap Accept. If you logged pain or an injury, pain and injury rules come first. Your goal and race never change automatically.</p>' +
          '<p class="learn-src"><b>Sources:</b> Nielsen et al. (2014), JOSPT; Frandsen et al. (2025), BJSM; Seiler (2010), 80/20 intensity distribution.</p>'
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = d;
  else root.CoachI18n.extend('en', 'learn', d);
})(this);
