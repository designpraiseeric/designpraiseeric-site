/* =====================================================================
   LIVE RATE CARD — pricing engine.
   Shared by the page (app.js) and the server (/api/estimate), so the figure a client sees
   is the figure the studio re-checks. It only reads RATES and the answers; it never touches the page.

   RCEngine.make(RATES, state) → helpers bound to that state:
     state = { market, about:{}, cat, ans:{ [cat]: { [question]: value } }, plan:{ count, retainer, pay, series } }
     compute() → the estimate (naira, client's market level) plus checks and a status:
       status 'ready'    nothing unusual
              'adjusted' an answer was outside what's possible, so a realistic value was priced
                         (or a tight-schedule line was added, or savings were capped)
              'call'     outside what the calculator can price well; the figure is a starting point
     Every check: { id, level: 'adjusted' | 'tight' | 'call' | 'note' | 'flag', msg }
       'note' is shown to the client but doesn't change the status.
       'flag' is for the owner only (in the emailed report), never shown on the page.
   Every number the checks use lives in RATES.checks (rates.js).
   ===================================================================== */
(function (g) {
  'use strict';

  function make(R, S) {
    var CK = R.checks || {};
    var market = function () { return R.markets.find(function (m) { return m.id === S.market; }); };
    var cat = function () { return R.categories.find(function (c) { return c.id === S.cat; }); };

    function optsOf(q) {
      var list = Array.isArray(q.options) ? q.options : q.options[market() ? market().revenue : 'ngn'];
      var c = cat(); return list.filter(function (o) { return !o.cats || !c || o.cats.indexOf(c.id) > -1; });
    }
    function prodQ(c) { return (c.production || []).map(function (id) { return R.production[id]; }).filter(Boolean); }
    function logistics(c) { return (c.logistics || []).map(function (id) { return id === 'formats' ? R.shared.videoFormats : R.shared[id]; }).filter(Boolean); }
    function allQ(c) { return c.questions.concat(prodQ(c), logistics(c)); }
    function qOf(c, id) { return allQ(c).find(function (q) { return q.id === id; }); }
    function visible(c, q) {
      var rule = q.show || q.hideIf; if (!rule) return true;
      if (rule.cats && rule.cats.indexOf(c.id) < 0) return true;
      var w = qOf(c, rule.q), wv = w ? val(c, w) : null;
      var hit = !!w && (Array.isArray(wv) ? wv.some(function (x) { return rule.in.indexOf(x) > -1; }) : rule.in.indexOf(wv) > -1);
      return q.show ? hit : !hit;
    }
    function defaultOf(q) {
      if (q.type === 'range') return q.def;
      if (q.type === 'assets') return {};
      var o = optsOf(q);
      if (q.type === 'multi') return o.filter(function (x) { return x.def; }).map(function (x) { return x.id; });
      return (o.find(function (x) { return x.def; }) || o[0]).id;
    }
    /* Every answer is cleaned here, so a doctored saved state can't price anything the page couldn't. */
    function val(c, q) {
      var a = (S.ans && S.ans[c.id]) || {}, v = a[q.id];
      if (v === undefined || v === null) return defaultOf(q);
      if (q.type === 'range') {
        var n = +v; if (!isFinite(n)) return q.def;
        n = Math.min(q.max, Math.max(q.min, n));
        n = q.min + Math.round((n - q.min) / q.step) * q.step;
        return +Math.min(q.max, n).toFixed(4);
      }
      if (q.type === 'assets') {
        if (typeof v !== 'object' || Array.isArray(v)) return {};
        var out = {}; q.items.forEach(function (it) { if (['have', 'need', 'none'].indexOf(v[it.id]) > -1) out[it.id] = v[it.id]; }); return out;
      }
      var ids = optsOf(q).map(function (o) { return o.id; });
      if (q.type === 'multi') {
        if (!Array.isArray(v)) return defaultOf(q);
        var keep = []; v.forEach(function (x) { if (ids.indexOf(x) > -1 && keep.indexOf(x) < 0) keep.push(x); });
        optsOf(q).forEach(function (o) { if (o.lock && keep.indexOf(o.id) < 0) keep.unshift(o.id); });
        return keep;
      }
      return ids.indexOf(v) > -1 ? v : defaultOf(q);
    }
    /* Quantities for countable options live in ans[cat].qty['question.option']. */
    function qtyOf(c, q, o) {
      if (!o.qty) return 1;
      var store = (S.ans && S.ans[c.id] && S.ans[c.id].qty) || {}, n = Math.round(+store[q.id + '.' + o.id]);
      if (!isFinite(n) || store[q.id + '.' + o.id] == null) n = o.qty.def || 1;
      return Math.min(o.qty.max || 99, Math.max(1, n));
    }
    function setQty(c, q, o, n) { S.ans = S.ans || {}; var a = (S.ans[c.id] = S.ans[c.id] || {}); a.qty = a.qty || {}; a.qty[q.id + '.' + o.id] = n; }
    function qtyOff(o, n) { var d = 0; (o.qty.steps || R.qtySteps || []).forEach(function (s) { if (n >= s.from) d = s.off; }); return d; }
    /* Units actually charged: n × (1 − discount), never fewer than for a smaller quantity. */
    function qtyUnits(o, n) { var best = 0; for (var i = 1; i <= n; i++) best = Math.max(best, i * (1 - qtyOff(o, i))); return best; }
    function setVal(c, q, v) { S.ans = S.ans || {}; (S.ans[c.id] = S.ans[c.id] || {})[q.id] = v; }
    var sum = function (a) { return a.reduce(function (s, x) { return s + x.v; }, 0); };
    var pick = function (list, id) { return list.find(function (o) { return o.id === id; }) || list.find(function (o) { return o.def; }) || list[0]; };

    /* ---------- tier ---------- */
    function tierInfo() {
      var pts = 0, np = false, u = 0, about = S.about || {}, known = false, why = [];
      R.about.forEach(function (q) {
        var o = optsOf(q).find(function (x) { return x.id === about[q.id]; });
        if (!o) return;
        if (q.id === 'org') known = true;
        pts += o.pts || 0; if (o.np) np = true; u += o.u || 0; why.push(q.id + ':' + o.label);
      });
      var T = R.tierRules, id;
      if (!known) id = 'standard';
      else if (pts >= T.enterprise) id = 'enterprise';
      else if (pts >= T.growth) id = 'growth';
      else if (pts >= T.standard) id = 'standard';
      else if (pts >= T.small) id = 'small';
      else id = np && pts <= T.community ? 'community' : 'startup';
      return { t: R.tiers.find(function (t) { return t.id === id; }), pts: pts, u: u, known: known, signals: why };
    }
    /* Answers about the organisation that don't sit well together. Owner-only: the client is never told. */
    function tierFlags() {
      var a = S.about || {}, f = [], big = ['corp', 'gov', 'mnc'], np = ['personal', 'student', 'ngo', 'church'];
      var say = function (id, msg) { f.push({ id: id, level: 'flag', msg: msg }); };
      if ((a.size === 's5' || a.size === 's6') && a.revenue === 'r0') say('tier-size-revenue', 'Over 250 staff but the lowest revenue band.');
      if (a.size === 's1' && (a.funding === 'series' || a.funding === 'listed' || a.revenue === 'r3')) say('tier-solo-large', '“Just me”, but with Series A+ or public funding, or the top revenue band.');
      if (big.indexOf(a.org) > -1 && (a.size === 's1' || a.size === 's2')) say('tier-big-small', 'Large organisation type with 10 staff or fewer.');
      if (np.indexOf(a.org) > -1 && (a.revenue === 'r3' || a.size === 's6' || a.funding === 'series' || a.funding === 'listed')) say('tier-np-large', 'Personal, student or nonprofit, but with large revenue, staff or investment.');
      if ((a.org === 'startup' || a.org === 'creator') && a.funding === 'listed') say('tier-startup-listed', 'Early startup or creator, but listed or government-funded.');
      return f;
    }

    /* ---------- text helpers for check messages ---------- */
    function lenTxt(s) { var m = Math.floor(s / 60), r = Math.round(s % 60); return m ? m + ' min' + (r ? ' ' + r + ' s' : '') : r + ' s'; }
    var dTxt = function (d) { return d + (d === 1 ? ' day' : ' days'); };
    var hTxt = function (h) { return h + (h === 1 ? ' hour' : ' hours'); };
    var upStep = function (x, step, min) { return Math.max(min, Math.ceil(x / step - 1e-9) * step); };

    /* ---------- engine ---------- */
    function volDisc(n) { var d = 0; R.volume.steps.forEach(function (s) { if (n >= s.from) d = s.off; }); return d; }
    function compute() {
      var c = cat(); if (!c) return null;
      var m = market() || R.markets[0], L = m.level, T = tierInfo(), tm = T.t.m;
      var all = allQ(c).filter(function (q) { return visible(c, q); });
      var base = c.base, mult = 1, scale = 1, u = T.u, lines = [], pass = [], perMin = 1, perDay = 1, chosen = [], unsure = 0;
      var checks = [], eff = {}, extra = [];
      var lenQ = c.questions.find(function (q) { return q.id === 'length'; }), len = lenQ ? val(c, lenQ) : 0;
      if (lenQ) perMin = Math.max(1, len / 60);
      var dayQ = c.questions.find(function (q) { return q.id === 'days'; }), days = dayQ && visible(c, dayQ) ? val(c, dayQ) : null;
      var charQ = c.questions.find(function (q) { return q.id === 'chars'; }), chars = charQ && visible(c, charQ) ? val(c, charQ) : 0;
      var variantQ = c.questions.find(function (q) { return q.id === 'variant'; }), variant = variantQ ? val(c, variantQ) : null;

      /* Film: enough shoot days for the finished length, and long-form goes to a call. */
      var F = CK.film;
      if (c.id === 'film' && F) {
        var vLabel = variantQ ? (pick(optsOf(variantQ), variant).label || '').toLowerCase() : 'film';
        if (len > F.longForm && F.longOk.indexOf(variant) < 0) {
          checks.push({ id: 'long-form', level: 'call', msg: len >= F.feature
            ? 'A feature-length film is a production of its own: development, a larger crew, permits, insurance and months of post. It’s planned and quoted on a call; treat this figure as a starting point, not a budget.'
            : 'Work longer than ' + lenTxt(F.longForm) + ' is planned and quoted on a call: the schedule, crew and post-production need a proper breakdown. Treat this figure as a starting point.' });
        }
        if (days !== null) {
          var pace = F.pace[variant] || F.pace.brand, slow = 1;
          Object.keys(F.slow).forEach(function (qid) {
            var qq = qOf(c, qid); if (!qq || !visible(c, qq)) return;
            var vv = val(c, qq); (Array.isArray(vv) ? vv : [vv]).forEach(function (id) { if (F.slow[qid][id]) slow *= F.slow[qid][id]; });
          });
          var mins = len / 60, step = dayQ.step;
          var minDays = upStep(mins / (pace[0] * slow), step, dayQ.min), goodDays = Math.max(minDays, upStep(mins / (pace[1] * slow), step, dayQ.min));
          if (days < minDays) {
            checks.push({ id: 'days-min', level: 'adjusted', msg: 'At ' + lenTxt(len) + ', a ' + vLabel + ' needs at least ' + dTxt(minDays) + ' of shooting, even at a fast pace, so the estimate uses ' + dTxt(minDays) + ' instead of ' + dTxt(days) + '. A comfortable schedule is about ' + dTxt(goodDays) + '.' });
            days = minDays;
          }
          eff.days = days;
          if (days < goodDays) {
            var P = F.tight.p * (goodDays - days) / Math.max(step, goodDays - minDays);
            extra.push({ p: P, line: F.tight.line });
            checks.push({ id: 'days-tight', level: 'tight', msg: dTxt(days) + ' for ' + lenTxt(len) + ' is a tight schedule: long days and extra hands on set. That’s priced as its own line; about ' + dTxt(goodDays) + ' would remove it.' });
          }
        }
      }
      if (days !== null) perDay = days;
      /* Editing: the finished edit can't be longer than the footage it's cut from. */
      var footQ = c.questions.find(function (q) { return q.id === 'footage'; });
      if (footQ && lenQ && CK.edit) {
        var foot = val(c, footQ), needH = upStep(len / 3600 * CK.edit.ratio, footQ.step, footQ.min);
        if (foot < needH) {
          checks.push({ id: 'footage-min', level: 'adjusted', msg: 'A ' + lenTxt(len) + ' finished edit needs at least ' + hTxt(needH) + ' of raw footage to cut from, so the estimate uses ' + hTxt(needH) + ' instead of ' + hTxt(foot) + '.' });
          eff.footage = needH;
        }
      }

      all.forEach(function (q) {
        if (q.type === 'range') { if (q.scale) scale *= Math.pow((eff[q.id] != null ? eff[q.id] : val(c, q)) / q.scale.ref, q.scale.exp); return; }
        if (q.type === 'assets') {
          var a = val(c, q);
          q.items.forEach(function (it) { if (a[it.id] === 'need' && it.need) chosen.push({ q: q, o: Object.assign({ label: it.need.line || it.label }, it.need) }); });
          return;
        }
        var v = val(c, q);
        optsOf(q).filter(function (o) { return q.type === 'multi' ? v.indexOf(o.id) > -1 : o.id === v; }).forEach(function (o) { chosen.push({ q: q, o: o }); });
      });
      extra.forEach(function (o) { chosen.push({ q: { type: 'check' }, o: o }); });
      chosen = chosen.filter(function (x) {
        var w = x.o.when; if (!w) return true;
        var wq = all.find(function (q) { return q.id === w.q; }); if (!wq) return false;
        var wv = val(c, wq); wv = Array.isArray(wv) ? wv : [wv];
        return w.any.some(function (id) { return wv.indexOf(id) > -1; });
      });
      var needScale = 1;
      chosen.forEach(function (x) { var o = x.o; if (o.b) base += o.b; if (o.m) mult *= o.m; if (o.needScale) needScale *= o.needScale; if (o.u) { u += o.u; unsure++; } });
      var production = base * scale * mult, floored = false;
      if (production < (c.min || 0)) { production = c.min; floored = true; }
      var qtySave = 0, qtyLines = [];
      chosen.forEach(function (x) {
        var asset = x.q.type === 'assets' || x.o.aiScale, ns = asset ? needScale : 1;
        var o = x.o, label = (o.line || o.label) + (asset && ns < 1 ? ' with AI' : ''), k = (o.perMin ? perMin : 1) * (o.perDay ? perDay : 1) * (o.perChar ? Math.max(1, chars) : 1) * ns;
        var qn = o.qty ? qtyOf(c, x.q, o) : 1, units = o.qty ? qtyUnits(o, qn) : 1;
        if (o.qty) {
          var off = 1 - units / qn;
          label += ' × ' + qn + (off > 0.0005 ? ' (' + Math.round(off * 100) + '% off each)' : '');
          qtySave += ((o.p ? production * o.p * ns : 0) + (o.a ? o.a * k : 0)) * (qn - units);
          qtyLines.push({ id: x.q.id + '.' + o.id, n: qn, units: units, off: off });
        }
        if (o.p) lines.push({ label: label, v: production * o.p * ns * units });
        if (o.a) lines.push({ label: label, v: o.a * k * units });
        if (o.pass) pass.push({ label: label, v: o.pass * k * units });
      });
      var merge = function (arr) { var mm = {}, out = []; arr.forEach(function (l) { if (mm[l.label]) mm[l.label].v += l.v; else { mm[l.label] = { label: l.label, v: l.v }; out.push(mm[l.label]); } }); return out; };
      lines = merge(lines); pass = merge(pass);

      /* plan */
      var plan = S.plan || {};
      var n = Math.round(+plan.count || 1); n = Math.min(R.volume.max, Math.max(R.volume.min, isFinite(n) ? n : 1));
      var vd = volDisc(n);
      var ret = R.retainer.options.find(function (o) { return o.id === plan.retainer; }) || R.retainer.options[0];
      var disc = Math.max(vd, ret.off || 0), discFrom = (ret.off || 0) > vd ? 'retainer' : 'volume';
      var payOff = (R.payPref.options.find(function (o) { return o.id === plan.pay; }) || {}).off || 0;
      /* Savings floor: tier discount × volume or retainer saving × upfront saving never take the studio fee below this share. */
      var tmD = Math.min(1, tm), capped = false, work0 = production + sum(lines);
      /* quantity discounts count toward the same cap: the floor is raised by the share they already took */
      var Fl = CK.savingsFloor ? Math.min(1, CK.savingsFloor * (work0 + qtySave) / work0) : 0;
      if (Fl && tmD * (1 - disc) * (1 - payOff) < Fl - 1e-9) {
        capped = true;
        if (tmD * (1 - disc) < Fl) { payOff = 0; disc = Math.max(0, 1 - Fl / tmD); }
        else payOff = 1 - Fl / (tmD * (1 - disc));
        checks.push({ id: 'savings-cap', level: 'adjusted', msg: 'Savings are capped at ' + Math.round((1 - CK.savingsFloor) * 100) + '% in total, so the combined tier, ' + discFrom + ', quantity and upfront savings have been trimmed to fit.' });
      }
      var work1 = production + sum(lines), pass1 = sum(pass);
      /* Tier premiums are folded into each line; tier discounts are shown as their own line. */
      var rows = [], up = tm > 1 ? tm : 1, pc = function (x) { return Math.round(x * 1000) / 10; };
      rows.push({ label: n > 1 ? 'Production × ' + n : 'Production', v: production * n * L * up });
      lines.forEach(function (l) { rows.push({ label: l.label + (n > 1 ? ' × ' + n : ''), v: l.v * n * L * up }); });
      if (disc) rows.push({ label: (discFrom === 'retainer' ? 'Retainer saving' : 'Volume saving') + ' (' + pc(disc) + '%' + (capped ? ', capped' : '') + ')', v: -work1 * n * disc * L * up, neg: true });
      if (tm < 1) rows.push({ label: T.t.label + ' discount (' + Math.round((1 - tm) * 100) + '%)', v: work1 * n * (1 - disc) * (tm - 1) * L, neg: true });
      pass.forEach(function (l) { rows.push({ label: l.label + ' (third party)' + (n > 1 ? ' × ' + n : ''), v: l.v * n * L }); });
      var setup = 0;
      if (plan.series === 'yes') {
        setup = (production * R.seriesSetup.share + chars * R.seriesSetup.perChar) * tm * L;
        if (!ret.months) rows.push({ label: R.seriesSetup.line, v: setup });
      }
      /* The upfront saving applies to the studio's work only; third-party costs are passed on at cost. */
      var studio = work1 * n * (1 - disc) * tm * L + (ret.months ? 0 : setup), third = pass1 * n * L;
      if (payOff) rows.push({ label: 'Paid in full upfront (' + pc(payOff) + '%' + (capped ? ', capped' : '') + ')', v: -studio * payOff, neg: true });
      var total = studio * (1 - payOff) + third;
      var b = R.band, lo = total * Math.max(0.5, b.lo - u * b.perUnsure * 0.5), hi = total * (b.hi + u * b.perUnsure);
      // payment
      var tierPay = R.payment.find(function (p) { return total <= p.upTo; });
      var pplan = tierPay.plan.map(function (p) { return [p[0], p[1]]; });
      var dep = pplan[0][1], turnQ = R.shared.turnaround, turn = c.logistics.indexOf('turnaround') > -1 ? val(c, turnQ) : 'std', floor = 0;
      if (S.market !== 'ng') floor = Math.max(floor, R.depositFloor.international);
      if (turn === 'rush' || turn === 'emerg') floor = Math.max(floor, R.depositFloor.rush);
      if (dep < floor && pplan.length > 1) { var rest = 1 - dep; pplan[0][1] = floor; for (var i = 1; i < pplan.length; i++) pplan[i][1] = pplan[i][1] / rest * (1 - floor); }
      if (payOff) pplan = [['Full payment before work starts', 1]];
      if (ret.months && !payOff) pplan = [['Each month, in advance', 1]];
      // timeline
      var speed = (turnQ.options.find(function (o) { return o.id === turn; }) || {}).speed || 1;
      var effort = work1 * n * (1 - disc) / R.dayRate, weeks = (effort / 5 + 1) * speed;
      var timeline = turn === 'emerg' ? Math.max(2, Math.round(effort * 0.6)) + '–' + Math.max(4, Math.round(effort)) + ' working days, if I’m free' :
        ret.months ? 'Delivered through the month, ' + ret.months + ' months' :
          (function () { var a = Math.max(1, Math.round(weeks * 0.8)), z = Math.max(a + 1, Math.round(weeks * 1.25)); return a + '–' + z + ' weeks from approved brief'; })();

      /* checks on the whole job */
      if (turn === 'emerg' && !ret.months && CK.emergencyMaxDays && effort > CK.emergencyMaxDays) {
        checks.push({ id: 'emergency-size', level: 'call', msg: 'This is about ' + Math.round(effort) + ' working days of work, which is too much for an emergency slot. The figure includes the emergency rate; real dates are agreed on a call.' });
      }
      if (CK.callAbove && total / L > CK.callAbove) {
        checks.push({ id: 'size', level: 'call', msg: 'A project of this size is scoped properly on a call before anything is priced. Treat the figure as a starting point.' });
      }
      var so = qOf(c, 'signoff'), rv = qOf(c, 'revisions');
      if (so && rv && val(c, so) === 'many' && val(c, rv) === 'r2') checks.push({ id: 'committee-rounds', level: 'note', msg: 'With a committee signing off, 3 rounds of revisions is usually more realistic. Two are priced here; extra rounds are billed if needed.' });
      checks = checks.concat(tierFlags());

      if (checks.some(function (x) { return x.level === 'call' && x.id !== 'emergency-size'; })) timeline = 'Planned on the call';
      var status = checks.some(function (x) { return x.level === 'call'; }) ? 'call' : checks.some(function (x) { return x.level === 'adjusted' || x.level === 'tight'; }) ? 'adjusted' : 'ready';
      return { c: c, m: m, T: T, rows: rows, total: total, setup: setup, chars: chars, lo: lo, hi: hi, plan: pplan, timeline: timeline, ret: ret, n: n, unsure: unsure, floored: floored, production: production,
        checks: checks, status: status, effective: eff, effort: effort, capped: capped, qty: qtyLines, qtySave: qtySave };
    }

    return { market: market, cat: cat, optsOf: optsOf, prodQ: prodQ, logistics: logistics, allQ: allQ, visible: visible, defaultOf: defaultOf, val: val, setVal: setVal, qtyOf: qtyOf, setQty: setQty, qtyOff: qtyOff, tierInfo: tierInfo, compute: compute };
  }

  /* The answers the server needs to price an estimate again, and nothing else. */
  function stateOf(S) { return { market: S.market, about: S.about || {}, cat: S.cat, ans: S.cat && S.ans ? { [S.cat]: S.ans[S.cat] || {} } : {}, plan: { count: S.plan && S.plan.count, retainer: S.plan && S.plan.retainer, pay: S.plan && S.plan.pay, series: S.plan && S.plan.series } }; }

  g.RCEngine = { make: make, stateOf: stateOf };
})(typeof window !== 'undefined' ? window : globalThis);
