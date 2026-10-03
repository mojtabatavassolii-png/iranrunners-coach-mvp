/* "Learn" section: short articles on the science behind the plan (English). Bodies are fixed, trusted HTML. */
(function (root) {
  var d = {
    title: 'Learn',
    intro: 'Short articles on the science your plan is built on, so you know <b>why</b> you do each session, not just <b>what</b> to do.',
    listAria: 'Articles',
    readMin: '{n} min read',
    back: 'All articles',
    more: 'Learn more:',
    others: 'More articles',
    articles: {
      vdot: {
        title: 'VDOT and the Jack Daniels method',
        summary: 'What VDOT is, how it comes from a single race result, and where easy, marathon, threshold, interval and repetition paces come from.',
        body:
          '<h3>What is VDOT?</h3>' +
          '<p>VDOT is a number created by <b>Jack Daniels</b>, the American coach and exercise physiologist, together with <b>Jimmy Gilbert</b>, to express a runner\'s current fitness as a single value. The name comes from VO2max (the most oxygen your body can use), but it isn\'t the same thing. VO2max is measured in a lab; VDOT comes from a real race or time trial. That means it also captures <b>running economy</b> (how much energy you need at a given speed) and your ability to hold a pace. That\'s why it\'s sometimes called a "functional" VO2max.</p>' +
          '<h3>How is it calculated?</h3>' +
          '<p>Daniels and Gilbert derived two relationships from measurements on runners:</p>' +
          '<ul><li><b>The oxygen cost of speed:</b> how much oxygen it takes to run at any given speed.</li>' +
          '<li><b>The share of capacity you can sustain:</b> the longer the race, the smaller the fraction of your maximum you can hold; about 100% for a 10-minute effort and around 80–85% for a marathon.</li></ul>' +
          '<p>Put your race speed into the first relationship, divide by the second, and you get your VDOT. For example, 10 km in 44 minutes gives a VDOT of about 46. The same number also predicts your times at other distances.</p>' +
          '<p>The result must be <b>recent</b> (the last few weeks), on a roughly flat course and run at full effort; an old result or a mountain race gives the wrong number. That\'s why the plan uses a 2, 3 or 5 km time trial or a recent race, and reminds you to repeat it every few weeks.</p>' +
          '<h3>The five training paces</h3>' +
          '<p>Each kind of training is a set share of that capacity:</p>' +
          '<ul><li><b>Easy (E):</b> roughly 65–75%. Builds the aerobic base (heart, capillaries, mitochondria) and aids recovery. Most of your weekly volume is at this pace.</li>' +
          '<li><b>Marathon (M):</b> your predicted marathon pace at this VDOT; for marathon-specific training.</li>' +
          '<li><b>Threshold (T):</b> roughly 86–90%. "Comfortably hard"; a pace a fit runner could hold for about an hour. Raises your lactate threshold.</li>' +
          '<li><b>Interval (I):</b> roughly 96–100%; close to 3–5 km race pace, in 3–5 minute reps. Targets VO2max.</li>' +
          '<li><b>Repetition (R):</b> a little faster than interval pace, in short reps with full recovery; for speed, form and running economy.</li></ul>' +
          '<h3>Why it matters</h3>' +
          '<p>The most common mistake is training at a "dream pace" or a friend\'s pace. VDOT ties your paces to your fitness <b>today</b>, so each session has exactly the effect it was designed for. Running faster than prescribed rarely speeds up progress; it mostly adds fatigue and injury risk. As you get fitter, a new time trial raises your VDOT and every pace updates together.</p>' +
          '<h3>Limitations</h3>' +
          '<p>VDOT tables assume standard conditions: cool weather, flat ground, low altitude. In heat, wind, on hills or at altitude, adjust by <b>perceived effort (RPE)</b>. If you have no result at all, the plan uses the talk test and RPE instead of paces.</p>' +
          '<p class="learn-src"><b>Sources:</b> Jack Daniels, <i>Daniels\' Running Formula</i>, 4th ed. (2022); Daniels &amp; Gilbert, <i>Oxygen Power</i> (1979).</p>'
      },
      rpe: {
        title: 'Perceived effort (RPE) and the talk test',
        summary: 'What the 1–10 scale is, how to use it, and why on hot or tired days it matters more than pace.',
        body:
          '<h3>What is RPE?</h3>' +
          '<p>RPE (Rating of Perceived Exertion) is a number you give to how hard a session feels. The idea comes from the Swedish psychologist <b>Gunnar Borg</b>, and his 1–10 version is now widely used in endurance training. Research shows RPE tracks heart rate, breathing and blood lactate well: your body senses intensity more accurately than you might think.</p>' +
          '<h3>The 1–10 scale</h3>' +
          '<ul><li><b>1–2:</b> very easy; like walking.</li>' +
          '<li><b>3–4:</b> easy; calm breathing, full sentences are comfortable. <b>Easy and long runs.</b></li>' +
          '<li><b>5–6:</b> moderate; deeper breathing, short sentences. Steady running.</li>' +
          '<li><b>7:</b> hard but controlled; only a few words. <b>Tempo and threshold.</b></li>' +
          '<li><b>8–9:</b> very hard; a word or two. <b>Intervals and repetitions.</b></li>' +
          '<li><b>10:</b> maximal; you can\'t talk. The end of a race.</li></ul>' +
          '<h3>The talk test</h3>' +
          '<p>The simplest tool for easy days: if you can speak in full sentences, you\'re at easy intensity. Studies have found that the point where you can no longer talk comfortably lines up closely with the <b>first ventilatory threshold</b>, the upper edge of low intensity. If you\'re breathing hard on an easy run, slow down, even below the target pace.</p>' +
          '<h3>Why it sometimes matters more than pace</h3>' +
          '<p>Pace is the outcome; effort is the cost. Your body feels the cost, not the number on your watch. The cost of a fixed pace goes up with:</p>' +
          '<ul><li><b>Heat and humidity:</b> some of your blood goes to the skin for cooling and your heart rate gradually drifts up, so the same pace feels harder. Slowing by 10–30 seconds per km in hot weather is normal.</li>' +
          '<li><b>Fatigue, poor sleep, stress or an oncoming illness.</b></li>' +
          '<li><b>Hills, wind, soft ground and altitude.</b></li></ul>' +
          '<p>On those days, forcing the pace turns an easy run into a hard one and spoils the next recovery. A simple rule: <b>on easy days, effort is the boss; pace is only a guide.</b></p>' +
          '<h3>In hard sessions</h3>' +
          '<p>In tempo and interval sessions the target pace leads, but RPE is your warning light. If the first rep already feels like a 10, ease the pace or shorten the session. A controlled session is far better than one you grind through and pay for over the next few days.</p>' +
          '<h3>In this plan</h3>' +
          '<p>Every session has its own target RPE. After each easy run the plan asks for your RPE; if several easy runs in a row land above 6, it suggests slowing your easy pace. Over time you\'ll learn to compare RPE with pace and heart rate, and your sense of effort will sharpen.</p>' +
          '<p class="learn-src"><b>Sources:</b> Borg (1982), <i>Med Sci Sports Exerc</i>; Foster et al. (2001), <i>J Strength Cond Res</i>; Persinger et al. (2004), <i>Med Sci Sports Exerc</i> (talk test).</p>'
      },
      eighty: {
        title: 'The 80/20 ratio',
        summary: 'Why most of your training should be easy with only a small part hard, and the research behind it.',
        body:
          '<h3>The idea</h3>' +
          '<p>About <b>80%</b> of training time at low intensity (easy, conversational) and about <b>20%</b> at moderate to high intensity. It may sound odd, but to get faster you should run slowly most of the time.</p>' +
          '<h3>Where it came from</h3>' +
          '<p><b>Stephen Seiler</b>, an American physiologist based in Norway, studied the training logs of elite endurance athletes: rowers, cross-country skiers and runners. Across sports and countries he found a shared pattern: roughly 80% of sessions easy and 20% hard. These athletes had arrived at the same answer independently, by trial and error.</p>' +
          '<h3>Controlled studies</h3>' +
          '<ul><li><b>Esteve-Lanao et al. (2007):</b> sub-elite runners trained for five months. The group doing about 80% easy improved more over a roughly 10 km race than the group doing more threshold work.</li>' +
          '<li><b>Stöggl &amp; Sperlich (2014):</b> 48 trained endurance athletes over nine weeks. The "polarised" model (mostly easy, a little very hard) produced the largest gains in VO2max and time to exhaustion, ahead of high volume, lots of threshold, or lots of intervals.</li>' +
          '<li><b>Muñoz et al. (2014):</b> recreational 10 km runners over ten weeks. The group training about 80% easy improved its 10 km time slightly more.</li></ul>' +
          '<h3>Why it works</h3>' +
          '<ul><li><b>The aerobic engine is built at low cost:</b> easy running increases mitochondria, capillaries and the heart\'s stroke volume without wearing you down, so you can run more volume.</li>' +
          '<li><b>Hard sessions need a fresh body:</b> if every day is "medium-hard" (the so-called grey zone), your easy days aren\'t easy enough and your hard days never get hard enough.</li>' +
          '<li><b>Lower risk:</b> fewer overuse injuries, less overtraining and less mental burnout.</li></ul>' +
          '<h3>A common mistake</h3>' +
          '<p>Most recreational runners run their easy days too fast, because slow running feels "pointless". They then arrive at hard sessions already tired. If you can\'t talk comfortably on an easy run, you\'re going faster than you should.</p>' +
          '<h3>In this plan</h3>' +
          '<p>From level 3 up, the hard part of the week (the main sets of tempo, interval, repetition and fartlek sessions and the fast part of long runs) is at most <b>20%</b> of weekly volume; warm-ups, recovery jogs and cool-downs count as easy. At lower levels nearly everything is easy, because the base comes first. Two hard days are never back to back.</p>' +
          '<p class="learn-src"><b>Sources:</b> Seiler &amp; Kjerland (2006), <i>Scand J Med Sci Sports</i>; Esteve-Lanao et al. (2007), <i>J Strength Cond Res</i>; Stöggl &amp; Sperlich (2014), <i>Front Physiol</i>; Muñoz et al. (2014), <i>Int J Sports Physiol Perform</i>.</p>'
      },
      types: {
        title: 'Types of hard sessions and how they differ',
        summary: 'Intervals, tempo and threshold, fartlek and hills: which energy system each targets and when to use it.',
        body:
          '<h3>First: the energy systems</h3>' +
          '<ul><li><b>Aerobic:</b> makes energy from fat and carbohydrate using oxygen. Slow but almost limitless. In any race of 5 km or longer, more than 85% of the energy comes from here.</li>' +
          '<li><b>Anaerobic glycolytic:</b> burns carbohydrate without enough oxygen. Fast but limited; efforts of 30 seconds to 2 minutes and that "burning" feeling.</li>' +
          '<li><b>Phosphocreatine:</b> instant energy for about 10 seconds; starts and sprints.</li></ul>' +
          '<p>Every hard session targets one of these, or the boundary between them.</p>' +
          '<h3>Tempo and threshold</h3>' +
          '<p><b>Target:</b> the lactate threshold, the highest intensity at which your body can still clear lactate as fast as it makes it. <b>Format:</b> 20–40 minutes continuous, or 8–10 minute blocks with short rests (threshold intervals). <b>Feel:</b> hard but controlled (RPE 7). <b>Result:</b> you hold a faster pace for longer; key for 10 km to the marathon.</p>' +
          '<h3>Intervals (VO2max)</h3>' +
          '<p><b>Target:</b> your aerobic ceiling, the most oxygen your body can use. <b>Format:</b> 3–5 minute reps (for example 800–1200 m) at about 3–5 km race pace, with a recovery jog slightly shorter than or equal to the rep. <b>Feel:</b> hard (RPE 8). <b>Result:</b> a higher ceiling for the engine; key for 5 and 10 km.</p>' +
          '<h3>Repetitions (R)</h3>' +
          '<p>Short 200–400 m reps, a little faster than interval pace, with <b>full recovery</b>. The aim is speed, form and running economy, not fatigue. When your form breaks down, the session is over.</p>' +
          '<h3>Fartlek</h3>' +
          '<p><b>Continuous</b> changes of pace with no stopping; recovery is running too. It trains several systems at once and teaches you to feel rhythm and change pace, as in a race. It needs no track, and it suits the base phase and runners who tire of rigid structure. The key difference from intervals: intervals have a precise structure and fuller rests so every rep is high quality.</p>' +
          '<h3>Hill training</h3>' +
          '<ul><li><b>Short hills (10–30 s):</b> strength and power in the legs and glutes, plus neuromuscular coordination; full recovery walking back down.</li>' +
          '<li><b>Medium hills (60–90 s):</b> an effect similar to intervals, with less impact on the joints.</li>' +
          '<li><b>Long hills and downhills:</b> muscular endurance and resilience to descending; essential for trail and ultra.</li></ul>' +
          '<h3>When to use which</h3>' +
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
          '<h3>Origin: "speed play"</h3>' +
          '<p>"Fartlek" is Swedish for <b>speed play</b>. The method was developed in the late 1930s by Swedish coach <b>Gösta Holmér</b> for Sweden\'s cross-country team, which had been beaten for years by the Finns (with stars like Paavo Nurmi). Holmér\'s idea was to combine speed and endurance in one continuous session through forests and countryside. Two of his best-known pupils, <b>Gunder Hägg</b> and <b>Arne Andersson</b>, traded the mile world record five times between 1942 and 1945.</p>' +
          '<h3>The Mona fartlek</h3>' +
          '<p>Named after <b>Steve Moneghetti</b>, the Australian marathoner who went to four Olympic Games and won the 1994 Commonwealth Games marathon, and designed by his coach <b>Chris Wardlaw</b>. The structure (after a full warm-up):</p>' +
          '<ul><li>2 × 90 s hard + 90 s "float"</li><li>4 × 60 s hard + 60 s float</li><li>4 × 30 s hard + 30 s float</li><li>4 × 15 s hard + 15 s float</li></ul>' +
          '<p>Exactly <b>20 minutes</b> in total, without stopping. The key is the "float": a fairly quick jog, never walking or standing. That\'s where the difficulty comes from; your body learns to recover while still running fairly fast and to clear lactate on the move.</p>' +
          '<p><b>Why it\'s respected:</b> because the duration is fixed, you can measure the total distance covered in the 20 minutes and compare it every few weeks, a simple benchmark of progress. It\'s used by elite and recreational runners alike. In this plan it\'s offered from <b>level 6</b>.</p>' +
          '<h3>The pyramid fartlek</h3>' +
          '<p>Hard sections of 1, 2, 3, 4, 3, 2 and 1 minutes with an easy jog in between. The long pieces in the middle sit near threshold effort and the short ones are faster. It teaches you to pace by the length of the effort and not to start the long ones too hard.</p>' +
          '<h3>The 1-1 fartlek</h3>' +
          '<p>One minute hard, one minute jog, several times in a row. The simplest way into speed work, suited to lower levels.</p>' +
          '<h3>Free, landmark-based fartlek</h3>' +
          '<p>The closest to Holmér\'s original idea: during a continuous run you surge to a landmark several times (a lamppost, the top of a rise, the next junction), with lengths varying from 15 seconds to 2 minutes. You jog until your breathing settles. It sharpens your sense of effort without a watch. In this plan it appears from <b>level 4</b>.</p>' +
          '<h3>Why fartleks earn their place</h3>' +
          '<ul><li>They train several energy systems in one session.</li><li>They simulate the pace changes of a race.</li><li>They need no track or precise distances.</li><li>They\'re more varied and more fun.</li></ul>' +
          '<p class="learn-src"><b>Sources:</b> Canadian Running Magazine and The Morning Shakeout (Mona fartlek); Athletics Weekly, "Fartlek running: Playing with speed".</p>'
      },
      tenpct: {
        title: 'The 10% rule and gradual adaptation',
        summary: 'Why sudden jumps in volume raise injury risk, and how the plan increases volume gently.',
        body:
          '<h3>What is the 10% rule?</h3>' +
          '<p>Each week\'s running volume is at most <b>10%</b> more than the week before; for example from 30 km to 33 km, not 40. The rule doesn\'t come from one specific study; it\'s a coaches\' rule of thumb that fits today\'s evidence reasonably well.</p>' +
          '<h3>Why gradual? Tissues adapt at different speeds</h3>' +
          '<ul><li><b>Heart and lungs:</b> adapt within weeks.</li>' +
          '<li><b>Muscle:</b> weeks to a few months.</li>' +
          '<li><b>Tendons, ligaments and bone:</b> months or longer. In the first weeks of a new load, bone is briefly a little more vulnerable before it gets stronger, because remodelling starts by removing old tissue.</li></ul>' +
          '<p>That\'s the catch: cardiovascular fitness arrives first, so you feel ready to run more, but your tendons and bones aren\'t yet. The result is overuse injuries: shin splints, Achilles problems, runner\'s knee and stress fractures.</p>' +
          '<h3>What the research says</h3>' +
          '<ul><li><b>Nielsen et al. (2014):</b> novice runners who raised their weekly volume by more than 30% had more of certain common running injuries than those who stayed under 10%.</li>' +
          '<li><b>Frandsen et al. (2025):</b> over 5,200 runners with GPS watch data. When a single run was more than 10% longer than the longest run of the previous 30 days, injury risk rose significantly, and the bigger the spike, the higher the risk. So it\'s not only the weekly total; <b>a single-session spike</b> matters too.</li>' +
          '<li><b>Buist et al. (2008):</b> a graded 10% programme on its own did not reduce injuries in novices compared with a standard programme. So 10% isn\'t magic; history, sleep, nutrition, intensity and past injuries matter as well.</li></ul>' +
          '<h3>The principle of gradual adaptation</h3>' +
          '<p>The body gets stronger through <b>load, recovery, adaptation</b>. Load beyond your capacity, or too little recovery, brings injury instead of adaptation. That\'s why a few weeks of increases need a lighter week so the body can catch up with the new load. Intensity is part of the load too: raising volume and intensity at the same time compounds the risk.</p>' +
          '<h3>In this plan</h3>' +
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
          '<h3>What a warm-up does</h3>' +
          '<ul><li><b>Raises muscle temperature:</b> warm muscle contracts faster and more forcefully, and nerve signals travel faster.</li>' +
          '<li><b>"Switches on" the aerobic system:</b> after a warm-up, oxygen uptake rises faster at the start of a hard effort, so the first rep leans less on anaerobic energy and doesn\'t tire you early.</li>' +
          '<li><b>Improves range of motion and coordination.</b></li>' +
          '<li><b>Mental readiness:</b> you focus for the hard work ahead.</li></ul>' +
          '<h3>Why it should match the session</h3>' +
          '<p>The harder the start of the main set, the bigger the gap between "at rest" and "first rep", and the more complete the warm-up needs to be:</p>' +
          '<ul><li><b>Easy and long runs:</b> the first few minutes of the run itself, slower than easy pace, are enough.</li>' +
          '<li><b>Tempo and threshold:</b> 10–15 minutes of progressive jogging, a few dynamic drills and 3–4 strides.</li>' +
          '<li><b>Intervals, hills and short races:</b> 10–15 minutes of jogging, activation drills and 4–6 strides near session pace, the last one right before the first rep. A short warm-up isn\'t enough here.</li></ul>' +
          '<p>Level matters too: a beginner needs a simpler, more gradual warm-up; an advanced runner usually does a more compact one with more drills.</p>' +
          '<h3>Dynamic versus static</h3>' +
          '<p><b>Dynamic drills:</b> controlled movement through a range of motion, close to running itself: leg swings, walking lunges, hip circles, high knees, skips, butt kicks. They warm the muscle and prepare it to move.</p>' +
          '<p><b>Static stretching:</b> holding a stretch still for 20–60 seconds or longer.</p>' +
          '<h3>Why static stretching after training?</h3>' +
          '<ul><li>Reviews show that long static stretches (around 60 seconds or more per muscle) right before activity can temporarily reduce strength and power slightly. Holds under 30 seconds have very little effect, but they don\'t help your running either.</li>' +
          '<li>Static stretching before running doesn\'t reliably prevent injury. In a large meta-analysis, stretching showed no protective effect, while <b>strength training</b> markedly reduced injury risk.</li>' +
          '<li>After training, when the muscle is warm, static stretching is better suited to flexibility and relaxation. It\'s optional.</li></ul>' +
          '<h3>Cooling down</h3>' +
          '<p>5–15 minutes of easy running or walking brings your heart rate and breathing down gradually. The evidence that a cool-down prevents next-day soreness is weak, but easing back to normal feels better and is a good time for light stretching.</p>' +
          '<p class="learn-src"><b>Sources:</b> Bishop (2003), <i>Sports Med</i>; Kay &amp; Blazevich (2012), <i>Med Sci Sports Exerc</i>; Behm et al. (2016), <i>Appl Physiol Nutr Metab</i>; Lauersen et al. (2014), <i>Br J Sports Med</i>; Van Hooren &amp; Peake (2018), <i>Sports Med</i>.</p>'
      },
      cycle: {
        title: 'The menstrual cycle and training',
        summary: 'A scientific summary of how the phases of the cycle may affect energy and performance.',
        body:
          '<h3>The phases</h3>' +
          '<p>A typical cycle lasts 21–35 days (28 days is used here as an example):</p>' +
          '<ul><li><b>Menstruation (about days 1–5):</b> oestrogen and progesterone are at their lowest. Cramps, fatigue or poor sleep are possible.</li>' +
          '<li><b>Follicular (to about day 14):</b> oestrogen gradually rises. Many people feel more energetic in this phase.</li>' +
          '<li><b>Ovulation (around mid-cycle).</b></li>' +
          '<li><b>Luteal (until the next period):</b> progesterone rises; core body temperature goes up by about 0.3–0.5 °C and breathing increases slightly. In the last days, as hormones fall, premenstrual symptoms may appear.</li></ul>' +
          '<h3>How it can affect training</h3>' +
          '<ul><li><b>Heat:</b> in the luteal phase, the higher body temperature may make running in hot weather a little harder. Enough fluid and electrolytes matter more.</li>' +
          '<li><b>Symptoms:</b> cramps, bloating, headaches, poor sleep and mood changes in the days before and at the start of a period can make a hard session genuinely harder.</li>' +
          '<li><b>Iron:</b> heavy bleeding raises the risk of iron deficiency, and low iron directly hurts endurance.</li></ul>' +
          '<h3>What the research says</h3>' +
          '<p>The largest meta-analysis (McNulty et al., 2020) concluded that exercise performance <b>might</b> be <b>trivially</b> reduced in the early follicular phase (the days of the period) compared with the other phases. But the effect is small, varies a lot between people, and many of the studies are low quality. The authors\' advice: rather than general rules for everyone, take a <b>personalised approach</b> based on how your own body responds.</p>' +
          '<h3>Practical tips</h3>' +
          '<ul><li>Log your cycle and symptoms alongside your training for two or three months to see your own pattern.</li>' +
          '<li>If symptoms are strong on a given day, a lighter option or active rest is perfectly sensible, but not required. For many people, light activity even eases the pain.</li>' +
          '<li>If you use the pill or another hormonal contraceptive, your hormone pattern is different and phase predictions are less useful.</li></ul>' +
          '<h3>Warning signs</h3>' +
          '<p>Missing your period for three months or more (without pregnancy or another known reason) is <b>not normal</b>, even for runners. It\'s often a sign of too little energy intake for the training load (RED-S) and can harm your bones and overall health. Very heavy bleeding or severe pain also needs a medical check.</p>' +
          '<h3>In this plan</h3>' +
          '<p>This feature is entirely optional. The plan <b>estimates</b> phases from the dates you enter and, for hard sessions on period or pre-period days, suggests a lighter option. Nothing changes without your choice, and the data stays only in your browser.</p>' +
          '<p class="learn-src"><b>Sources:</b> McNulty et al. (2020), <i>Sports Med</i> 50:1813–1827; Mountjoy et al. (2023), <i>Br J Sports Med</i> (RED-S).</p>'
      }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = d;
  else root.CoachI18n.extend('en', 'learn', d);
})(this);
