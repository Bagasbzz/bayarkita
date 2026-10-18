# BayarKita — Jasa Pembayaran (replika fahmidev.com) + Web Chat + Admin

Situs statis (HTML/CSS/JS) + backend PHP ringan untuk **chat langsung di web**,
**pesanan dari kalkulator checkout masuk ke chat**, dan **dashboard admin**.

## Struktur

```
/                 halaman publik (index.html, tarif.html, dll) + styles.css, script.js
/jasa-pembayaran/ halaman detail layanan
/assets/          gambar & ikon
chat.css, chat.js widget chat pelanggan (di-include di semua halaman)
/api/             backend PHP (settings, chat, orders, admin)
/admin/           dashboard admin (SPA: index.html, admin.css, admin.js)
.cpanel.yml       auto-deploy cPanel (Git Version Control)
.htaccess         proteksi config/data + cache
```

## Fitur

**Pelanggan**
- Tombol chat merah → pilih WhatsApp / Chat Web.
- Chat web: identifikasi nama + nomor WA, pesan realtime (polling 3 dtk), status admin online.
- Checkout di kalkulator tarif → pesanan dibuat di server dan **konfirmasi masuk ke chat web** (kartu pesanan dengan kode, rincian biaya, status).
- Perubahan status pesanan oleh admin muncul sebagai pesan sistem di chat.

**Admin (`/admin/`)**
- Login username + password (sesi PHP).
- Dashboard: statistik pesanan/omzet, grafik 7 hari, layanan terlaris, pesanan terbaru.
- Inbox: daftar percakapan (unread badge, notifikasi bunyi + browser), balas, quick reply, tutup/buka, hapus, panel pesanan per pelanggan.
- Pesanan: cari/filter/paginasi, ubah status (baru/diproses/selesai/batal) + pesan otomatis ke chat, catatan, export CSV.
- Layanan: CRUD katalog, aktif/nonaktif, urutan tampil.
- Pengaturan: fee & rate (langsung dipakai kalkulator), kurs multi mata uang, teks chat & kontak, ganti password.

## Deploy ke cPanel (hosting PHP + MySQL)

1. **Buat database MySQL** di cPanel (MySQL® Databases): buat DB, user, dan beri ALL PRIVILEGES.
2. **Git Version Control** → Create → clone repo ini, centang deploy. Edit `.cpanel.yml`:
   ganti `USER` dengan username cPanel (path `/home/USER/public_html`). Deploy pertama akan
   menyalin `api/config.sample.php` → `api/config.php` jika belum ada.
3. **Isi `api/config.php`** (lewat File Manager) dengan kredensial MySQL:
   ```php
   'db' => ['driver'=>'mysql','host'=>'localhost','name'=>'cpuser_bayarkita','user'=>'cpuser_app','pass'=>'...'],
   'admin' => ['username'=>'admin','password'=>'GANTI-SEGERA'],
   ```
   Tabel dibuat otomatis saat API pertama kali diakses (migrasi + seed layanan).
4. Pastikan PHP ≥ 8.0 dengan ekstensi `pdo_mysql` (MultiPHP Manager).
5. Buka `https://domain/admin/`, login, lalu **ganti password** di menu Pengaturan.
6. Push ke `master` → cPanel deploy otomatis (atau klik *Update from Remote* + *Deploy HEAD Commit*).

> **Catatan Vercel:** deploy di Vercel hanya menjalankan file statis. Chat web, checkout ke
> chat, dan `/admin/` **tidak berfungsi** di Vercel karena butuh PHP + database.

## Development lokal

```bash
cp api/config.sample.php api/config.php   # set 'driver' => 'sqlite' untuk tanpa MySQL
php -S 127.0.0.1:3000 -t .
# buka http://127.0.0.1:3000  dan  http://127.0.0.1:3000/admin/
```

`api/config.php` dan `api/data/` (SQLite) di-ignore oleh git — jangan commit kredensial.
