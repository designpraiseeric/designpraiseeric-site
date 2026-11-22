// Shared helpers for the newsletter functions. Database binding: NEWS_DB (D1, schema in migrations/).

export const TOPICS = ['work', 'tools', 'site'];
export const TOPIC_NAMES = { work: 'Films and design work', tools: 'Tools and products', site: 'Site news' };

const HEADERS = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
export function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...HEADERS, ...extra } });
}
export const now = () => Date.now();

export function token(bytes = 24) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export function cleanEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@"<>(),;:\\[\]]+@[^\s@"<>(),;:\\[\]]+\.[a-z]{2,}$/.test(e) ? e : null;
}
export function siteUrl(request) { return new URL(request.url).origin; }

/* Owner session: the same signed cookie the private /brand area sets (Path=/brand, so only /brand/* sees it). */
const enc = new TextEncoder();
function b64ToBytes(b64) { const s = atob(b64); const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
function b64url(buf) { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function sign(env, msg) {
  const key = await crypto.subtle.importKey('raw', b64ToBytes(env.BRAND_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function ownerOk(env, request) {
  if (!env.BRAND_KEY || !env.BRAND_PASSWORD) return false;
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)dp_brand=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, await sign(env, 'session:' + exp + ':' + env.BRAND_PASSWORD));
}
