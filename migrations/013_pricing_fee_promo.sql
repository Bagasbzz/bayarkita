-- Promo fee baru: bila fee hasil kalkulasi lebih dari Rp25.000, kurangi Rp7.000.
-- Persentase promo lama dinonaktifkan agar tidak terakumulasi dengan potongan nominal.
INSERT INTO settings (skey, svalue) VALUES ('fee_cut_threshold', '25000')
  ON CONFLICT(skey) DO UPDATE SET svalue = excluded.svalue;
INSERT INTO settings (skey, svalue) VALUES ('fee_cut_flat', '7000')
  ON CONFLICT(skey) DO UPDATE SET svalue = excluded.svalue;
INSERT INTO settings (skey, svalue) VALUES ('fee_cut_pct', '0')
  ON CONFLICT(skey) DO UPDATE SET svalue = excluded.svalue;
