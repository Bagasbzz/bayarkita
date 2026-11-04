-- Kembalikan rumus fee dasar; promo sekarang lewat fee_cut_pct (potong fee 10%
-- untuk pesanan selain paket ChatGPT/Claude > $20 yang sudah dapat diskon dolar).
UPDATE settings SET svalue = '20000' WHERE skey = 'fee_idr_base';
UPDATE settings SET svalue = '4.5' WHERE skey = 'fee_idr_pct';
UPDATE settings SET svalue = '20000' WHERE skey = 'fee_usd_min';
UPDATE settings SET svalue = '28000' WHERE skey = 'fee_usd_base';
UPDATE settings SET svalue = '1' WHERE skey = 'fee_usd_pct';
INSERT INTO settings (skey, svalue) VALUES ('fee_cut_pct', '10')
  ON CONFLICT(skey) DO UPDATE SET svalue = excluded.svalue;
