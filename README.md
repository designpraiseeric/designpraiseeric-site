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
