// Live rate card storage, in the same D1 database as the newsletter (binding NEWS_DB).
// Tables are created on first use, so there's nothing to run by hand. Schema copy: migrations/0002_rate_card.sql.
//   rc_estimates — one row per emailed estimate (the client agreed to be contacted).
//   rc_insights  — notes from the optional helper: what clients asked for, gaps in the calculator, feature ideas. No names, emails or images.

let ready = false;
export async function ensureRateTables(db) {
  if (ready || !db) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS rc_estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT, name TEXT, email TEXT, org TEXT, phone TEXT,
      category TEXT, tier TEXT, market TEXT, currency TEXT, lo INTEGER, hi INTEGER, net_country TEXT,
      data TEXT, report TEXT, mailed INTEGER DEFAULT 0, created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS rc_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, category TEXT, tier TEXT, market TEXT, currency TEXT,
      est_mid INTEGER, insight TEXT, feature TEXT, meta TEXT, created_at INTEGER NOT NULL)`),
    db.prepare('CREATE INDEX IF NOT EXISTS rc_estimates_at ON rc_estimates(created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS rc_insights_at ON rc_insights(created_at)'),
  ]);
  ready = true;
}

export async function logInsight(env, row) {
  if (!env.NEWS_DB || !row || (!row.insight && !row.feature)) return;
  try {
    await ensureRateTables(env.NEWS_DB);
    await env.NEWS_DB.prepare('INSERT INTO rc_insights (action, category, tier, market, currency, est_mid, insight, feature, meta, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(row.action || '', row.category || '', row.tier || '', row.market || '', row.currency || '', row.est_mid || null,
        String(row.insight || '').slice(0, 1000), String(row.feature || '').slice(0, 600), JSON.stringify(row.meta || {}).slice(0, 4000), Date.now())
      .run();
  } catch (e) { /* never break the page over a log line */ }
}
