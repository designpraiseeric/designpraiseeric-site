/* Live rate card — interface. Prices, rules and copy live in rates.js; the pricing engine is engine.js (shared with /api/estimate). Nothing here needs editing for a price change.
   The optional helper (/api/rate-ai) is checked once on load. If it isn't there or fails, every call returns null and the page carries on. */
(function () {
  'use strict';
  var R = window.RATES;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var HC = ['#03ee63', '#038eee', '#6403ee', '#03eed8', '#d903ee', '#eed903', '#ffa800', '#a57bff', '#6403ee'];
  var STEPS = [['about', 'About you'], ['project', 'Project'], ['details', 'Details'], ['delivery', 'Delivery and rights'], ['plan', 'Plan and budget'], ['send', 'Send']];
  var WEB3FORMS_KEY = '27d920ad-5ded-43f8-b867-a7fca4b00287'; // same key as the contact form on the home page (fallback when site mail is off)

  /* ---------------- state ---------------- */
  var KEY = 'dp-rc-state';
  function makeRef() { var d = new Date(); return 'RC-' + d.getFullYear().toString().slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function validUntil() { var d = new Date(Date.now() + ((R.checks && R.checks.validDays) || 14) * 864e5); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  var S, ACT;
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved && saved.v === R.version) { S = saved.S; ACT = saved.ACT; } } catch (e) {}
  if (!S) S = { step: 0, market: null, cur: null, about: {}, cat: null, ans: {}, plan: { count: 1, retainer: 'no', pay: 'std', budget: '' }, refs: { links: '' }, lead: {}, ref: makeRef(), sent: false };
  if (!ACT) ACT = { start: Date.now(), changes: 0, visited: {}, stepTime: {}, catSwitches: 0, curSwitches: 0, aiAsked: 0, aiAnswered: 0, refsAnalysed: 0, firstFigure: null, src: new URLSearchParams(location.search).get('src') || '', referrer: document.referrer && document.referrer.indexOf(location.origin) !== 0 ? document.referrer : '' };
  var AI = { on: false, follow: { forCat: null, qs: [], ans: {} }, refs: { busy: false, summary: '', notes: [], suggest: [], files: 0 } };
  var stepT0 = Date.now();
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ v: R.version, S: S, ACT: ACT })); } catch (e) {} }

  /* ---------------- lookups and pricing (engine.js, shared with the server) ---------------- */
  var EN = window.RCEngine.make(R, S);
  var market = EN.market, cat = EN.cat, optsOf = EN.optsOf, prodQ = EN.prodQ, allQ = EN.allQ, visible = EN.visible,
    logistics = EN.logistics, defaultOf = EN.defaultOf, val = EN.val, setVal = EN.setVal, tierInfo = EN.tierInfo, compute = EN.compute;
  var qtyOpts = function (q) { return q.type === 'multi' ? optsOf(q).filter(function (o) { return o.qty; }) : []; };
  var FX = { live: {}, at: null, source: '' };
  function fxFor(id) {
    var c = R.currencies[id], ref = c.fx, L = FX.live[id], r = R.fxRules || {};
    if (id === 'NGN' || !r.live || !L || Math.abs(L / ref - 1) > r.maxMove) return { fx: ref, how: 'reference' };
    var foreign = S.market && S.market !== 'ng';
    if (foreign && r.foreignFloor) return L < ref ? { fx: L, how: 'live' } : { fx: ref, how: 'reference (naira weaker than reference)' };
    if (!foreign && r.nigeriaLive === false) return { fx: ref, how: 'reference' };
    return { fx: L, how: 'live' };
  }
  var curInfo = function () { var m = market(); var id = S.cur || (m ? m.def : 'NGN'); var f = fxFor(id); return Object.assign({ id: id }, R.currencies[id], { fx: f.fx, how: f.how }); };
  function fxLine(cur) { if (cur.id === 'NGN') return ''; return cur.symbol + '1 = ₦' + Math.round(cur.fx).toLocaleString('en-GB') + ' (' + cur.how + (cur.how === 'live' && FX.at ? ', ' + new Date(FX.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '') + ')'; }
  /* ---------------- money ---------------- */
  function conv(v, cur) { cur = cur || curInfo(); var x = v / cur.fx; var r = cur.round; if (Math.abs(x) < r * 4) r = cur.id === 'NGN' ? 1000 : 5; return Math.round(x / r) * r; }
  function fmt(v, cur) { cur = cur || curInfo(); var x = conv(v, cur); return (x < 0 ? '−' : '') + cur.symbol + Math.abs(x).toLocaleString('en-GB'); }
  /* milestone amounts that add up exactly to the rounded total */
  function milestones(E, cur) { var tot = conv(E.total, cur), out = [], acc = 0; E.plan.forEach(function (p, i) { var v = i === E.plan.length - 1 ? tot - acc : conv(E.total * p[1], cur); acc += v; out.push(v); }); return out; }
  function fmtRange(E, cur) { return fmt(E.lo, cur) + ' – ' + fmt(E.hi, cur); }
  function totText(E, cur) { return E.status === 'call' ? R.copy.callTotal + ' ' + fmt(E.lo, cur) : fmtRange(E, cur); }
  function rangeHTML(E, cur) { return '<span>' + fmt(E.lo, cur) + ' –</span> <span>' + fmt(E.hi, cur) + '</span>'; }
  function unitTxt(q, v) {
    if (q.unit === 's') { var m = Math.floor(v / 60), s = v % 60; return m ? m + ' min' + (s ? ' ' + s + ' s' : '') : s + ' s'; }
    if (q.unit === 'h') return v + ' h'; if (q.unit === 'd') return v + (v === 1 ? ' day' : ' days'); if (q.unit === 'shots') return v + (v === 1 ? ' shot' : ' shots');
    return String(v);
  }

  /* ---------------- small UI builders ---------------- */
  function chipGroup(key, q, value, multi) {
    var o = optsOf(q);
    return '<div class="chips' + (multi ? ' multi' : '') + '" role="group" aria-label="' + esc(q.label) + '">' + o.map(function (x) {
      var on = multi ? value.indexOf(x.id) > -1 : value === x.id;
      return '<button type="button" class="chip" data-k="' + key + '" data-v="' + x.id + '" aria-pressed="' + on + '"' + (x.lock ? ' data-lock' : '') + '>' + esc(x.label) + '</button>';
    }).join('') + '</div>';
  }
  function qBlock(key, q, inner) { return '<div class="q" data-qwrap="' + key + '"><div class="ql" id="ql-' + key.replace(/\W/g, '-') + '">' + esc(q.label) + '</div>' + (q.hint ? '<p class="qh">' + esc(q.hint) + '</p>' : '') + inner + '</div>'; }
  function rangeBlock(key, q, v) {
    var f = ((v - q.min) / (q.max - q.min) * 100).toFixed(1);
    return qBlock(key, q, '<div class="rng"><input type="range" data-k="' + key + '" min="' + q.min + '" max="' + q.max + '" step="' + q.step + '" value="' + v + '" style="--f:' + f + '%" aria-label="' + esc(q.label) + '"><output id="o-' + key.replace(/\W/g, '-') + '">' + esc(unitTxt(q, v)) + '</output><div class="ticks"><span>' + esc(unitTxt(q, q.min)) + '</span><span>' + esc(unitTxt(q, q.max)) + '</span></div></div>');
  }
  function assetsBlock(key, q, v) {
    return qBlock(key, q, '<div class="assets">' + q.items.map(function (it) {
      var cur = v[it.id] || 'have';
      return '<div class="arow"><b>' + esc(it.label) + '</b><span class="seg" role="group" aria-label="' + esc(it.label) + '">' +
        [['have', 'I have it'], ['need', 'Need it'], ['none', 'Not needed']].map(function (s) { return '<button type="button" data-k="' + key + '" data-item="' + it.id + '" data-v="' + s[0] + '" aria-pressed="' + (cur === s[0]) + '">' + s[1] + '</button>'; }).join('') + '</span></div>';
    }).join('') + '</div>');
  }
  function questionHTML(c, q) {
    var key = 'c.' + q.id, v = val(c, q);
    if (!visible(c, q)) return '';
    if (q.type === 'range') return rangeBlock(key, q, v);
    if (q.type === 'assets') return assetsBlock(key, q, v);
    var note = q.notes && q.notes[v] ? '<p class="qnote">' + esc(q.notes[v]) + '</p>' : '';
    return qBlock(key, q, chipGroup(key, q, v, q.type === 'multi') + note + qtyHTML(c, q, v));
  }
  /* "How many?" steppers under a multi question, one per chosen countable option */
  function qtyText(o, n) {
    var off = EN.qtyOff(o, n), nxt = (o.qty.steps || R.qtySteps).find(function (s) { return s.from > n; });
    return (off ? Math.round(off * 100) + '% off each' : '') + (nxt && n < o.qty.max ? (off ? ' · ' : '') + Math.round(nxt.off * 100) + '% off from ' + nxt.from : '');
  }
  function qtyHTML(c, q, v) {
    var rows = qtyOpts(q).filter(function (o) { return v.indexOf(o.id) > -1; });
    if (!rows.length) return '';
    return '<div class="qtys">' + rows.map(function (o) {
      var n = EN.qtyOf(c, q, o), k = q.id + '.' + o.id;
      return '<div class="qrow"><span><b>' + esc(o.line || o.label) + '</b><small id="qx-' + k.replace(/\W/g, '-') + '">' + esc(qtyText(o, n)) + '</small></span><span class="qstep" role="group" aria-label="How many ' + esc(o.qty.unit || '') + '">' +
        '<button type="button" data-qk="' + k + '" data-qd="-1" aria-label="Fewer"' + (n <= 1 ? ' disabled' : '') + '>−</button><output id="qn-' + k.replace(/\W/g, '-') + '">' + n + '</output>' +
        '<button type="button" data-qk="' + k + '" data-qd="1" aria-label="More"' + (n >= o.qty.max ? ' disabled' : '') + '>+</button><small>' + esc(o.qty.unit || '') + '</small></span></div>';
    }).join('') + '</div>';
  }
  function navHTML(i) {
    return '<div class="nav">' + (i > 0 ? '<button type="button" class="btn line" data-go="' + (i - 1) + '">Back</button>' : '<span></span>') +
      (i < STEPS.length - 1 ? '<button type="button" class="btn" data-go="' + (i + 1) + '">' + STEPS[i + 1][1] + '</button>' : '') + '</div>';
  }

  /* ---------------- steps ---------------- */
  var flow = $('flow');
  function stepShell(i, title, lead, body) { return '<section class="step" id="st-' + STEPS[i][0] + '" data-s="' + i + '" hidden aria-labelledby="h-' + i + '"><header><span class="lt"><h2 id="h-' + i + '" tabindex="-1">' + esc(title) + '</h2></span>' + (lead ? '<p>' + lead + '</p>' : '') + '</header>' + body + '<p class="err" id="err-' + i + '" role="alert"></p>' + navHTML(i) + '</section>'; }

  function aboutHTML() {
    var m = market(), cur = curInfo();
    var mq = { label: 'Where is your business or organisation based?', hint: 'This sets the price level. If you work in several countries, choose where the paying entity is registered.', options: R.markets };
    var h = qBlock('mkt', mq, chipGroup('mkt', mq, S.market));
    if (m) h += qBlock('cur', { label: 'Show prices in', hint: m.id === 'ng' ? '' : 'Naira pricing is for businesses based in Nigeria.' }, '<div class="chips" role="group">' + Object.keys(R.currencies).map(function (k) {
      var ok = m.currencies.indexOf(k) > -1;
      return ok ? '<button type="button" class="chip" data-k="cur" data-v="' + k + '" aria-pressed="' + (cur.id === k) + '">' + R.currencies[k].symbol + ' ' + esc(R.currencies[k].name) + '</button>' : '';
    }).join('') + '</div>');
    R.about.forEach(function (q) { h += qBlock('a.' + q.id, q, chipGroup('a.' + q.id, q, S.about[q.id])); });
    h += '<div class="tierline" id="tierline"></div>';
    return stepShell(0, 'About you', 'These answers set your pricing tier. Nonprofits, churches and early startups pay less; large organisations pay more.', h);
  }
  function projectHTML() {
    var h = '<div class="cats" role="radiogroup" aria-label="Project type">' + R.categories.map(function (c) {
      return '<button type="button" class="cat" role="radio" data-cat="' + c.id + '" aria-checked="' + (S.cat === c.id) + '"><span class="ic" style="--c:' + c.colour + '">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return '<i class="' + (c.tiles.indexOf(i) > -1 ? 'on' : '') + '"></i>'; }).join('') + '</span><span><b>' + esc(c.label) + '</b><small>' + esc(c.blurb) + '</small></span><span class="tick"></span></button>';
    }).join('') + '</div>';
    return stepShell(1, 'Pick one project type', 'If it’s a mix, choose the main part. A film with motion graphics, for example, is a film; you’ll add the motion graphics on the next step.', h);
  }
  function detailsHTML() {
    var c = cat();
    if (!c) return stepShell(2, 'Details', 'Pick a project type first.', '');
    return stepShell(2, c.label, esc(c.blurb) + '. Choose what fits; anything you’re unsure about can stay on the default.', c.questions.concat(prodQ(c)).map(function (q) { return questionHTML(c, q); }).join(''));
  }
  function deliveryHTML() {
    var c = cat();
    if (!c) return stepShell(3, 'Delivery and rights', 'Pick a project type first.', '');
    return stepShell(3, 'Delivery and rights', 'How fast, how many rounds, which formats, and where the work will be used.', logistics(c).map(function (q) { return questionHTML(c, q); }).join(''));
  }
  function planHTML() {
    var cur = curInfo(), V = R.volume;
    var h = qBlock('p.series', R.series, chipGroup('p.series', R.series, S.plan.series || 'no'));
    h += rangeBlock('p.count', { label: V.label, hint: V.hint, min: V.min, max: V.max, step: 1, unit: '' }, S.plan.count);
    h += qBlock('p.retainer', { label: R.retainer.label, hint: R.retainer.note }, chipGroup('p.retainer', R.retainer, S.plan.retainer));
    h += qBlock('p.pay', R.payPref, chipGroup('p.pay', R.payPref, S.plan.pay));
    h += qBlock('p.budget', R.budget, '<label class="fl money"><span>' + cur.symbol + '</span><input id="budget" inputmode="numeric" autocomplete="off" placeholder="e.g. ' + (cur.id === 'NGN' ? '250,000' : '1,500') + '" value="' + esc(S.plan.budget) + '" aria-label="Budget in ' + esc(cur.name) + '"></label><p class="budget" id="budgetMsg" hidden></p>');
    h += '<div class="more" id="aiMore" hidden></div>';
    h += '<div class="more" id="refs"><div><div class="ql" style="font-weight:650">References (optional)</div><p class="qh" style="margin-top:4px">Films, styles or brands you like. Links are sent with your estimate.</p></div>' +
      '<label class="fl">Links<textarea id="refLinks" placeholder="One link per line">' + esc(S.refs.links) + '</textarea></label>' +
      '<div id="refFiles" hidden><label class="drop" id="drop"><input type="file" id="refFile" accept="image/*,video/*" multiple><b style="color:var(--ink)">Add images or short clips</b><span>Up to 4. Looked at once to understand the style, then discarded. Nothing is kept on this site or sent with the estimate.</span></label><div class="thumbs" id="thumbs"></div></div>' +
      '<div class="read" id="refRead" aria-live="polite"></div></div>';
    return stepShell(4, 'Plan and budget', 'Volume, ongoing work, how you’d like to pay, and the budget you have in mind.', h);
  }
  function sendHTML() {
    var h = '<div class="q"><div class="ql">Your details</div>' +
      '<div class="f2"><label class="fl">Name<input id="lName" autocomplete="name" value="' + esc(S.lead.name) + '"></label><label class="fl">Email<input id="lEmail" type="email" autocomplete="email" value="' + esc(S.lead.email) + '"></label></div>' +
      '<div class="f2"><label class="fl"><span>Organisation <small>(optional)</small></span><input id="lOrg" autocomplete="organization" value="' + esc(S.lead.org) + '"></label><label class="fl"><span>WhatsApp or phone <small>(optional)</small></span><input id="lPhone" type="tel" autocomplete="tel" value="' + esc(S.lead.phone) + '"></label></div>' +
      '<label class="fl"><span>Anything to add? <small>(optional)</small></span><textarea id="lNote">' + esc(S.lead.note) + '</textarea></label>' +
      '<label class="hp" aria-hidden="true">Leave empty<input id="lHp" tabindex="-1" autocomplete="off"></label>' +
      '<label class="consent"><input type="checkbox" id="lConsent"' + (S.lead.consent ? ' checked' : '') + '><span>I agree to be contacted by DesignPraise Studio about this estimate, onboarding and next steps. My answers are used only for this enquiry.</span></label>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" class="btn big" id="sendBtn" disabled>Email my estimate</button><button type="button" class="btn line" id="printBtn">Save as PDF</button></div></div>';
    h += '<div class="q"><div class="ql">Terms in short</div>' + R.policies.map(function (p) { return '<details class="pol"><summary>' + esc(p[0]) + '</summary><p>' + esc(p[1]) + '</p></details>'; }).join('') + '</div>';
    return stepShell(5, 'Send your estimate', 'I’ll get a copy of your answers and the figure. Then you can add the full brief.', h);
  }

  function renderAll() {
    flow.innerHTML = aboutHTML() + projectHTML() + detailsHTML() + deliveryHTML() + planHTML() + sendHTML();
    showStep(S.step, true);
    bindStatic();
    updateTier(); updateEst(); renderFollow(); refsMode(); updateSend();
  }
  function rerender(i) {
    var el = flow.querySelector('[data-s="' + i + '"]'); if (!el) return;
    var html = [aboutHTML, projectHTML, detailsHTML, deliveryHTML, planHTML, sendHTML][i]();
    var tmp = document.createElement('div'); tmp.innerHTML = html; var nu = tmp.firstChild;
    nu.hidden = el.hidden; el.replaceWith(nu); revealIn(nu);
    if (i === 4) { bindStatic(); renderFollow(); refsMode(); updateEst(); }
    if (i === 5) { bindStatic(); updateSend(); }
    if (i === 0) updateTier();
  }

  /* ---------------- step navigation ---------------- */
  function canGo(i) { if (i >= 2 && !S.cat) return false; return true; }
  function renderSteps() {
    $('steps').innerHTML = STEPS.map(function (s, i) {
      return '<button type="button" data-go="' + i + '"' + (i === S.step ? ' aria-current="step"' : '') + ' class="' + (ACT.visited[s[0]] && i !== S.step ? 'done' : '') + '"' + (canGo(i) ? '' : ' disabled') + '><span class="d"></span>' + s[1] + '</button>';
    }).join('');
    var lit = Math.round((S.step + (S.sent ? 1 : 0)) / STEPS.length * 9);
    $('prog').innerHTML = HC.map(function (c, i) { return '<i style="--c:' + c + '" class="' + (i < lit ? 'f' : '') + '"></i>'; }).join('');
    var cur = $('steps').querySelector('[aria-current]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }
  $('steps').addEventListener('click', function (e) { var go = e.target.closest('[data-go]'); if (go && !go.disabled) showStep(+go.dataset.go); });
  function validate(i) {
    if (i === 0) { if (!S.market) return 'Please choose where your business is based.'; if (!S.about.org) return 'Please choose what best describes you.'; }
    if (i === 1 && !S.cat) return 'Please pick one project type.';
    return '';
  }
  function showStep(i, first) {
    if (!first && i > S.step) { for (var k = S.step; k < i; k++) { var e = validate(k); if (e) { var er = $('err-' + k); if (er) er.textContent = e; if (k !== S.step) { i = k; break; } return; } } }
    if (!canGo(i)) i = 1;
    ACT.stepTime[STEPS[S.step][0]] = (ACT.stepTime[STEPS[S.step][0]] || 0) + (Date.now() - stepT0); stepT0 = Date.now();
    var back = i < S.step; S.step = i; ACT.visited[STEPS[i][0]] = 1;
    flow.querySelectorAll('.step').forEach(function (s) {
      var on = +s.dataset.s === i; s.hidden = !on;
      if (on && !first) { s.classList.remove('enter', 'back'); void s.offsetWidth; s.classList.add(back ? 'back' : 'enter'); revealIn(s); }
      if (on && first) revealIn(s);
    });
    flow.querySelectorAll('.err').forEach(function (e) { e.textContent = ''; });
    renderSteps(); save();
    if (!first) { var top = $('main').getBoundingClientRect().top + scrollY - 70; if (scrollY > top) scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' }); var h = $('h-' + i); if (h) h.focus({ preventScroll: true }); }
    if (i === 4) aiFollow();
  }

  /* ---------------- events ---------------- */
  function changed() { ACT.changes++; if (!ACT.firstFigure && S.cat) ACT.firstFigure = Date.now(); save(); updateEst(); }
  function pressGroup(btn, multi) {
    var g = btn.parentElement;
    if (!multi) g.querySelectorAll('[aria-pressed]').forEach(function (b) { b.setAttribute('aria-pressed', b === btn); });
    else btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') !== 'true');
    if (navigator.vibrate && !reduce) try { navigator.vibrate(6); } catch (e) {}
  }
  flow.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]'); if (go) { showStep(+go.dataset.go); return; }
    var ct = e.target.closest('[data-cat]');
    if (ct) {
      if (S.cat && S.cat !== ct.dataset.cat) ACT.catSwitches++;
      S.cat = ct.dataset.cat; AI.follow.forCat = null; AI.follow.qs = []; AI.follow.ans = {};
      flow.querySelectorAll('[data-cat]').forEach(function (b) { b.setAttribute('aria-checked', b === ct); });
      rerender(2); rerender(3); renderSteps(); changed(); renderFollow();
      setTimeout(function () { if (S.step === 1) showStep(2); }, reduce ? 0 : 420);
      return;
    }
    var qb = e.target.closest('button[data-qk]');
    if (qb) {
      var cq = cat(), parts = qb.dataset.qk.split('.'), qq = allQ(cq).find(function (x) { return x.id === parts[0]; }), qo = qq && optsOf(qq).find(function (o) { return o.id === parts[1]; });
      if (!qo) return;
      var nn = Math.min(qo.qty.max, Math.max(1, EN.qtyOf(cq, qq, qo) + (+qb.dataset.qd))), id = qb.dataset.qk.replace(/\W/g, '-');
      EN.setQty(cq, qq, qo, nn);
      $('qn-' + id).textContent = nn; $('qx-' + id).textContent = qtyText(qo, nn);
      qb.parentElement.querySelectorAll('button').forEach(function (x) { x.disabled = +x.dataset.qd < 0 ? nn <= 1 : nn >= qo.qty.max; });
      changed(); return;
    }
    var b = e.target.closest('button[data-k]'); if (!b || b.hasAttribute('data-lock')) return;
    var k = b.dataset.k, v = b.dataset.v;
    if (k === 'mkt') {
      pressGroup(b); S.market = v; var m = market(); if (!S.cur || m.currencies.indexOf(S.cur) < 0) S.cur = m.def;
      if (S.about.revenue && !optsOf(R.about.find(function (q) { return q.id === 'revenue'; })).find(function (o) { return o.id === S.about.revenue; })) delete S.about.revenue;
      rerender(0); rerender(4); changed(); return;
    }
    if (k === 'cur') { pressGroup(b); setCur(v); return; }
    if (k.indexOf('a.') === 0) { pressGroup(b); S.about[k.slice(2)] = v; updateTier(); changed(); return; }
    if (k.indexOf('p.') === 0) { pressGroup(b); S.plan[k.slice(2)] = v; changed(); return; }
    if (k.indexOf('c.') === 0) {
      var c = cat(), q = allQ(c).find(function (x) { return x.id === k.slice(2); });
      if (q.type === 'assets') { pressGroup(b); var a = Object.assign({}, val(c, q)); a[b.dataset.item] = v; setVal(c, q, a); }
      else if (q.type === 'multi') { pressGroup(b, true); var arr = val(c, q).slice(), ix = arr.indexOf(v); if (ix > -1) arr.splice(ix, 1); else arr.push(v); setVal(c, q, arr); }
      else { pressGroup(b); setVal(c, q, v); }
      if (q.notes || allQ(c).some(function (x) { var r = x.show || x.hideIf; return r && r.q === q.id; })) { var y = scrollY; rerender(2); scrollTo(0, y); }
      if (qtyOpts(q).some(function (o) { return o.id === v; })) { var y2 = scrollY; rerender(logistics(c).indexOf(q) > -1 ? 3 : 2); scrollTo(0, y2); }
      changed();
    }
  });
  var raf = 0;
  flow.addEventListener('input', function (e) {
    var t = e.target;
    if (t.type === 'range') {
      var k = t.dataset.k, v = +t.value;
      t.style.setProperty('--f', ((v - t.min) / (t.max - t.min) * 100).toFixed(1) + '%');
      var q;
      if (k === 'p.count') { S.plan.count = v; q = { unit: '' }; }
      else { var c = cat(); q = allQ(c).find(function (x) { return x.id === k.slice(2); }); setVal(c, q, v); }
      var o = $('o-' + k.replace(/\W/g, '-')); if (o) o.textContent = unitTxt(q, v);
      cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { changed(); });
      return;
    }
    if (t.id === 'budget') { var d = t.value.replace(/[^\d.]/g, ''); S.plan.budget = d ? Number(d).toLocaleString('en-GB') : ''; if (t.value !== S.plan.budget) t.value = S.plan.budget; updateEst(); save(); return; }
    if (t.id === 'refLinks') { S.refs.links = t.value; save(); return; }
    if (/^l[A-Z]/.test(t.id)) { var map = { lName: 'name', lEmail: 'email', lOrg: 'org', lPhone: 'phone', lNote: 'note' }; if (map[t.id]) S.lead[map[t.id]] = t.value; if (t.id === 'lConsent') S.lead.consent = t.checked; save(); updateSend(); }
  });
  flow.addEventListener('change', function (e) { if (e.target.id === 'lConsent') { S.lead.consent = e.target.checked; save(); updateSend(); } if (e.target.id === 'refLinks') aiRefs(); });
  function setCur(id) { if (S.cur !== id) ACT.curSwitches++; S.cur = id; rerender(0); rerender(4); changed(); }

  /* ---------------- tier line ---------------- */
  function updateTier() {
    var el = $('tierline'); if (!el) return; var T = tierInfo();
    el.innerHTML = T.known ? '<span class="pill">' + esc(T.t.label) + '</span><span><b>' + esc(T.t.note) + '.</b> ' + (T.t.m < 1 ? Math.round((1 - T.t.m) * 100) + '% off standard pricing. ' + esc(R.copy.tierCheck) : T.t.m === 1 ? 'Standard pricing.' : 'Pricing reflects the scale of your organisation.') + '</span>' : '<span class="mute">Your pricing tier will show here.</span>';
  }

  /* ---------------- estimate panel ---------------- */
  var est = $('est'), lastTot = '';
  function updateEst() {
    var E = compute(), cur = curInfo(), m = market();
    var curBtns = '<div class="cur" role="group" aria-label="Currency">' + Object.keys(R.currencies).map(function (k) { var ok = !m || m.currencies.indexOf(k) > -1; return '<button type="button" data-cur="' + k + '" aria-pressed="' + (cur.id === k) + '"' + (ok ? '' : ' disabled title="Naira pricing is for businesses based in Nigeria"') + '>' + k + '</button>'; }).join('') + '</div>';
    var head = '<div class="hd"><span class="grab"></span><button type="button" class="close-sheet" id="closeSheet" aria-label="Close estimate">×</button><div class="k"><span>Your estimate</span><span>' + (E ? esc(E.T.t.label) : '') + '</span></div>';
    if (!E) {
      est.innerHTML = head + '<div class="tot">—</div><p class="sub">Pick a project to see a figure.</p>' + curBtns + '</div><div class="bd"><p class="empty">' + (S.market ? 'Choose a project type and the estimate appears here, updating with every answer.' : 'Start with where you’re based. Prices follow your market and your organisation.') + '</p><p class="note">' + esc(R.copy.estimate) + '</p></div>';
      $('bar').hidden = true; bindEst(); return;
    }
    var tot = totText(E, cur);
    var shown = E.checks.filter(function (x) { return x.level !== 'flag'; });
    var st = R.copy.status[E.status] ? '<span class="st st-' + E.status + '">' + esc(R.copy.status[E.status]) + '</span>' : '';
    var checksHTML = shown.length ? '<div class="checks">' + shown.map(function (x) { return '<p class="ck ck-' + x.level + '">' + esc(x.msg) + '</p>'; }).join('') + '</div>' : '';
    Object.keys(E.effective).forEach(function (k) { var o = $('o-c-' + k), q = allQ(E.c).find(function (x) { return x.id === k; }); if (o && q) o.textContent = unitTxt(q, val(E.c, q)) + ' · priced as ' + unitTxt(q, E.effective[k]); });
    var rows = '<div class="rows">' + E.rows.map(function (r) { return '<div class="' + (r.neg ? 'neg' : '') + '"><span>' + esc(r.label) + '</span><span>' + fmt(r.v, cur) + '</span></div>'; }).join('') + '<div class="sum"><span>Most likely</span><span>' + fmt(E.total, cur) + '</span></div></div>';
    var parts = milestones(E, cur);
    var pay = '<div><h4>Payment</h4><div class="ms">' + E.plan.map(function (p, i) { return '<div style="--c:' + HC[(i * 2 + 3) % 9] + '"><i></i><span>' + esc(p[0]) + ' (' + Math.round(p[1] * 100) + '%)</span><span>' + cur.symbol + parts[i].toLocaleString('en-GB') + '</span></div>'; }).join('') + '</div></div>';
    var ret = E.ret.months ? '<div class="budget"><b>Retainer:</b> about ' + fmt(E.total, cur) + ' a month for ' + E.ret.months + ' months (' + E.n + (E.n === 1 ? ' piece' : ' pieces') + ' a month), billed monthly in advance' + (E.setup ? ', plus a one-off setup of ' + fmt(E.setup, cur) + ' with the first month' : '') + '.</div>' : '';
    var bmsg = '', bv = Number(String(S.plan.budget).replace(/,/g, ''));
    if (bv) { var bn = bv * cur.fx; bmsg = bn < E.lo ? R.copy.budgetLow : bn > E.hi ? R.copy.budgetHigh : R.copy.budgetFits; }
    var bm = $('budgetMsg'); if (bm) { bm.hidden = !bmsg; bm.textContent = bmsg; bm.className = 'budget' + (bv && bv * cur.fx < E.lo ? ' low' : ''); }
    var cmp = compareAI(E, cur);
    est.innerHTML = head + '<div class="tot" id="tot">' + (E.status === 'call' ? '<span>' + esc(R.copy.callTotal) + '</span> <span>' + fmt(E.lo, cur) + '</span>' : rangeHTML(E, cur)) + '</div>' + st + '<p class="sub">' + esc(E.c.label) + (E.n > 1 ? ' · ' + E.n + ' pieces' : '') + (E.unsure ? ' · range widened for “not sure” answers' : '') + '</p>' + curBtns + '</div>' +
      '<div class="bd">' + checksHTML + rows + '<div class="kv"><b>Timeline</b><span>' + esc(E.timeline) + '</span><b>Revisions</b><span>' + esc((R.shared.revisions.options.find(function (o) { return o.id === val(E.c, R.shared.revisions); }) || {}).label || '') + '</span><b>Market</b><span>' + esc(E.m.label) + '</span>' + (cur.id !== 'NGN' ? '<b>Rate</b><span>' + esc(fxLine(cur)) + '</span>' : '') + '</div>' + pay + ret +
      (bmsg ? '<div class="budget' + (bv * cur.fx < E.lo ? ' low' : '') + '">' + esc(bmsg) + '</div>' : '') + cmp + '<p class="note">' + esc(R.copy.estimate) + '</p></div>';
    if (tot !== lastTot && lastTot && !reduce) { var t = $('tot'); t.classList.add('tick'); }
    lastTot = tot;
    $('barTotal').textContent = tot; $('bar').hidden = false;
    bindEst();
  }
  /* Same project, every AI approach side by side; tap one to switch. */
  function compareAI(E, cur) {
    var c = E.c, q = R.production.ai; if (!c.production || c.production.indexOf('ai') < 0) return '';
    var curV = val(c, q), saved = (S.ans[c.id] || {}).ai, rows = optsOf(q).map(function (o) {
      setVal(c, q, o.id); var X = compute(); return { o: o, v: X.total };
    });
    if (saved === undefined) delete S.ans[c.id].ai; else setVal(c, q, saved);
    return '<div><h4>Ways to make it</h4><div class="cmp">' + rows.map(function (r) {
      return '<button type="button" data-ai="' + r.o.id + '" aria-pressed="' + (r.o.id === curV) + '"><span>' + esc(r.o.label) + '</span><b>' + fmt(r.v, cur) + (E.ret.months ? '/mo' : '') + '</b></button>';
    }).join('') + '</div></div>';
  }
  function bindEst() {
    est.querySelectorAll('[data-ai]').forEach(function (b) { b.onclick = function () { var c = cat(); setVal(c, R.production.ai, b.dataset.ai); rerender(2); rerender(3); changed(); }; });
    est.querySelectorAll('[data-cur]').forEach(function (b) { b.onclick = function () { if (!b.disabled) setCur(b.dataset.cur); }; });
    var cs = $('closeSheet'); if (cs) cs.onclick = closeSheet;
  }

  /* mobile sheet */
  var scrim = document.createElement('div'); scrim.className = 'scrim'; document.body.appendChild(scrim);
  function openSheet() { est.classList.add('open'); scrim.classList.add('on'); $('barBtn').setAttribute('aria-expanded', 'true'); }
  function closeSheet() { est.classList.remove('open'); scrim.classList.remove('on'); $('barBtn').setAttribute('aria-expanded', 'false'); }
  $('barBtn').onclick = openSheet; scrim.onclick = closeSheet;
  (function () { var y0 = null; est.addEventListener('touchstart', function (e) { if (est.classList.contains('open') && e.target.closest('.hd')) y0 = e.touches[0].clientY; }, { passive: true });
    est.addEventListener('touchmove', function (e) { if (y0 === null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) est.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    est.addEventListener('touchend', function (e) { if (y0 === null) return; var dy = e.changedTouches[0].clientY - y0; est.style.transform = ''; y0 = null; if (dy > 80) closeSheet(); }); })();
  addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); if (!$('splash').hidden) hideSplash(); } });

  /* ---------------- send ---------------- */
  function bindStatic() {
    var sb = $('sendBtn'); if (sb) sb.onclick = send;
    var pb = $('printBtn'); if (pb) pb.onclick = function () { closeSheet(); print(); };
    var fi = $('refFile'); if (fi) fi.onchange = function () { addFiles(fi.files); fi.value = ''; };
    var dr = $('drop'); if (dr) { ['dragenter', 'dragover'].forEach(function (ev) { dr.addEventListener(ev, function (e) { e.preventDefault(); dr.classList.add('over'); }); }); ['dragleave', 'drop'].forEach(function (ev) { dr.addEventListener(ev, function (e) { e.preventDefault(); dr.classList.remove('over'); if (ev === 'drop') addFiles(e.dataTransfer.files); }); }); }
  }
  function validLead() { return S.lead.name && S.lead.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((S.lead.email || '').trim()) && S.lead.consent; }
  function updateSend() { var b = $('sendBtn'); if (b) b.disabled = !(validLead() && S.cat); }

  function labelOf(q, v) {
    if (q.type === 'range') return unitTxt(q, v);
    if (q.type === 'assets') return q.items.map(function (it) { var s = v[it.id] || 'have'; return it.label + ': ' + (s === 'have' ? 'have it' : s === 'need' ? 'needs it' : 'not needed'); }).join('; ');
    var o = optsOf(q); if (q.type === 'multi') return v.map(function (id) { var x = o.find(function (y) { return y.id === id; }); return x ? x.label + (x.qty ? ' × ' + EN.qtyOf(cat(), q, x) : '') : id; }).join(', ') || 'None';
    var x = o.find(function (y) { return y.id === v; }); return x ? x.label : '';
  }
  function selections() {
    var c = cat(), out = [];
    if (!c) return out;
    allQ(c).filter(function (q) { return visible(c, q); }).forEach(function (q) { out.push([q.label, labelOf(q, val(c, q))]); });
    return out;
  }
  function aboutPairs() {
    var out = [['Based in', market() ? market().label : '—'], ['Currency', curInfo().id]];
    R.about.forEach(function (q) { var o = optsOf(q).find(function (x) { return x.id === S.about[q.id]; }); out.push([q.label, o ? o.label : '—']); });
    return out;
  }
  function activity() {
    ACT.stepTime[STEPS[S.step][0]] = (ACT.stepTime[STEPS[S.step][0]] || 0) + (Date.now() - stepT0); stepT0 = Date.now();
    var mins = function (ms) { return Math.round(ms / 6000) / 10 + ' min'; };
    return {
      'Time on page': mins(Date.now() - ACT.start), 'Time to first figure': ACT.firstFigure ? mins(ACT.firstFigure - ACT.start) : '—',
      'Changes made': ACT.changes, 'Steps visited': Object.keys(ACT.visited).join(', '),
      'Time per step': Object.keys(ACT.stepTime).map(function (k) { return k + ' ' + mins(ACT.stepTime[k]); }).join(', '),
      'Project type switches': ACT.catSwitches, 'Currency switches': ACT.curSwitches,
      'Extra questions asked / answered': ACT.aiAsked + ' / ' + ACT.aiAnswered, 'References looked at': ACT.refsAnalysed,
      'Device': (matchMedia('(pointer:coarse)').matches ? 'Touch' : 'Mouse') + ', ' + innerWidth + '×' + innerHeight + ', ' + (document.documentElement.dataset.theme === 'dark' ? 'night' : 'day') + ' mode',
      'Language / time zone': navigator.language + ' / ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
      'Came from': ACT.referrer || 'Direct link', 'Source tag': ACT.src || '—'
    };
  }
  function report() {
    var E = compute(), cur = curInfo(), T = tierInfo(), A = activity(), L = [];
    var hr = function (t) { L.push('', t.toUpperCase()); };
    L.push('Live rate card estimate ' + S.ref, new Date().toUTCString(), '');
    L.push('Name: ' + S.lead.name, 'Email: ' + S.lead.email, 'Organisation: ' + (S.lead.org || '—'), 'WhatsApp/phone: ' + (S.lead.phone || '—'), 'Consent to be contacted: yes');
    if (S.lead.note) L.push('Note: ' + S.lead.note);
    hr('Estimate');
    L.push(E.c.label + ': ' + fmtRange(E, cur) + ' (most likely ' + fmt(E.total, cur) + ')');
    if (cur.id !== 'NGN') L.push('Exchange rate: ' + fxLine(cur) + ', reference ₦' + R.currencies[cur.id].fx);
    if (cur.id !== 'NGN') L.push('In naira: ' + fmtRange(E, R.currencies.NGN && Object.assign({ id: 'NGN' }, R.currencies.NGN)));
    E.rows.forEach(function (r) { L.push('  ' + r.label + ': ' + fmt(r.v, cur)); });
    L.push('Timeline: ' + E.timeline);
    var ms = milestones(E, cur);
    L.push('Payment: ' + E.plan.map(function (p, i) { return p[0] + ' ' + Math.round(p[1] * 100) + '% (' + cur.symbol + ms[i].toLocaleString('en-GB') + ')'; }).join('; '));
    if (E.ret.months) L.push('Retainer: ' + E.ret.months + ' months, ' + E.n + ' a month, about ' + fmt(E.total, cur) + ' a month');
    if (S.plan.budget) L.push('Client budget: ' + cur.symbol + S.plan.budget);
    if (E.unsure) L.push('“Not sure” answers: ' + E.unsure);
    if (E.floored) L.push('Minimum project fee applied.');
    L.push('Status: ' + ({ ready: 'Ready', adjusted: 'Adjusted to what’s possible', call: 'Needs a call' })[E.status], 'Valid until: ' + validUntil());
    if (E.setup) L.push('Series setup (one-off): ' + fmt(E.setup, cur) + (E.ret.months ? ', billed with the first month' : ', included above'));
    if (S.about['for'] === 'other') L.push('NOTE: arranged by an intermediary for another organisation; tier answers are about the paying organisation.');
    var refQ = R.production.reference; if (E.c.production && E.c.production.indexOf('reference') > -1 && val(E.c, refQ) === 'close') L.push('FLAG: wants something close to a specific ad or film. Check whose, and steer to an original look.');
    var aiQ = R.production.ai, aiV = E.c.production && E.c.production.indexOf('ai') > -1 ? val(E.c, aiQ) : null;
    if (aiV) L.push('AI in the production: ' + labelOf(aiQ, aiV) + (aiV === 'elements' || aiV === 'led' ? ' (rights note: AI-generated parts may not be copyrightable; exclusivity not guaranteed for them)' : ''));
    if (E.checks.length) { hr('Checks'); E.checks.forEach(function (x) { L.push((x.level === 'flag' ? 'FLAG (owner only)' : x.level.toUpperCase()) + ': ' + x.msg); }); }
    hr('Tier');
    L.push(T.t.label + ' (×' + T.t.m + ', score ' + T.pts + ')' + (T.t.m > 1 ? ' — premium folded into the lines the client sees' : ''));
    aboutPairs().forEach(function (p) { L.push(p[0] + ': ' + p[1]); });
    hr('Selections');
    selections().forEach(function (p) { L.push(p[0] + ': ' + p[1]); });
    L.push('Series: ' + labelOf(R.series, S.plan.series || 'no'), 'How many: ' + S.plan.count, 'Ongoing: ' + labelOf(R.retainer, S.plan.retainer), 'Payment preference: ' + labelOf(R.payPref, S.plan.pay));
    if (AI.follow.qs.length) { hr('Extra details'); AI.follow.qs.forEach(function (q) { var a = AI.follow.ans[q.id]; L.push(q.q + ' ' + (a == null || a === '' ? '(skipped)' : Array.isArray(a) ? a.join(', ') : a)); }); }
    if (S.refs.links.trim() || AI.refs.summary) { hr('References'); if (S.refs.links.trim()) L.push(S.refs.links.trim()); if (AI.refs.summary) L.push('Read of the references: ' + AI.refs.summary); AI.refs.notes.forEach(function (n) { L.push('  ' + n); }); }
    hr('Activity');
    Object.keys(A).forEach(function (k) { L.push(k + ': ' + A[k]); });
    L.push('', 'Rates version ' + R.version);
    return { text: L.join('\n'), E: E, A: A };
  }
  function fetchT(url, opt, ms) { var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms || 10000); return fetch(url, Object.assign({ signal: c.signal }, opt || {})).finally(function () { clearTimeout(t); }); }

  function send() {
    var btn = $('sendBtn'); if (!validLead()) { $('err-5').textContent = 'Please add your name, a valid email and tick the box.'; return; }
    if ($('lHp') && $('lHp').value) return;
    var R0 = report(), E = R0.E, cur = curInfo();
    var data = { ref: S.ref, category: E.c.id, tier: E.T.t.id, market: E.m.id, currency: cur.id, lo: conv(E.lo, cur), hi: conv(E.hi, cur), mid: conv(E.total, cur), lo_ngn: Math.round(E.lo), hi_ngn: Math.round(E.hi), mid_ngn: Math.round(E.total), status: E.status, checks: E.checks.map(function (x) { return x.id; }), state: window.RCEngine.stateOf(S), selections: selections(), about: aboutPairs(), plan: S.plan, followups: AI.follow.qs.map(function (q) { return [q.q, AI.follow.ans[q.id] || '']; }), links: S.refs.links, activity: R0.A, version: R.version };
    btn.disabled = true; btn.textContent = 'Sending…'; $('err-5').textContent = '';
    var lead = { name: S.lead.name.trim(), email: S.lead.email.trim(), org: S.lead.org || '', phone: S.lead.phone || '' };
    var subj = (E.status === 'call' ? '[Needs a call] ' : E.status === 'adjusted' ? '[Adjusted] ' : '') + 'Rate card estimate ' + S.ref + ' from ' + lead.name + ' (' + totText(E, cur) + ')';
    fetchT('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: S.ref, lead: lead, consent: true, subject: subj, text: R0.text, data: data }) }, 15000)
      .then(function (r) { return r.json().then(function (j) { return r.ok && j.mailed; }); }).catch(function () { return false; })
      .then(function (ok) {
        if (ok) return 'site';
        var fd = new FormData();
        fd.append('access_key', WEB3FORMS_KEY); fd.append('subject', subj); fd.append('from_name', 'designpraise rate card'); fd.append('name', lead.name); fd.append('email', lead.email); fd.append('replyto', lead.email); fd.append('message', R0.text);
        return fetchT('https://api.web3forms.com/submit', { method: 'POST', body: fd, headers: { Accept: 'application/json' } }, 15000).then(function (r) { return r.json(); }).then(function (j) { return j.success ? 'web3forms' : false; }).catch(function () { return false; });
      })
      .then(function (via) {
        if (!via) { location.href = 'mailto:' + R.owner.email + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(R0.text.slice(0, 1800)); via = 'mailto'; }
        S.sent = true; save(); renderSteps();
        try { sessionStorage.setItem('dp-rc', JSON.stringify({ ref: S.ref, name: lead.name, email: lead.email, org: lead.org, phone: lead.phone, category: E.c.label, range: totText(E, cur), budget: S.plan.budget ? cur.symbol + S.plan.budget : '', links: S.refs.links, at: Date.now() })); } catch (e) {}
        aiCall({ action: 'insight', context: ctx(E), outcome: 'sent' });
        btn.textContent = 'Sent'; showSplash(via);
      });
  }
  function showSplash(via) {
    var sp = $('splash'); sp.querySelectorAll('.sp-cube i').forEach(function (i, n) { i.style.setProperty('--n', n); i.style.setProperty('--c', HC[n]); });
    $('splashTxt').textContent = via === 'mailto' ? 'Your email app should open with the estimate ready to send. Once it’s sent, add the full brief: goals, audience, references and dates.' : 'I’ve received your selections and the figure. The next step is the full brief: goals, audience, references and dates. It takes about five minutes and lets our call go straight to the details.';
    $('splashBook').href = '/book/?ref=' + encodeURIComponent(S.ref);
    $('splashRef').textContent = 'Reference ' + S.ref;
    sp.hidden = false; closeSheet(); $('splashBook').focus();
  }
  function hideSplash() { $('splash').hidden = true; var b = $('sendBtn'); if (b) b.focus(); }
  $('splashClose').onclick = hideSplash;

  /* ---------------- optional helper (fails silently) ---------------- */
  function ctx(E) {
    E = E || compute(); var c = cat(), cur = curInfo();
    return {
      category: c ? c.label : null, tier: tierInfo().t.label, market: market() ? market().label : null, currency: cur.id,
      estimate: E ? { lo: conv(E.lo, cur), hi: conv(E.hi, cur), mid: conv(E.total, cur) } : null,
      selections: selections(), plan: { count: S.plan.count, retainer: S.plan.retainer, budget: S.plan.budget },
      schema: c ? allQ(c).filter(function (q) { return q.type === 'single'; }).map(function (q) { return { id: q.id, label: q.label, options: optsOf(q).map(function (o) { return { id: o.id, label: o.label }; }) }; }) : []
    };
  }
  function aiCall(body) {
    if (!AI.on) return Promise.resolve(null);
    return fetchT('/api/rate-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 25000)
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function aiPing() {
    fetchT('/api/rate-ai', {}, 2500).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { AI.on = !!(j && j.ok); AI.images = !!(j && j.images); refsMode(); if (S.step === 4) aiFollow(); }).catch(function () {});
  }
  function aiFollow() {
    if (!AI.on || !S.cat || AI.follow.forCat === S.cat) return;
    AI.follow.forCat = S.cat; var forCat = S.cat;
    aiCall({ action: 'followup', context: ctx() }).then(function (j) {
      if (!j || S.cat !== forCat || !Array.isArray(j.questions)) return;
      AI.follow.qs = j.questions.filter(function (q) { return q && q.id && q.q; }).slice(0, 3).map(function (q) { return { id: String(q.id).slice(0, 40), q: String(q.q).slice(0, 200), type: ['single', 'multi', 'text'].indexOf(q.type) > -1 ? q.type : 'text', options: (Array.isArray(q.options) ? q.options : []).slice(0, 6).map(function (o) { return String(o).slice(0, 60); }) }; });
      ACT.aiAsked += AI.follow.qs.length; save(); renderFollow(true);
    });
  }
  function renderFollow(anim) {
    var box = $('aiMore'); if (!box) return;
    if (!AI.follow.qs.length) { box.hidden = true; return; }
    box.innerHTML = '<div><div class="ql" style="font-weight:650">A few more details</div><p class="qh" style="margin-top:4px">These help me plan. They don’t change the estimate, and you can skip them.</p></div>' + AI.follow.qs.map(function (q, i) {
      var a = AI.follow.ans[q.id];
      if (q.type === 'text' || !q.options.length) return '<label class="fl">' + esc(q.q) + '<input data-fu="' + i + '" value="' + esc(a || '') + '"></label>';
      var multi = q.type === 'multi';
      return '<div class="q" style="border:0;padding:0"><div class="ql" style="font-size:15px">' + esc(q.q) + '</div><div class="chips' + (multi ? ' multi' : '') + '">' + q.options.map(function (o) { var on = multi ? (a || []).indexOf(o) > -1 : a === o; return '<button type="button" class="chip" data-fq="' + i + '" data-fo="' + esc(o) + '" aria-pressed="' + on + '">' + esc(o) + '</button>'; }).join('') + '</div></div>';
    }).join('');
    box.hidden = false; if (anim && !reduce) { box.classList.remove('in'); void box.offsetWidth; box.classList.add('in'); }
    box.onclick = function (e) { var b = e.target.closest('[data-fq]'); if (!b) return; var q = AI.follow.qs[+b.dataset.fq], o = b.dataset.fo, had = AI.follow.ans[q.id] != null && AI.follow.ans[q.id] !== '';
      if (q.type === 'multi') { var arr = (AI.follow.ans[q.id] || []).slice(), ix = arr.indexOf(o); if (ix > -1) arr.splice(ix, 1); else arr.push(o); AI.follow.ans[q.id] = arr; pressGroup(b, true); } else { AI.follow.ans[q.id] = o; pressGroup(b); }
      if (!had) ACT.aiAnswered++; save(); };
    box.oninput = function (e) { var t = e.target; if (t.dataset.fu == null) return; var q = AI.follow.qs[+t.dataset.fu], had = !!AI.follow.ans[q.id]; AI.follow.ans[q.id] = t.value.slice(0, 300); if (!had && t.value) ACT.aiAnswered++; save(); };
  }
  function refsMode() { var f = $('refFiles'); if (f) f.hidden = !(AI.on && AI.images); renderRefRead(); }
  function renderRefRead() {
    var el = $('refRead'); if (!el) return;
    if (AI.refs.busy) { el.innerHTML = '<p class="mute">Looking at your references…</p>'; return; }
    if (!AI.refs.summary) { el.innerHTML = ''; return; }
    var c = cat();
    el.innerHTML = '<p><b>What I noticed:</b> ' + esc(AI.refs.summary) + '</p>' + AI.refs.notes.map(function (n) { return '<p class="mute">' + esc(n) + '</p>'; }).join('') +
      AI.refs.suggest.map(function (s, i) { var q = c && allQ(c).find(function (x) { return x.id === s.q; }), o = q && optsOf(q).find(function (x) { return x.id === s.opt; }); if (!o || val(c, q) === o.id) return '';
        return '<div class="sugg"><span>' + esc(s.why || 'This looks closer to') + ': <b>' + esc(q.label) + ' → ' + esc(o.label) + '</b></span><button type="button" class="btn sm line" data-sg="' + i + '" style="min-height:38px;padding:0 14px">Use this</button></div>'; }).join('');
    el.onclick = function (e) { var b = e.target.closest('[data-sg]'); if (!b) return; var s = AI.refs.suggest[+b.dataset.sg], q = allQ(c).find(function (x) { return x.id === s.q; }); setVal(c, q, s.opt); rerender(2); rerender(3); changed(); b.parentElement.remove(); };
  }
  function shrink(src, max) { return new Promise(function (res) { var w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight, k = Math.min(1, max / Math.max(w, h)); var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.78)); }); }
  function imgFrames(file) { return new Promise(function (res) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { shrink(im, 1024).then(function (d) { URL.revokeObjectURL(u); res([d]); }); }; im.onerror = function () { URL.revokeObjectURL(u); res([]); }; im.src = u; }); }
  function vidFrames(file) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(file), v = document.createElement('video'), out = [], at = [0.15, 0.5, 0.85], i = 0;
      v.muted = true; v.preload = 'auto'; v.playsInline = true;
      var done = function () { URL.revokeObjectURL(u); res(out); };
      v.onloadedmetadata = function () { if (!isFinite(v.duration) || v.duration > 600) return done(); v.currentTime = v.duration * at[0]; };
      v.onseeked = function () { shrink(v, 768).then(function (d) { out.push(d); i++; if (i < at.length) v.currentTime = v.duration * at[i]; else done(); }); };
      v.onerror = done; setTimeout(done, 12000); v.src = u;
    });
  }
  var pendingImgs = [];
  function addFiles(list) {
    if (!AI.on || !AI.images) return;
    var files = [].slice.call(list || []).filter(function (f) { return /^(image|video)\//.test(f.type); }).slice(0, Math.max(0, 4 - AI.refs.files));
    if (!files.length) return;
    var th = $('thumbs');
    Promise.all(files.map(function (f) { AI.refs.files++; return (f.type.indexOf('video') === 0 ? vidFrames(f) : imgFrames(f)).then(function (fr) { if (fr[0] && th) { var s = document.createElement('span'); s.style.backgroundImage = 'url(' + fr[0] + ')'; s.title = f.name; th.appendChild(s); } return fr; }); }))
      .then(function (all) { all.forEach(function (fr) { pendingImgs = pendingImgs.concat(fr); }); pendingImgs = pendingImgs.slice(0, 8); aiRefs(); });
  }
  var refsTimer = 0;
  function aiRefs() {
    if (!AI.on) return; clearTimeout(refsTimer);
    refsTimer = setTimeout(function () {
      var links = S.refs.links.split(/\s+/).filter(function (l) { return /^https?:\/\//i.test(l); }).slice(0, 5);
      if (!pendingImgs.length && !links.length) return;
      var imgs = pendingImgs; pendingImgs = [];
      AI.refs.busy = true; renderRefRead();
      aiCall({ action: 'refs', context: ctx(), images: imgs, links: links }).then(function (j) {
        imgs = null; AI.refs.busy = false;
        if (j && j.summary) { AI.refs.summary = String(j.summary).slice(0, 600); AI.refs.notes = (j.notes || []).slice(0, 4).map(String); AI.refs.suggest = (j.suggest || []).slice(0, 3); ACT.refsAnalysed++; save(); }
        renderRefRead();
      });
    }, 500);
  }

  /* ---------------- reveal + theme + boot ---------------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' }) : null;
  function revealIn(root) { root.querySelectorAll('.lt,.rv').forEach(function (el) { if (reduce || !io) el.classList.add('on'); else io.observe(el); }); if (root.matches && root.matches('.lt,.rv')) root.classList.add('on'); }
  $('theme').onclick = function () { var r = document.documentElement, n = r.dataset.theme === 'dark' ? 'light' : 'dark'; var go = function () { r.dataset.theme = n; try { localStorage.setItem('dp-theme', n); } catch (e) {} }; if (document.startViewTransition && !reduce) document.startViewTransition(go); else go(); };
  $('copyEst').textContent = R.copy.estimate; $('copyHon').textContent = R.copy.honest;
  $('yr').textContent = new Date().getFullYear(); $('ver').textContent = 'Rates ' + R.version;
  if (new URLSearchParams(location.search).has('reset')) { try { sessionStorage.removeItem(KEY); } catch (e) {} location.replace(location.pathname); return; }
  renderAll(); revealIn(document.querySelector('.intro'));
  aiPing();
  if (R.fxRules && R.fxRules.live) fetchT('/api/fx', {}, 3000).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j || !j.rates) return; ['USD', 'GBP'].forEach(function (k) { if (+j.rates[k] > 0) FX.live[k] = +j.rates[k]; }); FX.at = j.at || Date.now(); FX.source = j.source || '';
    rerender(0); updateEst();
  }).catch(function () {});
  window.DPRC = { compute: compute, tierInfo: tierInfo, state: S, report: function () { return report().text; } }; // handy for checking prices in the console
})();
