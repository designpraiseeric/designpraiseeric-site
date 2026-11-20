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
