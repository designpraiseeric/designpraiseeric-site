// Server check for rate card estimates: prices the answers again with the same rates and engine as the page.
// Used by /api/estimate; tested in tests/rate-card.test.mjs.
// The same prices and engine the page runs (they attach RATES and RCEngine to globalThis).
import '../../rate-card/rates.js';
import '../../rate-card/engine.js';

const naira = (v) => (v >= 1e6 ? '₦' + (Math.round(v / 1e4) / 100).toLocaleString('en-GB') + 'm' : '₦' + Math.round(v / 1000).toLocaleString('en-GB') + 'k');

/* Price the estimate again from the raw answers, so an edited page or a doctored figure can't change what the studio sees. */
export function serverCheck(d, netCountry) {
  const R = globalThis.RATES, EN = globalThis.RCEngine;
  const st = d && d.state && typeof d.state === 'object' ? d.state : null;
  if (!R || !EN || !st) return { done: false, note: 'No answers came with this estimate (an older copy of the page), so it wasn’t priced again here.' };
  const plain = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  const cat = String(st.cat || '').slice(0, 20);
  const S = { market: String(st.market || '').slice(0, 10), about: plain(st.about), cat, ans: { [cat]: plain(plain(st.ans)[cat]) }, plan: plain(st.plan) };
  let E;
  try { E = EN.make(R, S).compute(); } catch (e) { return { done: false, note: 'The answers couldn’t be priced again (' + String(e.message || e).slice(0, 80) + ').' }; }
  if (!E) return { done: false, note: 'Unknown project type, so it wasn’t priced again.' };
  const client = +d.mid_ngn, diff = client > 0 ? client / E.total - 1 : null;
  const sameVersion = !d.version || d.version === R.version;
  const match = diff !== null && Math.abs(diff) <= 0.02;
  const flags = E.checks.filter((x) => x.level === 'flag').map((x) => x.msg);
  if (S.market === 'ng' && netCountry && netCountry !== 'NG' && netCountry !== 'XX' && netCountry !== 'T1') flags.push('Chose Nigeria (naira pricing) but the request came from ' + netCountry + '. Travel or a VPN can explain it; check where the paying organisation is registered.');
  return { done: true, version: R.version, sameVersion, match, diff, status: E.status, total_ngn: Math.round(E.total), lo_ngn: Math.round(E.lo), hi_ngn: Math.round(E.hi),
    checks: E.checks.filter((x) => x.level !== 'flag').map((x) => x.id), flags, tier: E.T.t.id };
}
export function checkText(k, d) {
  if (!k.done) return '\n\nSERVER CHECK\n' + k.note;
  const L = ['', '', 'SERVER CHECK'];
  if (k.match) L.push('Figures match: priced again from the answers at ' + naira(k.total_ngn) + ' (most likely, naira at the client’s market level).');
  else if (!k.sameVersion) L.push('Priced again with the current rates (' + k.version + ') at ' + naira(k.total_ngn) + '; the page used ' + String(d.version).slice(0, 20) + ' (' + naira(+d.mid_ngn || 0) + '). An older copy of the page explains the difference. Quote from the current figure.');
  else L.push('MISMATCH: the page showed ' + naira(+d.mid_ngn || 0) + ' but the answers price at ' + naira(k.total_ngn) + ' (' + naira(k.lo_ngn) + '–' + naira(k.hi_ngn) + '). The page may have been edited. Quote from the server figure.');
  L.push('Status: ' + ({ ready: 'Ready', adjusted: 'Adjusted to what’s possible', call: 'Needs a call' })[k.status] + ', tier ' + k.tier);
  k.flags.forEach((f) => L.push('FLAG: ' + f));
  return L.join('\n');
}

