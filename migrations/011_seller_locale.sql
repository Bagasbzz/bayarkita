-- Akun Seller berbasis sesi pelanggan, locale Indonesia/Malaysia, dan snapshot diskon bulk.
ALTER TABLE conversations ADD COLUMN account_type TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE conversations ADD COLUMN locale TEXT NOT NULL DEFAULT 'id';

ALTER TABLE orders ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN unit_amount REAL;
ALTER TABLE orders ADD COLUMN unit_amount_idr REAL;
ALTER TABLE orders ADD COLUMN seller_discount REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN locale TEXT NOT NULL DEFAULT 'id';
