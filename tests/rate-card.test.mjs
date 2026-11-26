// Rate card engine tests. Run: node --test tests/
// Covers the price anchor, the checks that stop impossible answers being priced, the savings floor,
// tampered answers, the server re-check, and a fuzz run that every answer combination prices sanely.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../rate-card/rates.js';
import '../rate-card/engine.js';
import { serverCheck, checkText } from '../functions/_lib/rate-check.js';

const R = globalThis.RATES, EN = globalThis.RCEngine;
const clone = (o) => JSON.parse(JSON.stringify(o));
const state = (cat, ans = {}, extra = {}) => Object.assign({ market: 'ng', about: {}, cat, ans: { [cat]: ans }, plan: { count: 1, retainer: 'no', pay: 'std', series: 'no' } }, extra);
const run = (S) => EN.make(R, S).compute();
const ids = (E) => E.checks.map((x) => x.id);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

test('anchor: standard motion video, assets supplied, is ₦120k at 90 s (low) and ₦350k at 180 s (high)', () => {
  assert.equal(Math.round(run(state('motion', { length: 90 })).lo / 100) * 100, 120300);
  assert.equal(Math.round(run(state('motion', { length: 180 })).hi / 100) * 100, 350100);
});

test('every project type on its defaults is ready, with nothing to adjust', () => {
  R.categories.forEach((c) => {
    const E = run(state(c.id));
    assert.equal(E.status, 'ready', c.id + ': ' + ids(E).join(','));
  });
});

test('a feature-length film crushed into one shoot day is priced at a realistic schedule and sent to a call', () => {
  const S = state('film', { variant: 'short', length: 3600, days: 1 });
  const E = run(S);
  assert.equal(E.status, 'call');
  assert.ok(ids(E).includes('days-min') && ids(E).includes('long-form') && ids(E).includes('days-tight'));
  assert.ok(E.effective.days >= 7.5, 'priced days ' + E.effective.days);
  const naive = EN.make(Object.assign({}, R, { checks: {} }), clone(S)).compute();
  assert.ok(E.total > naive.total * 4, 'checked ' + E.total + ' vs naive ' + naive.total);
});

test('a 30-second commercial in one day is fine', () => {
  assert.equal(run(state('film', { variant: 'ad', length: 30, days: 1 })).status, 'ready');
});

test('full-length event coverage is not long-form', () => {
  const E = run(state('film', { variant: 'event', length: 7200, days: 1 }));
  assert.ok(!ids(E).includes('long-form'));
  assert.ok(E.effective.days >= 2);
});

test('more locations or a large cast need more shoot days', () => {
  const a = run(state('film', { variant: 'short', length: 900, days: 0.5 })).effective.days;
  const b = run(state('film', { variant: 'short', length: 900, days: 0.5, locs: 4, cast: 'actors', actors: 8 })).effective.days;
  assert.ok(b > a, a + ' → ' + b);
});

test('an edit can’t be longer than its footage', () => {
  const E = run(state('edit', { length: 3600, footage: 0.5 }));
  assert.ok(ids(E).includes('footage-min'));
  assert.equal(E.effective.footage, 1);
});

test('emergency turnaround on a big job needs a call', () => {
  const E = run(state('anim2d', { length: 600, turnaround: 'emerg' }));
  assert.ok(ids(E).includes('emergency-size'));
  assert.equal(E.status, 'call');
  assert.equal(run(state('motion', { length: 30, turnaround: 'emerg' })).status, 'ready');
});

test('very large estimates need a call', () => {
  const E = run(state('anim3d', { length: 300, look: 'photo', model: 'complex', variant: 'char' }, { market: 'us', plan: { count: 20, retainer: 'no', pay: 'std' } }));
  assert.ok(ids(E).includes('size'));
});

test('savings never take the studio fee below 60%', () => {
  const nonprofit = { org: 'ngo', size: 's1', revenue: 'r0', funding: 'grant' };
  const full = run(state('motion', {}, { about: {} }));
  const deep = run(state('motion', {}, { about: nonprofit, plan: { count: 1, retainer: 'm12', pay: 'full', series: 'no' } }));
  assert.equal(deep.T.t.id, 'community');
  assert.ok(ids(deep).includes('savings-cap'));
  assert.ok(Math.abs(deep.total / full.total - 0.6) < 1e-9, deep.total / full.total);
  const mild = run(state('motion', {}, { about: nonprofit }));
  assert.ok(!ids(mild).includes('savings-cap'));
});

test('the upfront saving comes off the studio fee, not third-party costs', () => {
  const S = state('film', { cast: 'many', kit: 'cine' });
  const a = run(S), b = run(Object.assign(clone(S), { plan: { count: 1, retainer: 'no', pay: 'full', series: 'no' } }));
  const third = a.rows.filter((r) => /third party/.test(r.label)).reduce((s, r) => s + r.v, 0);
  assert.ok(third > 0);
  assert.ok(Math.abs((a.total - b.total) - (a.total - third) * 0.03) < 1);
});

test('tampered answers are clamped to what the page allows', () => {
  const E = run(state('motion', { length: 99999, chars: -5, blend: ['char', 'nope', 'char'], style: 'gold', assets: 'x' }, { plan: { count: 500, retainer: 'forever', pay: 'free' } }));
  assert.ok(isFinite(E.total) && E.total > 0);
  assert.equal(E.n, 20);
  const max = run(state('motion', { length: 600, chars: 1, blend: ['char'] }, { plan: { count: 20, retainer: 'no', pay: 'std' } }));
  assert.ok(Math.abs(E.total - max.total) < 1);
});

test('tier flags are for the owner only and don’t change the status', () => {
  const E = run(state('motion', {}, { about: { org: 'church', size: 's6', revenue: 'r3', funding: 'grant' } }));
  const f = E.checks.filter((x) => x.level === 'flag');
  assert.ok(f.length >= 1);
  assert.equal(E.status, 'ready');
});

test('more of anything never costs less', () => {
  for (let i = 0; i < 300; i++) {
    const c = rnd(R.categories), ans = {};
    const S = state(c.id, ans, { market: rnd(R.markets).id, plan: { count: 1, retainer: rnd(R.retainer.options).id, pay: rnd(R.payPref.options).id, series: rnd(['yes', 'no']) } });
    c.questions.forEach((q) => { if (q.type === 'single') ans[q.id] = rnd(q.options).id; });
    c.questions.filter((q) => q.type === 'range').forEach((q) => {
      let last = -1;
      for (let v = q.min; v <= q.max; v += q.step * Math.max(1, Math.round((q.max - q.min) / q.step / 40))) {
        const t = clone(S); t.ans[c.id][q.id] = v;
        const tot = run(t).total;
        assert.ok(tot >= last - 1e-6, c.id + '.' + q.id + ' at ' + v + ': ' + tot + ' < ' + last);
        last = tot;
      }
    });
    let last = -1;
    for (let n = 1; n <= 20; n++) { const t = clone(S); t.plan.count = n; const tot = run(t).total; assert.ok(tot >= last - 1e-6, c.id + ' count ' + n); last = tot; }
  }
});

test('fuzz: any combination of answers gives a sane figure', () => {
  for (let i = 0; i < 4000; i++) {
    const c = rnd(R.categories), ans = {}, m = rnd(R.markets);
    const about = {}; R.about.forEach((q) => { const o = Array.isArray(q.options) ? q.options : q.options[m.revenue]; if (Math.random() < 0.9) about[q.id] = rnd(o).id; });
    const E0 = EN.make(R, state(c.id, ans));
    E0.allQ(c).forEach((q) => {
      if (q.type === 'range') ans[q.id] = q.min + Math.floor(Math.random() * ((q.max - q.min) / q.step + 1)) * q.step;
      else if (q.type === 'assets') { const a = {}; q.items.forEach((it) => { a[it.id] = rnd(['have', 'need', 'none']); }); ans[q.id] = a; }
      else if (q.type === 'multi') ans[q.id] = q.options.filter(() => Math.random() < 0.3).map((x) => x.id);
      else ans[q.id] = rnd(q.options).id;
    });
    const E = run(state(c.id, ans, { market: m.id, about, plan: { count: 1 + Math.floor(Math.random() * 20), retainer: rnd(R.retainer.options).id, pay: rnd(R.payPref.options).id, series: rnd(['yes', 'no']) } }));
    assert.ok(isFinite(E.total) && E.total > 0, c.id);
    assert.ok(E.lo <= E.total && E.total <= E.hi, c.id);
    assert.ok(['ready', 'adjusted', 'call'].includes(E.status));
    assert.ok(E.rows.every((r) => isFinite(r.v)));
    const pcts = E.plan.reduce((s, p) => s + p[1], 0); assert.ok(Math.abs(pcts - 1) < 1e-9, 'milestones add to 100%');
  }
});

test('server check: matching, edited and old pages', () => {
  const S = state('film', { variant: 'short', length: 3600, days: 1 });
  const E = run(clone(S));
  const ok = serverCheck({ state: EN.stateOf(clone(S)), mid_ngn: Math.round(E.total), version: R.version }, 'NG');
  assert.equal(ok.match, true); assert.equal(ok.status, 'call');
  const edited = serverCheck({ state: EN.stateOf(clone(S)), mid_ngn: Math.round(E.total / 3), version: R.version }, 'NG');
  assert.equal(edited.match, false); assert.ok(/MISMATCH/.test(checkText(edited, { mid_ngn: 1, version: R.version })));
  const old = serverCheck({ state: EN.stateOf(clone(S)), mid_ngn: 1, version: '2026-01-01' }, 'NG');
  assert.ok(/older copy/.test(checkText(old, { mid_ngn: 1, version: '2026-01-01' })));
  assert.equal(serverCheck({}, 'NG').done, false);
  const abroad = serverCheck({ state: EN.stateOf(clone(S)), mid_ngn: Math.round(E.total), version: R.version }, 'GB');
  assert.ok(abroad.flags.some((f) => /GB/.test(f)));
  const junk = serverCheck({ state: { cat: 'motion', ans: { motion: { length: 'lots' } }, plan: 'x', about: [1] }, mid_ngn: 5 }, '');
  assert.equal(junk.done, true);
});

/* ---------- quantities (PR #11) ---------- */
const qtyOptions = () => {
  const out = [];
  R.categories.forEach((c) => { const E = EN.make(R, state(c.id)); E.allQ(c).forEach((q) => { if (q.type === 'multi') q.options.forEach((o) => { if (o.qty) out.push({ c, q, o }); }); }); });
  return out;
};

test('every countable line: the default quantity prices like the old single line, and more never costs less', () => {
  const list = qtyOptions();
  assert.ok(list.length >= 7, 'countable lines: ' + list.length);
  list.forEach(({ c, q, o }) => {
    let last = -1;
    for (let n = 1; n <= o.qty.max; n++) {
      const S = state(c.id, { [q.id]: [o.id], qty: { [q.id + '.' + o.id]: n } });
      if (q.id === 'formats') S.ans[c.id][q.id] = ['master', o.id];
      const tot = run(S).total;
      assert.ok(tot >= last - 1e-6, c.id + ' ' + o.id + ' at ' + n);
      last = tot;
    }
    const first = (o.qty.steps || R.qtySteps)[0].from;
    assert.ok(first > o.qty.def, o.id + ': discount starts above the default quantity');
  });
});

test('quantity discounts show on the line and follow the table', () => {
  const S = state('edit', { extras: ['thumb'], qty: { 'extras.thumb': 10 } });
  const E = run(S), row = E.rows.find((r) => /Thumbnails/.test(r.label));
  assert.match(row.label, /× 10 \(20% off each\)/);
  assert.ok(Math.abs(row.v - 21000 * 10 * 0.8) < 1);
  const lang = run(state('motion', { formats: ['master', 'lang'], qty: { 'formats.lang': 3 } })).rows.find((r) => /Language/.test(r.label));
  assert.match(lang.label, /× 3 \(10% off each\)/);
});

test('tampered quantities are clamped', () => {
  const E = run(state('identity', { apps: ['social'], qty: { 'apps.social': 5000 } }));
  const max = run(state('identity', { apps: ['social'], qty: { 'apps.social': 40 } }));
  assert.equal(E.total, max.total);
  const neg = run(state('identity', { apps: ['social'], qty: { 'apps.social': -3 } }));
  const one = run(state('identity', { apps: ['social'], qty: { 'apps.social': 1 } }));
  assert.equal(neg.total, one.total);
});

test('quantity savings count toward the 40% cap', () => {
  const nonprofit = { org: 'ngo', size: 's1', revenue: 'r0', funding: 'grant' };
  const ans = { variant: 'logo', apps: ['social', 'sign'], qty: { 'apps.social': 40, 'apps.sign': 20 } };
  const list = run(Object.assign(state('identity', ans), { about: {} }));
  const deep = run(Object.assign(state('identity', ans), { about: nonprofit, plan: { count: 1, retainer: 'm12', pay: 'full', series: 'no' } }));
  const listPrice = list.total + list.qtySave;
  assert.ok(deep.total >= 0.6 * listPrice - 1, (deep.total / listPrice).toFixed(3));
});

test('no discount table has a step where one more unit costs less (so the % shown is the table’s)', () => {
  const tables = [R.qtySteps].concat(qtyOptions().map(({ o }) => o.qty.steps).filter(Boolean));
  tables.forEach((t) => {
    let prev = 0;
    t.forEach((st) => { assert.ok((st.from - 1) * (1 - prev) <= st.from * (1 - st.off) + 1e-9, JSON.stringify(t)); prev = st.off; });
  });
});

/* ---------- exact counts (PR #12) ---------- */
test('film: actors are paid per actor per shoot day, and only when actors are hired', () => {
  const E = run(state('film', { cast: 'actors', actors: 5, days: 2 }));
  const row = E.rows.find((r) => /^Actors × 5/.test(r.label));
  assert.ok(row && Math.abs(row.v - 50000 * 5 * 2) < 1, row && row.label);
  const none = run(state('film', { cast: 'none', actors: 5 }));
  assert.ok(!none.rows.some((r) => /Actors/.test(r.label)));
  const ai = run(state('film', { cast: 'actors', actors: 5, ai: 'led' }));
  assert.ok(!ai.rows.some((r) => /Actors/.test(r.label)), 'AI-led has no shoot, so no actors');
});

test('film: more locations than a day can cover raises the shoot days', () => {
  const E = run(state('film', { variant: 'brand', length: 90, days: 1, locs: 7 }));
  assert.ok(E.effective.days >= 2.5, E.effective.days);
  assert.match(E.checks.find((x) => x.id === 'days-min').msg, /get round 7 locations/);
  assert.equal(run(state('film', { variant: 'brand', length: 90, days: 1, locs: 2 })).status, 'ready');
});

test('3D: products, shots and speaking characters all add cost', () => {
  const base = run(state('anim3d')).total;
  assert.ok(run(state('anim3d', { products: 4 })).total > base);
  assert.ok(run(state('anim3d', { shots: 20 })).total > base);
  const c1 = run(state('anim3d', { variant: 'char' })), c3 = run(state('anim3d', { variant: 'char', chars: 3, dialogue: 'lines' }));
  assert.ok(c3.total > c1.total * 1.5);
  assert.ok(c3.rows.some((r) => /Character voices/.test(r.label)));
  assert.equal(run(state('anim3d', { variant: 'char', products: 9 })).total, c1.total, 'products don’t apply to character work');
});
