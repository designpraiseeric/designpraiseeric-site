# DesignPraise Eric — website

Static site. No build step. Hosted on Cloudflare Pages.

## Files
- `index.html` — the whole site (styles, scripts, content)
- `img/` — screenshots, Lukuluku renders (`img/luku/`), Colored Lens frames
- `fonts/` — DesignPraise Sans, Google Sans Code
- `favicon.svg`

## Contact form
Near the bottom of `index.html`, under `CONTACT SETTINGS`:
- `WEB3FORMS_KEY` — access key from web3forms.com (free; enquiries arrive by email)
- `EMAIL`, `WA` — your email and WhatsApp number (also update the two visible lines in the Contact section)
Without a key, the form falls back to opening the visitor's email app.

## Placeholders to replace
- Showreel (the reel mosaic's play button)
- Portrait in About
- Work images: set `img:'img/your-frame.jpg'` on each entry in `WORK`
- Loglines for Purple and Aró in `WORK`
- The site opens in night mode; the sun/moon button switches to day and remembers the visitor's choice.

## Work pages (/work/<project>/)
Each piece with a film gets its own page; its card on the home page links there (set `url` and `loop` on the entry in `WORK`).
- First one: `/work/chimpx/`. Copy that folder for the next project and change the words, stills and the `data-*` values on the `film.js` script tag.
- `work/film.js` (shared player) loads in stages: poster first, then a 3-second silent loop only while the film is on screen (skipped with reduced motion or data saver), and the full film only when the visitor presses play, a chapter or the timeline.
- Media for each project lives in `media/<project>/`: `<name>-loop.{av1,h264}.mp4` (768 px, about 3 s), `<name>-1080.av1.mp4`, `<name>-1080.hevc.mp4` (desktop), `<name>-720.h264.mp4` (phones and older browsers), `<name>-en.vtt` (captions), `<name>-scrub.webp` (8×5 frames, one every 0.5 s), poster and stills.
- Cloudflare Pages refuses files over 25 MB, so never upload a master render. When the media folder grows, move the videos to an R2 bucket and change `data-media` on the script tag (and the `loop` path in `WORK`); nothing else changes.

## Private brand area (/brand)
`/brand` is for the owner only. It asks for a password, then opens the brand archive: Directions A, B and C (preferred) as tabs, logos, mockups, the font kit and downloads.
- Files are read live from the private repo `designpraiseeric-brand-private` (branch `main`). Every push to that repo shows up here immediately; nothing to rebuild.
- Cloudflare secrets: `GITHUB_TOKEN` (fine-grained, Contents read-only, that repo only), `BRAND_PASSWORD`, and `BRAND_KEY` (signs the login session).
- `/brand/health` reports `{"source":"repo","ok":true}` when the repo is reachable. It reveals no content.
- If the token expires, `/brand` shows "unavailable": create a new token the same way and replace `GITHUB_TOKEN`, then redeploy.
- To change the password: Cloudflare dashboard → Workers & Pages → designpraiseeric → Settings → Variables and secrets → edit `BRAND_PASSWORD`, then redeploy. Changing it signs out every session.

## Seasonal greetings
On Christian holy days and Nigerian public days a small card turns in at the bottom left of every page (home, /soon, /tools) with a short note and a verse. Visitors can close it; it stays closed for that season.
- Calendar and colours: `js/seasons.js`; pictures: `js/seasons-art.js`. Both are copies of the files in `baerista/lib/`, which the After Effects tools use too. Edit them there, then copy them here.
- `img/seasons/<day>.jpg` (email banners) and `img/seasons/icon/<day>.png` (icons the ScriptUI tools download) are rendered by `baerista/site/render_seasons.py`.
- Includes Eid al-Fitr and Eid al-Adha as greetings to Muslim neighbours (Rom 12:18, Matt 22:39). Eid-el-Maulud is left out on purpose.
- Card and newsletter form: `js/dp-extras.js`.
- Preview any date: add `?season=2026-12-25` to a page URL.

## Newsletter
Visitors sign up on the home page (`#updates`), /soon and every /tools page. Double opt-in: they get an email to confirm, and every newsletter has a one-click unsubscribe.
- Write and send at **/brand/newsletter/** (sign in at /brand first). It shows subscribers, a live preview, a test send to yourself, tool releases from Baerista's `registry.json` that haven't been announced yet, and upcoming greetings to draft from.
- Storage: Cloudflare D1 database `designpraiseeric-newsletter`, bound to this project as `NEWS_DB`. Schema: `migrations/0001_newsletter.sql`.
- Sending: SMTP from `functions/_lib/mail.js`. Add the secret `SMTP_PASS` (a Gmail App Password for divinepraiseeric@gmail.com) in Cloudflare → Workers & Pages → designpraiseeric → Settings → Variables and secrets, then redeploy. Until then sign-ups are saved and you can send their confirmations from /brand/newsletter/ once mail is on.
- Other providers: also set `SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, `NEWSLETTER_FROM`.
- Gmail sends to about 500 recipients a day. A send that hits the limit pauses; press Resume under "Sent" the next day.
- Public endpoints: `POST /api/subscribe`, `POST /api/confirm`, `GET|POST /api/unsubscribe`. Status page: `/newsletter/`.

## Live rate card (/rate-card/) and Book a project (/book/)
A budget calculator that sits off the main page, reachable by direct link (also linked from Contact and the FAQ). Not indexed for now.
- **All prices, tiers, markets, currencies, policies and wording live in `rate-card/rates.js`.** The top of that file explains the maths and the option effects (`m`, `b`, `p`, `a`, `pass`, `u`, `when`). `app.js` never needs changing for a price update; bump `version` when you change prices (it clears visitors' saved answers).
- Anchor: a standard-tier motion video of 90–180 s, motion only, all assets supplied, comes out at ₦120,000–₦350,000. Every other price is relative to that.
- Details ends with shared production questions (`production` in rates.js): AI in the production (handmade only ×1.2, behind the scenes ×1, AI elements welcome ×0.97 with "Need it" assets ×0.55, AI-led ×0.6 with assets ×0.4 plus ₦25k a minute in generation credits, film's shoot questions drop out), disclosure, who signs off (×1, ×1.1, ×1.25) and how settled the look is (×1, ×1.05, or +15% style frames).
- Series and skits (26 Nov): "Is it a series?" adds a one-off setup (half of one piece's production plus ₦25k per recurring character; billed with the first month on a retainer). Motion design has a "Character skit ad" type, character count, speaking parts with lip-sync (voices per character), language, and app-screens segment. Styled animated captions are separate from plain captions. "Is it based on someone else's work?" flags close copies; character mascot rights +20%. The panel shows every AI approach side by side. About you asks whether the person is arranging it for another organisation. Terms cover series deadlines and bank-transfer-only payment (no crypto).
- Tier discounts show as their own line; tier premiums are folded into each line (the report you receive still shows the multiplier).
- Exchange rates: `currencies.fx` are reference rates. `/api/fx` fetches live mid-market rates (exchangerate-api.com, then the fawazahmed0 API), refreshed every 6 hours; moves under 1.5% and jumps over 30% are ignored, and the last good rate is kept in D1. Rules in `fxRules`: clients outside Nigeria never get a lower price because the naira weakened; Nigerian clients viewing $ or £ get the plain live conversion. If live rates fail, the reference rates are used. Market price levels are in `markets` (`level`, Nigeria = 1).
- Check any scenario in the browser console: `DPRC.compute()` and `DPRC.report()`.
- **Email my estimate** posts to `/api/estimate`: saves the estimate in D1 (`rc_estimates`, same `NEWS_DB`) and emails the report to `NEWSLETTER_OWNER` (default the newsletter address) with Reply-To set to the client. Until `SMTP_PASS` is set, the page sends the same report through Web3Forms (the contact-form key), and as a last resort opens the visitor's email app. The send button only works once the consent box is ticked.
- After sending, a splash points to **/book/**, the standalone brief form. It carries the estimate reference, name, email, budget and links over, and sends through Web3Forms like the home page form.
- **Optional helper** (`/api/rate-ai`): off unless `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` is set (Claude first, Gemini as fallback; optional `RATE_AI_MODEL`, `GEMINI_MODEL`, `RATE_AI=off`). With Gemini alone, client images are only sent if `GEMINI_PAID=yes` (billing on), because free-tier content may be used by Google to improve its products. When on, it asks up to three extra questions on the Plan step and reads reference images, short clips (three frames taken in the browser) and links, then suggests matching options. Images are held in memory for that one request and never stored. If it's off or failing, those parts simply don't appear.
- **Insights log:** every helper call writes a short note (no names, emails or images) to `rc_insights`. Pull it at `/brand/rate-insights` (sign in at /brand first): `?type=insights|estimates`, `&format=csv`, `&days=90`.
- Tables are created on first use; schema copy in `migrations/0002_rate_card.sql`.
- **Checks and the server re-check (PR #10, 26 Nov).** The pricing engine lives in `rate-card/engine.js`, shared by the page and `/api/estimate`. Before pricing, answers are checked against each other (numbers in `checks` in rates.js): film shoot days must cover the finished length at a realistic pace (fewer are priced at the minimum, and a tight-schedule line is added below a comfortable schedule); film over 30 minutes (except event, church and testimonial coverage) goes to a call; an edit can't be longer than its raw footage; emergency jobs over 10 working days and estimates over ₦25m (Nigerian level) go to a call; tier, volume or retainer and upfront savings together never take the studio fee below 60%; the upfront saving doesn't apply to third-party costs. Every answer is clamped to what the page allows. The panel shows a status (Adjusted to what's possible / Needs a call, with "From ₦…" in place of a range) and the reasons; owner-only flags for organisation answers that don't fit together go in the emailed report only. `/api/estimate` prices every estimate again from the raw answers (`functions/_lib/rate-check.js`), marks the email `[Check figures]` if the page's figure doesn't match, and flags naira pricing chosen from outside Nigeria. `/brand/rate-insights?type=estimates` shows status, figures_match, server_ngn and flags. Estimates are valid for 14 days. The Web3Forms and mailto fallbacks skip the server check.
- **Quantities (PR #11, 26 Nov).** Countable lines have a "how many" stepper: language versions, cutdowns, thumbnails, social templates, stationery items, signage and merch items, packaging designs. In rates.js an option with `qty:{def,max,unit,steps?}` is priced per unit, with quantity discounts from its own `steps` or the shared `qtySteps` (3+ 10%, 6+ 15%, 10+ 20%). `def` is the quantity the old single price covered, so defaults price exactly as before, and discounts start above it. A higher quantity never costs less, and quantity savings count toward the 40% total savings cap. The step tabs at the top are now clickable (they had no handler).
- **Exact counts (PR #12, 26 Nov).** Film: number of locations (1–12, a slider instead of bands; a shoot day covers 3 at most and 2 comfortably, so shoot days rise to fit) and hired actors (1–30, ₦50k per actor per shoot day, with or without a casting call); studio rental is its own question. 3D: products, objects or sets (1–20), separate shots (1–60, default 6), and for character work a character count and speaking parts with lip-sync. Option field `perQ:'id'` scales a line by a range question's value. A question that depends on a hidden question is hidden too (e.g. actors when the film is AI-led). "Priced as …" notes sit under the slider.
- Tests: `node --test tests/rate-card.test.mjs` (anchor, checks, savings floor, tampering, monotonic prices, fuzz, server check).

## How I work (/how-i-work/)
The client-facing process page: eight stages (Getting in touch → Afterwards), each with what happens, what the client provides, what they get and when it moves on; a rough timeline by project kind; how feedback rounds work; payment plans and terms; the six values (IDEALS) linked to the stages they show in.
- Stage text, timeline presets (working days) and values are arrays at the top of the page's script. Edit there.
- Payment plans, deposit floors and the terms are read live from `rate-card/rates.js` (`payment`, `depositFloor`, `policies`), so the page always matches the rate card. The `keep` list chooses which policies show.
- Linked from /work/ and /work/chimpx/ (nav), /book/ and /rate-card/ (footer).
- The private, step-by-step version for the owner is the Playbook tab at /brand/ (`playbook/` in the brand repo).

## Works page (/work/) and the home page
- **/work/** lists every case study (newest piece first; the first one is shown large). To add a piece, copy one `<a class="w">` block in `work/index.html` and point it at the new `/work/<project>/` page. The "Tools and programs" section links to `/tools/` and the apps; add a `.card` there for any new program.
- **The home page is open (since 27 Nov 2026).** `js/dp-gate.js` still loads on every page but does nothing while `OPEN = true`. To close the home page again, set `OPEN = false` and put back the `dp-gated` lines and a `noindex` meta in `index.html`.
- **Selected work on the home page** shows only finished pieces (the `WORK` array in `index.html`) plus a "more on the way" card for All and for each category (the `MORE` array). Add a piece to `WORK` when its page is up; remove a category's `MORE` card once it has a few pieces. The About portrait switches between `img/eric-night` and `img/eric-day` with the theme. The reel's play button links to the latest film (`/work/chimpx/`); point it at a real showreel when there is one.
