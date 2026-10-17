(function () {
  "use strict";

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
      chatOptions.querySelectorAll("a").forEach(function (a) {
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

  // Live search filters (catalog page + FAQ page)
  var normalise = function (s) { return (s || "").toLowerCase().replace(/\s+/g, " ").trim(); };
  // Mirrors production: matches on the item title only; when nothing matches the
  // list container is replaced by an empty-state element.
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

  // Service detail: order calculator + checkout popup (UI only, no backend)
  var orderCard = document.querySelector(".service-order-card");
  if (orderCard) {
    var USD_RATE = 18600; // IDR per USD
    var FEE_DISCOUNT = 0.9; // fee 10% lebih murah dari acuan
    var tabs = Array.prototype.slice.call(orderCard.querySelectorAll(".service-option-grid button"));
    var currencySel = orderCard.querySelector(".service-order-fields select");
    var amountInput = orderCard.querySelector(".service-order-fields input");
    var amountLabel = amountInput && amountInput.parentNode;
    var costStrong = orderCard.querySelectorAll(".service-cost-summary strong");
    var orderBtn = orderCard.querySelector(".service-order-button");
    var brandImg = orderCard.querySelector(".service-order-brand-icon img");
    var serviceName = (document.querySelector(".service-summary-brand h1") || {}).textContent || "";
    serviceName = serviceName.replace(/^Jasa Pembayaran\s+/i, "").trim();

    var fmtRp = function (n) { return "Rp " + Math.round(n).toLocaleString("id-ID"); };
    var fmtPrice = function (n, cur) {
      if (cur === "IDR") return "IDR\u00a0" + Math.round(n).toLocaleString("en-US");
      var sym = cur === "EUR" ? "\u20ac" : "$";
      return sym + n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
    };
    // Fee tiers mirror the amounts observed on the reference site.
    var feeFor = function (amount, cur) {
      var base;
      if (cur === "IDR") base = 25000 + amount * 0.05;
      else if (amount < 3) base = 25000;
      else base = 35000 + amount * USD_RATE * 0.01;
      return base * FEE_DISCOUNT;
    };
    var state = { amount: 0, currency: "IDR", plan: "" };
    var recalc = function () {
      var cur = currencySel ? currencySel.value : "IDR";
      var amount = parseFloat(amountInput.value) || 0;
      var fee = feeFor(amount, cur);
      var total = (cur === "IDR" ? amount : amount * USD_RATE) + fee;
      state = { amount: amount, currency: cur, fee: fee, total: total, plan: state.plan };
      if (costStrong[0]) costStrong[0].textContent = fmtPrice(amount, cur);
      if (costStrong[1]) costStrong[1].textContent = fmtRp(fee);
      if (costStrong[2]) costStrong[2].textContent = fmtRp(total);
      if (amountLabel) amountLabel.firstChild.textContent = "Jumlah " + cur;
      if (orderBtn) {
        var min = cur === "IDR" ? 20000 : 1;
        var ok = amount >= min;
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
        state.plan = tab.textContent.trim();
        recalc();
      });
    });
    var activeTab = tabs.filter(function (t) { return t.classList.contains("is-active"); })[0];
    state.plan = activeTab ? activeTab.textContent.trim() : "";
    if (amountInput) amountInput.addEventListener("input", recalc);
    if (currencySel) currencySel.addEventListener("change", recalc);
    recalc(); // replace pre-rendered numbers with the current fee/rate

    // Checkout popup — same markup as the reference, submission is UI-only.
    var ICON_X = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    var ICON_SHIELD = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';
    var ICON_USER = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';
    var ICON_CHAT = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>';
    var openCheckout = function () {
      var priceIdr = state.currency === "IDR" ? state.amount : state.amount * USD_RATE;
      var overlay = document.createElement("div");
      overlay.className = "checkout-modal-overlay";
      overlay.setAttribute("role", "presentation");
      overlay.innerHTML =
        '<section aria-labelledby="checkout-title" aria-modal="true" class="checkout-modal" role="dialog">' +
        '<button aria-label="Tutup popup" class="checkout-modal-close" type="button">' + ICON_X + "</button>" +
        '<div class="checkout-product-heading"><span class="checkout-modal-logo"><span class="brand-logo brand-image-logo">' +
        (brandImg ? '<img alt="' + serviceName + '" width="320" height="160" src="' + brandImg.getAttribute("src") + '">' : "") +
        '</span></span><div class="checkout-product-copy"><h2 id="checkout-title"></h2><p></p><strong></strong></div></div>' +
        '<div class="checkout-total-card"><span>Total Pembayaran</span><strong></strong>' + ICON_SHIELD + "</div>" +
        '<form class="checkout-form" novalidate>' +
        '<label>Nama<span class="checkout-input-wrap">' + ICON_USER + '<input autocomplete="name" placeholder="Masukkan nama lengkap Anda" value=""></span></label>' +
        '<label>No WhatsApp<span class="checkout-input-wrap">' + ICON_CHAT + '<input autocomplete="tel" inputmode="tel" placeholder="Contoh: 0812 3456 7890" value=""></span></label>' +
        '<div class="checkout-actions"><button class="checkout-cancel-button" type="button">Batal</button>' +
        '<button class="checkout-submit-button" type="submit"><span>Lanjutkan</span></button></div></form></section>';
      overlay.querySelector("#checkout-title").textContent = serviceName;
      overlay.querySelector(".checkout-product-copy p").textContent = state.plan;
      overlay.querySelector(".checkout-product-copy strong").textContent = fmtRp(priceIdr);
      overlay.querySelector(".checkout-total-card strong").textContent = fmtRp(state.total);
      var close = function () { overlay.remove(); document.removeEventListener("keydown", onKey); };
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
        var msg = document.createElement("p");
        msg.className = "checkout-error";
        if (!inputs[0].value.trim() || !inputs[1].value.trim()) {
          msg.textContent = "Nama dan nomor WhatsApp wajib diisi.";
        } else {
          // No backend in this replica: the reference submits the order to its API here.
          msg.textContent = "Pemrosesan pesanan belum terhubung pada versi ini. Silakan hubungi admin via WhatsApp.";
        }
        form.insertBefore(msg, form.querySelector(".checkout-actions"));
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
