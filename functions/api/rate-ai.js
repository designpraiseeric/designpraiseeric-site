// /api/rate-ai — the rate card's optional helper. Visitors never see that it exists; the page works without it.
//   GET  → { ok: true } when switched on. The page checks this once and hides the helper's parts if it isn't.
//   POST { action: 'followup' | 'refs' | 'insight', context, images?, links? }
//     followup: up to 3 short extra questions for this project
//     refs:     reads reference images / video frames / links and suggests matching options
//     insight:  a note for the owner when an estimate is sent
// Images arrive as small JPEG data URLs, are passed to the model in memory and never written anywhere.
// Every call logs an insight row (no names, emails or images) for /brand/rate-insights.
//
// Settings (Pages > Settings > Variables and secrets). Either key switches it on; with both, Claude is tried first and Gemini is the fallback.
//   ANTHROPIC_API_KEY   Claude (preferred)
//   RATE_AI_MODEL       optional, default claude-haiku-5-5
//   GEMINI_API_KEY      Gemini, from Google AI Studio (one key)
//   GEMINI_MODEL        optional, default gemini-3.6-flash
//   GEMINI_PAID         set to "yes" once billing is on for that Google project. On Google's free tier, prompts and
//                       images may be used by Google to improve its products, so client images are NOT sent to
//                       Gemini unless this is "yes" (the image upload is hidden; questions and link reading still work).
//   RATE_AI             set to "off" to switch it off without removing the keys
import { json } from '../_lib/common.js';
import { logInsight } from '../_lib/rates-db.js';

const on = (env) => (!!env.ANTHROPIC_API_KEY || !!env.GEMINI_API_KEY) && env.RATE_AI !== 'off';
// Client images may go to a provider only where they aren't used for training.
const imagesOk = (env) => !!env.ANTHROPIC_API_KEY || String(env.GEMINI_PAID || '').toLowerCase() === 'yes';

export async function onRequestGet({ env }) { return json({ ok: on(env), images: on(env) && imagesOk(env) }); }

const SYSTEM = `You help a Lagos-based art director and motion designer (Divinepraise Eric, DesignPraise Studio) understand prospective clients who are using his online rate card.
The client never sees that you exist. Your words may be shown on the page as if written by him: plain, warm, professional English. No buzzwords, no exclamation marks, no emoji, never mention AI.
You never change or comment on prices. Reply with one JSON object only, no prose around it.
Always include "insight" (one sentence for Eric: what this client seems to want, a risk, or a mismatch such as budget vs scope or an unusual combination) and "feature" (one sentence: something the calculator should ask or offer that it currently doesn't, or "" if nothing).`;

const TASKS = {
  followup: `Write up to 3 short follow-up questions that would most help scope THIS project and that the calculator's selections don't already answer (for example audience, key message, platform specifics, existing footage quality, decision makers, deadline driver). Prefer multiple choice.
Shape: {"questions":[{"id":"snake_case","q":"Question?","type":"single"|"multi"|"text","options":["…"]}],"insight":"…","feature":"…"}. Options: 2–5 short labels. Text questions have no options.`,
  refs: `Look at the client's references (images, video frames and/or link details). Describe the style in plain words: technique, look, pace, colour, level of detail.
If the references clearly point to a different option than the one selected for a question in "schema", suggest it (only ids from the schema, max 3).
Shape: {"summary":"1–2 sentences","notes":["short observations, max 3"],"suggest":[{"q":"question id","opt":"option id","why":"short reason, e.g. Your references use hand-drawn frames"}],"insight":"…","feature":"…"}`,
  insight: `The client has just sent this estimate. Shape: {"insight":"…","feature":"…"}`,
};

function pickJSON(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

async function linkInfo(url) {
  // Light metadata only: title, description and a thumbnail the model can look at.
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    let out = { url: u.href };
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname) || /(^|\.)vimeo\.com$/.test(u.hostname)) {
      const api = /vimeo/.test(u.hostname) ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u.href)}` : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.href)}`;
      const r = await fetch(api, { signal: ctl.signal });
      if (r.ok) { const j = await r.json(); out = { ...out, title: j.title, author: j.author_name, image: j.thumbnail_url }; }
    } else {
      const r = await fetch(u.href, { signal: ctl.signal, headers: { 'User-Agent': 'designpraise-rate-card/1.0', Accept: 'text/html' }, redirect: 'follow' });
      const type = r.headers.get('content-type') || '';
      if (r.ok && type.includes('image/')) out.image = u.href;
      else if (r.ok && type.includes('text/html')) {
        const html = (await r.text()).slice(0, 300000);
        const meta = (p) => { const m = new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i').exec(html) || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i').exec(html); return m ? m[1] : ''; };
        out.title = meta('og:title') || ((/<title[^>]*>([^<]{1,200})/i.exec(html) || [])[1] || '');
        out.description = meta('og:description') || meta('description');
        out.image = meta('og:image');
      }
    }
    clearTimeout(t);
    if (out.image && !/^https:\/\//.test(out.image)) delete out.image;
    return out;
  } catch (e) { return null; }
}

async function askClaude(env, system, content) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 22000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.RATE_AI_MODEL || 'claude-haiku-5-5', max_tokens: 900, system, messages: [{ role: 'user', content }] }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return pickJSON((j.content || []).map((c) => c.text || '').join(''));
  } catch (e) { return null; } finally { clearTimeout(t); }
}

async function urlToInline(url) {
  // Gemini can't fetch arbitrary image URLs, so small link thumbnails are fetched here and passed inline.
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const type = (r.headers.get('content-type') || '').split(';')[0];
    if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 1_500_000) return null;
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { inline_data: { mime_type: type, data: btoa(bin) } };
  } catch (e) { return null; } finally { clearTimeout(t); }
}
async function askGemini(env, system, content) {
  const parts = [];
  for (const c of content) {
    if (c.type === 'text') parts.push({ text: c.text });
    else if (c.source && c.source.type === 'base64') { if (imagesOk(env)) parts.push({ inline_data: { mime_type: c.source.media_type, data: c.source.data } }); }
    else if (c.source && c.source.type === 'url') { const p = await urlToInline(c.source.url); if (p) parts.push(p); }
  }
  const model = env.GEMINI_MODEL || 'gemini-3.6-flash';
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 22000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1200, temperature: 0.4 } }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j.candidates && j.candidates[0];
    return pickJSON(((c && c.content && c.content.parts) || []).map((p) => p.text || '').join(''));
  } catch (e) { return null; } finally { clearTimeout(t); }
}

async function ask(env, action, content) {
  const system = SYSTEM + '\n\nTask: ' + TASKS[action];
  let out = null;
  if (env.ANTHROPIC_API_KEY) out = await askClaude(env, system, content);
  if (!out && env.GEMINI_API_KEY) out = await askGemini(env, system, content);
  return out;
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!on(env)) return json({ ok: false }, 503);
  let raw;
  try { raw = await request.text(); } catch (e) { return json({ ok: false }, 400); }
  if (raw.length > 6_000_000) return json({ ok: false }, 413);
  let b;
  try { b = JSON.parse(raw); } catch (e) { return json({ ok: false }, 400); }
  const action = TASKS[b.action] ? b.action : null;
  if (!action) return json({ ok: false }, 400);
  const ctx = b.context && typeof b.context === 'object' ? b.context : {};
  const schema = Array.isArray(ctx.schema) ? ctx.schema.slice(0, 30) : [];

  const content = [];
  if (action === 'refs') {
    const imgs = imagesOk(env) ? (Array.isArray(b.images) ? b.images : []).slice(0, 8) : [];
    for (const d of imgs) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(d));
      if (m && m[2].length < 1_100_000) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] } });
    }
    const links = (Array.isArray(b.links) ? b.links : []).slice(0, 5);
    const infos = (await Promise.all(links.map(linkInfo))).filter(Boolean);
    infos.filter((i) => i.image).slice(0, 3).forEach((i) => content.push({ type: 'image', source: { type: 'url', url: i.image } }));
    if (!content.length && !infos.length) return json({ ok: false }, 400);
    content.push({ type: 'text', text: 'Links: ' + JSON.stringify(infos) });
  }
  content.push({ type: 'text', text: 'Calculator context: ' + JSON.stringify({ ...ctx, schema }).slice(0, 20000) + (b.outcome ? '\nOutcome: ' + String(b.outcome).slice(0, 40) : '') });

  let out = await ask(env, action, content);
  if (!out && action === 'refs' && content.some((c) => c.source && c.source.type === 'url')) {
    // A remote thumbnail can fail to load; try once more without them.
    out = await ask(env, action, content.filter((c) => !(c.source && c.source.type === 'url')));
  }
  if (!out) return json({ ok: false }, 502);

  const row = { action, category: ctx.category, tier: ctx.tier, market: ctx.market, currency: ctx.currency, est_mid: ctx.estimate && Math.round(+ctx.estimate.mid || 0), insight: out.insight, feature: out.feature,
    meta: { selections: (ctx.selections || []).slice(0, 40), plan: ctx.plan, questions: out.questions, summary: out.summary } };
  const log = logInsight(env, row);
  if (waitUntil) waitUntil(log); else await log;

  if (action === 'followup') {
    const qs = (Array.isArray(out.questions) ? out.questions : []).slice(0, 3).filter((q) => q && q.q);
    return json({ ok: true, questions: qs });
  }
  if (action === 'refs') {
    const valid = (s) => s && schema.some((q) => q.id === s.q && (q.options || []).some((o) => o.id === s.opt));
    return json({ ok: true, summary: String(out.summary || '').slice(0, 600), notes: (Array.isArray(out.notes) ? out.notes : []).slice(0, 3).map((n) => String(n).slice(0, 200)), suggest: (Array.isArray(out.suggest) ? out.suggest : []).filter(valid).slice(0, 3) });
  }
  return json({ ok: true });
}
