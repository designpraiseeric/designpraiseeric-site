// POST /api/estimate — the rate card's "Email my estimate".
// Saves the estimate (D1: NEWS_DB) and emails the report to the owner over the site's SMTP settings (see _lib/mail.js).
// Answers { ok, mailed, stored }. When mailed is false the page sends the same report through Web3Forms instead,
// so estimates still arrive while SMTP_PASS isn't set.
import { json, cleanEmail } from '../_lib/common.js';
import { SMTP, message, mailConfig, mailReady, layout } from '../_lib/mail.js';
import { ensureRateTables } from '../_lib/rates-db.js';
import { serverCheck, checkText } from '../_lib/rate-check.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

function reportHtml(text) {
  // Sections are written in capitals by the page; turn them into small headings, keep everything else as lines.
  return text.split('\n').map((l) => {
    if (/^[A-Z][A-Z ]{2,}$/.test(l.trim())) return `<h3 style="margin:22px 0 6px;font-size:13px;letter-spacing:.06em;color:#5a5278">${esc(l)}</h3>`;
    if (!l.trim()) return '';
    const m = /^(\s*)([^:]{1,60}):\s(.*)$/.exec(l);
    if (m) return `<div style="font-size:15px;line-height:1.55;color:#1a0d3e;padding-left:${m[1].length * 8}px"><span style="color:#5a5278">${esc(m[2])}:</span> ${esc(m[3])}</div>`;
    return `<div style="font-size:15px;line-height:1.55;color:#1a0d3e">${esc(l)}</div>`;
  }).join('\n');
}

export async function onRequestPost({ request, env }) {
  let raw;
  try { raw = await request.text(); } catch (e) { return json({ error: 'Bad request.' }, 400); }
  if (raw.length > 120000) return json({ error: 'Too large.' }, 413);
  let b;
  try { b = JSON.parse(raw); } catch (e) { return json({ error: 'Bad request.' }, 400); }
  if (b.consent !== true) return json({ error: 'Please agree to be contacted.' }, 400);
  const email = cleanEmail(b.lead && b.lead.email);
  const name = clip(b.lead && b.lead.name, 120);
  if (!email || name.length < 2) return json({ error: 'Please add your name and a valid email.' }, 400);
  const ref = clip(b.ref, 24).replace(/[^A-Z0-9-]/gi, '');
  const d = b.data && typeof b.data === 'object' ? b.data : {};
  const netCountry = (request.cf && request.cf.country) || request.headers.get('CF-IPCountry') || '';
  const k = serverCheck(d, netCountry);
  const text = clip(b.text, 60000) + checkText(k, d) + (netCountry ? `\n\nNETWORK CHECK\nRequest came from: ${netCountry} (VPNs and travel can explain a mismatch with the market chosen)` : '');
  const subject = (k.done && !k.match && k.sameVersion ? '[Check figures] ' : '') + (clip(b.subject, 200) || `Rate card estimate ${ref} from ${name}`);
  const stored_d = Object.assign({ server: k }, d);

  let stored = false, recent = 0, id = null;
  if (env.NEWS_DB) {
    try {
      await ensureRateTables(env.NEWS_DB);
      const r = await env.NEWS_DB.prepare('SELECT COUNT(*) AS n FROM rc_estimates WHERE email = ? AND created_at > ?').bind(email, Date.now() - 3600e3).first();
      recent = (r && r.n) || 0;
      if (recent >= 6) return json({ error: 'Too many estimates from this address in the last hour. Please try again later.' }, 429);
      const ins = await env.NEWS_DB.prepare('INSERT INTO rc_estimates (ref, name, email, org, phone, category, tier, market, currency, lo, hi, net_country, data, report, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(ref, name, email, clip(b.lead.org, 160), clip(b.lead.phone, 40), clip(d.category, 40), clip(d.tier, 20), clip(d.market, 10), clip(d.currency, 4),
          Math.round(+d.lo || 0), Math.round(+d.hi || 0), netCountry, JSON.stringify(stored_d).slice(0, 40000), text, Date.now())
        .run();
      id = ins.meta && ins.meta.last_row_id; stored = true;
    } catch (e) { /* storage is a bonus; email is what matters */ }
  }

  let mailed = false;
  if (mailReady(env)) {
    try {
      const cfg = mailConfig(env);
      const m = layout({ subject, preheader: `${name} · ${clip(d.category, 40)} · ${clip(d.currency, 4)} ${d.lo}–${d.hi}`, bodyHtml: reportHtml(text), bodyText: text,
        footerHtml: 'Sent from the live rate card. The client ticked the box to be contacted.', footerText: 'Sent from the live rate card. The client ticked the box to be contacted.' });
      const data = message(cfg, { to: cfg.owner, subject, html: m.html, text: m.text }).replace(/^Reply-To: .*$/m, `Reply-To: <${email}>`);
      const smtp = await new SMTP(cfg).open();
      try { await smtp.send({ to: cfg.owner, data }); } finally { await smtp.close(); }
      mailed = true;
      if (stored && id) await env.NEWS_DB.prepare('UPDATE rc_estimates SET mailed = 1 WHERE id = ?').bind(id).run().catch(() => {});
    } catch (e) { mailed = false; }
  }
  return json({ ok: mailed || stored, mailed, stored, ref });
}
