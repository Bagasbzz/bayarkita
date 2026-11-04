-- Potongan harga (IDR) per pesanan; total sudah dikurangi nilai ini.
ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0;

-- Fee layanan turun 10% (patungan tetap Rp5.000, seat tetap tanpa fee).
UPDATE settings SET svalue = '18000' WHERE skey = 'fee_idr_base';
UPDATE settings SET svalue = '4.05' WHERE skey = 'fee_idr_pct';
UPDATE settings SET svalue = '18000' WHERE skey = 'fee_usd_min';
UPDATE settings SET svalue = '25200' WHERE skey = 'fee_usd_base';
UPDATE settings SET svalue = '0.9' WHERE skey = 'fee_usd_pct';
