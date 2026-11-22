// Newsletter desk for the owner: /brand/newsletter
// Same sign-in as the private brand area (sign in at /brand first). Everything here needs that session.
import { json, now, token, sha256, siteUrl, ownerOk, TOPICS, TOPIC_NAMES } from '../../_lib/common.js';
import { SMTP, message, newsletterEmail, confirmEmail, mailConfig, mailReady } from '../../_lib/mail.js';
import { ADMIN_HTML } from '../../_lib/admin-page.js';

const REGISTRY = 'https://raw.githubusercontent.com/designpraiseeric/baerista/main/registry.json';
const BATCH = 20;   // emails per request; the page keeps asking until a send is finished

const NOINDEX = { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };

async function setting(db, key, value) {
  if (value === undefined) { const r = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first(); return r ? JSON.parse(r.value) : null; }
  await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, JSON.stringify(value)).run();
}

function audienceSql(topic) {
  // topics is a comma list; match whole words only.
  return topic && topic !== 'all' ? { where: "status = 'confirmed' AND (',' || topics || ',') LIKE ?", args: ['%,' + topic + ',%'] } : { where: "status = 'confirmed'", args: [] };
}

async function releases(db, env) {
  let reg;
  try { reg = await (await fetch((env.REGISTRY_URL || REGISTRY) + '?t=' + Date.now(), { cf: { cacheTtl: 0 } })).json(); } catch (e) { return { error: 'Couldn’t read the Baerista registry.' }; }
  const announced = (await setting(db, 'announced')) || {};
  const all = [{ id: 'baerista', name: reg.bar.name || 'Baerista', version: reg.bar.version, changelog: reg.bar.changelog || '', page: '/tools/baerista/' }]
    .concat(reg.tools.filter((t) => t.tier !== 'paid' || t.gumroad).map((t) => ({ id: t.id, name: t.name, version: t.version, changelog: t.changelog || '', page: '/tools/' + t.id + '/' })));
  return { pending: all.filter((t) => announced[t.id] !== t.version), all, firstRun: !Object.keys(announced).length };
}

async function markAnnounced(db, map) {
  const a = (await setting(db, 'announced')) || {};
  Object.assign(a, map || {});
  await setting(db, 'announced', a);
}

async function overview(env) {
  const db = env.NEWS_DB;
  const counts = {};
  for (const r of (await db.prepare('SELECT status, COUNT(*) n FROM subscribers GROUP BY status').all()).results) counts[r.status] = r.n;
  const byTopic = {};
  for (const t of TOPICS) {
    const a = audienceSql(t);
    byTopic[t] = (await db.prepare(`SELECT COUNT(*) n FROM subscribers WHERE ${a.where}`).bind(...a.args).first()).n;
  }
  const campaigns = (await db.prepare('SELECT id, subject, topic, status, total, sent, failed, created_at, finished_at FROM campaigns ORDER BY id DESC LIMIT 20').all()).results;
  const recent = (await db.prepare("SELECT email, topics, status, created_at FROM subscribers ORDER BY id DESC LIMIT 12").all()).results;
  const cfg = mailConfig(env);
  return { counts, byTopic, topicNames: TOPIC_NAMES, campaigns, recent, mail: { ready: mailReady(env), from: cfg.from, host: cfg.host, owner: cfg.owner }, releases: await releases(db, env) };
}

async function sendBatch(env, origin, id) {
  const db = env.NEWS_DB;
  const c = await db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first();
  if (!c) return { error: 'No such send.' };
  if (c.status === 'sent') return { done: true, sent: c.sent, failed: c.failed, remaining: 0 };
  const rows = (await db.prepare(`SELECT d.subscriber_id, s.email, s.unsub_token, s.status FROM deliveries d JOIN subscribers s ON s.id = d.subscriber_id
     WHERE d.campaign_id = ? AND d.status = 'queued' LIMIT ?`).bind(id, BATCH).all()).results;
  const cfg = mailConfig(env);
  let sent = 0, failed = 0, stopped = null;
  if (rows.length) {
    const smtp = await new SMTP(cfg).open();
    try {
      for (const r of rows) {
        if (r.status !== 'confirmed') {   // unsubscribed since the send started
          await db.prepare("UPDATE deliveries SET status = 'failed', error = 'unsubscribed', at = ? WHERE campaign_id = ? AND subscriber_id = ?").bind(now(), id, r.subscriber_id).run();
          failed++; continue;
        }
        const unsubUrl = `${origin}/newsletter/?u=${encodeURIComponent(r.unsub_token)}`;
        const unsubPost = `${origin}/api/unsubscribe?t=${encodeURIComponent(r.unsub_token)}`;
        const m = newsletterEmail({ subject: c.subject, body: c.body, unsubUrl });
        try {
          await smtp.send({ to: r.email, data: message(cfg, { to: r.email, subject: c.subject, html: m.html, text: m.text, unsub: unsubUrl, unsubPost }) });
          await db.prepare("UPDATE deliveries SET status = 'sent', at = ? WHERE campaign_id = ? AND subscriber_id = ?").bind(now(), id, r.subscriber_id).run();
          sent++;
        } catch (e) {
          // 4xx/5xx for this address: record it and carry on. A daily-limit reply (Gmail 550 5.4.5 / 421) stops the batch so it can resume tomorrow.
          if (/5\.4\.5|daily|limit|421/i.test(e.message)) { stopped = e.message; break; }
          await db.prepare("UPDATE deliveries SET status = 'failed', error = ?, at = ? WHERE campaign_id = ? AND subscriber_id = ?").bind(e.message.slice(0, 200), now(), id, r.subscriber_id).run();
          failed++;
          await smtp.reset();
        }
      }
    } finally { await smtp.close(); }
  }
  const left = (await db.prepare("SELECT COUNT(*) n FROM deliveries WHERE campaign_id = ? AND status = 'queued'").bind(id).first()).n;
  const tot = await db.prepare("SELECT SUM(status = 'sent') s, SUM(status = 'failed') f FROM deliveries WHERE campaign_id = ?").bind(id).first();
  if (!left) {
    await db.prepare("UPDATE campaigns SET status = 'sent', sent = ?, failed = ?, finished_at = ? WHERE id = ?").bind(tot.s || 0, tot.f || 0, now(), id).run();
    if (c.announce) await markAnnounced(db, JSON.parse(c.announce));
  } else {
    await db.prepare('UPDATE campaigns SET sent = ?, failed = ? WHERE id = ?').bind(tot.s || 0, tot.f || 0, id).run();
  }
  return { sent: tot.s || 0, failed: tot.f || 0, remaining: left, done: !left, stopped, batch: { sent, failed } };
}

function csv(rows) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return 'email,topics,status,source,created,confirmed\n' + rows.map((r) => [r.email, r.topics, r.status, r.source,
    new Date(r.created_at).toISOString(), r.confirmed_at ? new Date(r.confirmed_at).toISOString() : ''].map(q).join(',')).join('\n') + '\n';
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const parts = params.path || [];
  if (!(await ownerOk(env, request))) {
    if (parts[0] === 'api') return json({ error: 'Signed out. Sign in at /brand, then come back.' }, 401, NOINDEX);
    return new Response(null, { status: 302, headers: { Location: '/brand/', ...NOINDEX } });
  }
  if (parts[0] !== 'api') {
    if (!new URL(request.url).pathname.endsWith('/')) return new Response(null, { status: 301, headers: { Location: '/brand/newsletter/', ...NOINDEX } });
    return new Response(ADMIN_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "frame-ancestors 'none'", ...NOINDEX } });
  }
  if (!env.NEWS_DB) return json({ error: 'The newsletter database isn’t connected (binding NEWS_DB).' }, 503, NOINDEX);
  const db = env.NEWS_DB, action = parts[1] || '', origin = siteUrl(request);

  if (request.method === 'GET') {
    if (action === 'overview') return json(await overview(env), 200, NOINDEX);
    if (action === 'export.csv') {
      const rows = (await db.prepare('SELECT * FROM subscribers ORDER BY id').all()).results;
      return new Response(csv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="subscribers.csv"', ...NOINDEX } });
    }
    return json({ error: 'Not found.' }, 404, NOINDEX);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, NOINDEX);
  // Only this site's own pages may post here.
  const o = request.headers.get('Origin');
  if (o && o !== origin) return json({ error: 'Forbidden.' }, 403, NOINDEX);
  let b = {};
  try { b = await request.json(); } catch (e) {}

  try {
    switch (action) {
      case 'preview': {
        const m = newsletterEmail({ subject: b.subject || '', body: b.body || '', unsubUrl: origin + '/newsletter/' });
        return json({ html: m.html, text: m.text }, 200, NOINDEX);
      }
      case 'test': {
        if (!mailReady(env)) return json({ error: 'Add SMTP_PASS first (see the setup note).' }, 400, NOINDEX);
        const cfg = mailConfig(env);
        const m = newsletterEmail({ subject: b.subject || '(no subject)', body: b.body || '', unsubUrl: origin + '/newsletter/' });
        const smtp = await new SMTP(cfg).open();
        try { await smtp.send({ to: cfg.owner, data: message(cfg, { to: cfg.owner, subject: '[Test] ' + (b.subject || ''), html: m.html, text: m.text }) }); }
        finally { await smtp.close(); }
        return json({ ok: true, to: cfg.owner }, 200, NOINDEX);
      }
      case 'smtp-check': {
        if (!mailReady(env)) return json({ ok: false, error: 'SMTP_PASS isn’t set yet.' }, 200, NOINDEX);
        const smtp = await new SMTP(mailConfig(env)).open();
        await smtp.close();
        return json({ ok: true }, 200, NOINDEX);
      }
      case 'campaign': {
        if (!mailReady(env)) return json({ error: 'Add SMTP_PASS first (see the setup note).' }, 400, NOINDEX);
        const subject = String(b.subject || '').trim().slice(0, 200), body = String(b.body || '').trim();
        const topic = TOPICS.includes(b.topic) ? b.topic : 'all';
        if (!subject || !body) return json({ error: 'Add a subject and a message.' }, 400, NOINDEX);
        const a = audienceSql(topic);
        const total = (await db.prepare(`SELECT COUNT(*) n FROM subscribers WHERE ${a.where}`).bind(...a.args).first()).n;
        if (!total) return json({ error: 'Nobody has confirmed for that audience yet.' }, 400, NOINDEX);
        const r = await db.prepare('INSERT INTO campaigns (subject, body, topic, total, announce, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(subject, body, topic, total, b.announce ? JSON.stringify(b.announce) : null, now()).run();
        const id = r.meta.last_row_id;
        await db.prepare(`INSERT INTO deliveries (campaign_id, subscriber_id) SELECT ?, id FROM subscribers WHERE ${a.where}`).bind(id, ...a.args).run();
        return json({ id, total }, 200, NOINDEX);
      }
      case 'send-batch':
        return json(await sendBatch(env, origin, Number(b.id)), 200, NOINDEX);
      case 'mark-announced': {
        const rel = await releases(db, env);
        if (rel.error) return json(rel, 502, NOINDEX);
        const map = {};
        for (const t of rel.all) if (!b.ids || b.ids.includes(t.id)) map[t.id] = t.version;
        await markAnnounced(db, map);
        return json({ ok: true }, 200, NOINDEX);
      }
      case 'resend-confirm': {
        if (!mailReady(env)) return json({ error: 'Add SMTP_PASS first (see the setup note).' }, 400, NOINDEX);
        const day = now() - 24 * 3600e3;
        const rows = (await db.prepare("SELECT id, email FROM subscribers WHERE status = 'pending' AND (confirm_sent IS NULL OR confirm_sent < ?) LIMIT ?").bind(day, BATCH).all()).results;
        const cfg = mailConfig(env);
        let sent = 0;
        if (rows.length) {
          const smtp = await new SMTP(cfg).open();
          try {
            for (const r of rows) {
              const raw = token();
              await db.prepare('UPDATE subscribers SET confirm_hash = ?, confirm_sent = ? WHERE id = ?').bind(await sha256(raw), now(), r.id).run();
              const m = confirmEmail({ confirmUrl: `${origin}/newsletter/?c=${encodeURIComponent(raw)}` });
              try { await smtp.send({ to: r.email, data: message(cfg, { to: r.email, subject: 'Confirm your subscription', html: m.html, text: m.text }) }); sent++; }
              catch (e) { await smtp.reset(); }
            }
          } finally { await smtp.close(); }
        }
        const left = (await db.prepare("SELECT COUNT(*) n FROM subscribers WHERE status = 'pending' AND (confirm_sent IS NULL OR confirm_sent < ?)").bind(day).first()).n;
        return json({ sent, remaining: left }, 200, NOINDEX);
      }
    }
  } catch (e) {
    return json({ error: e.message || 'Something went wrong.' }, 500, NOINDEX);
  }
  return json({ error: 'Not found.' }, 404, NOINDEX);
}
