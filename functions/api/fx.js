// GET /api/fx — live naira rates for the rate card: { rates: { USD, GBP }, at, source, held }.
// Values are naira per unit (mid-market). Pricing rules (reference rates, foreign floor) live in rate-card/rates.js.
//
// Rules applied here:
//   1. Sources in order: open.er-api.com, then the fawazahmed0 currency API on jsDelivr. Both free, no key.
//   2. Sanity: a rate outside ₦300–₦10,000 per unit, or more than 30% away from the last accepted rate, is rejected.
//   3. Steadiness: a move under 1.5% since the last accepted rate is ignored, so estimates don't jitter.
//   4. Cached for 6 hours at the edge; the last accepted rate is kept in D1 (settings table) when NEWS_DB is bound.
// If every source fails, it answers with the last accepted rate, or 503 (the page then uses its reference rates).
import { json } from '../_lib/common.js';

const TTL = 6 * 3600;
const MIN_CHANGE = 0.015;
const MAX_JUMP = 0.3;
const KEY = 'rc_fx';

async function fetchJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } }); return r.ok ? await r.json() : null; }
  catch (e) { return null; } finally { clearTimeout(t); }
}
async function live() {
  const a = await fetchJSON('https://open.er-api.com/v6/latest/USD');
  if (a && a.rates && a.rates.NGN && a.rates.GBP) return { USD: a.rates.NGN, GBP: a.rates.NGN / a.rates.GBP, source: 'exchangerate-api.com' };
  const b = await fetchJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
  if (b && b.usd && b.usd.ngn && b.usd.gbp) return { USD: b.usd.ngn, GBP: b.usd.ngn / b.usd.gbp, source: 'fawazahmed0 currency-api' };
  return null;
}
async function lastAccepted(env) {
  if (!env.NEWS_DB) return null;
  try { const r = await env.NEWS_DB.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first(); return r ? JSON.parse(r.value) : null; } catch (e) { return null; }
}
async function keep(env, v) {
  if (!env.NEWS_DB) return;
  try {
    await env.NEWS_DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
    await env.NEWS_DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(KEY, JSON.stringify(v)).run();
  } catch (e) {}
}

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default, ck = new Request(new URL('/api/fx?v=1', request.url).toString());
  const hit = await cache.match(ck);
  if (hit) return hit;

  const prev = await lastAccepted(env);
  const got = await live();
  let out = prev ? { ...prev, held: true } : null;
  if (got) {
    const rates = {}, held = {};
    for (const k of ['USD', 'GBP']) {
      const v = got[k], p = prev && prev.rates && prev.rates[k];
      const sane = v > 300 && v < 10000 && (!p || Math.abs(v / p - 1) <= MAX_JUMP);
      if (!sane) { if (p) { rates[k] = p; held[k] = 'rejected'; } continue; }
      if (p && Math.abs(v / p - 1) < MIN_CHANGE) { rates[k] = p; held[k] = 'small move'; }
      else rates[k] = Math.round(v * 100) / 100;
    }
    if (rates.USD || rates.GBP) {
      const changed = !prev || ['USD', 'GBP'].some((k) => !prev.rates || prev.rates[k] !== rates[k]);
      out = { rates, at: changed ? Date.now() : prev.at, checked: Date.now(), source: got.source, held };
      const w = keep(env, out); if (waitUntil) waitUntil(w); else await w;
    }
  }
  if (!out) return json({ error: 'No rate available.' }, 503);
  const res = json(out, 200, { 'Cache-Control': `public, max-age=${TTL}` });
  const put = cache.put(ck, res.clone()); if (waitUntil) waitUntil(put);
  return res;
}
