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
