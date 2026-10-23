/* Web chat widget: chat langsung di website, identitas = nama + WhatsApp, polling ke /api/chat */
(function () {
  "use strict";

  var chatRoot = document.querySelector(".floating-chat");
  var options = chatRoot && chatRoot.querySelector(".floating-chat-options");
  var toggle = chatRoot && chatRoot.querySelector(".floating-chat-toggle");
  if (!chatRoot || !options || !toggle) return;

  // API berada di root domain (Cloudflare Pages Functions), tidak tergantung sub-folder halaman.
  var API = "/api/";
  var BASE = "/"; // root aset statis (logo, dll.)
  var STORAGE_KEY = "fdv_chat";
  var POLL_MS = 3000;

  var ICON = {
    chat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>',
    x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    minus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    send: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>',
    user: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>',
    phone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>',
    bag: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></svg>',
    arrow: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'
  };

  var session = null; // {token, name, phone}
  try { session = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (e) { session = null; }
  var saveSession = function (s) { session = s; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {} };
  var clearSession = function () { session = null; try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} };

  var api = function (path, data) {
    var opt = { headers: { "X-Requested-With": "fetch" }, credentials: "same-origin" };
    if (data) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(data); }
    return fetch(API + path, opt).then(function (r) { return r.json(); }).catch(function () { return { ok: false, error: "Tidak dapat terhubung ke server." }; });
  };

  // ---------- Tombol di widget floating ----------
  var action = document.createElement("button");
  action.type = "button";
  action.className = "floating-chat-action is-webchat";
  action.setAttribute("aria-label", "Chat langsung di website");
  action.setAttribute("tabindex", "-1");
  action.innerHTML = '<span class="floating-chat-icon">' + ICON.chat + '</span><span class="floating-chat-badge" hidden>0</span>';
  options.insertBefore(action, options.firstChild);
  var actionBadge = action.querySelector(".floating-chat-badge");
  var toggleBadge = document.createElement("span");
  toggleBadge.className = "floating-chat-badge";
  toggleBadge.hidden = true;
  toggle.appendChild(toggleBadge);

  var setBadge = function (n) {
    var show = n > 0 && (panel.hidden || minimized);
    [actionBadge, toggleBadge].forEach(function (b) { b.textContent = n > 99 ? "99+" : String(n); b.hidden = !show; });
  };

  // ---------- Panel ----------
  var panel = document.createElement("section");
  panel.className = "webchat";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Live chat Fahmidev");
  panel.innerHTML =
    '<header class="webchat-head">' +
    '<span class="webchat-avatar"><img src="' + BASE + 'assets/logo-fahmidev.svg" alt=""><span class="webchat-status-dot"></span></span>' +
    '<div class="webchat-title"><strong>Live Chat</strong><span class="webchat-subtitle">Biasanya membalas dalam beberapa menit</span></div>' +
    '<div class="webchat-head-actions"><button type="button" class="webchat-min" aria-label="Kecilkan">' + ICON.minus + '</button><button type="button" class="webchat-close" aria-label="Tutup chat">' + ICON.x + "</button></div>" +
    "</header>" +
    '<div class="webchat-body"></div>';
  document.body.appendChild(panel);
  var body = panel.querySelector(".webchat-body");
  var statusDot = panel.querySelector(".webchat-status-dot");
  var subtitle = panel.querySelector(".webchat-subtitle");
  var titleEl = panel.querySelector(".webchat-title strong");
  var minimized = false;

  var lastId = 0, lastVisible = "", unread = 0, pollTimer = null, rendered = {}, lastDay = "";
  var messagesEl = null, textarea = null, sendBtn = null, typingEl = null;
  var agentName = "", queueTimer = null;
  var setAgent = function (name) {
    agentName = name || "";
    titleEl.textContent = agentName ? agentName : "Live Chat";
  };

  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmtRp = function (n) { return "Rp " + Math.round(n).toLocaleString("id-ID"); };
  var fmtAmount = function (n, cur) {
    if (cur === "IDR") return "IDR " + Math.round(n).toLocaleString("id-ID");
    var sym = { USD: "$", EUR: "\u20ac", GBP: "\u00a3", JPY: "\u00a5", CNY: "\u00a5", THB: "\u0e3f", MYR: "RM" }[cur] || cur + " ";
    return sym + Number(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
  };
  var parseDate = function (s) { return new Date(String(s).replace(" ", "T")); };
  var fmtTime = function (s) { var d = parseDate(s); return isNaN(d) ? "" : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); };
  var dayLabel = function (s) {
    var d = parseDate(s); if (isNaN(d)) return "";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (diff === 0) return "Hari ini";
    if (diff === 1) return "Kemarin";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  var STATUS_LABEL = { baru: "Baru", diproses: "Diproses", selesai: "Selesai", batal: "Dibatalkan" };
  var orderCard = function (m) {
    var o = m.meta;
    return '<div class="webchat-order"><div class="webchat-order-head">' + ICON.bag + "<span>Pesanan #" + esc(o.code) + '</span><small><span class="webchat-pill is-' + esc(o.status) + '">' + (STATUS_LABEL[o.status] || o.status) + "</span></small></div>" +
      '<div class="webchat-order-rows"><div><span>Layanan</span><b>' + esc(o.service_name) + (o.plan ? " \u00b7 " + esc(o.plan) : "") + "</b></div>" +
      "<div><span>Harga</span><b>" + fmtAmount(o.amount, o.currency) + (o.currency !== "IDR" ? " \u2248 " + fmtRp(o.amount_idr) : "") + "</b></div>" +
      "<div><span>Biaya fee</span><b>" + fmtRp(o.fee) + "</b></div>" +
      '<div class="is-total"><span>Total</span><b>' + fmtRp(o.total) + "</b></div></div></div>";
  };

  var renderMessage = function (m) {
    if (rendered[m.id]) return;
    rendered[m.id] = true;
    var day = dayLabel(m.created_at);
    if (day && day !== lastDay) {
      lastDay = day;
      var sep = document.createElement("div");
      sep.className = "webchat-day";
      sep.innerHTML = "<span>" + esc(day) + "</span>";
      messagesEl.appendChild(sep);
    }
    var el = document.createElement("div");
    var isOrder = m.meta && m.meta.type === "order";
    var isConnected = m.meta && m.meta.type === "connected";
    if (isConnected) {
      el.className = "webchat-connected";
      el.innerHTML = "<span>" + esc(m.body) + "</span>";
      messagesEl.appendChild(el);
      return;
    }
    var who = m.sender === "admin" ? ((m.meta && m.meta.agent) || agentName || "Admin") + " \u00b7 " : "";
    el.className = "webchat-msg is-" + m.sender + (isOrder ? " has-order" : "");
    el.innerHTML = (isOrder ? orderCard(m) : '<div class="webchat-bubble">' + esc(m.body) + "</div>") +
      '<span class="webchat-time">' + esc(who) + fmtTime(m.created_at) + "</span>";
    messagesEl.appendChild(el);
  };
  var scrollBottom = function () { if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight; };
  var showTyping = function (on) {
    if (!typingEl) return;
    typingEl.hidden = !on;
    if (on) { typingEl.querySelector("b").textContent = agentName || "Admin"; scrollBottom(); }
  };

  // ---------- Tampilan: form identitas ----------
  var renderIntro = function (prefill) {
    stopPolling(); stopQueue(); setAgent("");
    body.innerHTML =
      '<div class="webchat-intro"><div><h3>Live Chat</h3><p>Isi nama dan nomor WhatsApp Anda agar tim kami dapat menghubungi kembali jika chat terputus.</p></div>' +
      '<form class="webchat-form" novalidate>' +
      '<label>Nama<span class="checkout-input-wrap">' + ICON.user + '<input name="name" autocomplete="name" placeholder="Masukkan nama Anda" value="' + esc((prefill && prefill.name) || "") + '"></span></label>' +
      '<label>No WhatsApp<span class="checkout-input-wrap">' + ICON.phone + '<input name="phone" autocomplete="tel" inputmode="tel" placeholder="Contoh: 0812 3456 7890" value="' + esc((prefill && prefill.phone) || "") + '"></span></label>' +
      '<button class="webchat-submit" type="submit"><span>Mulai Chat</span>' + ICON.arrow + "</button></form>" +
      '<p class="webchat-alt">Atau hubungi via <a href="https://t.me/fahmidev" target="_blank" rel="noreferrer">Telegram</a></p></div>';
    var form = body.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim(), phone = form.phone.value.trim();
      var old = form.querySelector(".checkout-error"); if (old) old.remove();
      var showErr = function (t) { var p = document.createElement("p"); p.className = "checkout-error"; p.textContent = t; form.insertBefore(p, form.querySelector(".webchat-submit")); };
      if (name.length < 2 || phone.replace(/\D/g, "").length < 9) return showErr("Nama dan nomor WhatsApp wajib diisi dengan benar.");
      var btn = form.querySelector(".webchat-submit"); btn.disabled = true;
      api("chat?action=start", { name: name, phone: phone }).then(function (r) {
        btn.disabled = false;
        if (!r.ok) return showErr(r.error || "Gagal memulai chat.");
        saveSession({ token: r.token, name: r.name, phone: r.phone });
        if (r.queue_left > 0) renderQueue(r.queue_left); else renderChat();
      });
    });
    var first = form.querySelector("input"); if (first && !panel.hidden) first.focus();
  };

  // ---------- Tampilan: antrian menunggu agen ----------
  var stopQueue = function () { if (queueTimer) clearInterval(queueTimer); queueTimer = null; };
  var renderQueue = function (seconds) {
    stopPolling(); stopQueue();
    var left = Math.max(1, Math.round(seconds));
    body.innerHTML =
      '<div class="webchat-queue"><div class="webchat-queue-spinner"></div>' +
      '<h3>Menghubungkan ke tim kami\u2026</h3>' +
      '<p>Mohon tunggu sebentar, Anda akan segera terhubung dengan agen kami.</p>' +
      '<div class="webchat-queue-count">Perkiraan <b>' + left + '</b> detik</div></div>';
    var countEl = body.querySelector(".webchat-queue-count b");
    subtitle.textContent = "Menunggu agen tersedia";
    queueTimer = setInterval(function () {
      left -= 1;
      if (countEl) countEl.textContent = String(Math.max(0, left));
      if (left <= 0) {
        stopQueue();
        // Konfirmasi ke server bahwa sudah tersambung; server mengirim sapaan agen.
        api("chat?action=poll&token=" + encodeURIComponent(session.token) + "&since=0").then(function (r) {
          if (r.ok && !r.connected && r.queue_left > 0) return renderQueue(r.queue_left);
          if (r.ok && r.agent) setAgent(r.agent);
          renderChat();
        });
      }
    }, 1000);
  };

  // ---------- Tampilan: percakapan ----------
  var renderChat = function () {
    stopQueue();
    body.innerHTML =
      '<div class="webchat-messages" aria-live="polite"></div>' +
      '<div class="webchat-typing" hidden><b>Admin</b> sedang mengetik<span class="webchat-dots"><i></i><i></i><i></i></span></div>' +
      '<div class="webchat-offline" hidden><span>Admin sedang offline. Pesan Anda tetap tersimpan.</span></div>' +
      '<div class="webchat-footer"><form class="webchat-compose"><textarea rows="1" placeholder="Tulis pesan..." aria-label="Tulis pesan"></textarea>' +
      '<button class="webchat-send" type="submit" aria-label="Kirim" disabled>' + ICON.send + "</button></form>" +
      '<p class="webchat-note">Chat sebagai <b></b> \u00b7 <a href="#" class="webchat-reset">ganti</a></p></div>';
    messagesEl = body.querySelector(".webchat-messages");
    typingEl = body.querySelector(".webchat-typing");
    textarea = body.querySelector("textarea");
    sendBtn = body.querySelector(".webchat-send");
    body.querySelector(".webchat-note b").textContent = session.name;
    body.querySelector(".webchat-reset").addEventListener("click", function (e) { e.preventDefault(); clearSession(); lastId = 0; lastVisible = ""; rendered = {}; lastDay = ""; renderIntro(); });
    var form = body.querySelector(".webchat-compose");
    var autosize = function () { textarea.style.height = "auto"; textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"; sendBtn.disabled = textarea.value.trim() === ""; };
    textarea.addEventListener("input", autosize);
    textarea.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = textarea.value.trim();
      if (!text) return;
      textarea.value = ""; autosize();
      // Tampilkan langsung (optimistic), lalu sinkronkan id dari server.
      var tempId = "tmp" + Date.now();
      renderMessage({ id: tempId, sender: "customer", body: text, created_at: localNow() });
      scrollBottom();
      api("chat?action=send", { token: session.token, body: text }).then(function (r) {
        if (!r.ok) {
          if (/tidak ditemukan/i.test(r.error || "")) { clearSession(); renderIntro(); return; }
          var el = messagesEl.lastElementChild; if (el) el.querySelector(".webchat-time").textContent = "Gagal terkirim: " + (r.error || "");
          return;
        }
        rendered[r.id] = true;
        if (r.id > lastId) lastId = r.id;
      });
    });
    lastId = 0; lastVisible = ""; rendered = {}; lastDay = "";
    poll(true);
    startPolling();
    if (!panel.hidden) textarea.focus();
  };
  var localNow = function () { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); };

  var poll = function (initial) {
    if (!session) return Promise.resolve();
    return api("chat?action=poll&token=" + encodeURIComponent(session.token) + "&since=" + lastId + "&vsince=" + encodeURIComponent(lastVisible)).then(function (r) {
      if (!r.ok) { if (r.error && /tidak ditemukan/i.test(r.error)) { clearSession(); renderIntro(); } return; }
      if (r.agent) setAgent(r.agent);
      // Masih di antrian (misal buka ulang halaman saat menunggu).
      if (r.connected === false && r.queue_left > 0) { if (!panel.hidden && !body.querySelector(".webchat-queue")) renderQueue(r.queue_left); return; }
      if (!messagesEl) return;
      var atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 40;
      var gotNew = false;
      (r.messages || []).forEach(function (m) {
        if (!rendered[m.id]) gotNew = true;
        renderMessage(m);
        // Pesan tertunda dilacak lewat visible_at; pesan biasa lewat id. Jangan campur agar tidak ada yang terlewat.
        if (m.visible_at) { if (m.visible_at > lastVisible) lastVisible = m.visible_at; }
        else if (m.id > lastId) lastId = m.id;
      });
      showTyping(!!r.typing);
      if (gotNew && (initial || atBottom)) scrollBottom();
      statusDot.classList.toggle("is-online", !!r.admin_online);
      subtitle.textContent = r.admin_online ? "Online \u00b7 siap membantu" : "Biasanya membalas dalam beberapa menit";
      var off = body.querySelector(".webchat-offline"); if (off) off.hidden = !!r.admin_online;
      unread = r.unread || 0;
      if (!panel.hidden && !minimized && document.visibilityState === "visible") {
        if (unread > 0) { api("chat?action=seen", { token: session.token }); unread = 0; }
      } else if (gotNew && unread > 0) {
        notify(r.messages);
      }
      setBadge(unread);
      if (gotNew && !initial && panel.hidden) ping();
    });
  };
  var startPolling = function () { stopPolling(); pollTimer = setInterval(function () { poll(false); }, POLL_MS); };
  var stopPolling = function () { if (pollTimer) clearInterval(pollTimer); pollTimer = null; };

  var ping = function () {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.05;
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };
  var notify = function (msgs) {
    if (!("Notification" in window) || Notification.permission !== "granted" || document.visibilityState === "visible") return;
    var last = msgs.filter(function (m) { return m.sender !== "customer"; }).pop();
    if (last) try { new Notification(agentName ? agentName + " \u00b7 Fahmidev" : "Live Chat Fahmidev", { body: last.body.slice(0, 120) }); } catch (e) {}
  };

  // ---------- Buka / tutup ----------
  var open = function () {
    if (!panel.hidden && !minimized) return;
    minimized = false;
    panel.hidden = false;
    panel.classList.add("is-entering");
    requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.remove("is-entering"); }); });
    document.body.classList.add("webchat-open");
    chatRoot.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    options.setAttribute("aria-hidden", "true");
    if (session) { if (!messagesEl) renderChat(); else { poll(false); startPolling(); textarea.focus(); } }
    else renderIntro();
    setBadge(0);
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  };
  var close = function () {
    panel.hidden = true;
    document.body.classList.remove("webchat-open");
    minimized = false;
  };
  panel.querySelector(".webchat-close").addEventListener("click", close);
  panel.querySelector(".webchat-min").addEventListener("click", function () { minimized = true; close(); });
  action.addEventListener("click", function (e) { e.stopPropagation(); open(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });

  // Polling latar belakang (badge) jika sudah pernah chat, meski panel tertutup.
  if (session) { poll(true); startPolling(); }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && session) poll(false); });

  // ---------- API publik untuk checkout (script.js) ----------
  window.FdvChat = {
    getSession: function () { return session; },
    /** Dipanggil setelah pesanan dibuat: simpan sesi dan buka chat dengan ringkasan pesanan. */
    openWithSession: function (s) {
      saveSession(s);
      messagesEl = null; lastId = 0; lastVisible = ""; rendered = {}; lastDay = "";
      open();
      renderChat();
    },
    open: open,
    apiBase: API
  };
})();
