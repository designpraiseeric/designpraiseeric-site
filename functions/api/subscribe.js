// POST /api/subscribe  { email, topics: ["work","tools","site"], website (honeypot), ms (time on page), source }
// Double opt-in: stores the address as pending and emails a confirmation link.
import { json, now, token, sha256, cleanEmail, siteUrl, TOPICS } from '../_lib/common.js';
import { SMTP, message, confirmEmail, mailConfig, mailReady } from '../_lib/mail.js';

const RESEND_AFTER = 10 * 60 * 1000;   // don't send another confirmation to the same address within 10 minutes

export async function sendConfirmation(env, origin, row, rawToken) {
  const cfg = mailConfig(env);
  const confirmUrl = `${origin}/newsletter/?c=${encodeURIComponent(rawToken)}`;
  const m = confirmEmail({ confirmUrl });
  const smtp = await new SMTP(cfg).open();
  try { await smtp.send({ to: row.email, data: message(cfg, { to: row.email, subject: 'Confirm your subscription', html: m.html, text: m.text }) }); }
  finally { await smtp.close(); }
  await env.NEWS_DB.prepare('UPDATE subscribers SET confirm_sent = ? WHERE id = ?').bind(now(), row.id).run();
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.NEWS_DB) return json({ error: 'Sign-ups open soon. Please try again later.' }, 503);
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Bad request.' }, 400); }
  const email = cleanEmail(b.email);
  if (!email) return json({ error: 'Please enter a valid email address.' }, 400);
  const topics = [...new Set((Array.isArray(b.topics) ? b.topics : TOPICS).filter((t) => TOPICS.includes(t)))];
  if (!topics.length) return json({ error: 'Choose at least one thing to hear about.' }, 400);

  const ready = mailReady(env);
  const done = ready ? 'Thank you. Check your inbox for a link to confirm.' : 'Thank you. A confirmation email will follow shortly.';
  // Bots fill the hidden field or submit instantly. Answer as usual and keep nothing.
  if (b.website || Number(b.ms) < 1500) return json({ ok: true, message: done });

  const db = env.NEWS_DB;
  const source = String(b.source || '').slice(0, 80);
  let row = await db.prepare('SELECT * FROM subscribers WHERE email = ?').bind(email).first();
  if (row && row.status === 'confirmed') return json({ ok: true, message: 'You’re already subscribed. Thank you.' });

  const raw = token();
  const hash = await sha256(raw);
  if (!row) {
    await db.prepare('INSERT INTO subscribers (email, topics, status, confirm_hash, unsub_token, source, created_at) VALUES (?, ?, \'pending\', ?, ?, ?, ?)')
      .bind(email, topics.join(','), hash, token(), source, now()).run();
  } else {
    if (row.status === 'pending' && row.confirm_sent && now() - row.confirm_sent < RESEND_AFTER) return json({ ok: true, message: done });
    await db.prepare('UPDATE subscribers SET topics = ?, status = \'pending\', confirm_hash = ?, unsub_at = NULL, source = ? WHERE id = ?')
      .bind(topics.join(','), hash, source, row.id).run();
  }
  row = await db.prepare('SELECT * FROM subscribers WHERE email = ?').bind(email).first();

  if (ready) {
    // Send after replying, so the visitor isn't kept waiting on the mail server.
    waitUntil(sendConfirmation(env, siteUrl(request), row, raw).catch((e) => console.log('confirmation email failed:', e.message)));
  }
  return json({ ok: true, message: done });
}
