// GET /brand/rate-insights — owner only (sign in at /brand first).
//   ?type=insights (default) or ?type=estimates
//   ?format=json (default) or ?format=csv
//   ?days=90 (how far back, default 90)
// Insights are the helper's notes on what clients wanted and what the calculator should add. Estimates are every emailed estimate.
import { json, ownerOk } from '../_lib/common.js';
import { ensureRateTables } from '../_lib/rates-db.js';

const csv = (rows) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
};

export async function onRequestGet({ request, env }) {
  if (!(await ownerOk(env, request))) return new Response(null, { status: 302, headers: { Location: '/brand/', 'Cache-Control': 'no-store' } });
  if (!env.NEWS_DB) return json({ error: 'Database not bound (NEWS_DB).' }, 503);
  await ensureRateTables(env.NEWS_DB);
  const u = new URL(request.url);
  const type = u.searchParams.get('type') === 'estimates' ? 'estimates' : 'insights';
  const days = Math.min(3650, Math.max(1, +u.searchParams.get('days') || 90));
  const since = Date.now() - days * 86400e3;
  const sql = type === 'estimates'
    ? `SELECT id, ref, datetime(created_at/1000,'unixepoch') AS at, name, email, org, phone, category, tier, market, net_country, currency, lo, hi, mailed FROM rc_estimates WHERE created_at > ? ORDER BY created_at DESC LIMIT 2000`
    : `SELECT id, datetime(created_at/1000,'unixepoch') AS at, action, category, tier, market, currency, est_mid, insight, feature FROM rc_insights WHERE created_at > ? ORDER BY created_at DESC LIMIT 5000`;
  const { results } = await env.NEWS_DB.prepare(sql).bind(since).all();
  if (u.searchParams.get('format') === 'csv') {
    return new Response(csv(results || []), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="rate-card-${type}.csv"`, 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex' } });
  }
  return json({ type, days, count: (results || []).length, rows: results || [] });
}
