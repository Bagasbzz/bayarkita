-- Migrasi v2: dukungan Live Chat AI.
-- Jalankan: npx wrangler d1 execute bayarkita --remote --file=./migrations/002_live_chat.sql
ALTER TABLE messages ADD COLUMN visible_at TEXT;
ALTER TABLE conversations ADD COLUMN agent TEXT;
ALTER TABLE conversations ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE conversations ADD COLUMN connected_at TEXT;
CREATE INDEX IF NOT EXISTS idx_msg_visible ON messages (conversation_id, visible_at);
