(function () {
  "use strict";
  var localeApi = window.GoisiinnLocale;
  var locale = function () { return localeApi ? localeApi.get() : "id"; };
  var t = function (key) { return localeApi ? localeApi.t(key) : key; };
  var esc = function (value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  // Catat kunjungan tanpa mengirim URL, IP, atau identitas pribadi.
  fetch("/api/visits", { method: "POST", credentials: "same-origin", headers: { "X-Requested-With": "fetch" }, keepalive: true }).catch(function () {});

  // Mobile navigation toggle
  var menuToggle = document.querySelector(".menu-toggle");
  var navPanel = document.querySelector(".nav-panel");
  if (menuToggle && navPanel) {
    var setMenu = function (open) {
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
      menuToggle.classList.toggle("is-open", open);
      navPanel.classList.toggle("is-open", open);
    };
    menuToggle.addEventListener("click", function () {
      setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
    });
    navPanel.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("click", function (event) {
      if (!navPanel.classList.contains("is-open")) return;
      if (menuToggle.contains(event.target) || navPanel.contains(event.target)) return;
      setMenu(false);
    });
  }

  // FAQ accordion (one item open at a time, like the reference)
  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-accordion-item"));
  faqItems.forEach(function (item) {
    var trigger = item.querySelector(".faq-accordion-trigger");
    if (!trigger) return;
    trigger.addEventListener("click", function () {
      var willOpen = !item.classList.contains("is-open");
      faqItems.forEach(function (other) {
        other.classList.remove("is-open");
        var t = other.querySelector(".faq-accordion-trigger");
        if (t) t.setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  // Floating chat widget
  var chat = document.querySelector(".floating-chat");
  var chatToggle = chat && chat.querySelector(".floating-chat-toggle");
  var chatOptions = chat && chat.querySelector(".floating-chat-options");
  if (chat && chatToggle && chatOptions) {
    var setChat = function (open) {
      chat.classList.toggle("is-open", open);
      chatToggle.setAttribute("aria-expanded", String(open));
      chatToggle.setAttribute("aria-label", open ? "Tutup pilihan chat" : "Buka pilihan chat");
      chatOptions.setAttribute("aria-hidden", String(!open));
      chatOptions.querySelectorAll("a, button").forEach(function (a) {
        a.setAttribute("tabindex", open ? "0" : "-1");
      });
    };
    chatToggle.addEventListener("click", function () {
      setChat(!chat.classList.contains("is-open"));
    });
    document.addEventListener("click", function (event) {
      if (chat.classList.contains("is-open") && !chat.contains(event.target)) setChat(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && chat.classList.contains("is-open")) setChat(false);
    });
  }

  // Pencarian live (halaman katalog + FAQ): cocokkan judul item saja;
  // bila tidak ada yang cocok, daftar diganti elemen "kosong".
  var normalise = function (s) { return (s || "").toLowerCase().replace(/\s+/g, " ").trim(); };
  var wireSearch = function (opts) {
    var input = document.querySelector(opts.input);
    var list = document.querySelector(opts.list);
    if (!input || !list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll(opts.item));
    var empty = document.createElement(opts.emptyTag || "div");
    empty.className = opts.emptyClass;
    empty.textContent = opts.emptyText;
    empty.hidden = true;
    list.parentNode.insertBefore(empty, list.nextSibling);
    input.addEventListener("input", function () {
      var q = normalise(input.value);
      var shown = 0;
      items.forEach(function (item) {
        var text = normalise((item.querySelector(opts.text) || item).textContent);
        var hide = q !== "" && text.indexOf(q) === -1;
        item.hidden = hide;
        if (!hide) shown++;
      });
      list.hidden = shown === 0;
      empty.hidden = shown !== 0;
    });
  };
  wireSearch({
    input: ".catalog-search input", list: ".catalog-grid", item: ".catalog-card", text: ".catalog-card-copy h2",
    emptyClass: "catalog-empty", emptyText: "Tidak ada layanan yang cocok dengan pencarian Anda."
  });
  wireSearch({
    input: ".faq-search-control input", list: ".faq-page-list", item: ".faq-page-card", text: ".faq-accordion-trigger span",
    emptyTag: "p", emptyClass: "faq-empty", emptyText: "FAQ tidak ditemukan."
  });

  // SNK table of contents: scroll to numbered section, highlight current
  var tocButtons = Array.prototype.slice.call(document.querySelectorAll(".snk-toc-list button"));
  var snkSections = Array.prototype.slice.call(document.querySelectorAll(".snk-content-section"));
  if (tocButtons.length && snkSections.length) {
    var setToc = function (index) {
      tocButtons.forEach(function (b, i) {
        b.classList.toggle("is-active", i === index);
        if (i === index) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
      });
    };
    tocButtons.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        var target = snkSections[i];
        if (!target) return;
        setToc(i);
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 110, behavior: "smooth" });
      });
    });
    if ("IntersectionObserver" in window) {
      var visible = new Map();
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { visible.set(e.target, e.isIntersecting ? e.boundingClientRect.top : null); });
        var best = -1, bestTop = Infinity;
        snkSections.forEach(function (s, i) {
          var top = visible.get(s);
          if (top != null && Math.abs(top - 120) < bestTop) { bestTop = Math.abs(top - 120); best = i; }
        });
        if (best >= 0) setToc(best);
      }, { rootMargin: "-100px 0px -60% 0px" });
      snkSections.forEach(function (s) { io.observe(s); });
    }
  }

  // Service detail: shrink summary metric values until they fit their box
  // (production does this with a resize-aware effect; 21px max, 12px min).
  var metricValues = Array.prototype.slice.call(document.querySelectorAll(".service-summary-metric-value"));
  if (metricValues.length) {
    var fitMetrics = function () {
      metricValues.forEach(function (el) {
        var size = 21;
        el.style.fontSize = size + "px";
        while (el.scrollWidth > el.clientWidth && size > 12) {
          size -= 1;
          el.style.fontSize = size + "px";
        }
      });
    };
    fitMetrics();
    window.addEventListener("resize", fitMetrics);
  }

  // Service detail: "Baca Selengkapnya" toggle
  var seoToggle = document.querySelector("[class*='ServiceSeoIntroduction'][class*='toggle']");
  var seoMore = document.querySelector("[class*='ServiceSeoIntroduction'][class*='more']");
  if (seoToggle && seoMore) {
    var expandedClass = seoToggle.className.split(" ")[0].replace(/toggle$/, "toggleExpanded");
    var label = seoToggle.firstChild;
    seoToggle.addEventListener("click", function () {
      var open = seoMore.hidden;
      seoMore.hidden = !open;
      seoToggle.classList.toggle(expandedClass, open);
      seoToggle.setAttribute("aria-expanded", String(open));
      if (label && label.nodeType === 3) label.textContent = open ? "Tampilkan Lebih Sedikit" : "Baca Selengkapnya";
    });
  }

  // Service detail: order calculator + checkout popup (pesanan dikirim ke /api/orders)
  var orderCard = document.querySelector(".service-order-card");
  if (orderCard) {
    // API berada di root domain (Cloudflare Pages Functions).
    var API_BASE = "/api/";
    // Nilai default = sama dengan setting server; akan ditimpa oleh /api/settings bila tersedia.
    var FEE = { idr_base: 20000, idr_pct: 4.5, usd_min: 20000, usd_min_threshold: 3, usd_base: 28000, usd_pct: 1, cut_pct: 10 };
    var RATES = { USD: 18600, EUR: 21500, GBP: 24800, JPY: 125, CNY: 2600, THB: 570, MYR: 4400 };
    var MIN_ORDER = { IDR: 20000, USD: 1 };
    var rateFor = function (cur) { return cur === "IDR" ? 1 : (Number(RATES[cur]) || 0); };
    var feeFor = function (amount, cur) {
      if (cur === "IDR") return FEE.idr_base + amount * FEE.idr_pct / 100;
      var idr = amount * rateFor(cur);
      if (idr / RATES.USD < FEE.usd_min_threshold) return FEE.usd_min;
      return FEE.usd_base + idr * FEE.usd_pct / 100;
    };
    var serviceSlug = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    var optionGrid = orderCard.querySelector(".service-option-grid");
    var serviceName = (document.querySelector(".service-summary-brand h1") || {}).textContent || "";
    // Judul halaman bisa sudah diterjemahkan ke Bahasa Malaysia sebelum script ini
    // berjalan. API orders menerima nama katalog saja, misalnya "Claude".
    serviceName = serviceName.replace(/^(?:Jasa|Layanan|Perkhidmatan)\s+Pembayaran\s+/i, "").trim();
    if (optionGrid && (serviceSlug === "claude" || serviceSlug === "chatgpt")) {
      var seatButtons = serviceSlug === "claude"
        ? '<button data-amount="257000" data-currency="IDR" data-custom="false" data-product-key="claude-team-standard" data-plan="Claude Team Standard Seat" aria-selected="false" role="tab" type="button">Team Standard Seat</button><button data-amount="812000" data-currency="IDR" data-custom="false" data-product-key="claude-team-premium" data-plan="Claude Team Premium Seat" aria-selected="false" role="tab" type="button">Team Premium Seat</button><button data-amount="5.55" data-currency="USD" data-custom="false" data-po-key="claude-pro-po-4" data-plan="Patungan Claude Pro (1/4)" aria-selected="false" role="tab" type="button">Patungan Claude Pro (1/4)</button>'
        : '<button data-amount="73000" data-currency="IDR" data-custom="false" data-product-key="chatgpt-business-standard" data-plan="ChatGPT Business Standard Seat" aria-selected="false" role="tab" type="button">Business Standard Seat</button><button data-amount="243000" data-currency="IDR" data-custom="false" data-product-key="chatgpt-business-premium" data-plan="ChatGPT Business Premium Seat" aria-selected="false" role="tab" type="button">Business Premium Seat</button><button data-amount="71250" data-currency="IDR" data-custom="false" data-po-key="chatgpt-plus-po-4" data-plan="Patungan ChatGPT Plus (1/4)" aria-selected="false" role="tab" type="button">Patungan ChatGPT Plus (1/4)</button>';
      var customTab = optionGrid.querySelector('[data-custom="true"]');
      if (customTab) {
        customTab.insertAdjacentHTML("beforebegin", seatButtons);
        optionGrid.insertAdjacentHTML("afterend", '<section class="service-product-help" aria-live="polite" hidden><h3></h3><p></p><details open><summary>Info selengkapnya</summary><div></div></details></section>');
      }
    }
    var tabs = Array.prototype.slice.call(orderCard.querySelectorAll(".service-option-grid button"));
    var currencySel = orderCard.querySelector(".service-order-fields select");
    if (currencySel && serviceSlug === "claude" && !currencySel.querySelector('option[value="IDR"]')) currencySel.insertAdjacentHTML("beforeend", '<option value="IDR">IDR</option>');
    var amountInput = orderCard.querySelector(".service-order-fields input");
    var amountLabel = amountInput && amountInput.parentNode;
    var costStrong = orderCard.querySelectorAll(".service-cost-summary strong");
    var orderBtn = orderCard.querySelector(".service-order-button");
    var brandImg = orderCard.querySelector(".service-order-brand-icon img");
    // Diskon paket tetap harus sama dengan fungsi discountUsdForPlan di server.
    // Diskon Claude Pro dibagi empat untuk satu slot patungan.
    var DISCOUNT_MIN_USD = 20;
    var tabLabel = function (t) { return t.getAttribute("data-plan") || t.textContent.trim(); };
    var activeTabEl = function () { return tabs.filter(function (x) { return x.classList.contains("is-active"); })[0]; };
    var discountUsdForTab = function (t) {
      if (!t || t.getAttribute("data-custom") === "true") return 0;
      if (serviceSlug === "chatgpt") return 2.12;
      if (serviceSlug !== "claude") return 0;
      if (t.getAttribute("data-po-key") === "claude-pro-po-4") return 4.79 / 4;
      var plan = tabLabel(t);
      if (plan === "Pro") return 4.79;
      if (plan === "Max 5X") return 9.12;
      return 3.56;
    };
    var tabIsPremium = function (t) {
      if (!discountUsdForTab(t)) return false;
      if (t.getAttribute("data-po-key") === "claude-pro-po-4") return true;
      var idr = (parseFloat(t.getAttribute("data-amount")) || 0) * rateFor(t.getAttribute("data-currency") || "IDR");
      return RATES.USD > 0 && idr / RATES.USD > DISCOUNT_MIN_USD;
    };
    var discountRow = null;
    var feeLabel = (orderCard.querySelectorAll(".service-cost-summary span")[1]) || null;
    var refreshBadges = function () {
      tabs.forEach(function (t) {
        var badge = t.querySelector(".service-discount-badge");
        if (badge) badge.hidden = !tabIsPremium(t);
      });
    };
    if (serviceSlug === "chatgpt" || serviceSlug === "claude") {
      tabs.forEach(function (t) {
        if (t.getAttribute("data-custom") === "true") return;
        if (!t.getAttribute("data-plan")) t.setAttribute("data-plan", t.textContent.trim());
        var discText = "-$" + discountUsdForTab(t).toFixed(2).replace(".", ",");
        t.insertAdjacentHTML("beforeend", '<span class="service-discount-badge" hidden>' + discText + "</span>");
      });
      var summary = orderCard.querySelector(".service-cost-summary");
      var totalRow = summary && summary.lastElementChild;
      if (totalRow) {
        totalRow.insertAdjacentHTML("beforebegin", '<div class="service-discount-row" hidden><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg><span>Diskon</span><strong></strong></div>');
        discountRow = summary.querySelector(".service-discount-row");
      }
    }
    var fmtRp = function (n) { return "Rp " + Math.round(n).toLocaleString("id-ID"); };
    var fmtCustomerMoney = function (idr) {
      if (locale() === "ms") {
        var myrRate = Number(RATES.MYR) || 4400;
        return "RM " + (Number(idr) / myrRate).toLocaleString("ms-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return fmtRp(idr);
    };
    var fmtPrice = function (n, cur) {
      if (cur === "IDR") return fmtRp(n);
      var sym = { USD: "$", EUR: "\u20ac", GBP: "\u00a3", JPY: "\u00a5", CNY: "\u00a5", THB: "\u0e3f", MYR: "RM" }[cur] || cur + " ";
      return sym + n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
    };
    var state = { amount: 0, currency: "IDR", plan: "", productKey: "", poKey: "" };
    var productHelp = orderCard.querySelector(".service-product-help");
    var productHelpCopy = {
      "claude-team-standard": ["Claude Team Standard Seat", "Akun Claude resmi dan legal dari Business Goisiinn. Admin mengundang email Anda ke seat khusus; aktif tepat 1 bulan dan limitnya 1,25× Claude Pro.", "Cocok untuk 1 orang dan bukan patungan. Masukkan email yang bisa menerima undangan. Bisa dipakai di web, aplikasi resmi, Claude Code CLI, Cowork, MCP/konektor resmi, dan project pribadi. Dilarang VPN/proxy/WARP, VPS/RDP/cloud, token injection, bot agent, prompt bersamaan, loop 24/7, scraping massal, malware, atau hacking. Pelanggaran = kick permanen tanpa refund."],
      "claude-team-premium": ["Claude Team Premium Seat", "Akun Claude resmi dan legal dari Business Goisiinn. Admin mengundang email Anda ke seat khusus; aktif tepat 1 bulan dan limitnya 6,25× Claude Pro.", "Cocok untuk 1 orang dan bukan patungan. Masukkan email yang bisa menerima undangan. Bisa dipakai di web, aplikasi resmi, Claude Code CLI, Cowork, MCP/konektor resmi, dan project pribadi. Dilarang VPN/proxy/WARP, VPS/RDP/cloud, token injection, bot agent, prompt bersamaan, loop 24/7, scraping massal, malware, atau hacking. SSH Tailscale hanya ke laptop rumah tanpa Exit Node VPS. Pelanggaran = kick permanen tanpa refund."],
      "chatgpt-business-standard": ["ChatGPT Business Standard Seat", "Akun resmi dan legal dari Business Goisiinn. Admin mengundang email Anda ke seat khusus; setara ChatGPT Go. Aktif tepat 1 bulan dan harga Rp73.000.", "Masukkan email yang bisa menerima undangan. Seat ini dipakai satu orang, bukan patungan, dan tidak menunggu peserta lain. Admin mengaitkan akses ke akun yang Anda berikan; jangan bagikan undangan atau kata sandi."],
      "chatgpt-business-premium": ["ChatGPT Business Premium Seat", "Akun resmi dan legal dari Business Goisiinn. Admin mengundang email Anda ke seat khusus; setara ChatGPT Pro. Aktif tepat 1 bulan dan harga promo Rp243.000.", "Masukkan email yang bisa menerima undangan. Seat ini dipakai satu orang, bukan patungan, dan tidak menunggu peserta lain. Admin mengaitkan akses ke akun yang Anda berikan; jangan bagikan undangan atau kata sandi."],
      "claude-pro-po-4": ["Patungan Claude Pro (1 dari 4 peserta)", "Akun Claude Pro resmi dan legal, aktif tepat 1 bulan. Satu akun yang sama dipakai bersama oleh 4 peserta; akses dibagikan setelah grup lengkap.", "Masukkan email dan nomor yang bisa dihubungi. Admin membayar melalui akun pembayaran admin setelah 4 peserta lengkap; grup menunggu maksimal 7 hari. Harga dasar per peserta USD5,55 + fee layanan Rp5.000. Jangan ubah password, memakai VPN/proxy, login ke VPS, atau memakai akun secara bersamaan."],
      "chatgpt-plus-po-4": ["Patungan ChatGPT Plus (1 dari 4 peserta)", "Akun ChatGPT Plus resmi dan legal, aktif tepat 1 bulan. Satu akun yang sama dipakai bersama oleh 4 peserta; akses dibagikan setelah pembayaran grup lengkap. Harga promo hanya berlaku di Goisiinn.", "Masukkan email yang bisa dihubungi. Untuk paket patungan, kirim link pembayaran/checkout lalu admin membayar lewat akun pembayaran admin; bisa memakai email baru atau email yang sudah pernah berlangganan. Harga dasar per peserta Rp71.250 + fee Rp5.000, total Rp76.250. Jangan gunakan bersamaan di dua perangkat dan jangan ubah kata sandi akun bersama."]
    };
    var updateProductHelp = function () {
      if (!productHelp) return;
      var key = state.productKey || state.poKey;
      var copy = productHelpCopy[key];
      if (!copy && state.plan) {
        copy = [state.plan, "Paket resmi Goisiinn dengan masa aktif tepat 1 bulan. Total akhir dan biaya layanan ditampilkan transparan di bawah pilihan paket.", "Untuk paket umum, kirim link pembayaran/checkout dan admin membayar melalui akun pembayaran admin. Bisa memakai email baru atau email yang sudah pernah berlangganan. Pastikan data pemesan benar sebelum checkout."];
      }
      productHelp.hidden = !copy;
      if (!copy) return;
      productHelp.querySelector("h3").textContent = copy[0];
      productHelp.querySelector("p").textContent = copy[1];
      productHelp.querySelector("details div").textContent = copy[2];
    };
    var recalc = function () {
      var cur = currencySel ? currencySel.value : "IDR";
      var amount = parseFloat(amountInput.value) || 0;
      var fee = state.productKey ? 0 : state.poKey ? 5000 : feeFor(amount, cur);
      var priceIdr = amount * rateFor(cur);
      // Nilai final selalu dihitung ulang di server.
      var premium = tabIsPremium(activeTabEl());
      refreshBadges();
      var threshold = Math.max(0, Number(FEE.cut_threshold) || 0);
      var cut = Math.max(0, Number(FEE.cut_flat) || 0);
      var feeCut = Math.round(fee) > threshold && cut > 0;
      if (feeCut) fee = Math.max(0, Math.round(fee) - cut);
      var discountUsd = discountUsdForTab(activeTabEl());
      var discount = premium ? Math.min(Math.round(discountUsd * RATES.USD), Math.round(priceIdr)) : 0;
      var total = priceIdr + fee - discount;
      state = { amount: amount, currency: cur, fee: fee, discount: discount, total: total, plan: state.plan, productKey: state.productKey, poKey: state.poKey };
      if (costStrong[0]) costStrong[0].textContent = locale() === "ms" ? fmtCustomerMoney(priceIdr) : fmtPrice(amount, cur);
      if (costStrong[1]) costStrong[1].textContent = fmtCustomerMoney(fee);
      if (feeLabel) feeLabel.textContent = locale() === "ms"
        ? (feeCut ? "Caj Perkhidmatan (jimat " + fmtCustomerMoney(cut) + ")" : "Caj Perkhidmatan")
        : (feeCut ? "Biaya Fee (hemat " + fmtCustomerMoney(cut) + ")" : "Biaya Fee");
      if (discountRow) {
        discountRow.hidden = !discount;
        discountRow.querySelector("span").textContent = "Diskon (-$" + discountUsd.toFixed(2).replace(".", ",") + ")";
        discountRow.querySelector("strong").textContent = "-" + fmtCustomerMoney(discount);
      }
      if (costStrong[2]) costStrong[2].textContent = fmtCustomerMoney(total);
      if (amountLabel) amountLabel.firstChild.textContent = "Jumlah " + cur;
      if (orderBtn) {
        var min = cur === "IDR" ? MIN_ORDER.IDR : MIN_ORDER.USD;
        var ok = amount >= min && rateFor(cur) > 0;
        orderBtn.classList.toggle("is-disabled", !ok);
        orderBtn.setAttribute("aria-disabled", String(!ok));
        if (ok) orderBtn.removeAttribute("tabindex"); else orderBtn.setAttribute("tabindex", "-1");
        if (amountInput) amountInput.min = String(min);
      }
    };
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        var custom = tab.getAttribute("data-custom") === "true";
        amountInput.disabled = !custom;
        if (currencySel) currencySel.disabled = !custom;
        amountInput.value = tab.getAttribute("data-amount") || "0";
        if (currencySel && tab.getAttribute("data-currency")) currencySel.value = tab.getAttribute("data-currency");
        state.plan = tab.getAttribute("data-plan") || tabLabel(tab);
        state.productKey = tab.getAttribute("data-product-key") || "";
        state.poKey = tab.getAttribute("data-po-key") || "";
        recalc();
        updateProductHelp();
      });
    });
    var activeTab = tabs.filter(function (t) { return t.classList.contains("is-active"); })[0];
    state.plan = activeTab ? activeTab.getAttribute("data-plan") || tabLabel(activeTab) : "";
    state.productKey = activeTab ? activeTab.getAttribute("data-product-key") || "" : "";
    state.poKey = activeTab ? activeTab.getAttribute("data-po-key") || "" : "";
    if (amountInput) amountInput.addEventListener("input", recalc);
    if (currencySel) currencySel.addEventListener("change", recalc);
    document.addEventListener("goisiinn:locale", recalc);
    recalc(); // replace pre-rendered numbers with the current fee/rate
    // Ambil fee & kurs terbaru dari pengaturan admin (fallback ke nilai default di atas).
    fetch(API_BASE + "settings", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r || !r.ok) return;
      if (r.fee) FEE = r.fee;
      if (r.rates) Object.keys(r.rates).forEach(function (k) { RATES[k] = r.rates[k]; });
      if (r.min_order) MIN_ORDER = r.min_order;
      recalc();
    }).catch(function () {});

    // Checkout popup: Lanjutkan -> POST /api/orders -> redirect ke halaman invoice /inv/{kode}.
    var ICON_X = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    var ICON_SHIELD = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';
    var ICON_USER = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';
    var ICON_CHAT = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>';
    var openCheckout = function () {
      var priceIdr = state.amount * rateFor(state.currency);
      var saved = window.FdvChat && window.FdvChat.getSession();
      var seller = !!(saved && saved.account_type === "seller");
      var quantityDefault = seller && !state.poKey ? 3 : 1;
      var overlay = document.createElement("div");
      overlay.className = "checkout-modal-overlay";
      overlay.setAttribute("role", "presentation");
      var previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      overlay.innerHTML =
        '<section aria-labelledby="checkout-title" aria-modal="true" class="checkout-modal" role="dialog">' +
        '<button aria-label="Tutup popup" class="checkout-modal-close" type="button">' + ICON_X + "</button>" +
        '<div class="checkout-product-heading"><span class="checkout-modal-logo"><span class="brand-logo brand-image-logo">' +
        (brandImg ? '<img alt="" width="320" height="160" src="' + brandImg.getAttribute("src") + '">' : "") +
        '</span></span><div class="checkout-product-copy"><h2 id="checkout-title"></h2><p></p><strong></strong></div></div>' +
        '<div class="checkout-total-card"><span>' + t("checkout_total") + '</span><strong></strong>' + ICON_SHIELD + "</div>" +
        (locale() === "ms" ? '<p class="checkout-currency-note">Anggaran Ringgit menggunakan kadar Goisiinn. QRIS tetap menagih Rupiah dan aplikasi pembayaran Malaysia menukar jumlahnya secara automatik.</p>' : '') +
         '<form class="checkout-form" novalidate>' +
        '<label>' + t("name") + '<span class="checkout-input-wrap">' + ICON_USER + '<input name="customer_name" autocomplete="name" placeholder="' + t("full_name") + '" value="' + esc((saved && saved.name) || "") + '"></span></label>' +
         '<label>' + t("whatsapp") + '<span class="checkout-input-wrap">' + ICON_CHAT + '<input name="customer_phone" autocomplete="tel" inputmode="tel" placeholder="' + t("phone_placeholder") + '" value="' + esc((saved && saved.phone) || "") + '"></span></label>' +
         '<label>' + t("quantity") + '<span class="checkout-input-wrap"><input name="quantity" type="number" inputmode="numeric" min="1" max="100" value="' + quantityDefault + '"' + (state.poKey ? " disabled" : "") + '></span></label>' +
         '<p class="checkout-seller-note ' + (seller ? "is-active" : "") + '">' + (seller ? t("seller_checkout_active") : t("seller_checkout_locked")) + '</p>' +
          (state.productKey ? '<label>' + t("seat_email") + '<span class="checkout-input-wrap"><input type="email" name="customer_email" autocomplete="email" inputmode="email" placeholder="nama@email.com" required></span></label>' : state.poKey ? '<label>' + t("participant_email") + '<span class="checkout-input-wrap"><input type="email" name="customer_email" autocomplete="email" inputmode="email" placeholder="nama@email.com" required></span></label>' : "") +
        '<div class="checkout-actions"><button class="checkout-cancel-button" type="button">' + t("cancel") + '</button>' +
        '<button class="checkout-submit-button" type="submit"><span>' + t("continue") + '</span></button></div></form></section>';
      overlay.querySelector("#checkout-title").textContent = serviceName;
      overlay.querySelector(".checkout-product-copy p").textContent = state.plan;
      overlay.querySelector(".checkout-product-copy strong").textContent = t("unit_price") + ": " + fmtCustomerMoney(priceIdr);
      var quantityInput = overlay.querySelector('[name="quantity"]');
      var currentTotals = function () {
        var quantity = state.poKey ? 1 : Math.max(1, Math.min(100, parseInt(quantityInput.value, 10) || 1));
        var normal = Math.round(state.total * quantity);
        var sellerCut = seller && quantity >= 3 ? Math.round(normal * 0.08) : 0;
        overlay.querySelector(".checkout-total-card strong").textContent = fmtCustomerMoney(normal - sellerCut);
        return { quantity: quantity, sellerDiscount: sellerCut, total: normal - sellerCut };
      };
      quantityInput.addEventListener("input", currentTotals);
      currentTotals();
      var close = function () { overlay.remove(); document.removeEventListener("keydown", onKey); document.body.style.overflow = previousBodyOverflow; };
      var onKey = function (e) { if (e.key === "Escape") close(); };
      overlay.querySelector(".checkout-modal-close").addEventListener("click", close);
      overlay.querySelector(".checkout-cancel-button").addEventListener("click", close);
      overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
      document.addEventListener("keydown", onKey);
      var form = overlay.querySelector(".checkout-form");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var inputs = form.querySelectorAll("input");
        var old = form.querySelector(".checkout-error");
        if (old) old.remove();
        var showErr = function (text) {
          var msg = document.createElement("p");
          msg.className = "checkout-error";
          msg.textContent = text;
          form.insertBefore(msg, form.querySelector(".checkout-actions"));
        };
         var name = form.customer_name.value.trim(), phone = form.customer_phone.value.trim();
         var checkout = currentTotals();
         var emailInput = form.querySelector('[name="customer_email"]');
         var customerEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";
        if (!name || !phone) return showErr(t("required_identity"));
         if (emailInput && (!emailInput.checkValidity() || !customerEmail)) { emailInput.focus(); return showErr(t("invalid_email")); }
        var submitBtn = form.querySelector(".checkout-submit-button");
        submitBtn.disabled = true;
        submitBtn.firstChild.textContent = t("processing");
        var session = window.FdvChat && window.FdvChat.getSession();
        fetch(API_BASE + "orders", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
          body: JSON.stringify({
            name: name, phone: phone, token: session ? session.token : "",
            service_slug: serviceSlug, service_name: serviceName, plan: state.plan,
             amount: state.amount, currency: state.currency, quantity: checkout.quantity, locale: locale(),
             product_key: state.productKey, po_key: state.poKey, customer_email: customerEmail
          })
        }).then(function (r) { return r.json(); }).then(function (r) {
          if (!r || !r.ok) throw new Error((r && r.error) || "Pesanan gagal dibuat. Silakan coba lagi.");
          if (!/^\/inv\/FDV-\d{6}-[0-9A-F]{5,32}$/.test(r.redirectUrl || "")) throw new Error("Link invoice tidak valid. Silakan hubungi admin sebelum membuat ulang pesanan.");
          // Simpan sesi chat (riwayat pesanan tetap bisa dibuka lewat widget), lalu ke halaman invoice.
          if (window.FdvChat && window.FdvChat.saveSession) window.FdvChat.saveSession({ token: r.token, name: name, phone: phone, account_type: r.account_type || (saved && saved.account_type) || "customer", locale: r.locale || locale() });
          location.href = r.redirectUrl;
        }).catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.firstChild.textContent = t("continue");
          showErr(err.message === "Failed to fetch" ? "Koneksi gagal. Silakan coba lagi." : err.message);
        });
      });
      document.body.appendChild(overlay);
      var first = overlay.querySelector("input");
      if (first) first.focus();
    };
    if (orderBtn) orderBtn.addEventListener("click", function () {
      if (!orderBtn.classList.contains("is-disabled")) openCheckout();
    });
  }
})();
