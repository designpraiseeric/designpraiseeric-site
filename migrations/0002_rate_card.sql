-- Live rate card. Created automatically by functions/_lib/rates-db.js on first use; kept here for reference.
CREATE TABLE IF NOT EXISTS rc_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT, name TEXT, email TEXT, org TEXT, phone TEXT,
  category TEXT, tier TEXT, market TEXT, currency TEXT, lo INTEGER, hi INTEGER, net_country TEXT,
  data TEXT, report TEXT, mailed INTEGER DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rc_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, category TEXT, tier TEXT, market TEXT, currency TEXT,
  est_mid INTEGER, insight TEXT, feature TEXT, meta TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rc_estimates_at ON rc_estimates(created_at);
CREATE INDEX IF NOT EXISTS rc_insights_at ON rc_insights(created_at);
