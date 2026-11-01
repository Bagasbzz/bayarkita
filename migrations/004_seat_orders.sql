-- Product seat individual: email undangan + snapshot produk dan harga promo.
-- Isi order lama tetap NULL dan tidak berubah.
ALTER TABLE orders ADD COLUMN customer_email TEXT;
ALTER TABLE orders ADD COLUMN product_key TEXT;
