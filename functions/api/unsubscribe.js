// Unsubscribe.
//   POST /api/unsubscribe            { t }                       — from the /newsletter/?u=… page
//   POST /api/unsubscribe?t=…        List-Unsubscribe=One-Click  — one-click button in mail apps (RFC 8058)
//   GET  /api/unsubscribe?t=…        → /newsletter/?u=…           — a plain visit asks first
import { json, now } from '../_lib/common.js';

async function unsub(env, t) {
  if (!env.NEWS_DB || !t || t.length < 20 || t.length > 64) return false;
  const r = await env.NEWS_DB.prepare('UPDATE subscribers SET status = \'unsubscribed\', unsub_at = ?, confirm_hash = NULL WHERE unsub_token = ? AND status != \'unsubscribed\'').bind(now(), t).run();
  if (r.meta.changes) return true;
  return !!(await env.NEWS_DB.prepare('SELECT 1 FROM subscribers WHERE unsub_token = ?').bind(t).first());
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  let t = url.searchParams.get('t');
  if (!t) { try { t = (await request.json()).t; } catch (e) {} }
  const ok = await unsub(env, String(t || ''));
  return ok ? json({ ok: true }) : json({ error: 'This link isn’t valid.' }, 404);
}

export function onRequestGet({ request }) {
  const t = new URL(request.url).searchParams.get('t') || '';
  return Response.redirect(new URL('/newsletter/?u=' + encodeURIComponent(t), request.url).toString(), 302);
}
