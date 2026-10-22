/* Admin dashboard Fahmidev — SPA tanpa dependensi, bicara ke /api/admin (Cloudflare Pages Functions) */
(function () {
  "use strict";

  var API = "/api/admin?action=";
  var $ = function (id) { return document.getElementById(id); };
  var qs = function (sel, root) { return (root || document).querySelector(sel); };
  var qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  // ---------- Format ----------
  var fmtRp = function (n) { return "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID"); };
  var fmtAmount = function (n, cur) {
    if (cur === "IDR") return "IDR " + Math.round(Number(n)).toLocaleString("id-ID");
    var sym = { USD: "$", EUR: "\u20ac", GBP: "\u00a3", JPY: "\u00a5", CNY: "\u00a5", THB: "\u0e3f", MYR: "RM" }[cur] || cur + " ";
    return sym + Number(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
  };
  var parseDate = function (s) { return new Date(String(s || "").replace(" ", "T")); };
  var fmtTime = function (s) { var d = parseDate(s); return isNaN(d) ? "" : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); };
  var fmtDateTime = function (s) { var d = parseDate(s); return isNaN(d) ? "" : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + " " + fmtTime(s); };
  var relTime = function (s) {
    var d = parseDate(s); if (isNaN(d)) return "";
    var diff = (Date.now() - d) / 1000;
    if (diff < 60) return "baru saja";
    if (diff < 3600) return Math.floor(diff / 60) + " mnt";
    if (diff < 86400) return Math.floor(diff / 3600) + " jam";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + " hr";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };
  var dayLabel = function (s) {
    var d = parseDate(s); if (isNaN(d)) return "";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (diff === 0) return "Hari ini";
    if (diff === 1) return "Kemarin";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };
  var STATUS = { baru: "Baru", diproses: "Diproses", selesai: "Selesai", batal: "Dibatalkan" };
  var initials = function (name) { return String(name || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0] || ""; }).join("").toUpperCase() || "?"; };
  var waLink = function (phone) { return "https://wa.me/" + String(phone || "").replace(/\D/g, ""); };

  var ICON = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    chatOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };

  // ---------- API ----------
  var api = function (action, body, opts) {
    opts = opts || {};
    var url = API + action + (opts.query ? "&" + new URLSearchParams(opts.query).toString() : "");
    var init = { credentials: "same-origin", headers: { "X-Requested-With": "fetch" } };
    if (body !== undefined) { init.method = "POST"; init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body || {}); }
    return fetch(url, init).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "Respons server tidak valid (" + r.status + ")." }; }).then(function (j) {
        if (r.status === 401 && action !== "login" && action !== "me") { showLogin(); }
        if (!j.ok) { var e = new Error(j.error || "Terjadi kesalahan."); e.status = r.status; throw e; }
        return j;
      });
    });
  };

  // ---------- Toast / modal ----------
  var toastTimer;
  var toast = function (msg, type) {
    var el = $("toast");
    el.textContent = msg; el.className = "admin-toast" + (type ? " is-" + type : ""); el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  };
  var modal = $("modal"), modalBody = $("modal-body");
  var openModal = function (html) { modalBody.innerHTML = html; modal.hidden = false; document.body.style.overflow = "hidden"; var f = qs("input,textarea,select", modalBody); if (f) setTimeout(function () { f.focus(); }, 50); };
  var closeModal = function () { modal.hidden = true; modalBody.innerHTML = ""; document.body.style.overflow = ""; };
  $("modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  var confirmModal = function (title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      openModal('<h2>' + esc(title) + '</h2><p class="admin-hint">' + esc(text) + '</p><div class="admin-modal-actions"><button class="admin-btn admin-btn-ghost" type="button" data-act="cancel">Batal</button><button class="admin-btn ' + (danger ? "admin-btn-danger" : "admin-btn-primary") + '" type="button" data-act="ok">' + esc(okLabel || "Ya") + "</button></div>");
      qs('[data-act=cancel]', modalBody).onclick = function () { closeModal(); resolve(false); };
      qs('[data-act=ok]', modalBody).onclick = function () { closeModal(); resolve(true); };
    });
  };

  // ---------- Suara & notifikasi ----------
  var soundOn = localStorage.getItem("fdv_admin_sound") !== "0";
  var soundBtn = $("sound-btn");
  var renderSound = function () { soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false"); soundBtn.title = soundOn ? "Suara notifikasi aktif" : "Suara notifikasi mati"; };
  renderSound();
  soundBtn.addEventListener("click", function () { soundOn = !soundOn; localStorage.setItem("fdv_admin_sound", soundOn ? "1" : "0"); renderSound(); if (soundOn) beep(); });
  var audioCtx;
  var beep = function () {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(880, audioCtx.currentTime); o.frequency.setValueAtTime(1175, audioCtx.currentTime + 0.1);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.36);
    } catch (e) { /* abaikan */ }
  };
  var notify = function (title, body) {
    if (!("Notification" in window) || document.hasFocus()) return;
    if (Notification.permission === "granted") { try { new Notification(title, { body: body, icon: "../assets/logo-fahmidev.svg" }); } catch (e) { /* abaikan */ } }
  };
  var requestNotif = function () { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); };

  // ---------- Login ----------
  var state = { admin: null, view: "", settings: {}, services: [], conv: { list: [], filter: "all", q: "", active: null, lastId: 0, orders: [], timer: null, listTimer: null, rendered: {}, lastDay: "" }, orders: { page: 1, status: "", q: "" }, totalUnread: 0, newOrders: 0 };
  var showLogin = function () {
    stopAllPolling();
    $("app").hidden = true; $("login").hidden = false;
    document.title = "Masuk Admin - Fahmidev";
    setTimeout(function () { var i = qs('input[name=username]', $("login-form")); if (i) i.focus(); }, 30);
  };
  var showApp = function (admin) {
    state.admin = admin;
    $("admin-name").textContent = admin.username;
    $("login").hidden = true; $("app").hidden = false;
    requestNotif();
    route();
    startGlobalPolling();
  };
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, err = $("login-error"), btn = qs("button[type=submit]", f);
    err.hidden = true; btn.disabled = true;
    api("login", { username: f.username.value.trim(), password: f.password.value }).then(function (j) {
      f.reset(); showApp(j.admin); toast("Selamat datang, " + j.admin.username + "!", "success");
    }).catch(function (ex) { err.textContent = ex.message; err.hidden = false; }).then(function () { btn.disabled = false; });
  });
  $("logout").addEventListener("click", function () { api("logout", {}).catch(function () {}).then(function () { showLogin(); toast("Anda telah keluar."); }); });

  // ---------- Sidebar mobile ----------
  var sidebar = $("sidebar"), backdrop = $("sidebar-backdrop");
  var toggleSidebar = function (open) { sidebar.classList.toggle("is-open", open); backdrop.classList.toggle("is-open", open); };
  $("menu-btn").addEventListener("click", function () { toggleSidebar(!sidebar.classList.contains("is-open")); });
  backdrop.addEventListener("click", function () { toggleSidebar(false); });

  // ---------- Routing ----------
  var TITLES = { dashboard: "Dashboard", inbox: "Chat Pelanggan", orders: "Pesanan", services: "Layanan", settings: "Pengaturan" };
  var route = function () {
    var hash = (location.hash || "#dashboard").slice(1).split("/");
    var view = TITLES[hash[0]] ? hash[0] : "dashboard";
    state.view = view;
    qsa(".admin-view").forEach(function (v) { v.hidden = v.dataset.view !== view; });
    qsa(".admin-nav a").forEach(function (a) { a.classList.toggle("is-active", a.dataset.view === view); });
    $("view-title").textContent = TITLES[view];
    document.title = TITLES[view] + " - Admin Fahmidev";
    toggleSidebar(false);
    stopThreadPolling(); clearInterval(state.conv.listTimer); state.conv.listTimer = null;
    if (view === "dashboard") loadDashboard();
    if (view === "inbox") { loadConversations(); state.conv.listTimer = setInterval(loadConversations, 4000); if (hash[1]) openThread(parseInt(hash[1], 10)); else closeThread(); }
    if (view === "orders") loadOrders();
    if (view === "services") loadServices();
    if (view === "settings") loadSettings();
  };
  window.addEventListener("hashchange", route);

  // ---------- Polling global (badge) ----------
  var globalTimer;
  var startGlobalPolling = function () { clearInterval(globalTimer); pollBadges(); globalTimer = setInterval(pollBadges, 6000); };
  var stopAllPolling = function () { clearInterval(globalTimer); clearInterval(state.conv.listTimer); stopThreadPolling(); };
  var pollBadges = function () {
    api("stats").then(function (s) {
      var b = $("badge-inbox"); b.textContent = s.unread_chats; b.hidden = !s.unread_chats;
      var o = $("badge-orders"); o.textContent = s.orders_new; o.hidden = !s.orders_new;
      if (state.totalUnread !== undefined && s.unread_chats > state.totalUnread && state.view !== "inbox") { beep(); notify("Pesan baru", s.unread_chats + " chat belum dibaca"); }
      if (state.newOrders !== undefined && s.orders_new > state.newOrders) { beep(); notify("Pesanan baru", "Ada " + s.orders_new + " pesanan berstatus baru"); if (state.view === "orders") loadOrders(); if (state.view === "dashboard") loadDashboard(); }
      state.totalUnread = s.unread_chats; state.newOrders = s.orders_new;
    }).catch(function () {});
  };

  // ---------- Dashboard ----------
  var loadDashboard = function () {
    $("stats").innerHTML = '<div class="admin-loading">Memuat…</div>';
    api("stats").then(function (s) {
      var statCard = function (icon, label, value, sub, accent) { return '<div class="admin-stat' + (accent ? " is-accent" : "") + '"><span class="admin-stat-icon">' + icon + "</span><div><small>" + label + "</small><strong>" + value + "</strong>" + (sub ? "<span>" + sub + "</span>" : "") + "</div></div>"; };
      $("stats").innerHTML =
        statCard(ICON.bag, "Pesanan baru", s.orders_new, s.orders_processing + " sedang diproses", true) +
        statCard(ICON.chat, "Chat belum dibaca", s.unread_chats, s.open_chats + " percakapan aktif") +
        statCard(ICON.money, "Omzet bulan ini", fmtRp(s.revenue_month), "Fee " + fmtRp(s.fee_month) + " · pesanan selesai") +
        statCard(ICON.users, "Pesanan bulan ini", s.orders_month, s.orders_today + " hari ini · " + s.total_customers + " pelanggan");
      // Grafik
      var days = Object.keys(s.daily), max = 0;
      days.forEach(function (d) { max = Math.max(max, s.daily[d].total); });
      $("chart").innerHTML = max === 0 ? '<div class="admin-chart-empty">Belum ada pesanan diproses/selesai dalam 14 hari terakhir.</div>' :
        days.map(function (d) {
          var v = s.daily[d]; var h = max ? Math.max(2, Math.round(v.total / max * 100)) : 2;
          var dt = new Date(d + "T00:00:00");
          return '<div class="admin-bar' + (v.total ? "" : " is-empty") + '"><i style="height:' + h + '%" data-value="' + esc(fmtRp(v.total) + " · " + v.count + " pesanan") + '"></i><small>' + dt.getDate() + "/" + (dt.getMonth() + 1) + "</small></div>";
        }).join("");
      // Layanan terlaris
      var topMax = s.top_services.length ? s.top_services[0].c : 0;
      $("top-services").innerHTML = s.top_services.length ? s.top_services.map(function (t) {
        var svc = state.services.filter(function (x) { return x.name === t.service_name; })[0];
        var icon = svc && svc.icon ? '<img src="../' + esc(svc.icon) + '" alt="">' : '<span class="admin-top-ph">' + esc(initials(t.service_name)) + "</span>";
        return '<div class="admin-top-row">' + icon + "<div><b>" + esc(t.service_name) + "</b><small>" + t.c + " pesanan</small><div class=\"admin-top-bar\"><i style=\"width:" + Math.round(t.c / topMax * 100) + "%\"></i></div></div><strong>" + fmtRp(t.t) + "</strong></div>";
      }).join("") : '<div class="admin-empty">Belum ada pesanan.</div>';
      // Pesanan terbaru
      $("recent-orders").innerHTML = s.recent_orders.length ? "<thead><tr><th>Kode</th><th>Pelanggan</th><th>Layanan</th><th>Total</th><th>Status</th><th>Waktu</th></tr></thead><tbody>" + s.recent_orders.map(function (o) {
        return '<tr><td class="is-code"><a class="admin-link" href="#orders">#' + esc(o.code) + '</a></td><td><div class="admin-customer"><b>' + esc(o.customer_name) + "</b><small>" + esc(o.phone) + '</small></div></td><td>' + esc(o.service_name) + (o.plan ? ' <span class="is-muted">· ' + esc(o.plan) + "</span>" : "") + '</td><td class="is-money">' + fmtRp(o.total) + '</td><td><span class="admin-status is-' + esc(o.status) + '">' + (STATUS[o.status] || o.status) + '</span></td><td class="is-muted">' + fmtDateTime(o.created_at) + "</td></tr>";
      }).join("") + "</tbody>" : '<tbody><tr><td class="admin-empty">Belum ada pesanan.</td></tr></tbody>';
    }).catch(function (ex) { if (ex.status !== 401) toast(ex.message, "error"); });
    if (!state.services.length) api("services").then(function (j) { state.services = j.services; }).catch(function () {});
  };

  // ---------- Inbox ----------
  var convItems = $("conv-items"), inboxEl = qs(".admin-inbox");
  var loadConversations = function () {
    api("conversations", undefined, { query: { filter: state.conv.filter, q: state.conv.q } }).then(function (j) {
      state.conv.list = j.conversations;
      renderConvList();
    }).catch(function () {});
  };
  var renderConvList = function () {
    var list = state.conv.list;
    if (!list.length) { convItems.innerHTML = '<div class="admin-empty">Tidak ada percakapan.</div>'; return; }
    convItems.innerHTML = list.map(function (c) {
      var prefix = c.last_sender === "admin" ? "Anda: " : c.last_sender === "system" ? "Sistem: " : "";
      return '<button type="button" class="admin-conv' + (c.unread_admin ? " is-unread" : "") + (state.conv.active === c.id ? " is-active" : "") + '" data-id="' + c.id + '"><span class="admin-avatar' + (c.status === "closed" ? " is-closed" : "") + '">' + esc(initials(c.name)) + '</span><div class="admin-conv-main"><b>' + esc(c.name) + "</b><p>" + esc(prefix + (c.last_message || "Belum ada pesan")) + '</p></div><div class="admin-conv-side"><time>' + relTime(c.last_at || c.created_at) + "</time>" + (c.unread_admin ? '<span class="admin-nav-badge">' + c.unread_admin + "</span>" : c.order_count ? '<span class="admin-status is-' + (c.status === "open" ? "open" : "closed") + '">' + c.order_count + " order</span>" : "") + "</div></button>";
    }).join("");
  };
  convItems.addEventListener("click", function (e) {
    var b = e.target.closest(".admin-conv"); if (!b) return;
    location.hash = "#inbox/" + b.dataset.id;
  });
  var searchTimer;
  $("conv-search").addEventListener("input", function (e) { clearTimeout(searchTimer); searchTimer = setTimeout(function () { state.conv.q = e.target.value.trim(); loadConversations(); }, 250); });
  $("conv-filter").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    qsa("button", e.currentTarget).forEach(function (x) { x.classList.toggle("is-active", x === b); });
    state.conv.filter = b.dataset.filter; loadConversations();
  });

  var threadMsgs = $("thread-messages"), threadOrders = $("thread-orders"), compose = $("thread-compose"), composeTa = qs("textarea", compose), composeBtn = qs("button[type=submit]", compose);
  var stopThreadPolling = function () { clearInterval(state.conv.timer); state.conv.timer = null; };
  var closeThread = function () {
    stopThreadPolling();
    state.conv.active = null;
    $("thread-empty").hidden = false; $("thread-body").hidden = true;
    inboxEl.classList.remove("is-thread-open");
    renderConvList();
  };
  var openThread = function (id) {
    if (!id) return closeThread();
    stopThreadPolling();
    state.conv.active = id; state.conv.lastId = 0; state.conv.rendered = {}; state.conv.lastDay = "";
    threadMsgs.innerHTML = '<div class="admin-loading">Memuat percakapan…</div>';
    threadOrders.hidden = true;
    $("thread-empty").hidden = true; $("thread-body").hidden = false;
    inboxEl.classList.add("is-thread-open");
    renderConvList();
    renderQuickReplies();
    fetchThread(true);
    state.conv.timer = setInterval(function () { fetchThread(false); }, 2500);
  };
  var fetchThread = function (initial) {
    var id = state.conv.active; if (!id) return;
    api("messages", undefined, { query: { id: id, since: initial ? 0 : state.conv.lastId } }).then(function (j) {
      if (state.conv.active !== id) return;
      var c = j.conversation;
      $("thread-name").textContent = c.name;
      var ph = $("thread-phone"); ph.textContent = c.phone; ph.href = waLink(c.phone);
      $("thread-avatar").textContent = initials(c.name); $("thread-avatar").className = "admin-avatar" + (c.status === "closed" ? " is-closed" : "");
      $("thread-toggle-status").textContent = c.status === "closed" ? "Buka kembali" : "Tandai selesai";
      $("thread-toggle-status").dataset.status = c.status;
      state.conv.orders = j.orders; $("thread-order-count").textContent = j.orders.length;
      renderThreadOrders();
      if (initial) threadMsgs.innerHTML = "";
      var atBottom = threadMsgs.scrollHeight - threadMsgs.scrollTop - threadMsgs.clientHeight < 80;
      var gotCustomer = false;
      j.messages.forEach(function (m) { if (!state.conv.rendered[m.id]) { appendMsg(m); state.conv.rendered[m.id] = 1; state.conv.lastId = Math.max(state.conv.lastId, m.id); if (!initial && m.sender === "customer") gotCustomer = true; } });
      if (initial && !j.messages.length) threadMsgs.innerHTML = '<div class="admin-empty">Belum ada pesan.</div>';
      if (initial || atBottom || gotCustomer) threadMsgs.scrollTop = threadMsgs.scrollHeight;
      if (gotCustomer) { beep(); var idx = state.conv.list.findIndex(function (x) { return x.id === id; }); if (idx > -1) { state.conv.list[idx].unread_admin = 0; } }
    }).catch(function (ex) { if (ex.status === 404) { toast("Percakapan tidak ditemukan.", "error"); location.hash = "#inbox"; } });
  };
  var orderCard = function (o) {
    return '<div class="webchat-order"><div class="webchat-order-head">' + ICON.bag + "<span>Pesanan #" + esc(o.code) + '</span><small><span class="webchat-pill is-' + esc(o.status) + '">' + (STATUS[o.status] || o.status) + "</span></small></div>" +
      '<div class="webchat-order-rows"><div><span>Layanan</span><b>' + esc(o.service_name) + (o.plan ? " \u00b7 " + esc(o.plan) : "") + "</b></div>" +
      "<div><span>Harga</span><b>" + fmtAmount(o.amount, o.currency) + (o.currency !== "IDR" ? " \u2248 " + fmtRp(o.amount_idr) : "") + "</b></div>" +
      "<div><span>Biaya fee</span><b>" + fmtRp(o.fee) + "</b></div>" +
      '<div class="is-total"><span>Total</span><b>' + fmtRp(o.total) + "</b></div></div></div>";
  };
  var appendMsg = function (m) {
    var day = dayLabel(m.created_at);
    if (day && day !== state.conv.lastDay) { state.conv.lastDay = day; var sep = document.createElement("div"); sep.className = "webchat-day"; sep.innerHTML = "<span>" + esc(day) + "</span>"; threadMsgs.appendChild(sep); }
    var isOrder = m.meta && m.meta.type === "order";
    var el = document.createElement("div");
    el.className = "webchat-msg is-" + m.sender + (isOrder ? " has-order" : "");
    el.innerHTML = (isOrder ? orderCard(m.meta) : '<div class="webchat-bubble">' + esc(m.body) + "</div>") + '<span class="webchat-time">' + (m.sender === "admin" ? "Anda \u00b7 " : m.sender === "system" ? "Sistem \u00b7 " : "") + fmtTime(m.created_at) + "</span>";
    threadMsgs.appendChild(el);
  };
  var renderThreadOrders = function () {
    var os = state.conv.orders;
    threadOrders.innerHTML = os.length ? os.map(function (o) {
      return '<div class="admin-thread-order"><div><b>#' + esc(o.code) + ' <span class="admin-status is-' + esc(o.status) + '">' + (STATUS[o.status] || o.status) + "</span></b><small>" + esc(o.service_name) + (o.plan ? " · " + esc(o.plan) : "") + " · " + fmtAmount(o.amount, o.currency) + ' · Total <span class="is-money">' + fmtRp(o.total) + "</span></small></div>" + statusSelect(o) + "</div>";
    }).join("") : '<div class="admin-empty">Belum ada pesanan dari pelanggan ini.</div>';
  };
  var statusSelect = function (o) {
    return '<select class="admin-status-select" data-order="' + o.id + '" data-current="' + esc(o.status) + '">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (k === o.status ? " selected" : "") + ">" + STATUS[k] + "</option>"; }).join("") + "</select>";
  };
  $("thread-orders-btn").addEventListener("click", function () { threadOrders.hidden = !threadOrders.hidden; });
  threadOrders.addEventListener("change", function (e) { var s = e.target.closest(".admin-status-select"); if (s) changeOrderStatus(s, function () { fetchThread(false); }); });
  $("thread-back").addEventListener("click", function () { location.hash = "#inbox"; });
  $("thread-toggle-status").addEventListener("click", function () {
    var id = state.conv.active; if (!id) return;
    var next = this.dataset.status === "closed" ? "open" : "closed";
    api("conv_status", { id: id, status: next }).then(function () { toast(next === "closed" ? "Percakapan ditandai selesai." : "Percakapan dibuka kembali.", "success"); fetchThread(false); loadConversations(); }).catch(function (ex) { toast(ex.message, "error"); });
  });
  $("thread-delete").addEventListener("click", function () {
    var id = state.conv.active; if (!id) return;
    confirmModal("Hapus percakapan?", "Semua pesan dan pesanan pelanggan ini akan dihapus permanen.", "Hapus", true).then(function (ok) {
      if (!ok) return;
      api("conv_delete", { id: id }).then(function () { toast("Percakapan dihapus."); location.hash = "#inbox"; loadConversations(); }).catch(function (ex) { toast(ex.message, "error"); });
    });
  });
  // Compose
  var autosize = function () { composeTa.style.height = "auto"; composeTa.style.height = Math.min(composeTa.scrollHeight, 140) + "px"; composeBtn.disabled = !composeTa.value.trim(); };
  composeTa.addEventListener("input", autosize);
  composeTa.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); compose.requestSubmit ? compose.requestSubmit() : sendReply(); } });
  var sendReply = function () {
    var id = state.conv.active, body = composeTa.value.trim(); if (!id || !body) return;
    composeBtn.disabled = true;
    api("reply", { id: id, body: body }).then(function (j) {
      composeTa.value = ""; autosize();
      var m = { id: j.id, sender: "admin", body: body, meta: null, created_at: j.created_at };
      if (!state.conv.rendered[m.id]) { if (qs(".admin-empty", threadMsgs)) threadMsgs.innerHTML = ""; appendMsg(m); state.conv.rendered[m.id] = 1; state.conv.lastId = Math.max(state.conv.lastId, m.id); }
      threadMsgs.scrollTop = threadMsgs.scrollHeight;
      loadConversations();
    }).catch(function (ex) { toast(ex.message, "error"); composeBtn.disabled = false; });
  };
  compose.addEventListener("submit", function (e) { e.preventDefault(); sendReply(); });
  var renderQuickReplies = function () {
    var raw = state.settings.quick_replies;
    var render = function (txt) {
      var lines = String(txt || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      $("quick-replies").innerHTML = lines.map(function (l) { return '<button type="button" title="' + esc(l) + '">' + esc(l.length > 48 ? l.slice(0, 48) + "…" : l) + "</button>"; }).join("");
      qsa("button", $("quick-replies")).forEach(function (b, i) { b.onclick = function () { composeTa.value = lines[i]; autosize(); composeTa.focus(); }; });
    };
    if (raw !== undefined) render(raw); else api("settings").then(function (j) { state.settings = j.settings; render(j.settings.quick_replies); }).catch(function () {});
  };

  // ---------- Pesanan ----------
  var ordersTable = $("orders-table"), ordersPager = $("orders-pager");
  var loadOrders = function () {
    ordersTable.innerHTML = '<tbody><tr><td><div class="admin-loading">Memuat…</div></td></tr></tbody>';
    api("orders", undefined, { query: { status: state.orders.status, q: state.orders.q, page: state.orders.page } }).then(function (j) {
      state.orders.data = j.orders;
      ordersTable.innerHTML = j.orders.length ? "<thead><tr><th>Kode</th><th>Pelanggan</th><th>Layanan</th><th>Nominal</th><th>Fee</th><th>Total</th><th>Status</th><th>Waktu</th><th></th></tr></thead><tbody>" + j.orders.map(function (o) {
        return "<tr data-id=\"" + o.id + '"><td class="is-code">#' + esc(o.code) + (o.note ? ' <span title="' + esc(o.note) + '">📝</span>' : "") + '</td><td><div class="admin-customer"><b>' + esc(o.customer_name) + '</b><small><a class="admin-link" style="color:inherit" target="_blank" rel="noreferrer" href="' + waLink(o.phone) + '">' + esc(o.phone) + "</a></small></div></td><td>" + esc(o.service_name) + (o.plan ? '<br><span class="is-muted">' + esc(o.plan) + "</span>" : "") + '</td><td class="is-money">' + fmtAmount(o.amount, o.currency) + (o.currency !== "IDR" ? '<br><span class="is-muted">≈ ' + fmtRp(o.amount_idr) + "</span>" : "") + "</td><td>" + fmtRp(o.fee) + '</td><td class="is-money">' + fmtRp(o.total) + "</td><td>" + statusSelect(o) + '</td><td class="is-muted">' + fmtDateTime(o.created_at) + '</td><td class="is-actions"><button class="admin-icon-btn" type="button" data-act="chat" title="Buka chat">' + ICON.chatOpen + '</button><button class="admin-icon-btn" type="button" data-act="note" title="Detail & catatan">' + ICON.note + '</button><button class="admin-icon-btn" type="button" data-act="delete" title="Hapus">' + ICON.trash + "</button></td></tr>";
      }).join("") + "</tbody>" : '<tbody><tr><td><div class="admin-empty">Tidak ada pesanan.</div></td></tr></tbody>';
      var start = (j.page - 1) * 25 + 1;
      ordersPager.innerHTML = "<span>" + (j.total ? "Menampilkan " + start + "–" + Math.min(j.total, start + j.orders.length - 1) + " dari " + j.total : "0 pesanan") + "</span><div>" +
        '<button class="admin-btn admin-btn-ghost admin-btn-sm" type="button" data-page="' + (j.page - 1) + '"' + (j.page <= 1 ? " disabled" : "") + ">‹ Sebelumnya</button>" +
        '<button class="admin-btn admin-btn-ghost admin-btn-sm" type="button" data-page="' + (j.page + 1) + '"' + (j.page >= j.pages ? " disabled" : "") + ">Berikutnya ›</button></div>";
      $("export-btn").href = "/api/admin?action=export_orders" + (state.orders.status ? "&status=" + state.orders.status : "") + (state.orders.q ? "&q=" + encodeURIComponent(state.orders.q) : "");
    }).catch(function (ex) { if (ex.status !== 401) toast(ex.message, "error"); });
  };
  ordersPager.addEventListener("click", function (e) { var b = e.target.closest("button[data-page]"); if (b && !b.disabled) { state.orders.page = parseInt(b.dataset.page, 10); loadOrders(); } });
  var orderSearchTimer;
  $("order-search").addEventListener("input", function (e) { clearTimeout(orderSearchTimer); orderSearchTimer = setTimeout(function () { state.orders.q = e.target.value.trim(); state.orders.page = 1; loadOrders(); }, 250); });
  $("order-filter").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    qsa("button", e.currentTarget).forEach(function (x) { x.classList.toggle("is-active", x === b); });
    state.orders.status = b.dataset.status; state.orders.page = 1; loadOrders();
  });
  ordersTable.addEventListener("change", function (e) { var s = e.target.closest(".admin-status-select"); if (s) changeOrderStatus(s, loadOrders); });
  ordersTable.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var tr = b.closest("tr"), id = parseInt(tr.dataset.id, 10);
    var o = (state.orders.data || []).filter(function (x) { return x.id == id; })[0]; if (!o) return;
    if (b.dataset.act === "chat") location.hash = "#inbox/" + o.conversation_id;
    if (b.dataset.act === "delete") confirmModal("Hapus pesanan #" + o.code + "?", "Pesanan dihapus dari daftar. Pesan di chat tidak ikut terhapus.", "Hapus", true).then(function (ok) { if (ok) api("order_delete", { id: id }).then(function () { toast("Pesanan dihapus."); loadOrders(); }).catch(function (ex) { toast(ex.message, "error"); }); });
    if (b.dataset.act === "note") openOrderDetail(o);
  });
  var openOrderDetail = function (o) {
    openModal('<h2>Pesanan #' + esc(o.code) + '</h2><div class="admin-order-detail">' +
      "<div><span>Pelanggan</span><b>" + esc(o.customer_name) + "<br><small>" + esc(o.phone) + "</small></b></div>" +
      "<div><span>Layanan</span><b>" + esc(o.service_name) + (o.plan ? " · " + esc(o.plan) : "") + "</b></div>" +
      "<div><span>Nominal</span><b>" + fmtAmount(o.amount, o.currency) + (o.currency !== "IDR" ? " ≈ " + fmtRp(o.amount_idr) + " (kurs " + Number(o.rate).toLocaleString("id-ID") + ")" : "") + "</b></div>" +
      "<div><span>Fee</span><b>" + fmtRp(o.fee) + "</b></div><div><span>Total</span><b>" + fmtRp(o.total) + "</b></div>" +
      '<div><span>Status</span><b><span class="admin-status is-' + esc(o.status) + '">' + (STATUS[o.status] || o.status) + "</span></b></div>" +
      "<div><span>Dibuat</span><b>" + fmtDateTime(o.created_at) + "</b></div></div>" +
      '<form id="note-form"><label>Catatan internal (tidak terlihat pelanggan)<textarea name="note" rows="3">' + esc(o.note || "") + '</textarea></label><div class="admin-modal-actions"><a class="admin-btn admin-btn-ghost" href="#inbox/' + o.conversation_id + '">Buka chat</a><button class="admin-btn admin-btn-primary" type="submit">Simpan catatan</button></div></form>');
    qs("#note-form", modalBody).addEventListener("submit", function (e) {
      e.preventDefault();
      api("order_note", { id: o.id, note: e.target.note.value }).then(function () { toast("Catatan disimpan.", "success"); closeModal(); loadOrders(); }).catch(function (ex) { toast(ex.message, "error"); });
    });
    qs("a.admin-btn", modalBody).addEventListener("click", closeModal);
  };
  // Ubah status pesanan + pesan opsional ke chat pelanggan
  var changeOrderStatus = function (sel, done) {
    var id = parseInt(sel.dataset.order, 10), status = sel.value, prev = sel.dataset.current;
    if (status === prev) return;
    var defaults = {
      diproses: "Pesanan Anda sedang kami proses. Mohon tunggu konfirmasi berikutnya ya.",
      selesai: "Pesanan Anda telah selesai diproses. Terima kasih sudah menggunakan jasa Fahmidev!",
      batal: "Mohon maaf, pesanan Anda dibatalkan. Silakan hubungi admin jika ada pertanyaan.",
      baru: ""
    };
    openModal("<h2>Ubah status → " + STATUS[status] + '</h2><p class="admin-hint">Status baru akan muncul di chat pelanggan. Anda bisa menambahkan pesan (opsional), misalnya instruksi pembayaran.</p><form id="status-form"><label>Pesan untuk pelanggan<textarea name="message" rows="3">' + esc(defaults[status] || "") + '</textarea></label><div class="admin-modal-actions"><button class="admin-btn admin-btn-ghost" type="button" data-act="cancel">Batal</button><button class="admin-btn admin-btn-primary" type="submit">Simpan status</button></div></form>');
    qs("[data-act=cancel]", modalBody).onclick = function () { sel.value = prev; closeModal(); };
    qs("#status-form", modalBody).addEventListener("submit", function (e) {
      e.preventDefault();
      api("order_status", { id: id, status: status, message: e.target.message.value.trim() }).then(function () { toast("Status pesanan diperbarui.", "success"); closeModal(); if (done) done(); pollBadges(); }).catch(function (ex) { toast(ex.message, "error"); sel.value = prev; });
    });
  };

  // ---------- Layanan ----------
  var servicesList = $("services-list");
  var loadServices = function () {
    servicesList.innerHTML = '<div class="admin-loading">Memuat…</div>';
    api("services").then(function (j) { state.services = j.services; renderServices(); }).catch(function (ex) { if (ex.status !== 401) toast(ex.message, "error"); });
  };
  var renderServices = function () {
    var list = state.services;
    servicesList.innerHTML = list.length ? list.map(function (s, i) {
      var icon = s.icon ? '<img src="../' + esc(s.icon) + '" alt="" onerror="this.outerHTML=\'<span class=&quot;admin-top-ph&quot;>' + esc(initials(s.name)) + '</span>\'">' : '<span class="admin-top-ph">' + esc(initials(s.name)) + "</span>";
      return '<article class="admin-service' + (s.active ? "" : " is-inactive") + '" data-id="' + s.id + '"><div class="admin-service-head">' + icon + "<div><b>" + esc(s.name) + "</b><small>/" + esc(s.slug) + "</small></div><label class=\"admin-switch\"><input type=\"checkbox\" data-act=\"toggle\"" + (s.active ? " checked" : "") + "></label></div>" +
        (s.description ? "<p>" + esc(s.description) + "</p>" : "") +
        '<div class="admin-service-meta">' + s.currencies.map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("") + "<span>" + s.presets.length + " preset</span></div>" +
        '<div class="admin-service-actions"><div><button class="admin-icon-btn" type="button" data-act="up" title="Naik"' + (i === 0 ? " disabled" : "") + ">" + ICON.up + '</button><button class="admin-icon-btn" type="button" data-act="down" title="Turun"' + (i === list.length - 1 ? " disabled" : "") + ">" + ICON.down + '</button></div><div><button class="admin-btn admin-btn-ghost admin-btn-sm" type="button" data-act="edit">Edit</button><button class="admin-icon-btn" type="button" data-act="delete" title="Hapus">' + ICON.trash + "</button></div></div></article>";
    }).join("") : '<div class="admin-empty">Belum ada layanan.</div>';
  };
  servicesList.addEventListener("change", function (e) {
    var cb = e.target.closest("input[data-act=toggle]"); if (!cb) return;
    var id = parseInt(cb.closest(".admin-service").dataset.id, 10);
    api("service_toggle", { id: id, active: cb.checked ? 1 : 0 }).then(function () { toast(cb.checked ? "Layanan diaktifkan." : "Layanan dinonaktifkan."); loadServices(); }).catch(function (ex) { toast(ex.message, "error"); cb.checked = !cb.checked; });
  });
  servicesList.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var card = b.closest(".admin-service"), id = parseInt(card.dataset.id, 10);
    var idx = state.services.findIndex(function (s) { return s.id === id; }), s = state.services[idx];
    if (b.dataset.act === "edit") openServiceForm(s);
    if (b.dataset.act === "delete") confirmModal("Hapus layanan " + s.name + "?", "Layanan dihapus dari katalog API. Pesanan lama tidak terpengaruh.", "Hapus", true).then(function (ok) { if (ok) api("service_delete", { id: id }).then(function () { toast("Layanan dihapus."); loadServices(); }).catch(function (ex) { toast(ex.message, "error"); }); });
    if (b.dataset.act === "up" || b.dataset.act === "down") {
      var to = b.dataset.act === "up" ? idx - 1 : idx + 1; if (to < 0 || to >= state.services.length) return;
      var arr = state.services.slice(); arr.splice(to, 0, arr.splice(idx, 1)[0]);
      api("service_sort", { ids: arr.map(function (x) { return x.id; }) }).then(function () { state.services = arr; renderServices(); }).catch(function (ex) { toast(ex.message, "error"); });
    }
  });
  $("service-add").addEventListener("click", function () { openServiceForm(null); });
  var presetRow = function (p) {
    p = p || { label: "", amount: "", currency: "", custom: false };
    return '<div class="admin-preset-row"><input name="p_label" placeholder="Label (mis. Pro / $20)" value="' + esc(p.label) + '"><input name="p_amount" type="number" step="0.01" placeholder="Nominal (0 = custom)" value="' + esc(p.custom ? "" : p.amount) + '"><input name="p_currency" placeholder="USD" maxlength="3" value="' + esc(p.currency) + '" style="width:72px;text-transform:uppercase"><button class="admin-icon-btn" type="button" data-act="rm" title="Hapus baris">' + ICON.x + "</button></div>";
  };
  var openServiceForm = function (s) {
    var isNew = !s; s = s || { id: 0, slug: "", name: "", description: "", icon: "", currencies: ["USD"], presets: [], active: 1 };
    openModal("<h2>" + (isNew ? "Tambah layanan" : "Edit layanan") + '</h2><form id="service-form"><div class="admin-modal-fields">' +
      '<div class="admin-form-grid"><label>Nama<input name="name" required value="' + esc(s.name) + '"></label><label>Slug (URL)<input name="slug" required value="' + esc(s.slug) + '" placeholder="mis. netflix"></label></div>' +
      '<label>Deskripsi singkat<input name="description" value="' + esc(s.description) + '"></label>' +
      '<label>Path ikon (relatif root, mis. assets/services/xxx.png)<input name="icon" value="' + esc(s.icon) + '"></label>' +
      '<label>Mata uang (pisahkan koma)<input name="currencies" required value="' + esc(s.currencies.join(", ")) + '"></label>' +
      '<div><label style="margin-bottom:8px">Preset paket</label><div class="admin-presets" id="presets">' + s.presets.map(presetRow).join("") + '</div><button class="admin-btn admin-btn-ghost admin-btn-sm" type="button" id="preset-add" style="margin-top:8px">+ Tambah preset</button></div>' +
      '<label class="admin-switch"><input type="checkbox" name="active"' + (s.active ? " checked" : "") + "> Aktif di katalog</label></div>" +
      '<div class="admin-modal-actions"><button class="admin-btn admin-btn-ghost" type="button" data-act="cancel">Batal</button><button class="admin-btn admin-btn-primary" type="submit">' + (isNew ? "Tambah" : "Simpan") + "</button></div></form>");
    var presets = qs("#presets", modalBody);
    qs("#preset-add", modalBody).onclick = function () { presets.insertAdjacentHTML("beforeend", presetRow()); };
    presets.addEventListener("click", function (e) { var b = e.target.closest("[data-act=rm]"); if (b) b.closest(".admin-preset-row").remove(); });
    qs("[data-act=cancel]", modalBody).onclick = closeModal;
    qs("#service-form", modalBody).addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      var currencies = f.currencies.value.split(",").map(function (c) { return c.trim().toUpperCase(); }).filter(Boolean);
      var rows = qsa(".admin-preset-row", presets).map(function (r) {
        var amt = parseFloat(qs("[name=p_amount]", r).value);
        return { label: qs("[name=p_label]", r).value.trim(), amount: isNaN(amt) ? 0 : amt, currency: qs("[name=p_currency]", r).value.trim().toUpperCase() || currencies[0], custom: isNaN(amt) || amt <= 0 };
      }).filter(function (p) { return p.label; });
      api("service_save", { id: s.id, name: f.name.value.trim(), slug: f.slug.value.trim(), description: f.description.value.trim(), icon: f.icon.value.trim(), currencies: currencies, presets: rows, active: f.active.checked ? 1 : 0 })
        .then(function () { toast(isNew ? "Layanan ditambahkan." : "Layanan disimpan.", "success"); closeModal(); loadServices(); }).catch(function (ex) { toast(ex.message, "error"); });
    });
  };

  // ---------- Pengaturan ----------
  var feeForm = $("fee-form"), rateForm = $("rate-form"), chatForm = $("chat-form"), pwForm = $("password-form");
  var loadSettings = function () {
    api("settings").then(function (j) {
      state.settings = j.settings;
      var s = j.settings;
      qsa("input", feeForm).forEach(function (i) { if (s[i.name] !== undefined) i.value = s[i.name]; });
      renderRates(s);
      qsa("input,textarea", chatForm).forEach(function (i) { if (s[i.name] !== undefined) i.value = s[i.name]; });
      pwForm.username.value = j.admin.username;
      feePreview();
    }).catch(function (ex) { if (ex.status !== 401) toast(ex.message, "error"); });
  };
  var renderRates = function (s) {
    var keys = Object.keys(s).filter(function (k) { return k.indexOf("rate_") === 0; }).sort(function (a, b) { return a === "rate_USD" ? -1 : b === "rate_USD" ? 1 : a.localeCompare(b); });
    $("rate-fields").innerHTML = keys.map(function (k) { return '<label class="admin-rate-field">' + k.slice(5) + (k !== "rate_USD" ? ' <button type="button" data-rm="' + k + '">hapus</button>' : "") + '<input name="' + k + '" type="number" step="0.01" min="0" value="' + esc(s[k]) + '"></label>'; }).join("");
  };
  $("rate-fields").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-rm]"); if (!b) return;
    // Kurs tidak bisa dihapus di server (hanya di-set); nilai 0 menandakan tidak dipakai
    b.closest("label").remove(); toast("Kurs dihapus dari form. Simpan untuk menerapkan (nilai akan di-set 0).");
    state.settings["__removed_" + b.dataset.rm] = true;
  });
  $("rate-add").addEventListener("click", function () {
    var code = $("rate-new-code").value.trim().toUpperCase(), val = parseFloat($("rate-new-val").value);
    if (!/^[A-Z]{3}$/.test(code)) return toast("Kode mata uang harus 3 huruf.", "error");
    if (isNaN(val) || val <= 0) return toast("Kurs harus angka > 0.", "error");
    if (qs('[name="rate_' + code + '"]', rateForm)) return toast("Mata uang sudah ada.", "error");
    $("rate-fields").insertAdjacentHTML("beforeend", '<label class="admin-rate-field">' + code + ' <button type="button" data-rm="rate_' + code + '">hapus</button><input name="rate_' + code + '" type="number" step="0.01" min="0" value="' + val + '"></label>');
    $("rate-new-code").value = ""; $("rate-new-val").value = "";
  });
  var feePreview = function () {
    var v = function (n) { return parseFloat(feeForm[n].value) || 0; };
    var rate = parseFloat((qs('[name=rate_USD]', rateForm) || {}).value) || parseFloat(state.settings.rate_USD) || 0;
    var idr = 500000, usd = 20, usdSmall = 2;
    var feeIdr = v("fee_idr_base") + idr * v("fee_idr_pct") / 100;
    var feeUsd = usd < v("fee_usd_min_threshold") ? v("fee_usd_min") : v("fee_usd_base") + usd * rate * v("fee_usd_pct") / 100;
    var feeSmall = usdSmall < v("fee_usd_min_threshold") ? v("fee_usd_min") : v("fee_usd_base") + usdSmall * rate * v("fee_usd_pct") / 100;
    $("fee-preview").innerHTML = "Contoh: Rp 500.000 → fee <b>" + fmtRp(feeIdr) + "</b>, total " + fmtRp(idr + feeIdr) + "<br>$20 (kurs " + rate.toLocaleString("id-ID") + ") → fee <b>" + fmtRp(feeUsd) + "</b>, total " + fmtRp(usd * rate + feeUsd) + "<br>$2 → fee <b>" + fmtRp(feeSmall) + "</b>, total " + fmtRp(usdSmall * rate + feeSmall);
  };
  feeForm.addEventListener("input", feePreview);
  rateForm.addEventListener("input", feePreview);
  var saveSettings = function (form, collect) {
    return function (e) {
      e.preventDefault();
      var btn = qs("button[type=submit]", form); btn.disabled = true;
      api("settings_save", { settings: collect() }).then(function () { toast("Pengaturan disimpan.", "success"); loadSettings(); }).catch(function (ex) { toast(ex.message, "error"); }).then(function () { btn.disabled = false; });
    };
  };
  feeForm.addEventListener("submit", saveSettings(feeForm, function () { var o = {}; qsa("input", feeForm).forEach(function (i) { o[i.name] = i.value; }); return o; }));
  rateForm.addEventListener("submit", saveSettings(rateForm, function () {
    var o = {}; qsa("input[name^=rate_]", rateForm).forEach(function (i) { o[i.name] = i.value; });
    Object.keys(state.settings).forEach(function (k) { if (k.indexOf("__removed_") === 0) { o[k.slice(10)] = "0"; delete state.settings[k]; } });
    return o;
  }));
  chatForm.addEventListener("submit", saveSettings(chatForm, function () { var o = {}; qsa("input,textarea", chatForm).forEach(function (i) { o[i.name] = i.value; }); return o; }));
  pwForm.addEventListener("submit", function (e) {
    e.preventDefault();
    api("password", { username: pwForm.username.value.trim(), old_password: pwForm.old_password.value, new_password: pwForm.new_password.value }).then(function () {
      toast("Akun diperbarui.", "success"); pwForm.old_password.value = ""; pwForm.new_password.value = ""; $("admin-name").textContent = pwForm.username.value.trim();
    }).catch(function (ex) { toast(ex.message, "error"); });
  });

  // ---------- Boot ----------
  api("me").then(function (j) { showApp(j.admin); }).catch(function () { showLogin(); });
})();
