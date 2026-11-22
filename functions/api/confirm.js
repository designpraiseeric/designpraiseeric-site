// POST /api/confirm  { t } — the token from the confirmation email (/newsletter/?c=…).
import { json, now, sha256 } from '../_lib/common.js';

export async function onRequestPost({ request, env }) {
  if (!env.NEWS_DB) return json({ error: 'Not available.' }, 503);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Bad request.' }, 400); }
  const t = String(b.t || '');
  if (t.length < 20 || t.length > 64) return json({ error: 'This link isn’t valid.' }, 400);
  const row = await env.NEWS_DB.prepare('SELECT id, status, topics FROM subscribers WHERE confirm_hash = ?').bind(await sha256(t)).first();
  if (!row) return json({ error: 'This link has expired or was already used.' }, 404);
  await env.NEWS_DB.prepare('UPDATE subscribers SET status = \'confirmed\', confirmed_at = ?, confirm_hash = NULL WHERE id = ?').bind(now(), row.id).run();
  return json({ ok: true, topics: row.topics.split(',') });
}
