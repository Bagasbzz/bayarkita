-- PO plan umum 4 peserta: group progress dan deadline 7 hari.
ALTER TABLE orders ADD COLUMN po_group_id INTEGER;
CREATE TABLE IF NOT EXISTS po_groups (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_key     TEXT NOT NULL,
  product_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  target_size     INTEGER NOT NULL DEFAULT 4,
  member_count    INTEGER NOT NULL DEFAULT 0,
  deadline_at     TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_open_product ON po_groups(product_key) WHERE status = 'open';
CREATE TABLE IF NOT EXISTS po_group_members (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    INTEGER NOT NULL,
  order_id    INTEGER NOT NULL,
  slot        INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE(group_id, order_id),
  UNIQUE(group_id, slot)
);
