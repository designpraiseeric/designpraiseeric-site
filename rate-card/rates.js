/* =====================================================================
   LIVE RATE CARD — every price, rule and policy lives in this file.
   Edit here; app.js reads it and never needs to change for price updates.

   HOW PRICES WORK
   All money values are naira for a STANDARD-tier client in NIGERIA.
   The engine then applies the client's tier and market, and converts to
   the display currency at the FX rate below.

     production = (category.base + every option's b) × every scale × every m
     lines      = p × production   (shown as their own line)
                + a                (fixed line, scaled by tier and market)
                + pass             (third-party cost: market-scaled, NOT tier-discounted)
     range      = total × band.lo … total × band.hi  (widened by "not sure" answers)

   OPTION EFFECTS (any combination)
     m: 1.2       multiply production (style, complexity…)
     b: 50000     add to the base before multipliers
     p: 0.15      add a line worth 15% of production (rush, rights, extra formats…)
     a: 40000     add a fixed line
     pass: 40000  add a third-party cost line (talent, stock, rentals)
     perMin       scale a/pass by the film's length in minutes (min 1)
     perDay       scale a/pass by the number of shoot days
     u: 1         "not sure" — widens the range a little
     when:{q,any} the effect only counts when another question has one of these answers
     needScale    multiplies every "Need it" asset line (used by the AI options)
     cats:[…]     the option only appears for these categories
     perChar      scale a/pass by the number of characters
     perQ:'id'    scale a/pass by the value of that range question (e.g. actors × days)
     aiScale      the AI options' needScale applies to this line too (e.g. generated voices)
     qty:{def,max,unit,steps?}  the client sets how many; p/a/pass are PER UNIT, and the line gets the
                  quantity discount from `steps` (or the shared `qtySteps`). def is the quantity the old single
                  price covered, so the default never changes; steps start above it. A higher quantity never costs less.
   QUESTION FIELDS: show:{q,in,cats?} hides a question unless another has one of these answers; hideIf:{q,in} hides it when it does
     (film's shoot questions disappear for AI-led work); notes:{optionId:'text'} explains a choice
   RANGE QUESTIONS
     scale:{ref, exp}  production × (value / ref) ^ exp   (exp < 1: longer = cheaper per unit)

   CHECKS (engine.js, numbers in `checks` below)
     Answers are checked against each other before they're priced. An impossible answer is priced at the
     realistic minimum and explained; work the calculator can't price well is marked "needs a call".
     The server (/api/estimate) prices every emailed estimate again from the raw answers, so an edited page can't change a figure.
   ===================================================================== */
(typeof window !== 'undefined' ? window : globalThis).RATES = {
  version: '2026-11-26f',
  owner: { name: 'Divinepraise Eric', studio: 'DesignPraise Studio', email: 'divinepraiseeric@gmail.com', wa: '2348135726234' },

  /* Range band around the computed figure. ANCHOR: a standard-tier motion video, motion only,
     all assets supplied, comes out at ₦120,000 at 90 s (low end) and ₦350,000 at 180 s (high end).
     That's motion's base (215,000 at 135 s) with this band. Every other category was set relative to it. */
  band: { lo: 0.79, hi: 1.275, perUnsure: 0.04 },

  /* ---------- quantity discounts for countable lines (thumbnails, language versions, templates…) ----------
     From this many units, every unit on that line is this much cheaper. Lines can set their own `steps`.
     Keep each step small enough that one more unit never lowers the line: (from − 1) × (1 − previous off) ≤ from × (1 − off).
     The engine enforces this anyway, but then the "% off" shown is the true effective figure, not the table's. */
  qtySteps: [{ from: 3, off: 0.1 }, { from: 6, off: 0.15 }, { from: 10, off: 0.2 }],

  /* One working day of studio time at standard tier (used for timeline estimates). */
  dayRate: 36000,

  /* ---------- checks: answers that don't fit together (Claude's recommended numbers, 26 Nov; adjust freely) ---------- */
  checks: {
    film: {
      /* Finished minutes a shoot can cover in one day: [fastest possible, comfortable].
         Fewer days than "fastest" are priced at that minimum; between the two, a tight-schedule line is added. */
      pace: { brand: [4, 2], ad: [2, 1], mv: [5, 3], doc: [8, 4], short: [8, 4], testi: [20, 10], event: [60, 30], church: [60, 30] },
      /* Answers that slow a shoot down (pace × factor). */
      slow: { crew: { solo: 0.85, large: 0.85 }, blend: { vfx: 0.85 } },
      /* Counts that slow a shoot: pace ÷ (1 + k × (count − 1)). 4 locations ≈ ×0.74, 7 actors ≈ ×0.85. */
      slowPer: { locs: 0.12, actors: 0.03 },
      locsPerDay: [3, 2], // locations a shoot day can cover: [fastest, comfortable]; shoot days are raised to fit
      tight: { p: 0.25, line: 'Tight shoot schedule (long days, extra hands)' }, // at the minimum; shrinks to 0 at the comfortable number of days
      longForm: 1800,   // seconds: longer work goes to a call…
      feature: 3600,    // …with a feature-film message from this length
      longOk: ['event', 'church', 'testi'] // except full-length coverage, which is fine at any length
    },
    edit: { ratio: 1 },        // raw footage must be at least this × the finished length
    emergencyMaxDays: 10,      // more working days of effort than this can't be an emergency job → needs a call
    callAbove: 25000000,       // estimates above this (naira at Nigerian level) → needs a call
    savingsFloor: 0.6,         // tier discount × volume or retainer × upfront saving never go below 60% of the studio fee
    validDays: 14              // an emailed estimate is good for this many days
  },

  /* ---------- currencies ----------
     fx = naira per unit: the REFERENCE rate, set when the market levels below were set.
     The page also fetches a live rate from /api/fx (refreshed every 6 hours) and applies fxRules.
     If the live rate can't be fetched, these reference rates are used. */
  currencies: {
    NGN: { symbol: '₦', fx: 1, round: 5000, name: 'Naira' },
    USD: { symbol: '$', fx: 1400, round: 10, name: 'US dollar' },   // NFEM ≈ ₦1,357, parallel ≈ ₦1,440 (Nov 2026)
    GBP: { symbol: '£', fx: 1800, round: 10, name: 'Pound sterling' } // ≈ ₦1,790–1,840 (Nov 2026)
  },
  fxRules: {
    live: true,            // use the live rate at all (false = reference rates only)
    maxMove: 0.3,          // ignore a live rate more than 30% away from the reference (bad data); reference is used instead
    foreignFloor: true,    // clients outside Nigeria: a weaker naira never lowers their price (lower of live and reference is used)
    nigeriaLive: true      // Nigerian clients viewing $ or £: plain live conversion of their naira price
    // The server also ignores moves under 1.5% between refreshes, so figures don't jitter (functions/api/fx.js)
  },

  /* ---------- markets: price level vs Nigeria, by economic level not exchange rate ---------- */
  markets: [
    { id: 'ng', label: 'Nigeria', level: 1, currencies: ['NGN', 'USD', 'GBP'], def: 'NGN', revenue: 'ngn' },
    { id: 'af', label: 'Elsewhere in Africa', level: 2, currencies: ['USD', 'GBP'], def: 'USD', revenue: 'usd' },
    { id: 'uk', label: 'United Kingdom', level: 5.5, currencies: ['GBP', 'USD'], def: 'GBP', revenue: 'gbp' },
    { id: 'us', label: 'United States or Canada', level: 6, currencies: ['USD', 'GBP'], def: 'USD', revenue: 'usd' },
    { id: 'eu', label: 'Europe, Australia, NZ, Gulf states', level: 5.5, currencies: ['USD', 'GBP'], def: 'USD', revenue: 'usd' },
    { id: 'row', label: 'Anywhere else', level: 3, currencies: ['USD', 'GBP'], def: 'USD', revenue: 'usd' }
  ],

  /* ---------- client tiers ---------- */
  tiers: [
    { id: 'community', label: 'Community', note: 'Nonprofits, churches, students and personal projects', m: 0.75 },
    { id: 'startup', label: 'Early startup', note: 'New ventures and solo creators', m: 0.85 },
    { id: 'small', label: 'Small business', note: 'Small teams with steady trade', m: 0.92 },
    { id: 'standard', label: 'Standard', note: 'Established businesses and agencies', m: 1 },
    { id: 'growth', label: 'Growth', note: 'Larger or well-funded companies', m: 1.3 },
    { id: 'enterprise', label: 'Enterprise', note: 'Corporates, government and multinationals', m: 1.7 }
  ],
  /* score → tier. Score = organisation + team size + revenue + funding points.
     Nonprofit-type organisations land in Community below the "community" threshold, everyone else in Early startup. */
  tierRules: { community: 1, small: 2, standard: 4, growth: 6, enterprise: 8 },

  /* ---------- step 1: about you ---------- */
  about: [
    { id: 'for', type: 'single', label: 'Who is this for?', hint: 'If you’re arranging it for another organisation, answer the questions below about them, the one paying.', options: [
      { id: 'self', label: 'My own organisation or project', pts: 0 }, { id: 'other', label: 'I’m arranging it for another organisation', pts: 0 }
    ] },
    { id: 'org', type: 'single', label: 'What best describes the organisation paying?', options: [
      { id: 'personal', label: 'Individual or personal project', pts: 0, np: true },
      { id: 'student', label: 'Student or school project', pts: 0, np: true },
      { id: 'ngo', label: 'Nonprofit, NGO or charity', pts: -1, np: true },
      { id: 'church', label: 'Church or ministry', pts: -1, np: true },
      { id: 'creator', label: 'Creator or personal brand', pts: 1 },
      { id: 'startup', label: 'Early-stage startup', pts: 1 },
      { id: 'smb', label: 'Small business', pts: 2 },
      { id: 'company', label: 'Established company', pts: 2 },
      { id: 'agency', label: 'Agency (work for your client)', pts: 2 },
      { id: 'corp', label: 'Large corporate, bank or telecom', pts: 4 },
      { id: 'gov', label: 'Government or public body', pts: 4 },
      { id: 'mnc', label: 'Multinational or global brand', pts: 5 }
    ] },
    { id: 'size', type: 'single', label: 'How many people work there?', options: [
      { id: 's1', label: 'Just me', pts: 0 }, { id: 's2', label: '2–10', pts: 0 }, { id: 's3', label: '11–50', pts: 1 },
      { id: 's4', label: '51–250', pts: 2 }, { id: 's5', label: '251–1,000', pts: 3 }, { id: 's6', label: 'Over 1,000', pts: 4 }
    ] },
    { id: 'revenue', type: 'single', label: 'Yearly revenue or budget (roughly)', hint: 'Shown in your market’s currency. Choose “Prefer not to say” if you like; it widens the estimate.', options: {
      ngn: [{ id: 'r0', label: 'Under ₦20m', pts: 0 }, { id: 'r1', label: '₦20m–₦200m', pts: 1 }, { id: 'r2', label: '₦200m–₦2bn', pts: 2 }, { id: 'r3', label: 'Over ₦2bn', pts: 3 }, { id: 'rx', label: 'Prefer not to say', pts: 1, u: 2 }],
      usd: [{ id: 'r0', label: 'Under $100k', pts: 0 }, { id: 'r1', label: '$100k–$1m', pts: 1 }, { id: 'r2', label: '$1m–$20m', pts: 2 }, { id: 'r3', label: 'Over $20m', pts: 3 }, { id: 'rx', label: 'Prefer not to say', pts: 1, u: 2 }],
      gbp: [{ id: 'r0', label: 'Under £80k', pts: 0 }, { id: 'r1', label: '£80k–£800k', pts: 1 }, { id: 'r2', label: '£800k–£15m', pts: 2 }, { id: 'r3', label: 'Over £15m', pts: 3 }, { id: 'rx', label: 'Prefer not to say', pts: 1, u: 2 }]
    } },
    { id: 'funding', type: 'single', label: 'How is it funded?', options: [
      { id: 'self', label: 'Self-funded or from sales', pts: 0 }, { id: 'grant', label: 'Grants or donations', pts: 0 },
      { id: 'seed', label: 'Pre-seed or seed', pts: 0 }, { id: 'series', label: 'Series A or later', pts: 2 },
      { id: 'listed', label: 'Listed, public or government budget', pts: 2 }, { id: 'na', label: 'Not applicable', pts: 0 }
    ] }
  ],

  /* ---------- shared delivery questions (categories list which they use) ---------- */
  shared: {
    turnaround: { id: 'turnaround', type: 'single', label: 'Turnaround', hint: 'Standard time is worked out from the scope and shown on the estimate.', options: [
      { id: 'flex', label: 'Flexible (no fixed date)', m: 0.95, speed: 1.4 },
      { id: 'std', label: 'Standard', def: true, speed: 1 },
      { id: 'prio', label: 'Priority (about 25% faster)', p: 0.25, speed: 0.75, line: 'Priority turnaround' },
      { id: 'rush', label: 'Rush (about 40% faster)', p: 0.5, speed: 0.6, line: 'Rush turnaround' },
      { id: 'emerg', label: 'Emergency (days, if I’m free)', p: 0.9, speed: 0.4, u: 1, line: 'Emergency turnaround' }
    ] },
    revisions: { id: 'revisions', type: 'single', label: 'Revision rounds', hint: 'Two rounds are included at each review stage.', options: [
      { id: 'r2', label: '2 rounds (included)', def: true }, { id: 'r3', label: '3 rounds', p: 0.1, line: 'Extra revision round' },
      { id: 'r4', label: '4 rounds', p: 0.18, line: 'Two extra revision rounds' }
    ] },
    brand: { id: 'brand', type: 'single', label: 'Brand guidelines', options: [
      { id: 'full', label: 'Full guidelines (logo, colours, type, rules)', def: true },
      { id: 'logo', label: 'Logo and colours only', m: 1.06 },
      { id: 'none', label: 'Nothing yet', m: 1.12 },
      { id: 'ns', label: 'Not sure', m: 1.05, u: 1 }
    ] },
    channels: { id: 'channels', type: 'multi', label: 'Where will it be seen?', hint: 'Choose all that apply.', options: [
      { id: 'organic', label: 'Website and organic social', def: true },
      { id: 'internal', label: 'Internal, events or church services' },
      { id: 'paid', label: 'Paid social and digital ads', p: 0.15, line: 'Usage: paid digital' },
      { id: 'tv', label: 'TV broadcast', p: 0.35, line: 'Usage: broadcast' },
      { id: 'ooh', label: 'Cinema, billboards or screens', p: 0.25, line: 'Usage: cinema and outdoor' }
    ] },
    territory: { id: 'territory', type: 'single', label: 'Territory', hint: 'Time and territory only add to the price for paid, broadcast or outdoor use.', options: [
      { id: 'one', label: 'One country', def: true }, { id: 'region', label: 'A region (e.g. West Africa, EU)', p: 0.08, line: 'Usage: regional', when: { q: 'channels', any: ['paid', 'tv', 'ooh'] } },
      { id: 'world', label: 'Worldwide', p: 0.15, line: 'Usage: worldwide', when: { q: 'channels', any: ['paid', 'tv', 'ooh'] } }
    ] },
    term: { id: 'term', type: 'single', label: 'How long will it be used?', options: [
      { id: 'y1', label: 'Up to 1 year' }, { id: 'y3', label: 'Up to 3 years', p: 0.08, line: 'Usage: 3 years', when: { q: 'channels', any: ['paid', 'tv', 'ooh'] } },
      { id: 'perp', label: 'Indefinitely', def: true, p: 0.15, line: 'Usage: no time limit', when: { q: 'channels', any: ['paid', 'tv', 'ooh'] } },
      { id: 'buy', label: 'Full buyout and exclusivity', p: 0.35, line: 'Full buyout' }
    ] },
    portfolio: { id: 'portfolio', type: 'single', label: 'Can I show the work in my portfolio?', options: [
      { id: 'yes', label: 'Yes, after release', def: true }, { id: 'later', label: 'Yes, after an agreed date' },
      { id: 'nda', label: 'No (NDA)', p: 0.1, line: 'No portfolio use (NDA)' }
    ] },
    videoFormats: { id: 'formats', type: 'multi', label: 'Deliverable formats', hint: 'One master (16:9 or your main ratio) is included.', options: [
      { id: 'master', label: 'Master in one aspect ratio', def: true, lock: true },
      { id: 'vert', label: 'Vertical 9:16', p: 0.12, line: 'Vertical version' },
      { id: 'sq', label: 'Square 1:1 or 4:5', p: 0.1, line: 'Square version' },
      { id: 'cut', label: 'Cutdowns (shorter edits, e.g. 6 s, 15 s, 30 s)', p: 0.05, line: 'Cutdowns', qty: { def: 3, max: 12, unit: 'cutdowns', steps: [{ from: 5, off: 0.1 }, { from: 8, off: 0.2 }] } },
      { id: 'subs', label: 'Plain captions or subtitles', a: 20000, perMin: true, line: 'Captions' },
      { id: 'kcap', label: 'Styled animated captions (word by word)', p: 0.12, a: 10000, line: 'Animated captions' },
      { id: 'lang', label: 'Other language versions', p: 0.15, line: 'Language versions', qty: { def: 1, max: 10, unit: 'languages' } },
      { id: 'alpha', label: 'ProRes or transparent files', a: 15000, line: 'Mastering files' },
      { id: 'proj', label: 'Editable project files', p: 0.15, line: 'Project files' }
    ] }
  },

  /* ---------- production questions shown at the end of Details (categories list which they use in `production`) ---------- */
  production: {
    ai: { id: 'ai', type: 'single', label: 'AI in the production', hint: 'How much AI you’re comfortable with in the work. Some brands don’t allow it at all; that’s fine.', options: [
      { id: 'none', label: 'Handmade only, no AI tools at all', m: 1.2 },
      { id: 'assist', label: 'AI tools behind the scenes are fine', def: true },
      { id: 'elements', label: 'AI-generated elements are welcome', m: 0.97, needScale: 0.55 },
      { id: 'led', label: 'Mostly AI-generated, directed and finished by hand', m: 0.6, needScale: 0.4, pass: 25000, perMin: true, u: 1, line: 'Generation credits', cats: ['motion', 'anim2d', 'anim3d', 'film', 'artdir', 'motionsys'] }
    ], notes: {
      none: 'No generative tools anywhere, including stock, upscaling and voice. It takes longer, which is reflected in the figure.',
      elements: 'Backgrounds, B-roll, stills or voice may be generated; design, animation and finishing stay handmade. AI-generated parts may not be protected by copyright, so exclusivity can’t be guaranteed for them.',
      led: 'Shots are generated, then directed, selected, edited, graded and finished by me. There is no shoot, so crew, kit and cast drop out. AI-generated parts may not be protected by copyright, so exclusivity can’t be guaranteed for them.'
    } },
    disclose: { id: 'disclose', type: 'single', label: 'Does the AI use need to be disclosed?', show: { q: 'ai', in: ['elements', 'led'] }, options: [
      { id: 'no', label: 'No requirement', def: true }, { id: 'client', label: 'We’ll disclose it ourselves' },
      { id: 'label', label: 'Add a “made with AI” label to the work' }, { id: 'ns', label: 'Not sure', u: 1 }
    ] },
    reference: { id: 'reference', type: 'single', label: 'Is it based on someone else’s work?', options: [
      { id: 'own', label: 'No, our own direction', def: true },
      { id: 'inspired', label: 'Inspired by a reference' },
      { id: 'close', label: 'Close to a specific ad or film' }
    ], notes: {
      inspired: 'Good. Share it in the references step and I’ll use it for tone, pace and quality.',
      close: 'I’ll match the quality and energy, but the characters, look and story will be your own. A close copy of another brand’s work, especially a competitor’s, can cause legal trouble and makes you look like them.'
    } },
    charRights: { id: 'charRights', type: 'single', label: 'How will the characters be used?', show: { q: 'blend', in: ['char'], cats: ['motion'] }, options: [
      { id: 'project', label: 'In this project or series only', def: true },
      { id: 'mascot', label: 'As brand mascots, anywhere', p: 0.2, line: 'Character rights (mascot use)' }
    ], notes: { mascot: 'You can use the characters in any marketing. If they’re AI-generated, they may not be protected by copyright, so others could copy them; hand-designed characters are safer as mascots.' } },
    signoff: { id: 'signoff', type: 'single', label: 'Who signs off the work?', hint: 'More approvers usually means more rounds of feedback to combine.', options: [
      { id: 'one', label: 'Just me', def: true }, { id: 'few', label: '2–3 people', m: 1.1 },
      { id: 'many', label: 'A committee or several departments', m: 1.25, u: 1 }
    ] },
    look: { id: 'look', type: 'single', label: 'How settled is the look?', options: [
      { id: 'clear', label: 'Clear: references or a style guide', def: true }, { id: 'rough', label: 'A rough idea', m: 1.05 },
      { id: 'zero', label: 'Starting from zero', p: 0.15, u: 1, line: 'Style frames and look development' }
    ] }
  },

  /* ---------- step 5: plan, volume and payment ---------- */
  volume: { id: 'count', label: 'How many pieces like this?', hint: 'Same style and brief. Each extra piece costs less because the look is already set.', min: 1, max: 20,
    steps: [{ from: 2, off: 0.05 }, { from: 3, off: 0.1 }, { from: 5, off: 0.15 }, { from: 10, off: 0.2 }] },
  series: { id: 'series', label: 'Is it a series?', hint: 'A series with recurring characters or a fixed look needs a one-off setup: characters designed and locked, voices cast, captions, product segment and end card built as templates. After that, each episode costs less.', options: [
    { id: 'no', label: 'No, one piece or unrelated pieces', def: true },
    { id: 'yes', label: 'Yes, a series with a recurring look or cast' }
  ] },
  seriesSetup: { share: 0.5, perChar: 25000, line: 'Series setup (one-off)' }, // half of one piece's production, plus each recurring character
  retainer: { id: 'retainer', label: 'Ongoing work?', options: [
    { id: 'no', label: 'One-off project', def: true, off: 0 },
    { id: 'm3', label: 'Monthly retainer, 3 months', off: 0.1, months: 3 },
    { id: 'm6', label: 'Monthly retainer, 6 months', off: 0.15, months: 6 },
    { id: 'm12', label: 'Monthly retainer, 12 months', off: 0.2, months: 12 }
  ], note: 'On a retainer, “how many pieces” means pieces per month. Volume and retainer savings don’t stack; you get whichever is higher.' },
  payPref: { id: 'pay', label: 'Payment preference', options: [
    { id: 'std', label: 'Deposit, then milestones', def: true },
    { id: 'full', label: 'Pay in full upfront (3% off)', off: 0.03 }
  ] },
  budget: { id: 'budget', label: 'What budget do you have in mind?', hint: 'This never changes the estimate. It helps me suggest the right scope.' },

  /* deposit and milestones, by total in naira-equivalent at Nigerian level */
  payment: [
    { upTo: 150000, deposit: 1, plan: [['Full payment before work starts', 1]] },
    { upTo: 1000000, deposit: 0.5, plan: [['Deposit to book', 0.5], ['Before final files', 0.5]] },
    { upTo: 5000000, deposit: 0.4, plan: [['Deposit to book', 0.4], ['On approved direction', 0.3], ['Before final files', 0.3]] },
    { upTo: Infinity, deposit: 0.3, plan: [['Deposit to book', 0.3], ['On approved direction', 0.25], ['On first full cut', 0.25], ['Before final files', 0.2]] }
  ],
  depositFloor: { international: 0.5, rush: 0.6 },

  policies: [
    ['Estimates', 'Every figure here is an estimate. The fixed quote comes after a discovery call and a written brief, and it can be higher or lower than this range. An emailed estimate is valid for 14 days.'],
    ['Revisions', 'Two rounds of revisions are included at each review stage (direction, first cut, final). A round is one set of combined notes. Changes to an approved script, storyboard or direction count as new scope.'],
    ['Deposit', 'Work is booked when the deposit is paid. Production starts after the brief is signed off.'],
    ['Refunds', 'Before direction starts, the deposit is refunded less 25% for discovery and planning. After direction starts, the deposit is non-refundable and completed milestones are due. Nothing is refunded once final files are delivered.'],
    ['Cancellation and pauses', 'Projects paused for more than 30 days by the client may be rescheduled into the next free slot. Rush and emergency slots are non-refundable once booked.'],
    ['Rights', 'Usage rights transfer when the final invoice is paid. Third-party items (music, stock, fonts, voice talent) follow their own licences.'],
    ['Late payment', 'Invoices are due within 7 days. Final files are released once the balance is paid.'],
    ['Series and retainers', 'Scripts, assets and feedback are due on agreed dates, normally 5 working days before each delivery for weekly work. Late material moves that episode to the next free slot. Unused slots carry over for one month only. The one-off setup is paid with the first month.'],
    ['Your answers', 'The estimate is priced on your answers: the scope, the assets you’ll supply, who signs off, the AI approach and the details about your organisation. If any of them turn out different, the price is worked out again. Volume and retainer savings apply to the number of pieces agreed in writing; if fewer are made, the saving is recalculated.'],
    ['Payment methods', 'Bank transfer only: naira for clients in Nigeria, US dollars or pounds for clients abroad. Crypto isn’t accepted.'],
    ['AI-generated material', 'Where you choose AI-generated elements, those parts may not be protected by copyright and the generation tools’ own terms apply, so exclusivity can’t be guaranteed for them. Handmade-only projects use no generative tools anywhere.']
  ],

  /* ---------- project categories (the client picks ONE) ---------- */
  categories: [
    {
      id: 'motion', label: 'Motion design', blurb: 'Explainers, product films, social motion, titles and logo animation', colour: '#03eed8', tiles: [4],
      base: 215000, min: 65000, rights: true, production: ['ai', 'disclose', 'reference', 'charRights', 'signoff', 'look'], logistics: ['turnaround', 'revisions', 'brand', 'formats', 'channels', 'territory', 'term', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'What kind of piece?', options: [
          { id: 'explainer', label: 'Explainer', def: true }, { id: 'product', label: 'Product or app film', m: 1.1 },
          { id: 'social', label: 'Social ad or reel', m: 0.95 }, { id: 'kinetic', label: 'Kinetic type or lyric video', m: 0.85 },
          { id: 'ui', label: 'UI or app walkthrough', m: 1 }, { id: 'data', label: 'Data or infographic film', m: 1.1 },
          { id: 'titles', label: 'Title sequence or opener', m: 1.25 }, { id: 'logo', label: 'Logo animation or sting', m: 1.3 },
          { id: 'broadcast', label: 'Broadcast package (bumpers, lower thirds)', m: 1.15 }, { id: 'stage', label: 'Event or stage screen visuals', m: 1 },
          { id: 'skit', label: 'Character skit ad (story, product demo, end card)', m: 1.1 }
        ], notes: { skit: 'A short story with characters, then your product in use, then the end card. Add “Character animation” and “App screens” below if they’re part of it.' } },
        { id: 'blend', type: 'multi', label: 'Mixed with anything else?', hint: 'For mixed projects. Choose all that apply.', options: [
          { id: 'footage', label: 'Live-action footage', m: 1.15 }, { id: '3d', label: '3D elements', m: 1.35 },
          { id: 'char', label: 'Character animation', m: 1.4 }, { id: 'vfx', label: 'Compositing or VFX', m: 1.2 },
          { id: 'screen', label: 'App screens or product walkthrough', m: 1.12 }
        ] },
        { id: 'chars', type: 'range', label: 'Characters', hint: 'Count everyone who appears, including small parts.', unit: '', min: 1, max: 8, step: 1, def: 1, scale: { ref: 1, exp: 0.25 }, show: { q: 'blend', in: ['char'] } },
        { id: 'dialogue', type: 'single', label: 'Do the characters speak?', show: { q: 'blend', in: ['char'] }, options: [
          { id: 'none', label: 'No, music or narration only', def: true },
          { id: 'lines', label: 'Yes, with lip-sync', m: 1.25, pass: 15000, perChar: true, aiScale: true, line: 'Character voices' }
        ] },
        { id: 'lang', type: 'single', label: 'Language', options: [
          { id: 'en', label: 'English', def: true }, { id: 'pcm', label: 'Pidgin' },
          { id: 'local', label: 'Yoruba, Igbo, Hausa or another language', m: 1.05 }, { id: 'mix', label: 'A mix', m: 1.03 }
        ] },
        { id: 'length', type: 'range', label: 'Length', unit: 's', min: 5, max: 600, step: 5, def: 120, scale: { ref: 135, exp: 0.85 } },
        { id: 'style', type: 'single', label: 'Visual style', options: [
          { id: 'minimal', label: 'Minimal and typographic', m: 0.9 }, { id: 'flat', label: 'Clean flat 2D', def: true },
          { id: 'collage', label: 'Photo collage or mixed media', m: 1.1 }, { id: 'depth', label: '2.5D with depth and camera moves', m: 1.2 },
          { id: 'rich', label: 'Richly illustrated', m: 1.25 }, { id: 'cine', label: 'Premium cinematic', m: 1.5 },
          { id: 'ns', label: 'Not sure yet', u: 1 }
        ] },
        { id: 'complexity', type: 'single', label: 'How much is happening on screen?', options: [
          { id: 'simple', label: 'Simple: a few elements, gentle moves', m: 0.8 }, { id: 'mod', label: 'Moderate', def: true },
          { id: 'detail', label: 'Detailed: many layers, tight timing', m: 1.3 }, { id: 'dense', label: 'Very detailed throughout', m: 1.6 },
          { id: 'ns', label: 'Not sure', u: 1 }
        ] },
        { id: 'assets', type: 'assets', label: 'What do you already have?', hint: 'The base price assumes you supply everything and I animate.', items: [
          { id: 'script', label: 'Script', need: { p: 0.12, line: 'Scriptwriting' } },
          { id: 'design', label: 'Designed frames or illustrations', need: { p: 0.45, line: 'Design and illustration' } },
          { id: 'board', label: 'Storyboard', need: { p: 0.12, line: 'Storyboard' } },
          { id: 'vo', label: 'Voiceover', need: { pass: 30000, perMin: true, line: 'Voice talent' } },
          { id: 'music', label: 'Music', need: { pass: 25000, line: 'Licensed music' } },
          { id: 'sfx', label: 'Sound design', need: { p: 0.1, line: 'Sound design' } },
          { id: 'logo', label: 'Logo and brand files', need: { a: 21000, line: 'Logo clean-up' } },
          { id: 'footage', label: 'Footage or screenshots', need: { pass: 30000, line: 'Stock footage' } }
        ] }
      ]
    },
    {
      id: 'anim2d', label: '2D animation', blurb: 'Character animation, stories, series and kids content', colour: '#038eee', tiles: [3, 4, 5],
      base: 500000, min: 170000, rights: true, production: ['ai', 'disclose', 'reference', 'charRights', 'signoff', 'look'], logistics: ['turnaround', 'revisions', 'brand', 'formats', 'channels', 'territory', 'term', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'What kind of piece?', options: [
          { id: 'explainer', label: 'Character explainer', def: true }, { id: 'story', label: 'Short story or film', m: 1.15 },
          { id: 'series', label: 'Series episode', m: 1.05 }, { id: 'pilot', label: 'Series pilot (sets up the look)', m: 1.3 },
          { id: 'kids', label: 'Kids or Bible-story content', m: 1 }, { id: 'mv', label: 'Music video', m: 1.1 }, { id: 'ad', label: 'Advert', m: 1.1 }
        ] },
        { id: 'blend', type: 'multi', label: 'Mixed with anything else?', options: [
          { id: 'motion', label: 'Motion graphics', m: 1.1 }, { id: 'footage', label: 'Live-action footage', m: 1.2 }, { id: '3d', label: '3D backgrounds or props', m: 1.25 }
        ] },
        { id: 'length', type: 'range', label: 'Length', unit: 's', min: 5, max: 900, step: 5, def: 60, scale: { ref: 60, exp: 0.9 } },
        { id: 'technique', type: 'single', label: 'Technique', options: [
          { id: 'motioncomic', label: 'Motion comic (minimal movement)', m: 0.65 }, { id: 'cutout', label: 'Cut-out', m: 0.9 },
          { id: 'rig', label: 'Rigged puppet', def: true }, { id: 'hybrid', label: 'Rigged with hand-drawn moments', m: 1.5 },
          { id: 'fbf', label: 'Frame by frame', m: 2.2 }, { id: 'ns', label: 'Not sure', u: 1 }
        ] },
        { id: 'chars', type: 'range', label: 'Main characters', unit: '', min: 1, max: 10, step: 1, def: 2, scale: { ref: 2, exp: 0.3 } },
        { id: 'extras', type: 'multi', label: 'Also needed', options: [
          { id: 'lip', label: 'Lip-sync', m: 1.2 }, { id: 'crowd', label: 'Crowd scenes', m: 1.15 }, { id: 'fx', label: 'Effects (water, fire, smoke)', m: 1.15 }
        ] },
        { id: 'complexity', type: 'single', label: 'Scene complexity', options: [
          { id: 'simple', label: 'Simple', m: 0.8 }, { id: 'mod', label: 'Moderate', def: true }, { id: 'detail', label: 'Detailed', m: 1.35 }, { id: 'ns', label: 'Not sure', u: 1 }
        ] },
        { id: 'assets', type: 'assets', label: 'What do you already have?', items: [
          { id: 'script', label: 'Script', need: { p: 0.1, line: 'Scriptwriting' } },
          { id: 'chardes', label: 'Character designs', need: { p: 0.25, line: 'Character design' } },
          { id: 'bg', label: 'Backgrounds', need: { p: 0.25, line: 'Background design' } },
          { id: 'board', label: 'Storyboard and animatic', need: { p: 0.18, line: 'Storyboard and animatic' } },
          { id: 'vo', label: 'Voice cast', need: { pass: 45000, perMin: true, line: 'Voice cast' } },
          { id: 'music', label: 'Music', need: { pass: 25000, line: 'Licensed music' } },
          { id: 'sfx', label: 'Sound design', need: { p: 0.1, line: 'Sound design' } }
        ] }
      ]
    },
    {
      id: 'anim3d', label: '3D animation', blurb: 'Product visualisation, launch films and 3D scenes', colour: '#a57bff', tiles: [0, 4, 8],
      base: 570000, min: 170000, rights: true, production: ['ai', 'disclose', 'reference', 'charRights', 'signoff', 'look'], logistics: ['turnaround', 'revisions', 'brand', 'formats', 'channels', 'territory', 'term', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'What kind of piece?', options: [
          { id: 'turn', label: 'Product turntable or hero shots', m: 0.75 }, { id: 'launch', label: 'Product launch film', def: true },
          { id: 'arch', label: 'Architecture or interior', m: 1.1 }, { id: 'abstract', label: 'Abstract loops or visuals', m: 0.85 },
          { id: 'char', label: '3D character animation', m: 1.6 }, { id: 'phone', label: 'App on a 3D phone (like ChimpX)', m: 0.9 }
        ] },
        { id: 'blend', type: 'multi', label: 'Mixed with anything else?', options: [
          { id: 'motion', label: '2D motion graphics', m: 1.1 }, { id: 'footage', label: 'Live-action footage (CG integration)', m: 1.35 }
        ] },
        { id: 'length', type: 'range', label: 'Length', unit: 's', min: 5, max: 300, step: 5, def: 30, scale: { ref: 30, exp: 0.8 } },
        { id: 'products', type: 'range', hideIf: { q: 'variant', in: ['char', 'abstract'] }, label: 'Products, objects or sets', hint: 'Each one is modelled (or prepared from your files), lit and shot.', unit: '', min: 1, max: 20, step: 1, def: 1, scale: { ref: 1, exp: 0.55 } },
        { id: 'shots', type: 'range', label: 'Separate shots (camera set-ups)', hint: 'A turntable is one shot; a launch film is usually 6–12.', unit: 'shots', min: 1, max: 60, step: 1, def: 6, scale: { ref: 6, exp: 0.25 } },
        { id: 'chars', type: 'range', show: { q: 'variant', in: ['char'] }, label: 'Characters', hint: 'Count everyone who appears, including small parts.', unit: '', min: 1, max: 8, step: 1, def: 1, scale: { ref: 1, exp: 0.35 } },
        { id: 'dialogue', type: 'single', show: { q: 'variant', in: ['char'] }, label: 'Do the characters speak?', options: [
          { id: 'none', label: 'No, music or narration only', def: true },
          { id: 'lines', label: 'Yes, with lip-sync', m: 1.3, pass: 15000, perChar: true, aiScale: true, line: 'Character voices' }
        ] },
        { id: 'model', type: 'single', label: 'Models', options: [
          { id: 'have', label: 'You supply 3D models or CAD', def: true }, { id: 'simple', label: 'I model simple objects', p: 0.3, line: '3D modelling' },
          { id: 'complex', label: 'I model complex products or sets', p: 0.65, line: 'Detailed 3D modelling' }, { id: 'ns', label: 'Not sure', p: 0.3, u: 1, line: '3D modelling' }
        ] },
        { id: 'look', type: 'single', label: 'Look', options: [
          { id: 'clay', label: 'Stylised or clay', m: 0.9 }, { id: 'clean', label: 'Clean studio', def: true }, { id: 'real', label: 'Realistic', m: 1.3 }, { id: 'photo', label: 'Photoreal hero', m: 1.7 }
        ] },
        { id: 'sim', type: 'multi', label: 'Simulations', options: [
          { id: 'cloth', label: 'Cloth', m: 1.15 }, { id: 'fluid', label: 'Liquids', m: 1.25 }, { id: 'part', label: 'Particles or smoke', m: 1.15 }
        ] },
        { id: 'res', type: 'single', label: 'Render resolution', options: [
          { id: 'hd', label: '1080p', def: true }, { id: '4k', label: '4K', m: 1.2 }
        ] },
        { id: 'assets', type: 'assets', label: 'What do you already have?', items: [
          { id: 'board', label: 'Storyboard or shot list', need: { p: 0.1, line: 'Storyboard' } },
          { id: 'mats', label: 'Material and colour references', need: { a: 30000, line: 'Look development' } },
          { id: 'music', label: 'Music', need: { pass: 25000, line: 'Licensed music' } },
          { id: 'sfx', label: 'Sound design', need: { p: 0.08, line: 'Sound design' } }
        ] }
      ]
    },
    {
      id: 'film', label: 'Film and video production', blurb: 'Directing and shooting commercials, short films, documentaries, events and church media', colour: '#d903ee', tiles: [0, 4, 8],
      base: 0, min: 170000, rights: true, production: ['ai', 'disclose', 'reference', 'signoff', 'look'], logistics: ['turnaround', 'revisions', 'brand', 'formats', 'channels', 'territory', 'term', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'What are we making?', options: [
          { id: 'brand', label: 'Brand or corporate film', b: 500000, def: true }, { id: 'ad', label: 'Commercial', b: 600000 },
          { id: 'mv', label: 'Music video', b: 500000 }, { id: 'doc', label: 'Documentary short', b: 645000 },
          { id: 'short', label: 'Short film (narrative)', b: 860000 }, { id: 'testi', label: 'Interviews or testimonials', b: 285000 },
          { id: 'event', label: 'Event coverage or highlight', b: 255000 }, { id: 'church', label: 'Church or worship media', b: 215000 }
        ] },
        { id: 'blend', type: 'multi', label: 'Mixed with anything else?', options: [
          { id: 'motion', label: 'Motion graphics', m: 1.2 }, { id: 'anim', label: 'Animated sequences', m: 1.3 }, { id: 'vfx', label: 'VFX shots', m: 1.25 },
          { id: 'drone', label: 'Drone shots', pass: 80000, perDay: true, line: 'Drone operator' }, { id: 'live', label: 'Live stream', pass: 150000, line: 'Live-stream setup' }
        ] },
        { id: 'length', type: 'range', label: 'Finished length', hint: 'Over 30 minutes is quoted on a call; the figure is a starting point.', unit: 's', min: 15, max: 7200, step: 15, def: 90, scale: { ref: 90, exp: 0.35 } },
        { id: 'days', type: 'range', hideIf: { q: 'ai', in: ['led'] }, label: 'Shoot days', hint: 'If it’s fewer than the length needs, the estimate uses the realistic minimum and tells you.', unit: 'd', min: 0.5, max: 40, step: 0.5, def: 1, scale: { ref: 1, exp: 0.8 } },
        { id: 'crew', type: 'single', hideIf: { q: 'ai', in: ['led'] }, label: 'Crew size', options: [
          { id: 'solo', label: 'Just me (director and camera)', m: 0.8 }, { id: 'small', label: 'Small crew (3–5)', def: true },
          { id: 'full', label: 'Full crew (6–12)', m: 1.6 }, { id: 'large', label: 'Large production', m: 2.4, u: 1 }
        ] },
        { id: 'kit', type: 'single', hideIf: { q: 'ai', in: ['led'] }, label: 'Camera and lighting', options: [
          { id: 'mine', label: 'Standard kit', def: true }, { id: 'cine', label: 'Cinema camera package', pass: 150000, perDay: true, line: 'Cinema camera rental' },
          { id: 'high', label: 'High-end package (lenses, lighting, grip)', pass: 400000, perDay: true, line: 'High-end equipment rental' }
        ] },
        { id: 'cast', type: 'single', hideIf: { q: 'ai', in: ['led'] }, label: 'On-screen talent', options: [
          { id: 'none', label: 'Real people or your team', def: true },
          { id: 'actors', label: 'Hired actors', pass: 50000, perDay: true, perQ: 'actors', line: 'Actors' },
          { id: 'call', label: 'Hired actors, with a casting call', a: 115000, pass: 50000, perDay: true, perQ: 'actors', line: 'Casting and cast' }
        ] },
        { id: 'actors', type: 'range', show: { q: 'cast', in: ['actors', 'call'] }, label: 'How many actors?', hint: 'Everyone with a speaking or featured part. Extras in the background count too.', unit: '', min: 1, max: 30, step: 1, def: 2 },
        { id: 'locs', type: 'range', hideIf: { q: 'ai', in: ['led'] }, label: 'Locations', hint: 'Every place the crew moves to, including a studio. About three a day is the most a shoot can cover.', unit: '', min: 1, max: 12, step: 1, def: 1, scale: { ref: 1, exp: 0.18 } },
        { id: 'studio', type: 'single', hideIf: { q: 'ai', in: ['led'] }, label: 'Studio rental', options: [
          { id: 'no', label: 'No studio', def: true }, { id: 'yes', label: 'Rent a studio', pass: 150000, perDay: true, line: 'Studio rental' }
        ] },
        { id: 'where', type: 'single', hideIf: { q: 'ai', in: ['led'] }, label: 'Where is the shoot?', options: [
          { id: 'lagos', label: 'Lagos', def: true }, { id: 'ng', label: 'Elsewhere in Nigeria', pass: 150000, line: 'Travel and lodging' },
          { id: 'intl', label: 'Outside Nigeria', pass: 600000, u: 2, line: 'International travel (quoted separately)' }
        ] },
        { id: 'post', type: 'multi', label: 'Post-production', hint: 'A standard edit is included.', options: [
          { id: 'grade', label: 'Colour grade', p: 0.1, line: 'Colour grade' }, { id: 'mix', label: 'Sound design and mix', p: 0.1, line: 'Sound mix' },
          { id: 'score', label: 'Original music', pass: 150000, line: 'Composer' }
        ] },
        { id: 'assets', type: 'assets', label: 'What do you already have?', items: [
          { id: 'script', label: 'Script or treatment', need: { p: 0.12, line: 'Script and treatment' } },
          { id: 'board', label: 'Storyboard or shot list', need: { p: 0.08, line: 'Storyboard' } },
          { id: 'permits', label: 'Location permits', need: { pass: 50000, line: 'Permits' } },
          { id: 'wardrobe', label: 'Wardrobe and props', need: { pass: 60000, line: 'Wardrobe and props' } },
          { id: 'music', label: 'Music', need: { pass: 30000, line: 'Licensed music' } }
        ] }
      ]
    },
    {
      id: 'edit', label: 'Editing and post', blurb: 'Edits from your footage: social, YouTube, promos, events and sermons', colour: '#ffa800', tiles: [0, 2, 6, 8],
      base: 65000, min: 35000, rights: false, production: ['ai', 'disclose', 'reference', 'signoff', 'look'], logistics: ['turnaround', 'revisions', 'brand', 'formats', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'What kind of edit?', options: [
          { id: 'social', label: 'Social reel or short', m: 1 }, { id: 'yt', label: 'YouTube or long-form', def: true },
          { id: 'promo', label: 'Promo or corporate', m: 1.2 }, { id: 'doc', label: 'Documentary', m: 1.4 },
          { id: 'event', label: 'Event highlight', m: 1.05 }, { id: 'talk', label: 'Podcast or talking head', m: 0.7 },
          { id: 'sermon', label: 'Sermon or service', m: 0.6 }, { id: 'mv', label: 'Music video', m: 1.25 }, { id: 'trailer', label: 'Trailer', m: 1.3 }
        ] },
        { id: 'length', type: 'range', label: 'Finished length', unit: 's', min: 15, max: 3600, step: 15, def: 300, scale: { ref: 120, exp: 0.75 } },
        { id: 'footage', type: 'range', label: 'Raw footage', unit: 'h', min: 0.5, max: 40, step: 0.5, def: 2, scale: { ref: 2, exp: 0.3 } },
        { id: 'extras', type: 'multi', label: 'Also needed', options: [
          { id: 'story', label: 'Find the story (no script)', m: 1.2 }, { id: 'multicam', label: 'Multicam sync', m: 1.15 },
          { id: 'grade', label: 'Colour grade', p: 0.2, line: 'Colour grade' }, { id: 'audio', label: 'Audio clean-up and mix', p: 0.15, line: 'Audio mix' },
          { id: 'titles', label: 'Motion titles and lower thirds', p: 0.15, line: 'Motion titles' }, { id: 'thumb', label: 'Thumbnails', a: 21000, line: 'Thumbnails', qty: { def: 1, max: 30, unit: 'thumbnails', steps: [{ from: 5, off: 0.15 }, { from: 10, off: 0.2 }] } }
        ] },
        { id: 'assets', type: 'assets', label: 'What do you already have?', items: [
          { id: 'music', label: 'Music', need: { pass: 20000, line: 'Licensed music' } },
          { id: 'broll', label: 'B-roll', need: { pass: 30000, line: 'Stock B-roll' } },
          { id: 'gfx', label: 'Brand graphics pack', need: { a: 45000, line: 'Graphics pack' } }
        ] }
      ]
    },
    {
      id: 'vfx', label: 'Colour and VFX', blurb: 'Grading, compositing, tracking, clean-up and screen replacement', colour: '#eed903', tiles: [0, 2, 4, 6, 8],
      base: 0, min: 45000, rights: false, production: ['ai', 'disclose', 'signoff', 'look'], logistics: ['turnaround', 'revisions', 'formats', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'Main job', hint: 'Price is per shot.', options: [
          { id: 'grade', label: 'Colour grade', b: 11000, def: true }, { id: 'comp', label: 'Green screen or compositing', b: 45000 },
          { id: 'track', label: 'Tracking and screen replacement', b: 30000 }, { id: 'clean', label: 'Clean-up or object removal', b: 35000 },
          { id: 'ext', label: 'Sky or set extension', b: 55000 }, { id: 'beauty', label: 'Beauty or retouch', b: 30000 }, { id: 'cg', label: 'CG integration', b: 85000 }
        ] },
        { id: 'blend', type: 'multi', label: 'Also in the same shots', options: [
          { id: 'grade', label: 'Grade', m: 1.15 }, { id: 'comp', label: 'Compositing', m: 1.3 }, { id: 'track', label: 'Tracking', m: 1.2 }, { id: 'clean', label: 'Clean-up', m: 1.2 }
        ] },
        { id: 'shots', type: 'range', label: 'Number of shots', unit: 'shots', min: 1, max: 300, step: 1, def: 20, scale: { ref: 1, exp: 0.9 } },
        { id: 'difficulty', type: 'single', label: 'Difficulty', options: [
          { id: 'easy', label: 'Easy', m: 0.7 }, { id: 'mod', label: 'Moderate', def: true }, { id: 'hard', label: 'Hard', m: 1.6 }, { id: 'hero', label: 'Hero shots', m: 2.5 }, { id: 'ns', label: 'Not sure', u: 1 }
        ] },
        { id: 'plates', type: 'single', label: 'Footage quality', options: [
          { id: 'good', label: 'Well shot (log, clean)', def: true }, { id: 'ok', label: 'Average', m: 1.2 }, { id: 'poor', label: 'Difficult (noise, motion blur, phone)', m: 1.5 }
        ] },
        { id: 'look', type: 'multi', label: 'Look development', options: [
          { id: 'lut', label: 'Custom LUT or show look', a: 85000, line: 'Look development' }, { id: 'hdr', label: 'HDR deliverable', p: 0.2, line: 'HDR master' }
        ] }
      ]
    },
    {
      id: 'identity', label: 'Brand identity', blurb: 'Logos, identity systems, guidelines and rebrands', colour: '#6403ee', tiles: [1, 4],
      base: 0, min: 170000, rights: false, production: ['ai', 'disclose', 'reference', 'signoff'], logistics: ['turnaround', 'revisions', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'Scope', options: [
          { id: 'logo', label: 'Logo only', b: 255000 }, { id: 'basic', label: 'Logo and basic identity', b: 500000, def: true },
          { id: 'system', label: 'Full identity system', b: 930000 }, { id: 'rebrand', label: 'Rebrand of an existing identity', b: 685000 },
          { id: 'motion', label: 'Identity with motion identity', b: 1360000 }
        ] },
        { id: 'blend', type: 'multi', label: 'Add motion?', options: [
          { id: 'logoanim', label: 'Logo animation', a: 130000, line: 'Logo animation' }, { id: 'kit', label: 'Social motion templates', a: 170000, line: 'Motion templates' }
        ] },
        { id: 'concepts', type: 'single', label: 'Initial concepts', options: [
          { id: 'c2', label: '2 directions', def: true }, { id: 'c3', label: '3 directions', m: 1.15 }, { id: 'c5', label: '5 directions', m: 1.35 }
        ] },
        { id: 'research', type: 'single', label: 'Strategy', options: [
          { id: 'none', label: 'You have a clear brief', def: true }, { id: 'light', label: 'A short workshop', a: 85000, line: 'Brand workshop' },
          { id: 'full', label: 'Full strategy (audience, positioning)', p: 0.3, line: 'Brand strategy' }
        ] },
        { id: 'guide', type: 'single', label: 'Guidelines', options: [
          { id: 'one', label: 'One-page sheet', def: true }, { id: 'std', label: 'Standard guide (about 20 pages)', p: 0.15, line: 'Brand guidelines' },
          { id: 'full', label: 'Comprehensive brand book', p: 0.35, line: 'Brand book' }
        ] },
        { id: 'apps', type: 'multi', label: 'Applications', options: [
          { id: 'stat', label: 'Business cards and stationery', a: 55000 / 3, line: 'Stationery', qty: { def: 3, max: 10, unit: 'items', steps: [{ from: 6, off: 0.1 }] } }, { id: 'social', label: 'Social templates', a: 17000, line: 'Social templates', qty: { def: 5, max: 40, unit: 'templates', steps: [{ from: 8, off: 0.1 }, { from: 16, off: 0.15 }] } },
          { id: 'deck', label: 'Presentation template', a: 130000, line: 'Presentation template' }, { id: 'sign', label: 'Signage and merch', a: 35000, line: 'Signage and merch', qty: { def: 2, max: 20, unit: 'items', steps: [{ from: 5, off: 0.1 }, { from: 10, off: 0.15 }] } },
          { id: 'pack', label: 'Packaging', a: 170000, line: 'Packaging', qty: { def: 1, max: 12, unit: 'designs' } }, { id: 'web', label: 'Website style', a: 170000, line: 'Website style' },
          { id: 'name', label: 'Naming', a: 215000, line: 'Naming' }
        ] },
        { id: 'assets', type: 'assets', label: 'What do you already have?', items: [
          { id: 'brief', label: 'Written brief', need: { a: 30000, line: 'Brief writing' } },
          { id: 'name', label: 'Final name', need: { u: 1 } },
          { id: 'fonts', label: 'Font licences', need: { pass: 60000, line: 'Font licences' } },
          { id: 'photo', label: 'Photography', need: { pass: 80000, line: 'Stock or commissioned photos' } }
        ] }
      ]
    },
    {
      id: 'motionsys', label: 'Motion identity and templates', blurb: 'Motion systems, channel kits, Essential Graphics and automated templates', colour: '#03ee63', tiles: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      base: 0, min: 85000, rights: false, production: ['ai', 'disclose', 'reference', 'signoff', 'look'], logistics: ['turnaround', 'revisions', 'brand', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'Scope', options: [
          { id: 'logo', label: 'Logo animation only', b: 130000 }, { id: 'yt', label: 'Channel kit (intro, end screen, lower thirds)', b: 400000, def: true },
          { id: 'toolkit', label: 'Motion toolkit (titles, transitions, lower thirds)', b: 460000 }, { id: 'event', label: 'Event or broadcast package', b: 645000 },
          { id: 'system', label: 'Full motion identity with guidelines', b: 930000 }
        ] },
        { id: 'elements', type: 'range', label: 'Template elements', unit: '', min: 1, max: 40, step: 1, def: 8, scale: { ref: 8, exp: 0.6 } },
        { id: 'format', type: 'multi', label: 'Template formats', hint: 'After Effects project is included.', options: [
          { id: 'mogrt', label: 'Premiere Essential Graphics', p: 0.2, line: 'Essential Graphics' }, { id: 'resolve', label: 'DaVinci Resolve', p: 0.25, line: 'Resolve templates' },
          { id: 'canva', label: 'Canva or CapCut friendly', p: 0.15, line: 'Canva or CapCut versions' }, { id: 'auto', label: 'Automated (script- or data-driven)', p: 0.5, line: 'Automation' }
        ] },
        { id: 'complexity', type: 'single', label: 'Motion complexity', options: [
          { id: 'simple', label: 'Simple', m: 0.8 }, { id: 'mod', label: 'Moderate', def: true }, { id: 'detail', label: 'Detailed', m: 1.3 }
        ] },
        { id: 'extras', type: 'multi', label: 'Also needed', options: [
          { id: 'train', label: 'Training session for your team', a: 55000, line: 'Team training' }, { id: 'guide', label: 'Motion guidelines', p: 0.15, line: 'Motion guidelines' },
          { id: 'sound', label: 'Sonic logo or sound set', a: 85000, line: 'Sound set' }
        ] }
      ]
    },
    {
      id: 'artdir', label: 'Art direction', blurb: 'Creative direction, style frames, treatments and production design', colour: '#d903ee', tiles: [1, 3, 5, 7],
      base: 135000, min: 85000, rights: false, production: ['ai', 'disclose', 'reference', 'signoff'], logistics: ['turnaround', 'revisions', 'brand', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'What do you need?', options: [
          { id: 'frames', label: 'Style frames and look development', def: true }, { id: 'campaign', label: 'Campaign art direction', m: 1.2 },
          { id: 'treat', label: 'Treatment or pitch deck', m: 0.9 }, { id: 'set', label: 'Production design for a shoot', m: 1.1 }, { id: 'brand', label: 'Brand creative direction', m: 1.3 }
        ] },
        { id: 'blend', type: 'multi', label: 'Will it lead into…', hint: 'Production can be quoted on its own estimate.', options: [
          { id: 'motion', label: 'Motion design' }, { id: 'film', label: 'A film shoot' }, { id: 'id', label: 'An identity' }
        ] },
        { id: 'days', type: 'range', label: 'Working days (rough)', unit: 'd', min: 1, max: 30, step: 1, def: 4, scale: { ref: 1, exp: 0.95 } },
        { id: 'deliver', type: 'multi', label: 'Deliverables', options: [
          { id: 'board', label: 'Mood boards', m: 1 }, { id: 'frames', label: 'Finished style frames', m: 1.1 }, { id: 'deck', label: 'Presentation deck', a: 55000, line: 'Deck design' },
          { id: 'onset', label: 'On-set supervision', m: 1.15 }
        ] },
        { id: 'assets', type: 'assets', label: 'What do you already have?', items: [
          { id: 'brief', label: 'Brief', need: { a: 30000, line: 'Brief writing' } },
          { id: 'refs', label: 'References', need: { u: 0 } }
        ] }
      ]
    },
    {
      id: 'tools', label: 'Custom tools and training', blurb: 'After Effects and Premiere scripts, panels, pipelines and workshops', colour: '#03ee63', tiles: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      base: 0, min: 85000, rights: false, production: ['signoff'], logistics: ['turnaround', 'revisions', 'portfolio'],
      questions: [
        { id: 'variant', type: 'single', label: 'What do you need?', options: [
          { id: 'script', label: 'After Effects script', b: 215000, def: true }, { id: 'panel', label: 'After Effects panel (with interface)', b: 645000 },
          { id: 'pipe', label: 'Template automation pipeline', b: 860000 }, { id: 'plugin', label: 'Premiere or Resolve plugin', b: 715000 },
          { id: 'workshop', label: 'Workshop (one session)', b: 170000 }, { id: 'course', label: 'Course (several sessions)', b: 645000 }
        ] },
        { id: 'complexity', type: 'single', label: 'Complexity', options: [
          { id: 'simple', label: 'Simple', m: 0.7 }, { id: 'mod', label: 'Moderate', def: true }, { id: 'adv', label: 'Advanced', m: 1.6 }, { id: 'ns', label: 'Not sure', u: 1 }
        ] },
        { id: 'platforms', type: 'multi', label: 'Platforms', options: [
          { id: 'both', label: 'macOS and Windows', m: 1.1 }, { id: 'multi', label: 'More than one app', m: 1.25 }
        ] },
        { id: 'people', type: 'range', label: 'People using it or attending', unit: '', min: 1, max: 200, step: 1, def: 5, scale: { ref: 5, exp: 0.12 } },
        { id: 'extras', type: 'multi', label: 'Also needed', options: [
          { id: 'docs', label: 'Documentation and video guide', a: 55000, line: 'Docs and guide' }, { id: 'support', label: '3 months of support', p: 0.15, line: 'Support' },
          { id: 'onsite', label: 'In person (Lagos)', pass: 40000, line: 'Travel' }
        ] }
      ]
    }
  ],

  /* copy shown on the page */
  copy: {
    honest: 'Please answer as accurately as you can. Prices are set by where your business is based, its size and its budget. If details are understated to bring the figure down, the final quote will be corrected after the discovery call, so an honest answer gets you a figure you can plan with.',
    estimate: 'This is an estimate, not a quote. The final price is set after a discovery call, a look at the full scope and a written brief, and it may go up or down.',
    budgetLow: 'Your budget is below this range. On the call we can bring it closer: a shorter piece, a simpler style, or assets you supply.',
    budgetFits: 'Your budget sits within this range.',
    budgetHigh: 'Your budget is above this range, so there is room for extras such as more formats or a richer style.',
    status: { ready: '', adjusted: 'Adjusted to what’s possible', call: 'Needs a call' },
    callTotal: 'From',
    tierCheck: 'Tier pricing is confirmed on the call.'
  }
};
