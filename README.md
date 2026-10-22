# BayarKita — Jasa Pembayaran + Web Chat + Admin (Cloudflare Pages + D1)

Situs statis (HTML/CSS/JS) + backend **Cloudflare Pages Functions** + database **Cloudflare D1**
untuk chat langsung di web, pesanan dari kalkulator checkout, dan dashboard admin.
Gratis di tier free Cloudflare; deploy otomatis setiap push ke GitHub.

## Struktur

```
public/                 semua file statis yang di-serve (output Pages)
  index.html, faq.html, artikel.html, jasa-pembayaran.html, syarat-dan-ketentuan.html
  jasa-pembayaran/      halaman detail layanan
  admin/                dashboard admin (SPA: index.html, admin.css, admin.js)
  assets/               gambar & ikon
  styles.css, script.js, chat.css, chat.js
  _headers              header HTTP (cache aset, noindex admin)
functions/
  api/_middleware.js    konteks request, seed awal, penanganan error
  api/settings.js       GET /api/settings[?services=1]
  api/chat.js           /api/chat?action=start|poll|send|seen
  api/orders.js         POST /api/orders
  api/admin.js          /api/admin?action=...  (butuh login)
  _lib/core.js          helper DB, settings, kalkulasi fee, percakapan
  _lib/auth.js          sesi admin (cookie + tabel D1), rate limit login
  _lib/password.js      hash password PBKDF2 (WebCrypto)
schema.sql              DDL tabel D1
wrangler.toml           konfigurasi Pages + binding D1
```

## Fitur

**Pelanggan**
- Tombol chat → pilih WhatsApp / Chat Web.
- Chat web: identifikasi nama + nomor WA, polling 3 dtk, indikator admin online.
- Checkout di kalkulator tarif → pesanan dibuat di server (fee dihitung ulang di server) dan konfirmasi masuk ke chat web.
- Perubahan status pesanan oleh admin muncul sebagai pesan sistem di chat.

**Admin (`/admin/`)**
- Login username + password (sesi 7 hari, rate limit 8 gagal / 10 menit per IP).
- Dashboard: statistik pesanan/omzet, grafik 14 hari, layanan terlaris, pesanan terbaru.
- Inbox: daftar percakapan, balas, quick reply, tutup/buka, hapus, panel pesanan per pelanggan.
- Pesanan: cari/filter/paginasi, ubah status + pesan otomatis ke chat, catatan, export CSV.
- Layanan: CRUD katalog, aktif/nonaktif, urutan.
- Pengaturan: fee & kurs (langsung dipakai kalkulator), teks chat & kontak, ganti username/password.

---

## Deploy ke Cloudflare (lewat GitHub)

### 1. Push kode ke GitHub

```bash
git add -A
git commit -m "Migrate to Cloudflare Pages + D1"
git push origin master
```

### 2. Buat database D1

Dashboard Cloudflare → **Storage & databases → D1 SQL Database → Create**:
- Name: `bayarkita`
- Setelah dibuat, salin **Database ID** → tempel ke `wrangler.toml` di `database_id`, commit, push.

Lalu buat tabel. Buka tab **Console** di halaman database tersebut, tempel seluruh isi
`schema.sql`, jalankan. (Alternatif via terminal: `npx wrangler login` lalu `npm run db:migrate`.)

### 3. Buat project Pages dari GitHub

Dashboard → **Compute → Workers & Pages → Create → Pages → Connect to Git** → pilih repo `bayarkita`.

Build settings:

| Field                  | Nilai     |
|------------------------|-----------|
| Framework preset       | None      |
| Build command          | *(kosong)*|
| Build output directory | `public`  |

Klik **Save and Deploy**. Deploy pertama akan jalan tanpa DB (API error 500) — lanjut ke langkah 4.

### 4. Binding D1 + Secret

Di project Pages → **Settings**:

**Bindings → Add → D1 database**
- Variable name: `DB`
- D1 database: `bayarkita`

**Variables and Secrets → Add**

| Nama             | Tipe   | Nilai                                            |
|------------------|--------|--------------------------------------------------|
| `ADMIN_USERNAME` | Text   | `admin` (atau username lain)                     |
| `ADMIN_PASSWORD` | Secret | password admin awal, min. 8 karakter             |
| `TIMEZONE`       | Text   | `Asia/Jakarta`                                   |

> `ADMIN_USERNAME` / `ADMIN_PASSWORD` hanya dipakai **sekali** saat seed admin pertama.
> Setelah itu ganti password lewat menu Pengaturan di `/admin/`.

Pastikan setting di atas dipasang untuk environment **Production** (dan Preview bila perlu).
Lalu **Deployments → Retry deployment** (atau push commit baru) agar binding aktif.

### 5. Verifikasi

- `https://<project>.pages.dev/` → halaman utama.
- `https://<project>.pages.dev/api/settings` → JSON `{"ok":true,...}`.
- `https://<project>.pages.dev/admin/` → login dengan `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

### 6. Pasang domain sendiri

Beli domain di registrar mana pun (Niagahoster, Namecheap, dsb.), lalu:

**Opsi A — pindahkan DNS ke Cloudflare (disarankan)**
1. Dashboard → **Domains → Add a domain** → masukkan domain → pilih plan Free.
2. Cloudflare memberi 2 nameserver. Di registrar, ganti nameserver domain ke nameserver tersebut (propagasi ≤ 24 jam).
3. Di project Pages → **Custom domains → Set up a custom domain** → masukkan domain. Record DNS dibuat otomatis, SSL otomatis.

**Opsi B — DNS tetap di registrar**
1. Project Pages → **Custom domains → Set up a custom domain** → masukkan domain.
2. Cloudflare memberi record `CNAME` → tambahkan di panel DNS registrar: `@` (atau `www`) → `<project>.pages.dev`.

Setelah domain aktif, ubah `wa_number`/kontak di `/admin/` → Pengaturan bila perlu.

---

## Development lokal

```bash
npm install
cp .dev.vars.example .dev.vars      # isi ADMIN_PASSWORD
npm run db:migrate:local            # buat tabel di D1 lokal (.wrangler/)
npm run dev                         # http://localhost:8788  dan  /admin/
```

`.dev.vars` dan `.wrangler/` di-ignore git — jangan commit kredensial.

## Catatan teknis

- Fee & total pesanan selalu dihitung ulang di server (`functions/_lib/core.js` → `calcOrder`) dari setting di D1; nilai dari klien hanya untuk tampilan.
- Password admin di-hash PBKDF2-SHA256 (100k iterasi) karena bcrypt tidak tersedia di runtime Workers.
- Endpoint tulis admin memerlukan header `X-Requested-With: fetch` sebagai proteksi CSRF ringan (cookie `SameSite=Lax`).
- Pages otomatis menyajikan `faq.html` sebagai `/faq` dan me-redirect `/faq.html` → `/faq` (308); link lama tetap berfungsi.
- Limit tier free D1: 5 juta baris dibaca/hari, 100 ribu ditulis/hari — jauh di atas kebutuhan polling chat untuk skala UMKM.
