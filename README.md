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
- Files are read live from the private repo `designpraiseeric-brand-private` (branch `main`) using the Cloudflare secret `GITHUB_TOKEN` (fine-grained, read-only, that repo only). Every push to that repo shows up here immediately. If `GITHUB_TOKEN` is missing, the site falls back to the encrypted `vault/`.
- `BRAND_KEY` still signs the login session (and decrypts the fallback vault).
- `vault/*.bin` (fallback only) are AES-256-GCM encrypted, with file names that don't reveal what they are. They are unreadable without `BRAND_KEY`, which lives only in Cloudflare.
- `functions/brand/[[path]].js` checks the password and decrypts on the server. `functions/vault/` hides the encrypted files from direct requests.
- The readable master copy is the private repo `designpraiseeric-brand-private`.
- To change the password: Cloudflare dashboard → Workers & Pages → designpraiseeric → Settings → Variables and secrets → edit `BRAND_PASSWORD`, then redeploy. Changing it signs out every session.
