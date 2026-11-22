// Newsletter mail: a small SMTP client (Cloudflare sockets) plus the branded email template.
//
// Settings (Pages > Settings > Variables and secrets):
//   SMTP_PASS        required to send. For Gmail: an App Password (Google Account > Security > App passwords).
//   NEWSLETTER_FROM  sender address            (default divinepraiseeric@gmail.com)
//   SMTP_USER        login                     (default NEWSLETTER_FROM)
//   SMTP_HOST        server                    (default smtp.gmail.com)
//   SMTP_PORT        465 (TLS) or 587 (STARTTLS) (default 465)
// Any SMTP provider works (Gmail, Zoho, Brevo, Resend SMTP...). Gmail allows about 500 recipients a day.

import { connect } from 'cloudflare:sockets';

export const FROM_NAME = 'DesignPraise Eric';
export function mailConfig(env) {
  const from = env.NEWSLETTER_FROM || 'divinepraiseeric@gmail.com';
  return {
    from, user: env.SMTP_USER || from, pass: env.SMTP_PASS || '',
    host: env.SMTP_HOST || 'smtp.gmail.com', port: Number(env.SMTP_PORT || 465),
    tls: env.SMTP_TLS || 'auto',           // 'off' only for local testing
    owner: env.NEWSLETTER_OWNER || from,
  };
}
export const mailReady = (env) => !!mailConfig(env).pass;

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(str) {
  const bytes = enc.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=');

export class SMTP {
  constructor(cfg) { this.cfg = cfg; this.buf = ''; }

  async open() {
    const { host, port, tls } = this.cfg;
    const mode = tls === 'off' ? 'off' : port === 465 ? 'on' : 'starttls';
    this.sock = connect({ hostname: host, port }, { secureTransport: mode, allowHalfOpen: false });
    this.grab();
    await this.reply(220);
    await this.cmd('EHLO designpraiseeric.pages.dev', 250);
    if (mode === 'starttls') {
      await this.cmd('STARTTLS', 220);
      this.reader.releaseLock(); this.writer.releaseLock();
      this.sock = this.sock.startTls();
      this.grab(); this.buf = '';
      await this.cmd('EHLO designpraiseeric.pages.dev', 250);
    }
    if (this.cfg.pass) await this.cmd('AUTH PLAIN ' + b64('\0' + this.cfg.user + '\0' + this.cfg.pass), 235);
    return this;
  }
  grab() { this.reader = this.sock.readable.getReader(); this.writer = this.sock.writable.getWriter(); }

  async line() {
    for (;;) {
      const i = this.buf.indexOf('\r\n');
      if (i >= 0) { const l = this.buf.slice(0, i); this.buf = this.buf.slice(i + 2); return l; }
      const { value, done } = await this.reader.read();
      if (done) throw new Error('The mail server closed the connection.');
      this.buf += dec.decode(value, { stream: true });
    }
  }
  async reply(expect) {
    let l, text = '';
    do { l = await this.line(); text += l.slice(4) + ' '; } while (l[3] === '-');
    const code = Number(l.slice(0, 3));
    if (expect && code !== expect) {
      const e = new Error(`Mail server said ${code}: ${text.trim()}`.slice(0, 300));
      e.code = code; throw e;
    }
    return code;
  }
  async cmd(c, expect) { await this.writer.write(enc.encode(c + '\r\n')); return this.reply(expect); }

  async send({ to, data }) {
    await this.cmd(`MAIL FROM:<${this.cfg.from}>`, 250);
    await this.cmd(`RCPT TO:<${to}>`, 250);
    await this.cmd('DATA', 354);
    const body = data.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    await this.writer.write(enc.encode(body + '\r\n.\r\n'));
    await this.reply(250);
  }
  async reset() { try { await this.cmd('RSET', 250); } catch (e) {} }
  async close() {
    try { await this.writer.write(enc.encode('QUIT\r\n')); } catch (e) {}
    try { await this.sock.close(); } catch (e) {}
  }
}

/** Builds one MIME message. unsub: absolute URL for the List-Unsubscribe header (omit for non-list mail). */
export function message(cfg, { to, subject, html, text, unsub, unsubPost }) {
  const boundary = 'dp' + crypto.randomUUID().replace(/-/g, '');
  const h = [
    `From: ${encWord(FROM_NAME)} <${cfg.from}>`,
    `To: <${to}>`,
    `Reply-To: <${cfg.from}>`,
    `Subject: ${encWord(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@designpraiseeric.pages.dev>`,
    'MIME-Version: 1.0',
  ];
  if (unsub) {
    h.push(`List-Unsubscribe: <${unsubPost || unsub}>, <mailto:${cfg.from}?subject=unsubscribe>`);
    if (unsubPost) h.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    h.push('List-Id: DesignPraise Eric updates <updates.designpraiseeric.pages.dev>');
  }
  h.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  return h.join('\r\n') + '\r\n\r\n' +
    `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(text))}` +
    `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(html))}` +
    `--${boundary}--\r\n`;
}

/* ── writing format ─────────────────────────────────────────────────
   Plain text with a few marks:  # Heading   ## Smaller heading   - list item   > quote
   **bold**  *italic*  [link text](https://…)  ![image description](https://…/image.jpg)
   [[Button text](https://…)]  on its own line makes a button.  --- on its own line is a divider.  */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (u) => (/^(https?:|mailto:)/i.test(u) ? u : '#');
const C = { violet: '#6403ee', ink: '#1a0d3e', mute: '#5a5278', line: '#e8e3f3', paper: '#f7f5fc' };

function inline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, u) => `<img src="${safeUrl(u)}" alt="${alt}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:12px;margin:8px 0">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${safeUrl(u)}" style="color:${C.violet};font-weight:600">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}
const inlineText = (s) => s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '[$1: $2]').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');

export function renderBody(src) {
  const blocks = String(src || '').replace(/\r/g, '').trim().split(/\n{2,}/);
  const html = [], text = [];
  const P = `margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.ink}`;
  for (const b of blocks) {
    const lines = b.split('\n');
    let m;
    if ((m = /^\[\[([^\]]+)\]\(([^)\s]+)\)\]$/.exec(b.trim()))) {
      html.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:12px;background:${C.violet}"><a href="${safeUrl(m[2])}" style="display:inline-block;padding:13px 22px;font-weight:600;font-size:15px;color:#ffffff;text-decoration:none">${esc(m[1])}</a></td></tr></table>`);
      text.push(`${m[1]}: ${m[2]}`);
    } else if (b.trim() === '---') {
      html.push(`<hr style="border:0;border-top:1px solid ${C.line};margin:24px 0">`); text.push('—');
    } else if ((m = /^(#{1,2})\s+(.+)$/.exec(b.trim())) && lines.length === 1) {
      const size = m[1].length === 1 ? 24 : 19;
      html.push(`<h${m[1].length + 1} style="margin:${html.length ? 24 : 0}px 0 10px;font-size:${size}px;line-height:1.25;letter-spacing:-0.02em;color:${C.ink}">${inline(m[2])}</h${m[1].length + 1}>`);
      text.push(m[2].toUpperCase());
    } else if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      html.push(`<ul style="margin:0 0 16px;padding-left:20px;color:${C.ink};font-size:16px;line-height:1.6">` + lines.map((l) => `<li style="margin:0 0 6px">${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>');
      text.push(lines.map((l) => '• ' + inlineText(l.replace(/^\s*[-*]\s+/, ''))).join('\n'));
    } else if (lines.every((l) => /^>\s?/.test(l))) {
      const q = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
      html.push(`<blockquote style="margin:0 0 16px;padding:4px 0 4px 16px;border-left:3px solid ${C.violet};color:${C.mute};font-size:16px;line-height:1.6">${inline(q).replace(/\n/g, '<br>')}</blockquote>`);
      text.push(q.split('\n').map((l) => '> ' + inlineText(l)).join('\n'));
    } else {
      html.push(`<p style="${P}">${inline(b).replace(/\n/g, '<br>')}</p>`);
      text.push(inlineText(b));
    }
  }
  return { html: html.join('\n'), text: text.join('\n\n') };
}

/** Wraps rendered content in the DesignPraise email layout. */
export function layout({ subject, bodyHtml, bodyText, preheader, footerHtml, footerText }) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
<tr><td style="padding:0 8px 16px"><a href="https://designpraiseeric.pages.dev/" style="text-decoration:none;font-weight:700;font-size:18px;letter-spacing:-0.02em;color:${C.ink}"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${C.violet};margin-right:8px;vertical-align:1px"></span>designpraise</a></td></tr>
<tr><td style="background:#ffffff;border-radius:16px;border:1px solid ${C.line};padding:32px 32px 16px">
${bodyHtml}
</td></tr>
<tr><td style="padding:20px 8px 0;font-size:13px;line-height:1.55;color:${C.mute}">${footerHtml || ''}<br>DesignPraise Studio · Lagos, Nigeria</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${bodyText}\n\n—\n${footerText || ''}\nDesignPraise Studio · Lagos, Nigeria\nhttps://designpraiseeric.pages.dev/`;
  return { html, text };
}

export function newsletterEmail({ subject, body, unsubUrl, preheader }) {
  const r = renderBody(body);
  return layout({
    subject, preheader: preheader || r.text.slice(0, 120), bodyHtml: r.html, bodyText: r.text,
    footerHtml: `You’re getting this because you subscribed at designpraiseeric.pages.dev. <a href="${esc(unsubUrl)}" style="color:${C.mute}">Unsubscribe</a>`,
    footerText: `You’re getting this because you subscribed at designpraiseeric.pages.dev.\nUnsubscribe: ${unsubUrl}`,
  });
}

export function confirmEmail({ confirmUrl }) {
  const body = `## One more step\n\nPlease confirm that you’d like email updates from DesignPraise Eric.\n\n[[Confirm my subscription](${confirmUrl})]\n\nIf you didn’t sign up, ignore this email and you won’t hear from me again.`;
  const r = renderBody(body);
  return layout({ subject: 'Confirm your subscription', preheader: 'Confirm your email updates from DesignPraise Eric.', bodyHtml: r.html, bodyText: r.text,
    footerHtml: 'Sent because this address was entered at designpraiseeric.pages.dev.', footerText: 'Sent because this address was entered at designpraiseeric.pages.dev.' });
}
