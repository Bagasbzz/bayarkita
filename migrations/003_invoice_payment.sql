-- Migrasi v3: halaman invoice + pembayaran (QRIS dinamis, rekening, masa berlaku).
-- Jalankan: npx wrangler d1 execute bayarkita --remote --file=./migrations/003_invoice_payment.sql
--   (lokal: ganti --remote dengan --local)
ALTER TABLE orders ADD COLUMN expires_at TEXT;   -- batas bayar invoice (waktu lokal)
ALTER TABLE orders ADD COLUMN paid_at TEXT;      -- waktu admin konfirmasi pembayaran

-- Balasan otomatis lama menyuruh menunggu instruksi di chat; sekarang instruksi ada di halaman invoice.
UPDATE settings SET svalue = 'Terima kasih, pesanan Anda sudah kami terima. Silakan selesaikan pembayaran lewat halaman invoice (rekening & QRIS tersedia di sana), lalu konfirmasi ke admin.'
WHERE skey = 'order_auto_reply'
  AND svalue = 'Terima kasih, pesanan Anda sudah kami terima. Admin akan segera mengirimkan instruksi pembayaran di chat ini.';
