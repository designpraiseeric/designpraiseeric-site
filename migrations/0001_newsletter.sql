-- Newsletter (D1 database "designpraiseeric-newsletter", bound to the Pages project as NEWS_DB).
CREATE TABLE IF NOT EXISTS subscribers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  topics        TEXT NOT NULL DEFAULT 'work,tools,site',
  status        TEXT NOT NULL DEFAULT 'pending',      -- pending | confirmed | unsubscribed
  confirm_hash  TEXT,                                 -- sha256 of the emailed confirmation token
  unsub_token   TEXT NOT NULL,
  source        TEXT,
  created_at    INTEGER NOT NULL,
  confirmed_at  INTEGER,
  unsub_at      INTEGER,
  confirm_sent  INTEGER                               -- when the last confirmation email went out
);
CREATE INDEX IF NOT EXISTS subscribers_status ON subscribers(status);

CREATE TABLE IF NOT EXISTS campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  topic       TEXT NOT NULL DEFAULT 'all',
  status      TEXT NOT NULL DEFAULT 'sending',        -- sending | sent
  total       INTEGER NOT NULL DEFAULT 0,
  sent        INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  announce    TEXT,                                   -- JSON {toolId: version} marked announced when sent
  created_at  INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS deliveries (
  campaign_id   INTEGER NOT NULL,
  subscriber_id INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',       -- queued | sent | failed
  error         TEXT,
  at            INTEGER,
  PRIMARY KEY (campaign_id, subscriber_id)
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
