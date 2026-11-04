-- Schema D1 (SQLite). Jalankan: npm run db:migrate (remote) / npm run db:migrate:local
-- Seed data (admin, settings, katalog layanan) dilakukan otomatis oleh kode
-- saat API pertama kali diakses, jadi file ini cukup berisi DDL.

CREATE TABLE IF NOT EXISTS settings (
  skey   TEXT PRIMARY KEY,
  svalue TEXT
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  currencies  TEXT,
  presets     TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  token            TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  unread_admin     INTEGER NOT NULL DEFAULT 0,
  unread_customer  INTEGER NOT NULL DEFAULT 0,
  last_message     TEXT,
  last_sender      TEXT,
  last_at          TEXT,
  customer_seen_at TEXT,
  created_at       TEXT NOT NULL,
  agent            TEXT,                        -- nama persona AI yang menangani
  ai_enabled       INTEGER NOT NULL DEFAULT 1,  -- 0 = admin manusia ambil alih
  connected_at     TEXT                         -- waktu "terhubung dengan agen" (setelah antrian)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender          TEXT NOT NULL,
  body            TEXT NOT NULL,
  meta            TEXT,
  created_at      TEXT NOT NULL,
  visible_at      TEXT                         -- NULL = langsung tampil; untuk jeda balasan AI
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT UNIQUE NOT NULL,
  conversation_id INTEGER NOT NULL,
  service_slug    TEXT,
  service_name    TEXT NOT NULL,
  plan            TEXT,
  amount          REAL NOT NULL,
  currency        TEXT NOT NULL,
  rate            REAL NOT NULL DEFAULT 1,
  amount_idr      REAL NOT NULL,
  fee             REAL NOT NULL,
  total           REAL NOT NULL,
  status          TEXT NOT NULL DEFAULT 'baru',   -- baru (menunggu bayar) | dibayar | diproses | selesai | batal
  customer_name   TEXT NOT NULL,
  phone           TEXT NOT NULL,
  note            TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  expires_at      TEXT,                          -- batas bayar invoice
  paid_at         TEXT,                          -- waktu pembayaran dikonfirmasi admin
  customer_email TEXT,                           -- email tujuan undangan seat (khusus admin)
  product_key     TEXT,                           -- snapshot key paket promo seat/PO
  po_group_id     INTEGER,                        -- grup PO plan umum bila ada
  discount        REAL NOT NULL DEFAULT 0         -- potongan harga (IDR) yang sudah dikurangkan dari total
);

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

-- Sesi login admin. Token disimpan sebagai hash SHA-256.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Rate limit percobaan login gagal per IP.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip         TEXT NOT NULL,
  attempted_at TEXT NOT NULL
);

-- Analytics menyimpan hitungan harian dan ID anonim sementara, bukan riwayat halaman.
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

CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_visible ON messages (conversation_id, visible_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_last ON conversations (last_at);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts (ip, attempted_at);
CREATE INDEX IF NOT EXISTS idx_analytics_visitors_last_seen ON analytics_visitors(last_seen_at);
