/* Lokalisasi publik Goisiinn: default Indonesia/Malaysia dari lokasi, dengan pilihan manual. */
(function () {
  "use strict";

  var KEY = "goisiinn_locale";
  var saved = "";
  try { saved = localStorage.getItem(KEY) || ""; } catch (_) {}
  var browserMs = /^ms(?:-|$)/i.test(navigator.language || "");
  var locale = saved === "ms" || saved === "id" ? saved : (browserMs ? "ms" : "id");
  var originals = new WeakMap();
  var originalAttrs = new WeakMap();

  var UI = {
    id: {
      live_chat: "Live Chat", chat_subtitle: "Biasanya membalas dalam beberapa menit", minimize: "Kecilkan", close_chat: "Tutup chat",
      today: "Hari ini", yesterday: "Kemarin", order: "Pesanan", service: "Layanan", price: "Harga", fee: "Biaya fee",
      discount: "Diskon", seller_discount: "Diskon Seller 8%", total: "Total", view_invoice: "Lihat invoice & bayar",
      name: "Nama", whatsapp: "No WhatsApp", name_placeholder: "Masukkan nama Anda", phone_placeholder: "Contoh: 0812 3456 7890 / 012 345 6789",
      intro: "Isi nama dan nomor WhatsApp Indonesia atau Malaysia agar tim kami dapat menghubungi kembali jika chat terputus.",
      start_chat: "Mulai Chat", invalid_identity: "Nama dan nomor WhatsApp Indonesia/Malaysia wajib diisi dengan benar.", start_failed: "Gagal memulai chat.",
      queue_title: "Menghubungkan ke tim kami…", queue_text: "Mohon tunggu sebentar, Anda akan segera terhubung dengan agen kami.", estimate: "Perkiraan", seconds: "detik", waiting: "Menunggu agen tersedia",
      typing: "sedang mengetik", message_placeholder: "Tulis pesan…", send: "Kirim", send_failed: "Pesan gagal dikirim.", session_ended: "Sesi chat berakhir.",
      online: "Online · siap membantu", offline: "Admin sedang offline. Pesan Anda tetap tersimpan.", chat_as: "Chat sebagai", change: "ganti", back: "Kembali ke chat",
      upgrade_seller: "Upgrade Seller", seller_active: "Seller aktif · diskon 8%", seller_title: "Akun Seller Goisiinn",
      seller_copy: "Dapatkan diskon 8% otomatis untuk setiap checkout dengan minimal 3 produk.", activate_seller: "Aktifkan Seller Gratis", seller_success: "Akun Seller berhasil diaktifkan.", seller_failed: "Gagal mengaktifkan akun Seller.",
      quantity: "Jumlah produk", quantity_note: "Diskon Seller 8% aktif mulai 3 produk.", unit_price: "Harga per produk", checkout_total: "Total Pembayaran",
      continue: "Lanjutkan", processing: "Memproses...", cancel: "Batal", full_name: "Masukkan nama lengkap Anda", required_identity: "Nama dan nomor WhatsApp wajib diisi.", invalid_email: "Masukkan email yang valid.",
      seller_checkout_active: "Benefit Seller aktif: diskon 8% untuk minimal 3 produk.", seller_checkout_locked: "Upgrade ke Seller dari Live Chat untuk diskon 8% mulai 3 produk.", email: "Email", seat_email: "Email untuk undangan seat", participant_email: "Email peserta patungan",
      payment_success: "Pembayaran Sukses", payment_confirmed: "Pembayaran sudah dikonfirmasi, sebentar lagi admin akan menghubungi",
      order_cancelled: "Pesanan Dibatalkan", invoice_expired: "Invoice Kedaluwarsa", order_success: "Pemesanan Berhasil",
      pay_prompt: "Silakan melakukan pembayaran agar pesanan segera diproses", order_detail: "Detail Pesanan", invoice_no: "No Invoice", nominal: "Nominal",
      service_fee: "Biaya Layanan", status: "Status", total_payment: "Total Pembayaran", payment_guide: "Panduan Pembayaran",
      payment_methods: "Metode Pembayaran", confirm_chat: "Konfirmasi Via Chat Web", valid_until: "Berlaku sampai", copy: "Salin",
      copied: "Tersalin", back_services: "Lihat layanan lainnya", invoice_not_found: "Invoice tidak ditemukan", load_failed: "Gagal memuat invoice",
    },
    ms: {
      live_chat: "Chat Langsung", chat_subtitle: "Biasanya membalas dalam beberapa minit", minimize: "Kecilkan", close_chat: "Tutup chat",
      today: "Hari ini", yesterday: "Semalam", order: "Pesanan", service: "Perkhidmatan", price: "Harga", fee: "Caj perkhidmatan",
      discount: "Diskaun", seller_discount: "Diskaun Seller 8%", total: "Jumlah", view_invoice: "Lihat invois & bayar",
      name: "Nama", whatsapp: "Nombor WhatsApp", name_placeholder: "Masukkan nama anda", phone_placeholder: "Contoh: 012 345 6789 / +60 12 345 6789",
      intro: "Isi nama dan nombor WhatsApp Malaysia atau Indonesia supaya pasukan kami boleh menghubungi anda semula jika chat terputus.",
      start_chat: "Mulakan Chat", invalid_identity: "Nama dan nombor WhatsApp Malaysia/Indonesia mesti diisi dengan betul.", start_failed: "Gagal memulakan chat.",
      queue_title: "Menghubungkan anda kepada pasukan kami…", queue_text: "Sila tunggu sebentar, anda akan disambungkan kepada ejen kami.", estimate: "Anggaran", seconds: "saat", waiting: "Menunggu ejen tersedia",
      typing: "sedang menaip", message_placeholder: "Tulis mesej…", send: "Hantar", send_failed: "Mesej gagal dihantar.", session_ended: "Sesi chat telah tamat.",
      online: "Dalam talian · sedia membantu", offline: "Admin sedang di luar talian. Mesej anda tetap disimpan.", chat_as: "Chat sebagai", change: "tukar", back: "Kembali ke chat",
      upgrade_seller: "Naik Taraf Seller", seller_active: "Seller aktif · diskaun 8%", seller_title: "Akaun Seller Goisiinn",
      seller_copy: "Dapatkan diskaun 8% secara automatik untuk setiap checkout dengan minimum 3 produk.", activate_seller: "Aktifkan Seller Percuma", seller_success: "Akaun Seller berjaya diaktifkan.", seller_failed: "Gagal mengaktifkan akaun Seller.",
      quantity: "Kuantiti produk", quantity_note: "Diskaun Seller 8% aktif mulai 3 produk.", unit_price: "Harga setiap produk", checkout_total: "Jumlah Pembayaran",
      continue: "Teruskan", processing: "Memproses...", cancel: "Batal", full_name: "Masukkan nama penuh anda", required_identity: "Nama dan nombor WhatsApp mesti diisi.", invalid_email: "Masukkan e-mel yang sah.",
      seller_checkout_active: "Benefit Seller aktif: diskaun 8% untuk minimum 3 produk.", seller_checkout_locked: "Naik taraf Seller melalui Chat Langsung untuk diskaun 8% mulai 3 produk.", email: "E-mel", seat_email: "E-mel untuk jemputan seat", participant_email: "E-mel peserta kongsi",
      payment_success: "Pembayaran Berjaya", payment_confirmed: "Pembayaran telah disahkan, admin akan menghubungi anda sebentar lagi",
      order_cancelled: "Pesanan Dibatalkan", invoice_expired: "Invois Tamat Tempoh", order_success: "Pesanan Berjaya",
      pay_prompt: "Sila buat pembayaran supaya pesanan boleh diproses segera", order_detail: "Butiran Pesanan", invoice_no: "No. Invois", nominal: "Nilai",
      service_fee: "Caj Perkhidmatan", status: "Status", total_payment: "Jumlah Pembayaran", payment_guide: "Panduan Pembayaran",
      payment_methods: "Kaedah Pembayaran", confirm_chat: "Sahkan Melalui Chat Web", valid_until: "Sah sehingga", copy: "Salin",
      copied: "Disalin", back_services: "Lihat perkhidmatan lain", invoice_not_found: "Invois tidak ditemui", load_failed: "Gagal memuatkan invois",
    }
  };

  var PHRASES = {
    "Navigasi utama": "Navigasi utama", "Buka menu": "Buka menu", "Jasa & Layanan": "Perkhidmatan", "Kontak Kami": "Hubungi Kami",
    "Pembayaran Global, Lebih Praktis": "Pembayaran Global, Lebih Mudah", "Jasa Pembayaran": "Perkhidmatan Pembayaran",
    "Pilih Layanan": "Pilih Perkhidmatan", "Proses Kilat": "Proses Pantas", "Aman & Tepercaya": "Selamat & Dipercayai", "Support Sigap": "Sokongan Pantas",
    "Pilihan merchant untuk kebutuhan Anda": "Pilihan merchant untuk keperluan anda", "Layanan Populer": "Perkhidmatan Popular",
    "Harga Layanan": "Harga Perkhidmatan", "Biaya Layanan": "Caj Perkhidmatan", "Pembayaran Aman": "Pembayaran Selamat",
    "Terlindungi & Terenkripsi": "Dilindungi & Disulitkan", "Mata Uang": "Mata Wang", "Transaksi Minimum": "Transaksi Minimum",
    "Pilih layanan": "Pilih perkhidmatan", "Pilih Paket": "Pilih Pakej", "Tentukan Paket": "Tentukan Pakej", "Tentukan Layanan": "Tentukan Perkhidmatan",
    "Biaya Fee": "Caj Perkhidmatan", "Total Biaya": "Jumlah Bayaran", "Order Sekarang": "Pesan Sekarang",
    "Transaksi aman dan tepercaya": "Transaksi selamat dan dipercayai", "Metode Bayar": "Kaedah Bayaran",
    "Pertanyaan yang Sering Diajukan": "Soalan Lazim", "Telusuri pertanyaan": "Cari soalan", "Telusuri pertanyaan...": "Cari soalan...",
    "Syarat dan Ketentuan": "Terma dan Syarat", "Artikel": "Artikel", "Lihat Selengkapnya": "Lihat Selanjutnya",
    "Nama": "Nama", "Nomor": "Nombor", "No WhatsApp": "Nombor WhatsApp", "Pesanan": "Pesanan", "Layanan": "Perkhidmatan",
    "Pembayaran": "Pembayaran", "Diskon": "Diskaun", "Invoice": "Invois", "Biaya": "Caj", "Jumlah": "Kuantiti"
  };

  var REPLACE = [
    [/\bjasa pembayaran\b/gi, "perkhidmatan pembayaran"], [/\blayanan\b/gi, "perkhidmatan"], [/\bkebutuhan\b/gi, "keperluan"],
    [/\bnomor\b/gi, "nombor"], [/\binvoice\b/gi, "invois"], [/\bdiskon\b/gi, "diskaun"], [/\bbiaya\b/gi, "caj"],
    [/\bakun\b/gi, "akaun"], [/\bpesan(?:an)?\b/gi, function (m) { return /^Pes/.test(m) ? "Pesanan" : "pesanan"; }],
    [/\bmudah digunakan\b/gi, "mudah digunakan"], [/\baman\b/gi, "selamat"], [/\btepercaya\b/gi, "dipercayai"],
    [/\bsilakan\b/gi, "sila"], [/\bsegera\b/gi, "secepat mungkin"], [/\bpertanyaan\b/gi, "soalan"], [/\bjawaban\b/gi, "jawapan"]
  ];

  function t(key) { return (UI[locale] && UI[locale][key]) || UI.id[key] || key; }
  function translateText(value) {
    if (locale !== "ms" || !value) return value;
    var lead = value.match(/^\s*/)[0], tail = value.match(/\s*$/)[0], core = value.trim();
    if (!core) return value;
    if (PHRASES[core]) return lead + PHRASES[core] + tail;
    var out = core;
    REPLACE.forEach(function (pair) { out = out.replace(pair[0], pair[1]); });
    return lead + out + tail;
  }

  function excluded(node) {
    var el = node.parentElement;
    return !el || !!el.closest("script,style,code,pre,.webchat,.checkout-modal-overlay,.inv-page,.admin-app,.admin-login");
  }

  function apply(root) {
    root = root || document;
    document.documentElement.lang = locale === "ms" ? "ms-MY" : "id-ID";
    var walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (excluded(node)) continue;
      if (!originals.has(node)) originals.set(node, node.nodeValue);
      var original = originals.get(node);
      node.nodeValue = locale === "ms" ? translateText(original) : original;
    }
    Array.prototype.forEach.call((root.querySelectorAll ? root.querySelectorAll("[placeholder],[aria-label],[title],meta[name=description]") : []), function (el) {
      var attrs = originalAttrs.get(el) || {};
      ["placeholder", "aria-label", "title", "content"].forEach(function (attr) {
        if (!el.hasAttribute(attr)) return;
        if (attrs[attr] === undefined) attrs[attr] = el.getAttribute(attr);
        el.setAttribute(attr, locale === "ms" ? translateText(attrs[attr]) : attrs[attr]);
      });
      originalAttrs.set(el, attrs);
    });
    var select = document.querySelector(".locale-select");
    if (select) select.value = locale;
  }

  function installSwitch() {
    var panel = document.querySelector(".nav-panel");
    if (!panel || panel.querySelector(".locale-switch")) return;
    var cta = panel.querySelector(".nav-cta");
    var actions = panel.querySelector(".nav-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "nav-actions";
      panel.insertBefore(actions, cta || null);
      if (cta) actions.appendChild(cta);
    }
    var label = document.createElement("label");
    label.className = "locale-switch";
    label.setAttribute("aria-label", "Language / Bahasa");
    label.innerHTML = '<span aria-hidden="true">🌐</span><select class="locale-select"><option value="id">ID</option><option value="ms">MY</option></select>';
    actions.insertBefore(label, cta || null);
    label.querySelector("select").addEventListener("change", function (event) { set(event.target.value, true); });
  }

  function set(next, persist) {
    next = next === "ms" ? "ms" : "id";
    if (persist) { try { localStorage.setItem(KEY, next); } catch (_) {} document.cookie = "goisiinn_locale=" + next + "; Path=/; Max-Age=31536000; SameSite=Lax"; }
    var changed = locale !== next;
    locale = next;
    apply(document);
    if (changed) document.dispatchEvent(new CustomEvent("goisiinn:locale", { detail: { locale: locale } }));
  }

  window.GoisiinnLocale = { get: function () { return locale; }, t: t, translate: translateText, apply: apply, set: set };

  function ready() {
    installSwitch(); apply(document);
    if (!saved) {
      fetch("/api/locale", { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); }).then(function (r) {
        if (r && r.ok && (r.locale === "id" || r.locale === "ms")) set(r.locale, false);
      }).catch(function () {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();
