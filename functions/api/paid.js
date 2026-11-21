// Paid tool downloads for Baerista.
//
// POST /api/paid   { "license": "<Gumroad licence key>", "product": "<Gumroad product id>", "path": "paid/<tool>/<file>" }
//
// 1. Checks the licence with Gumroad (must be valid, not refunded, not charged back,
//    and for the product that owns the requested path).
// 2. Streams the file from the private repo designpraiseeric-tools-paid.
//
// Secrets (Pages > Settings > Variables and secrets):
//   PAID_GITHUB_TOKEN  fine-grained token, Contents: read-only, on designpraiseeric-tools-paid only
// Each paid tool's Gumroad product must have "Generate a unique license key per sale" switched on.

const REPO = 'designpraiseeric/designpraiseeric-tools-paid';
const HEADERS = { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...HEADERS } });
}

async function verifyLicence(product, licence) {
  const body = new URLSearchParams({ product_id: product, license_key: licence, increment_uses_count: 'false' });
  const res = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) return { ok: false, why: 'That licence key is not valid for this tool.' };
  const p = data.purchase || {};
  if (p.refunded || p.chargebacked || p.disputed) return { ok: false, why: 'This purchase was refunded or disputed.' };
  if (p.subscription_ended_at || p.subscription_cancelled_at || p.subscription_failed_at) return { ok: false, why: 'This subscription is no longer active.' };
  return { ok: true };
}

export async function onRequestPost({ request, env }) {
  if (!env.PAID_GITHUB_TOKEN) return json({ error: 'Paid downloads are not set up yet.' }, 503);
  let req;
  try { req = await request.json(); } catch (e) { return json({ error: 'Bad request.' }, 400); }
  const licence = String(req.license || '').trim();
  const product = String(req.product || '').trim();
  const path = String(req.path || '');
  // Only files under paid/<tool>/ can be requested, and no climbing out of it.
  if (!licence || !product || !/^paid\/[a-z0-9-]+\/[A-Za-z0-9._\/ -]+$/.test(path) || path.includes('..')) {
    return json({ error: 'Bad request.' }, 400);
  }

  // The private repo maps each tool folder to the Gumroad product that unlocks it.
  const tool = path.split('/')[1];
  const map = await fetchRepo(env, 'products.json');
  if (!map) return json({ error: 'Paid downloads are not set up yet.' }, 503);
  const owners = JSON.parse(await new Response(map).text());
  if (owners[tool] !== product) return json({ error: 'That licence is for a different tool.' }, 403);

  const check = await verifyLicence(product, licence);
  if (!check.ok) return json({ error: check.why }, 403);

  const file = await fetchRepo(env, path);
  if (!file) return json({ error: 'File not found.' }, 404);
  return new Response(file, { headers: { 'Content-Type': 'application/octet-stream', ...HEADERS } });
}

export function onRequest() {
  return json({ error: 'Use POST.' }, 405);
}

async function fetchRepo(env, path) {
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${enc}?ref=main`, {
    headers: { Authorization: 'Bearer ' + env.PAID_GITHUB_TOKEN, Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'designpraiseeric-paid' },
    cf: { cacheTtl: 0 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('GitHub ' + res.status);
  return res.body;
}
