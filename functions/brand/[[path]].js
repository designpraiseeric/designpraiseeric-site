// Private brand area. Only the owner (with the password) can open it.
// The files in /vault are AES-256-GCM encrypted; the key lives only in
// Cloudflare (Pages > Settings > Variables and secrets: BRAND_KEY, BRAND_PASSWORD).

const COOKIE = 'dp_brand';
const SESSION_DAYS = 30;
const enc = new TextEncoder();

const SECURITY = {
  'Cache-Control': 'no-store, private',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmacKey(env) {
  return crypto.subtle.importKey('raw', b64ToBytes(env.BRAND_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function sign(env, msg) {
  return b64url(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(msg)));
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function passwordOk(env, given) {
  // Compare HMACs so the comparison is constant-time and length-independent.
  return same(await sign(env, 'pw:' + given), await sign(env, 'pw:' + env.BRAND_PASSWORD));
}
async function makeSession(env) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return exp + '.' + (await sign(env, 'session:' + exp + ':' + env.BRAND_PASSWORD));
}
async function sessionOk(env, request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await sign(env, 'session:' + exp + ':' + env.BRAND_PASSWORD));
}
const TYPES = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', ttf: 'font/ttf', zip: 'application/zip' };

async function vaultName(path) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('dp-vault:' + path)));
  return [...h.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('') + '.bin';
}
// Returns the decrypted file, or null if there is no such file.
async function openVault(env, request, path) {
  const res = await env.ASSETS.fetch(new URL('/vault/' + (await vaultName(path)), request.url));
  if (!res.ok) return null;
  const data = new Uint8Array(await res.arrayBuffer());
  if (data.length < 29) return null; // not an encrypted file (e.g. a fallback page)
  const key = await crypto.subtle.importKey('raw', b64ToBytes(env.BRAND_KEY), 'AES-GCM', false, ['decrypt']);
  try {
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12), additionalData: enc.encode(path) }, key, data.slice(12));
  } catch { return null; }
}
// Preferred source: the private GitHub repo itself, so every push shows up here.
// Needs GITHUB_TOKEN (fine-grained, read-only Contents on designpraiseeric-brand-private).
const REPO = 'designpraiseeric/designpraiseeric-brand-private';
async function openRepo(env, path) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${enc}?ref=main`, {
    headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'designpraiseeric-brand' },
    cf: { cacheTtl: 0 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('GitHub ' + res.status);
  if ((res.headers.get('Content-Type') || '').includes('application/json') && !path.endsWith('.json')) return null; // a folder, not a file
  return res.body;
}

function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY', ...SECURITY, ...extra } });
}

function loginPage(error) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Private</title>
<style>
@font-face{font-family:"DesignPraise Sans";src:url(/fonts/DesignPraiseSans.woff2) format("woff2");font-weight:1 1000}
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{display:grid;place-items:center;background:#1a0d3e;color:#fff;font-family:"DesignPraise Sans",system-ui,sans-serif}
form{width:min(360px,88vw);padding:40px 32px;background:#251552;border-radius:28px}
h1{font-size:24px;font-weight:700;letter-spacing:-.02em;margin:0 0 24px}
label{display:block;font-size:13px;color:#b9b0d6;margin-bottom:8px}
input{width:100%;padding:14px 16px;border-radius:8px;border:1px solid #3a2b6e;background:#1a0d3e;color:#fff;font:inherit;font-size:16px}
input:focus{outline:2px solid #a57bff;outline-offset:2px}
button{margin-top:16px;width:100%;padding:14px;border:0;border-radius:8px;background:#a57bff;color:#1a0d3e;font:inherit;font-size:16px;font-weight:700;cursor:pointer}
p{margin:16px 0 0;font-size:13px;color:#ffa800}
</style></head><body>
<form method="post" action="/brand/">
<h1>Private</h1>
<label for="pw">Password</label>
<input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Open</button>
${error ? '<p>That password is not right.</p>' : ''}
</form></body></html>`;
}

export async function onRequest({ request, env }) {
  if (!env.BRAND_KEY || !env.BRAND_PASSWORD) return html('Not configured', 503);

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/brand/, '') || '';

  if (path === '') return Response.redirect(url.origin + '/brand/', 302);

  // The brand fonts are already public on the main site; reuse them.
  // Health check (no content): is the live repo source reachable?
  if (path === '/health') {
    let ok = false, source = env.GITHUB_TOKEN ? 'repo' : 'vault';
    try { ok = env.GITHUB_TOKEN ? !!(await openRepo(env, 'CHANGELOG.md')) : !!(await openVault(env, request, 'index.html')); } catch {}
    return new Response(JSON.stringify({ source, ok }), { status: ok ? 200 : 503, headers: { 'Content-Type': 'application/json', ...SECURITY } });
  }
  const font = path.match(/(?:^|\/)fonts\/(DesignPraiseSans|GoogleSansCode)\.woff2$/);
  if (font && request.method === 'GET') return env.ASSETS.fetch(new URL('/fonts/' + font[1] + '.woff2', url.origin));

  if (path === '/logout') {
    return new Response(null, { status: 302, headers: { Location: '/brand/', 'Set-Cookie': `${COOKIE}=; Path=/brand; Max-Age=0; HttpOnly; Secure; SameSite=Lax`, ...SECURITY } });
  }

  if (path === '/' && request.method === 'POST') {
    const form = await request.formData();
    if (await passwordOk(env, String(form.get('password') || ''))) {
      return new Response(null, { status: 303, headers: {
        Location: '/brand/',
        'Set-Cookie': `${COOKIE}=${await makeSession(env)}; Path=/brand; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
        ...SECURITY } });
    }
    await new Promise(r => setTimeout(r, 1200)); // slow down guessing
    return html(loginPage(true), 401);
  }

  const authed = await sessionOk(env, request);
  if (!authed) {
    if (path === '/') return html(loginPage(false), 401);
    return Response.redirect(url.origin + '/brand/', 302);
  }

  let file;
  try { file = decodeURIComponent(path.slice(1)); } catch { file = ''; }
  if (file === '' || file.endsWith('/')) file += 'index.html';
  if (file.split('/').some(seg => seg === '..' || seg === '.')) return new Response('Not found', { status: 404, headers: SECURITY });

  let body;
  try { body = env.GITHUB_TOKEN ? await openRepo(env, file) : await openVault(env, request, file); }
  catch { return new Response('The brand archive is unavailable right now.', { status: 502, headers: SECURITY }); }
  if (!body) return new Response('Not found', { status: 404, headers: SECURITY });

  const ext = (file.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'X-Frame-Options': 'SAMEORIGIN', ...SECURITY };
  if (ext === 'zip' || ext === 'ttf') headers['Content-Disposition'] = `attachment; filename="${file.split('/').pop()}"`;
  return new Response(body, { headers });
}
