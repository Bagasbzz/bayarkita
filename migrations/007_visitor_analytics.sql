CREATE TABLE IF NOT EXISTS analytics_daily (
  visit_date TEXT PRIMARY KEY,
  visits INTEGER NOT NULL DEFAULT 0,
  new_visits INTEGER NOT NULL DEFAULT 0,
  returning_visits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytics_visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last_seen ON analytics_visitors(last_seen_at);
