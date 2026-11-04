/* Halaman invoice /inv/{kode}: detail pesanan, metode pembayaran (rekening + QRIS dinamis),
   konfirmasi lewat chat web, dan polling status tiap 5 detik. */
(function () {
  "use strict";

  var root = document.getElementById("invoice");
  if (!root) return;

  var POLL_MS = 5000;
  var code = (location.pathname.match(/\/inv\/([^/?#]+)/) || [])[1] || "";
  try { code = decodeURIComponent(code).toUpperCase(); } catch (_) { code = ""; }

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmtRp = function (n) { return "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID"); };
  var fmtAmount = function (n, cur) {
    if (cur === "IDR") return fmtRp(n);
    var sym = { USD: "$", EUR: "\u20ac", GBP: "\u00a3", JPY: "\u00a5", CNY: "\u00a5", THB: "\u0e3f", MYR: "RM" }[cur] || cur + " ";
    return sym + Number(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
  };
  var fmtExpiry = function (ts) {
    var d = new Date(ts);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) + " " +
      d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).replace(".", ":") + " WIB";
  };

  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>'
  };

  var order = null, active = null, pollTimer = null;

  var showError = function (title, text) {
    root.innerHTML = '<div class="inv-empty"><h1>' + esc(title) + "</h1><p>" + esc(text) + '</p><a href="/jasa-pembayaran.html">Lihat layanan lainnya</a></div>';
  };

  // Daftar metode: QRIS (bila dikonfigurasi) + rekening/e-wallet dari pengaturan admin.
  var methods = function () {
    var list = [];
    if (order.qris) list.push({ code: "qris", name: "QRIS", logo: "/assets/payment-methods/qris.png", qris: true, disabled: !order.qris.available });
    order.accounts.forEach(function (a) { list.push(a); });
    return list;
  };

  var heroHtml = function () {
    if (order.confirmed) return '<section class="inv-hero is-paid"><span class="inv-hero-icon">' + ICON.check + "</span><h1>Pembayaran Sukses</h1><p>Pembayaran sudah dikonfirmasi, sebentar lagi admin akan menghubungi</p></section>";
    if (order.status === "batal") return '<section class="inv-hero is-dead"><span class="inv-hero-icon">' + ICON.x + "</span><h1>Pesanan Dibatalkan</h1><p>Invoice ini sudah tidak berlaku. Silakan hubungi admin bila ada pertanyaan.</p></section>";
    if (order.status === "kedaluwarsa") return '<section class="inv-hero is-dead"><span class="inv-hero-icon">' + ICON.x + "</span><h1>Invoice Kedaluwarsa</h1><p>Batas waktu pembayaran sudah lewat. Silakan buat pesanan baru atau hubungi admin.</p></section>";
    return '<section class="inv-hero"><span class="inv-hero-icon">' + ICON.check + "</span><h1>Pemesanan Berhasil</h1><p>Silakan melakukan pembayaran agar pesanan segera diproses</p></section>";
  };

  var detailHtml = function () {
    var nominal = order.plan && order.plan.toLowerCase() !== "custom" ? order.plan + " \u00b7 " : "";
    nominal += fmtAmount(order.amount, order.currency) + (order.currency !== "IDR" ? " (\u2248 " + fmtRp(order.amount_idr) + ")" : "");
    return '<div class="inv-wrap" style="padding:0"><article class="inv-card"><h2>Detail Pesanan</h2><div class="inv-rows">' +
      "<div><span>Nama:</span><b>" + esc(order.name) + "</b></div>" +
      "<div><span>No Invoice:</span><b>" + esc(order.invoice) + "</b></div>" +
      "<div><span>Layanan:</span><b>" + esc(order.service) + "</b></div>" +
      "<div><span>Nominal:</span><b>" + esc(nominal) + "</b></div>" +
      "<div><span>Biaya Layanan:</span><b>" + fmtRp(order.fee) + "</b></div>" +
      (order.discount > 0 ? "<div><span>Diskon:</span><b>-" + fmtRp(order.discount) + "</b></div>" : "") +
      '<div><span>Status:</span><b><span class="inv-pill is-' + esc(order.status) + '">' + esc(order.status_label) + "</span></b></div>" +
      '<div class="is-total"><span>Total Pembayaran:</span><b>' + fmtRp(order.total) + "</b></div>" +
      (order.po ? '<div><span>Peserta sudah membayar:</span><b>' + esc(order.po.paid_count + '/' + order.po.target_size + ' peserta') + '</b></div>' : '') +
      "</div></article>" +
      (order.po ? '<article class="inv-card inv-po-notice"><strong>Grup Patungan ' + esc(order.po.product_name.replace(/^Patungan\s+/i, "")) + '</strong><p>Info grup ini hanya tersedia setelah pembayaran Anda tercatat. Berikut peserta yang pembayarannya sudah dikonfirmasi:</p><ul class="inv-po-members">' + order.po.paid_members.map(function (name) { return '<li>' + esc(name) + '</li>'; }).join('') + '</ul><p>Patungan diproses setelah empat peserta membayar. Batas pengumpulan maksimal tujuh hari sejak grup dibuka. Jika grup tidak terpenuhi, admin akan menghubungi peserta untuk tindak lanjut.</p><p>Opsi patungan memakai satu paket bersama. Jangan membagikan kata sandi akun pribadi Anda.</p></article>' : '') +
      '<article class="inv-card"><h2>Panduan Pembayaran</h2><ol class="inv-steps">' +
      "<li>Buka M-Banking / Internet Banking / e-wallet yang anda gunakan saat ini</li>" +
      "<li>Lakukan pembayaran ke Rekening / QRIS yang tersedia. Untuk QRIS, nominal sudah terisi otomatis saat di-scan</li>" +
      "<li>Klik Konfirmasi di Chat Web setelah membayar</li>" +
      "<li>Setelah pembayaran masuk, admin akan segera memproses pesanan</li>" +
      "</ol></article></div>";
  };

  var methodBody = function (m) {
    if (!m) return '<small>Metode pembayaran belum tersedia. Silakan hubungi admin lewat chat web.</small>';
    if (m.qris) {
      // QR dibuat server per invoice; hanya dimuat selama invoice masih bisa dibayar.
      var src = "/api/invoice?action=qris&code=" + encodeURIComponent(order.invoice);
      return '<img class="inv-qris-logo" src="/assets/payment-methods/qris.png" alt="QRIS">' +
        "<small>" + esc(order.qris.merchant || "QRIS BayarKita") + "</small>" +
        '<div class="inv-qr">' + (order.payable ? '<img alt="QRIS BayarKita" width="540" height="540" src="' + src + '">' : "") + "</div>" +
        '<div class="inv-qr-amount">' + fmtRp(order.total) + "</div>" +
        '<p class="inv-qr-note">Scan dengan aplikasi bank / e-wallet apa pun. Nominal sudah terisi otomatis, tinggal bayar.</p>';
    }
    return '<img class="inv-qris-logo" src="' + esc(m.logo) + '" alt="' + esc(m.name) + '">' +
      "<small>" + esc(m.label) + "</small>" +
      '<div class="inv-acc">' + esc(m.number) + "</div>" +
      (m.owner ? '<div class="inv-owner">A/N ' + esc(m.owner) + "</div>" : "") +
      '<button class="inv-copy" type="button" data-copy="' + esc(m.number) + '"' + (order.payable ? "" : " disabled") + '>' + ICON.copy + "<span>Salin</span></button>";
  };

  var payHtml = function () {
    var list = methods();
    if (!active || !list.some(function (m) { return m.code === active && !m.disabled; })) {
      var first = list.filter(function (m) { return !m.disabled; })[0];
      active = first ? first.code : null;
    }
    var cur = list.filter(function (m) { return m.code === active; })[0];
    var tabs = list.map(function (m) {
      var tip = m.disabled && m.qris ? ' data-tip="QRIS nonaktif untuk total pembayaran di atas ' + fmtRp(order.qris.max) + '"' : "";
      return '<span class="inv-tip"' + tip + '><button class="inv-tab' + (m.code === active ? " is-active" : "") + '" type="button" data-method="' + esc(m.code) + '"' + (m.disabled ? " disabled" : "") + ' aria-label="' + esc(m.name) + '"><img src="' + esc(m.logo) + '" alt="' + esc(m.name) + '"></button></span>';
    }).join("");
    var locked = !order.payable;
    var badge = order.confirmed ? "Pembayaran Sukses" : order.status === "batal" ? "Dibatalkan" : order.status === "kedaluwarsa" ? "Kedaluwarsa" : "";
    return '<article class="inv-card"><h2>Metode Pembayaran</h2>' +
      (list.length ? '<div class="inv-tabs" aria-label="Pilih metode pembayaran">' + tabs + "</div>" : "") +
      '<div class="inv-method' + (locked ? " is-locked" + (order.confirmed ? "" : " is-dead") : "") + '">' + methodBody(cur) + (locked ? '<span class="inv-badge">' + esc(badge) + "</span>" : "") + "</div>" +
      '<div class="inv-total-bar"><span>Total Pembayaran</span><strong>' + fmtRp(order.total) + "</strong></div>" +
      (order.payable ? '<button class="inv-wa inv-chat-confirm" type="button" data-chat-confirm>' + ICON.chat + "Konfirmasi Via Chat Web" + "</button>" : "") +
      (order.payable && order.expires_ts ? '<p class="inv-expiry">Berlaku sampai <b>' + esc(fmtExpiry(order.expires_ts)) + "</b></p>" : "") +
      "</article>";
  };

  var render = function () {
    document.title = "Invoice " + order.invoice + " - BayarKita";
    root.innerHTML = heroHtml() + '<div class="inv-grid">' + detailHtml() + payHtml() + "</div>";
  };

  root.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-method]");
    if (tab && !tab.disabled) { active = tab.getAttribute("data-method"); render(); return; }
    var confirm = e.target.closest("[data-chat-confirm]");
    if (confirm) {
      var chat = window.FdvChat;
      if (chat && chat.openWithMessage) {
        chat.openWithMessage("Halo admin, saya sudah melakukan pembayaran untuk invoice " + order.invoice + " (" + order.service + ") atas nama " + order.name + ". Mohon dicek ya.");
      } else if (chat && chat.open) {
        chat.open();
      }
      return;
    }
    var cp = e.target.closest("[data-copy]");
    if (cp && order.payable && !cp.disabled) {
      var txt = cp.getAttribute("data-copy").replace(/\s+/g, "");
      var done = function () { cp.classList.add("is-done"); cp.querySelector("span").textContent = "Tersalin"; setTimeout(function () { cp.classList.remove("is-done"); cp.querySelector("span").textContent = "Salin"; }, 1600); };
      var failed = function () { cp.querySelector("span").textContent = "Gagal, salin nomor manual"; };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, failed); else failed();
    }
  });

  var load = function () {
    return fetch("/api/invoice?code=" + encodeURIComponent(code), { cache: "no-store" }).then(function (r) {
      return r.json().then(function (j) { if (!j.ok) { var e = new Error(j.error || "Gagal memuat invoice."); e.status = r.status; throw e; } return j.order; });
    });
  };

  // Polling ringan; data lengkap dimuat ulang hanya saat status berubah.
  var poll = function () {
    if (document.visibilityState !== "visible") return;
    fetch("/api/invoice?action=status&code=" + encodeURIComponent(code), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) return;
      var paidCountChanged = order.po && order.confirmed && j.groupPaidCount !== order.po.paid_count;
      if (j.status === order.status && !paidCountChanged) return;
      return load().then(function (o) {
        order = o; render();
        if (order.status === "selesai" || order.status === "batal") clearInterval(pollTimer);
      });
    }).catch(function () {});
  };

  if (!/^FDV-\d{6}-[0-9A-F]{5,32}$/.test(code)) { showError("Invoice tidak ditemukan", "Periksa kembali link invoice Anda."); return; }
  load().then(function (o) {
    order = o; render();
    if (order.status !== "selesai" && order.status !== "batal") pollTimer = setInterval(poll, POLL_MS);
  }).catch(function (e) {
    if (e.status === 404) showError("Invoice tidak ditemukan", "Periksa kembali link invoice Anda.");
    else showError("Gagal memuat invoice", "Periksa koneksi Anda lalu muat ulang halaman.");
  });
  document.addEventListener("visibilitychange", function () { if (order) poll(); });
})();
