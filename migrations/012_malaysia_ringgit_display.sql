-- Snapshot mata uang tampilan pelanggan. Settlement dan payload QRIS tetap IDR.
ALTER TABLE orders ADD COLUMN display_currency TEXT NOT NULL DEFAULT 'IDR';
ALTER TABLE orders ADD COLUMN display_rate REAL NOT NULL DEFAULT 1;

-- Pesanan Malaysia lama memakai kurs MYR yang tersimpan di pengaturan saat migrasi.
UPDATE orders
SET display_currency = 'MYR',
    display_rate = COALESCE(
      NULLIF(CAST((SELECT svalue FROM settings WHERE skey = 'rate_MYR') AS REAL), 0),
      4400
    )
WHERE locale = 'ms';
