/* =========================================================
   Meadowly — Global runtime
   ========================================================= */
(function () {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const page = body.dataset.page || "";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STORE_KEYS = {
    theme: "meadowly-theme",
    dir: "meadowly-dir",
    box: "meadowly-box",
    wishlist: "meadowly-wishlist"
  };

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* Storage can be unavailable in private contexts. */
      }
    },
    text(key, fallback) {
      try {
        return localStorage.getItem(key) || fallback;
      } catch (error) {
        return fallback;
      }
    },
    setText(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        /* noop */
      }
    }
  };

  const icon = (name, className = "icon") =>
    `<svg class="${className}" aria-hidden="true" focusable="false"><use href="assets/icons.svg#${name}"></use></svg>`;

  const escapeHTML = (value) =>
    String(value).replace(/[&<>"']/g, (character) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[character];
    });

  const formatINR = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);

  /* ---------- Toast ---------- */
  function ensureToastStack() {
    let stack = qs(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      stack.setAttribute("aria-atomic", "false");
      body.appendChild(stack);
    }
    return stack;
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains("is-leaving")) return;
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 320);
  }

  function showToast(title, message = "", type = "success") {
    const stack = ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " toast--error" : ""}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <span class="toast__icon">${icon(type === "error" ? "info" : "check")}</span>
      <span class="toast__body">
        <strong>${escapeHTML(title)}</strong>
        ${message ? `<span>${escapeHTML(message)}</span>` : ""}
      </span>
      <button class="toast__close" type="button" aria-label="Dismiss notification">
        ${icon("close")}
      </button>
    `;
    qs(".toast__close", toast).addEventListener("click", () => dismissToast(toast));
    stack.appendChild(toast);
    window.setTimeout(() => dismissToast(toast), 4800);
  }

  /* ---------- Theme & direction ---------- */
  function updateThemeControls() {
    const isDark = root.getAttribute("data-theme") === "dark";
    qsa("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      button.setAttribute("title", isDark ? "Light theme" : "Dark theme");
      const use = qs("use", button);
      if (use) use.setAttribute("href", `assets/icons.svg#${isDark ? "sun" : "moon"}`);
    });
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    storage.setText(STORE_KEYS.theme, theme);
    updateThemeControls();
  }

  function updateDirControls() {
    const isRTL = root.getAttribute("dir") === "rtl";
    qsa("[data-dir-toggle]").forEach((button) => {
      const label = qs("[data-dir-label]", button);
      if (label) label.textContent = isRTL ? "LTR" : "RTL";
      button.setAttribute("aria-label", isRTL ? "Switch to left-to-right layout" : "Switch to right-to-left layout");
      button.setAttribute("title", isRTL ? "Left-to-right layout" : "Right-to-left layout");
      if (!label) button.textContent = isRTL ? "LTR" : "RTL";
    });
  }

  function setDirection(direction) {
    if (typeof closeCartDrawer === "function") closeCartDrawer();
    closeNavDrawer();
    root.classList.add("switching-dir");
    if (direction === "rtl") {
      root.setAttribute("dir", "rtl");
    } else {
      root.removeAttribute("dir");
      root.setAttribute("dir", "ltr");
    }
    storage.setText(STORE_KEYS.dir, direction);
    updateDirControls();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        root.classList.remove("switching-dir");
      });
    });
  }

  function initThemeAndDirection() {
    if (!root.getAttribute("data-theme")) {
      const saved = storage.text(STORE_KEYS.theme, "");
      if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
        root.setAttribute("data-theme", "dark");
      }
    }
    const savedDir = storage.text(STORE_KEYS.dir, "");
    if (savedDir === "rtl") {
      root.setAttribute("dir", "rtl");
    }
    updateThemeControls();
    updateDirControls();

    qsa("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
      });
    });

    qsa("[data-dir-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = root.getAttribute("dir") === "rtl" ? "ltr" : "rtl";
        setDirection(next);
      });
    });
  }

  /* ---------- Box & Cart helpers ---------- */
  const DAIRY_CATALOG = {
    "Sunrise Whole Milk": { price: 78, unit: "1L returnable glass", img: "assets/images/prod-milk.jpg" },
    "A2 Gir Cow Milk": { price: 118, unit: "1L returnable glass", img: "assets/images/prod-a2-milk.jpg" },
    "Hand-Set Curd": { price: 64, unit: "500g clay pot", img: "assets/images/prod-curd.jpg" },
    "Greek Yogurt": { price: 96, unit: "400g tub", img: "assets/images/prod-greek-yogurt.jpg" },
    "Malai Paneer": { price: 148, unit: "250g fresh block", img: "assets/images/prod-paneer.jpg" },
    "Cultured White Butter": { price: 185, unit: "200g jar", img: "assets/images/prod-butter.jpg" },
    "Aged Cheddar": { price: 320, unit: "200g artisanal block", img: "assets/images/prod-cheese.jpg" },
    "Alphonso Mango Lassi": { price: 85, unit: "300ml bottle", img: "assets/images/prod-lassi.jpg" },
    "Rose Buttermilk": { price: 45, unit: "300ml bottle", img: "assets/images/prod-buttermilk.jpg" },
    "Wild Berry Curd": { price: 110, unit: "400g pot", img: "assets/images/prod-berry-curd.jpg" },
    "Custom morning box": { price: 290, unit: "Daily morning box", img: "assets/images/prod-milk.jpg" }
  };

  const QUICK_ADD_ITEMS = [
    { name: "Sunrise Whole Milk", price: 78, unit: "1L glass", img: "assets/images/prod-milk.jpg" },
    { name: "Hand-Set Curd", price: 64, unit: "500g pot", img: "assets/images/prod-curd.jpg" },
    { name: "Malai Paneer", price: 148, unit: "250g fresh", img: "assets/images/prod-paneer.jpg" },
    { name: "Cultured White Butter", price: 185, unit: "200g jar", img: "assets/images/prod-butter.jpg" }
  ];

  function getBox() {
    const value = storage.get(STORE_KEYS.box, []);
    return Array.isArray(value) ? value : [];
  }

  function getBoxCount() {
    return getBox().reduce((total, item) => total + (Number(item.qty) || 0), 0);
  }

  function updateBoxCounts() {
    const count = getBoxCount();
    qsa("[data-box-count]").forEach((element) => {
      element.textContent = count;
    });
    qsa("[data-box-link]").forEach((link) => {
      link.setAttribute("aria-label", `My morning box, ${count} item${count === 1 ? "" : "s"}`);
      link.setAttribute("title", `My box · ${count} item${count === 1 ? "" : "s"}`);
    });
  }

  function renderCartDrawer() {
    const container = qs("[data-cart-items-container]");
    const subtotalEl = qs("[data-cart-subtotal]");
    const totalEl = qs("[data-cart-total]");
    const quickAddList = qs("[data-cart-quick-add-list]");
    if (!container) return;

    const box = getBox();
    let subtotal = 0;

    if (!box.length) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-graphic" aria-hidden="true">${icon("box")}</div>
          <h3>Your morning box is empty</h3>
          <p>Choose fresh dairy essentials below to begin your sunrise delivery.</p>
        </div>
      `;
    } else {
      container.innerHTML = box.map((item) => {
        const info = DAIRY_CATALOG[item.name] || {
          price: 78,
          unit: "Fresh harvest",
          img: "assets/images/prod-milk.jpg"
        };
        const itemLineTotal = info.price * item.qty;
        subtotal += itemLineTotal;

        return `
          <div class="cart-item" data-item-name="${item.name}">
            <img class="cart-item__thumb" src="${info.img}" alt="${item.name}" loading="lazy">
            <div class="cart-item__info">
              <h4 class="cart-item__title">${item.name}</h4>
              <span class="cart-item__unit">${info.unit} · ₹${info.price}</span>
              <div class="cart-item__controls">
                <div class="cart-qty-stepper">
                  <button class="qty-btn" type="button" data-cart-qty-dec="${item.name}" aria-label="Decrease ${item.name}">−</button>
                  <span class="qty-val">${item.qty}</span>
                  <button class="qty-btn" type="button" data-cart-qty-inc="${item.name}" aria-label="Increase ${item.name}">+</button>
                </div>
                <span class="cart-item__line-total">₹${itemLineTotal}</span>
                <button class="cart-item__del" type="button" data-cart-remove="${item.name}" aria-label="Remove ${item.name}">
                  ${icon("close")}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
    if (totalEl) totalEl.textContent = `₹${subtotal}`;

    if (quickAddList && !quickAddList.children.length) {
      quickAddList.innerHTML = QUICK_ADD_ITEMS.map((item) => `
        <div class="quick-add-card">
          <img src="${item.img}" alt="${item.name}" loading="lazy">
          <div class="quick-add-card__info">
            <span class="quick-add-card__title">${item.name}</span>
            <span class="quick-add-card__price">₹${item.price} <small>/ ${item.unit}</small></span>
          </div>
          <button class="quick-add-btn" type="button" data-cart-quick-add="${item.name}" aria-label="Add ${item.name}">
            ${icon("plus")} Add
          </button>
        </div>
      `).join("");
    }
  }

  function addToBox(name, quantity = 1) {
    if (!name) return;
    const box = getBox();
    const existing = box.find((item) => item.name === name);
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + quantity;
    } else {
      box.push({ name, qty: quantity });
    }
    storage.set(STORE_KEYS.box, box);
    updateBoxCounts();
    renderCartDrawer();
    showToast("Added to your morning box", `${name} · tap box icon in navbar to view.`);
  }

  function updateBoxQty(name, delta) {
    if (!name) return;
    const box = getBox();
    const existing = box.find((item) => item.name === name);
    if (!existing) return;
    existing.qty = (Number(existing.qty) || 0) + delta;
    const filtered = box.filter((item) => item.qty > 0);
    storage.set(STORE_KEYS.box, filtered);
    updateBoxCounts();
    renderCartDrawer();
  }

  function removeFromBox(name) {
    if (!name) return;
    const box = getBox().filter((item) => item.name !== name);
    storage.set(STORE_KEYS.box, box);
    updateBoxCounts();
    renderCartDrawer();
    showToast("Removed from morning box", name);
  }

  function clearBox() {
    storage.set(STORE_KEYS.box, []);
    updateBoxCounts();
    renderCartDrawer();
    showToast("Morning box cleared", "Select essentials to start your sunrise delivery.");
  }

  function openCartDrawer() {
    const drawer = qs("#boxCartDrawer");
    const backdrop = qs("[data-cart-backdrop]");
    const trigger = qs("[data-cart-open]");
    if (!drawer) return;
    renderCartDrawer();
    drawer.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-open");
    body.classList.add("cart-open");
    drawer.setAttribute("aria-hidden", "false");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    const drawerBody = drawer.querySelector(".cart-drawer__body");
    if (drawerBody) drawerBody.scrollTop = 0;
  }

  function closeCartDrawer() {
    const drawer = qs("#boxCartDrawer");
    const backdrop = qs("[data-cart-backdrop]");
    const trigger = qs("[data-cart-open]");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-open");
    body.classList.remove("cart-open");
    drawer.setAttribute("aria-hidden", "true");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function closeNavDrawer() {
    const drawer = qs(".nav-drawer");
    const backdrop = qs("[data-drawer-backdrop]");
    const openButton = qs("[data-menu-open]");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-open");
    body.classList.remove("menu-open");
    drawer.setAttribute("aria-hidden", "true");
    if (openButton) {
      openButton.setAttribute("aria-expanded", "false");
    }
  }

  function getWishlist() {
    const value = storage.get(STORE_KEYS.wishlist, []);
    return Array.isArray(value) ? value : [];
  }

  function toggleWishlist(name, button) {
    if (!name) return;
    const list = getWishlist();
    const index = list.indexOf(name);
    if (index >= 0) list.splice(index, 1);
    else list.push(name);
    storage.set(STORE_KEYS.wishlist, list);
    if (button) {
      const active = list.includes(name);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      showToast(active ? "Saved for later" : "Removed from saved items", name);
    }
  }

  /* ---------- Header & footer markup ---------- */
  const brandLogoSVG = `
    <svg class="brand-logo-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="31" fill="#1b3d2a" stroke="#f2cb70" stroke-width="2"/>
      <g>
        <rect x="0" y="0" width="64" height="64" rx="32" fill="#28543b"/>
        <circle cx="32" cy="27" r="11" fill="#f2cb70"/>
        <path d="M32 10v4M22 13l2.5 3M42 13l-2.5 3M15 22l3.5 1.5M49 22l-3.5 1.5" stroke="#f2cb70" stroke-width="2" stroke-linecap="round"/>
        <path d="M0 39 C14 31, 26 31, 42 36 C52 39, 58 37, 64 35 L64 64 L0 64 Z" fill="#2d6345"/>
        <path d="M0 44 C12 37, 30 38, 48 45 C55 48, 60 46, 64 44 L64 64 L0 64 Z" fill="#1b3d2a"/>
        <path d="M12 37v5M17 38v5M22 39v5M42 39v5M47 38v5M52 37v5" stroke="#f2cb70" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
        <path d="M10 40h14M40 40h14" stroke="#f2cb70" stroke-width="0.8" opacity="0.45"/>
        <path d="M28 17 h8 l2.5 5 v24 a2.5 2.5 0 0 1 -2.5 2.5 h-8 a2.5 2.5 0 0 1 -2.5 -2.5 v-24 l2.5 -5 Z" fill="rgba(18, 42, 28, 0.45)"/>
        <rect x="29" y="14" width="6" height="3" rx="1.2" fill="#f2cb70" stroke="#122a1c" stroke-width="0.8"/>
        <path d="M28.5 17 h7 l2.5 5.5 v23 a2 2 0 0 1 -2 2 h-8 a2 2 0 0 1 -2 -2 v-23 l2.5 -5.5 Z" fill="#fffdf6" stroke="#122a1c" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M27 26.5 c2 -0.8, 5 0.8, 10 0 v19.5 a1 1 0 0 1 -1 1 h-8 a1 1 0 0 1 -1 -1 v-19.5 Z" fill="#fff8e9"/>
        <path d="M32 31 c1.8 2.2, 2.5 3.3, 2.5 4.5 a2.5 2.5 0 0 1 -5 0 c0 -1.2, 0.7 -2.3, 2.5 -4.5 Z" fill="#28543b"/>
        <circle cx="31.2" cy="34" r="0.6" fill="#fffdf6"/>
        <path d="M28 27 v16" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
        <path d="M18 51 c3.5 -4, 8.5 -4.5, 11 -2 c-2 3.5 -6 5 -11 2 Z" fill="#a8b99a"/>
        <path d="M46 51 c-3.5 -4, -8.5 -4.5, -11 -2 c2 3.5, 6 5, 11 2 Z" fill="#a8b99a"/>
      </g>
      <circle cx="32" cy="32" r="28" fill="none" stroke="#f2cb70" stroke-width="0.9" stroke-dasharray="2.5 2" opacity="0.75"/>
    </svg>
  `;

  const brandMark = `
    <span class="brand-mark" aria-hidden="true">
      ${brandLogoSVG}
    </span>
    <span class="brand-word">Meadowly<small>Dairy Farm &amp; Fresh Milk</small></span>
  `;

  const headerHTML = `
    <header class="site-header is-loading" data-site-header>
      <div class="utility-bar">
        <div class="container utility-inner">
          <p><span class="live-dot" aria-hidden="true"></span> Morning milking is underway · deliveries 5:30–6:30 AM</p>
          <div class="utility-links">
            <a href="contact.html#delivery">${icon("map-pin")} Check your area</a>
            <a href="tel:+919000012345">${icon("phone")} +91 90000 12345</a>
          </div>
        </div>
      </div>
      <div class="container">
        <div class="nav-wrap">
          <a class="brand" href="index.html" aria-label="Meadowly Dairy Co. — home">${brandMark}</a>
          <nav class="main-nav" aria-label="Primary navigation">
            <ul class="nav-list">
              <li><a class="nav-link" href="index.html">Home</a></li>
              <li><a class="nav-link" href="home-2.html">Home 2</a></li>
              <li><a class="nav-link" href="about.html">About</a></li>
              <li data-section="products product-details"><a class="nav-link" href="products.html">Products</a></li>
              <li><a class="nav-link" href="sourcing.html">Farm sourcing</a></li>
              <li><a class="nav-link" href="subscription.html">Plans</a></li>
              <li><a class="nav-link" href="pricing.html">Pricing</a></li>
              <li data-section="blog blog-details"><a class="nav-link" href="blog.html">Blog</a></li>
              <li><a class="nav-link" href="contact.html">Contact</a></li>
            </ul>
          </nav>
          <div class="header-actions">
            <button class="icon-btn box-btn" type="button" data-cart-open data-box-link aria-label="Open morning delivery box" aria-expanded="false" aria-controls="boxCartDrawer">
              ${icon("box")}<span class="box-count" data-box-count>0</span>
            </button>
            <button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle theme">
              ${icon("moon")}
            </button>
            <button class="icon-btn rtl-toggle" type="button" data-dir-toggle aria-label="Switch direction">
              <span data-dir-label>RTL</span>
            </button>
            <div class="profile-menu has-dd" data-profile-menu>
              <button class="icon-btn profile-toggle" type="button" aria-expanded="false" aria-haspopup="true" aria-label="Account profile">
                ${icon("user")}
              </button>
              <div class="nav-dd profile-dd" role="menu">
                <div class="profile-dd__head">
                  <span class="profile-dd__badge">Account</span>
                </div>
                <a href="login.html" role="menuitem">
                  <div>
                    <strong>Login</strong>
                    <small>Sign in to your morning account</small>
                  </div>
                  ${icon("arrow-right", "icon icon--sm")}
                </a>
                <a href="signup.html" role="menuitem">
                  <div>
                    <strong>Signup</strong>
                    <small>Create an account to get started</small>
                  </div>
                  ${icon("arrow-right", "icon icon--sm")}
                </a>
                <a href="dashboard.html" role="menuitem">
                  <div>
                    <strong>Subscriber Dashboard</strong>
                    <small>Deliveries, pause &amp; invoices</small>
                  </div>
                  ${icon("arrow-right", "icon icon--sm")}
                </a>
                <a href="admin.html" role="menuitem">
                  <div>
                    <strong>Admin Dashboard</strong>
                    <small>Operations &amp; daily dispatch</small>
                  </div>
                  ${icon("arrow-right", "icon icon--sm")}
                </a>
              </div>
            </div>
            <a class="btn btn--primary btn--sm header-cta" href="subscription.html">Build my box</a>
            <button class="menu-toggle" type="button" data-menu-open aria-controls="navDrawer" aria-expanded="false" aria-label="Open menu">
              ${icon("menu")}
            </button>
          </div>
        </div>
      </div>
    </header>
    <div class="drawer-backdrop" data-drawer-backdrop></div>
    <aside class="nav-drawer" id="navDrawer" aria-label="Mobile navigation" aria-hidden="true">
      <div class="drawer-head">
        <a class="brand" href="index.html">${brandMark}</a>
        <button class="icon-btn" type="button" data-menu-close aria-label="Close menu">${icon("close")}</button>
      </div>
      <nav class="drawer-nav" aria-label="Mobile primary navigation">
        <span class="drawer-label">Menu</span>
        <a href="index.html">Home ${icon("arrow-right")}</a>
        <a href="home-2.html">Home 2 ${icon("arrow-right")}</a>
        <a href="about.html">About ${icon("arrow-right")}</a>
        <a href="products.html">Products ${icon("arrow-right")}</a>
        <a href="sourcing.html">Farm sourcing ${icon("arrow-right")}</a>
        <a href="subscription.html">Plans ${icon("arrow-right")}</a>
        <a href="pricing.html">Pricing ${icon("arrow-right")}</a>
        <a href="blog.html">Blog ${icon("arrow-right")}</a>
        <a href="contact.html">Contact ${icon("arrow-right")}</a>
        <span class="drawer-label">Account</span>
        <a href="login.html">Login ${icon("arrow-right")}</a>
        <a href="signup.html">Signup ${icon("arrow-right")}</a>
        <a href="dashboard.html">Subscriber Dashboard ${icon("arrow-right")}</a>
        <a href="admin.html">Admin Dashboard ${icon("arrow-right")}</a>
      </nav>
      <div class="drawer-actions">
        <div class="drawer-tools">
          <button class="icon-btn box-btn" type="button" data-cart-open aria-label="Open morning delivery box">
            ${icon("box")}<span class="box-count" data-box-count>0</span>
          </button>
          <button class="icon-btn" type="button" data-theme-toggle aria-label="Toggle theme">${icon("moon")}</button>
          <button class="icon-btn rtl-toggle" type="button" data-dir-toggle aria-label="Switch direction">
            <span data-dir-label>RTL</span>
          </button>
        </div>
        <a class="btn btn--primary btn--block" href="subscription.html">Build my morning box</a>
        <p class="drawer-note">Fresh from Nilgiris partner farms. Bottled at dawn, delivered by 6:30 AM across Coimbatore.</p>
      </div>
    </aside>

    <div class="cart-backdrop" data-cart-backdrop aria-hidden="true"></div>
    <aside class="cart-drawer" id="boxCartDrawer" aria-label="Morning Delivery Box" aria-hidden="true">
      <div class="cart-drawer__head">
        <div class="cart-drawer__brand">
          <span class="cart-drawer__icon">${icon("milk")}</span>
          <div>
            <h2 class="cart-drawer__title">Morning Delivery Box</h2>
            <p class="cart-drawer__subtitle">Sunrise drop · 5:30 – 6:30 AM</p>
          </div>
        </div>
        <button class="icon-btn" type="button" data-cart-close aria-label="Close morning box">${icon("close")}</button>
      </div>
      <div class="cart-drawer__body">
        <div class="cart-drawer__banner">
          <span class="banner-badge"><span class="live-dot" aria-hidden="true"></span> Tomorrow's Sunrise</span>
          <p>Bottled at dawn in Nilgiris · Delivered in returnable glass bottles.</p>
        </div>
        <div class="cart-drawer__content" data-cart-items-container>
          <!-- Rendered dynamically -->
        </div>
        <div class="cart-drawer__quick-add">
          <div class="quick-add__head">
            <h3>Quick Add Essentials</h3>
            <small>Fresh for tomorrow</small>
          </div>
          <div class="quick-add__list" data-cart-quick-add-list>
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>
      <div class="cart-drawer__footer" data-cart-footer>
        <div class="cart-summary">
          <div class="cart-summary__row">
            <span>Items subtotal</span>
            <strong data-cart-subtotal>₹0</strong>
          </div>
          <div class="cart-summary__row">
            <span>Sunrise delivery</span>
            <span class="free-tag">FREE</span>
          </div>
          <div class="cart-summary__row">
            <span>Glass bottle deposit</span>
            <span class="deposit-tag">₹0 (Return at door)</span>
          </div>
          <div class="cart-summary__divider"></div>
          <div class="cart-summary__row cart-summary__total">
            <span>Estimated daily total</span>
            <strong class="total-amount" data-cart-total>₹0</strong>
          </div>
        </div>
        <div class="cart-actions">
          <a class="btn btn--primary btn--block btn--lg cart-checkout-btn" href="subscription.html">
            Proceed with Morning Box ${icon("arrow-right")}
          </a>
          <div class="cart-subactions">
            <a class="btn btn--outline btn--sm" href="dashboard.html#my-box">
              ${icon("box")} Manage in Dashboard
            </a>
            <button class="cart-clear-btn" type="button" data-cart-clear>
              Clear box
            </button>
          </div>
        </div>
      </div>
    </aside>
  `;

  const footerHTML = `
    <footer class="site-footer" role="contentinfo">
      <div class="container">
        <div class="footer-grid">
          <!-- Column 1: Company -->
          <div class="footer-col footer-col--company">
            <div class="footer-brand">
              <a class="brand" href="index.html" aria-label="Meadowly Dairy Co. — home">${brandMark}</a>
              <p class="footer-description">
                Small-batch, single-origin dairy from certified Nilgiris partner farms. Bottled at dawn and delivered fresh in returnable glass bottles by 6:30 AM across Coimbatore.
              </p>
              <div class="footer-socials" aria-label="Social media channels">
                <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Meadowly on Instagram">${icon("instagram")}</a>
                <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Meadowly on Facebook">${icon("facebook")}</a>
                <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="Meadowly on X (Twitter)">${icon("x")}</a>
                <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="Meadowly on YouTube">${icon("youtube")}</a>
              </div>
            </div>
          </div>

          <!-- Column 2: Quick Links (Matches exact navbar order & labels) -->
          <div class="footer-col footer-col--links">
            <h3 class="footer-heading">Quick Links</h3>
            <ul class="footer-links" role="list">
              <li><a href="index.html">Home</a></li>
              <li><a href="home-2.html">Home 2</a></li>
              <li><a href="about.html">About</a></li>
              <li><a href="products.html">Products</a></li>
              <li><a href="sourcing.html">Farm sourcing</a></li>
              <li><a href="subscription.html">Plans</a></li>
              <li><a href="pricing.html">Pricing</a></li>
              <li><a href="blog.html">Blog</a></li>
              <li><a href="contact.html">Contact</a></li>
            </ul>
          </div>

          <!-- Column 3: Contact Details -->
          <div class="footer-col footer-col--contact">
            <h3 class="footer-heading">Contact Us</h3>
            <ul class="footer-contact-list" role="list">
              <li class="footer-contact-item">
                <span class="footer-contact-icon" aria-hidden="true">${icon("map-pin")}</span>
                <div class="footer-contact-text">
                  <strong>Farm &amp; Dairy Desk</strong>
                  <a href="contact.html#visit">Meadowly Dairy Co., Anaikatti Road, Coimbatore 641 108</a>
                </div>
              </li>
              <li class="footer-contact-item">
                <span class="footer-contact-icon" aria-hidden="true">${icon("phone")}</span>
                <div class="footer-contact-text">
                  <strong>Phone Support</strong>
                  <a href="tel:+914224001880">+91 422 400 1880</a>
                </div>
              </li>
              <li class="footer-contact-item">
                <span class="footer-contact-icon" aria-hidden="true">${icon("mail")}</span>
                <div class="footer-contact-text">
                  <strong>Email Desk</strong>
                  <a href="mailto:care@meadowly.in">care@meadowly.in</a>
                </div>
              </li>
              <li class="footer-contact-item">
                <span class="footer-contact-icon" aria-hidden="true">${icon("clock")}</span>
                <div class="footer-contact-text">
                  <strong>Working Hours</strong>
                  <span>7:00 AM – 8:00 PM · Every day</span>
                </div>
              </li>
            </ul>
          </div>

          <!-- Column 4: Newsletter -->
          <div class="footer-col footer-col--newsletter">
            <h3 class="footer-heading">Newsletter</h3>
            <p class="footer-newsletter-desc">
              Subscribe to receive the latest updates, sunrise delivery notes, seasonal offers, and fresh dairy insights.
            </p>
            <form class="newsletter-form js-newsletter" novalidate>
              <label class="sr-only" for="footerNewsletterEmail">Email address</label>
              <input id="footerNewsletterEmail" name="email" type="email" placeholder="Your email address" autocomplete="email" required>
              <button class="btn btn--butter btn--sm" type="submit">Subscribe</button>
            </form>
            <p class="footer-fine">No spam. Low-volume morning updates. Unsubscribe anytime.</p>
          </div>
        </div>

        <!-- Bottom Legal & Copyright Bar -->
        <div class="footer-bottom">
          <p class="footer-copy">© <span data-year>2026</span> Meadowly Dairy Co. All rights reserved.</p>
          <div class="footer-legal">
            <a href="contact.html#privacy">Privacy Policy</a>
            <span class="footer-legal__sep" aria-hidden="true">|</span>
            <a href="contact.html#terms">Terms &amp; Conditions</a>
            <span class="footer-legal__sep" aria-hidden="true">|</span>
            <a href="404.html#shortcuts">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  `;

  function injectShell() {
    const headerHost = qs("#site-header");
    const footerHost = qs("#site-footer");
    if (headerHost) {
      headerHost.innerHTML = headerHTML;
      const measureHeader = () => {
        const rect = headerHost.getBoundingClientRect();
        const h = rect.height || headerHost.offsetHeight;
        if (h > 0) {
          document.documentElement.style.setProperty("--header-actual-h", `${Math.round(h)}px`);
        }
      };
      measureHeader();
      window.addEventListener("resize", measureHeader, { passive: true });
    }
    if (footerHost) footerHost.innerHTML = footerHTML;

    if (!qs(".skip-link")) {
      body.insertAdjacentHTML(
        "afterbegin",
        `<a class="skip-link" href="#main">Skip to main content</a>`
      );
    }

    if (!qs(".back-to-top") && !body.classList.contains("auth-page") && body.dataset.page !== "login" && body.dataset.page !== "signup") {
      body.insertAdjacentHTML(
        "beforeend",
        `<button class="back-to-top" type="button" aria-label="Back to top">${icon("arrow-right")}</button>`
      );
    }

    ensureToastStack();
    markCurrentPage();
    updateBoxCounts();
    renderCartDrawer();
    updateThemeControls();
    updateDirControls();
  }

  function markCurrentPage() {
    const filename = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    const scope = [qs("[data-site-header]"), qs(".nav-drawer"), qs(".site-footer")].filter(Boolean);
    scope.forEach((container) => {
      qsa("a[href]", container).forEach((link) => {
        const href = (link.getAttribute("href") || "").split("#")[0].toLowerCase();
        if (href && href === filename) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
      qsa("[data-section]", container).forEach((item) => {
        const pages = (item.dataset.section || "").split(" ");
        const trigger = qs(".nav-link", item) || (item.matches(".nav-link") ? item : null);
        if (trigger && pages.includes(page)) trigger.setAttribute("aria-current", "page");
      });
    });
  }

  /* ---------- Navigation ---------- */
  function initNavigation() {
    const drawer = qs(".nav-drawer");
    const backdrop = qs("[data-drawer-backdrop]");
    const openButton = qs("[data-menu-open]");
    const closeButton = qs("[data-menu-close]");

    const openDrawer = () => {
      if (!drawer) return;
      drawer.classList.add("is-open");
      if (backdrop) backdrop.classList.add("is-open");
      body.classList.add("menu-open");
      drawer.setAttribute("aria-hidden", "false");
      if (openButton) openButton.setAttribute("aria-expanded", "true");
      if (closeButton) closeButton.focus();
    };

    const closeDrawer = closeNavDrawer;

    if (openButton) openButton.addEventListener("click", openDrawer);
    if (closeButton) closeButton.addEventListener("click", closeDrawer);
    if (backdrop) backdrop.addEventListener("click", closeDrawer);
    qsa("a", drawer || document.createElement("div")).forEach((link) => {
      link.addEventListener("click", closeDrawer);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDrawer();
        closeCartDrawer();
        qsa(".has-dd.is-open").forEach((item) => {
          item.classList.remove("is-open");
          const trigger = qs("button", item);
          if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
      }
    });

    qsa(".has-dd").forEach((item) => {
      const trigger = qs("button", item);
      if (!trigger) return;
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = item.classList.contains("is-open");
        qsa(".has-dd.is-open").forEach((other) => {
          if (other !== item) {
            other.classList.remove("is-open");
            const otherTrigger = qs("button", other);
            if (otherTrigger) otherTrigger.setAttribute("aria-expanded", "false");
          }
        });
        item.classList.toggle("is-open", !isOpen);
        trigger.setAttribute("aria-expanded", String(!isOpen));
      });

      trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          item.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
          const firstLink = qs("a", item);
          if (firstLink) firstLink.focus();
        }
      });

      qsa("a", item).forEach((link) => {
        link.addEventListener("click", () => {
          item.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        });
      });
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".has-dd")) {
        qsa(".has-dd.is-open").forEach((item) => {
          item.classList.remove("is-open");
          const trigger = qs("button", item);
          if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
      }
    });

    const header = qs("[data-site-header]");
    if (header) {
      let isScrolled = false;
      const updateScroll = () => {
        const y = window.scrollY || window.pageYOffset || 0;
        if (!isScrolled && y > 40) {
          isScrolled = true;
          header.classList.add("is-scrolled");
        } else if (isScrolled && y < 15) {
          isScrolled = false;
          header.classList.remove("is-scrolled");
        }
      };
      updateScroll();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          header.classList.remove("is-loading");
        });
      });
      window.addEventListener("scroll", updateScroll, { passive: true });
    }

    const backToTop = qs(".back-to-top");
    if (backToTop) {
      const onScroll = () => backToTop.classList.toggle("is-visible", window.scrollY > 700);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }
  }

  /* ---------- Cart Drawer Interaction ---------- */
  function initCartDrawer() {
    qsa("[data-cart-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openCartDrawer();
      });
    });

    const closeBtn = qs("[data-cart-close]");
    if (closeBtn) closeBtn.addEventListener("click", closeCartDrawer);

    const backdrop = qs("[data-cart-backdrop]");
    if (backdrop) backdrop.addEventListener("click", closeCartDrawer);

    const drawer = qs("#boxCartDrawer");
    if (drawer) {
      drawer.addEventListener("click", (e) => {
        const incBtn = e.target.closest("[data-cart-qty-inc]");
        if (incBtn) {
          e.preventDefault();
          updateBoxQty(incBtn.dataset.cartQtyInc, 1);
          return;
        }

        const decBtn = e.target.closest("[data-cart-qty-dec]");
        if (decBtn) {
          e.preventDefault();
          updateBoxQty(decBtn.dataset.cartQtyDec, -1);
          return;
        }

        const remBtn = e.target.closest("[data-cart-remove]");
        if (remBtn) {
          e.preventDefault();
          removeFromBox(remBtn.dataset.cartRemove);
          return;
        }

        const quickAddBtn = e.target.closest("[data-cart-quick-add]");
        if (quickAddBtn) {
          e.preventDefault();
          addToBox(quickAddBtn.dataset.cartQuickAdd, 1);
          return;
        }

        const clearBtn = e.target.closest("[data-cart-clear]");
        if (clearBtn) {
          e.preventDefault();
          clearBox();
          return;
        }
      });
    }
  }

  /* ---------- Reveal & counters ---------- */
  function initReveal() {
    const items = qsa(".reveal");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px" }
    );

    items.forEach((item) => observer.observe(item));
  }

  function animateCounter(element) {
    const target = Number(element.dataset.count) || 0;
    const decimals = Number(element.dataset.decimals) || 0;
    const prefix = element.dataset.prefix || "";
    const suffix = element.dataset.suffix || "";
    const duration = reduceMotion ? 0 : 1500;
    const start = performance.now();
    const formatter = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    const tick = (now) => {
      const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      element.textContent = `${prefix}${formatter.format(value)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  function initCounters() {
    const counters = qsa("[data-count]");
    if (!counters.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      counters.forEach((counter) => {
        const target = Number(counter.dataset.count) || 0;
        const decimals = Number(counter.dataset.decimals) || 0;
        const prefix = counter.dataset.prefix || "";
        const suffix = counter.dataset.suffix || "";
        counter.textContent = `${prefix}${new Intl.NumberFormat("en-IN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }).format(target)}${suffix}`;
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.45 }
    );

    counters.forEach((counter) => {
      counter.textContent = "0";
      observer.observe(counter);
    });
  }

  /* ---------- Accordions & tabs ---------- */
  function initAccordions() {
    qsa(".acc-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        const group = button.closest("[data-accordion]");
        if (group && group.dataset.single === "true" && !expanded) {
          qsa(".acc-btn", group).forEach((other) => other.setAttribute("aria-expanded", "false"));
        }
        button.setAttribute("aria-expanded", String(!expanded));
      });
    });
  }

  function initTabs() {
    qsa("[data-tabs]").forEach((group) => {
      const tabs = qsa("[data-tab]", group);
      const panels = qsa("[data-tab-panel]", group);
      if (!tabs.length) return;

      const activate = (name, focus = false) => {
        tabs.forEach((tab) => {
          const active = tab.dataset.tab === name;
          tab.setAttribute("aria-selected", String(active));
          tab.tabIndex = active ? 0 : -1;
          if (active && focus) tab.focus();
        });
        panels.forEach((panel) => {
          const active = panel.dataset.tabPanel === name;
          panel.hidden = !active;
          panel.classList.toggle("is-active", active);
        });
      };

      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab.dataset.tab));
        tab.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const next = tabs[(index + direction + tabs.length) % tabs.length];
          activate(next.dataset.tab, true);
        });
      });

      const initial = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
      activate(initial.dataset.tab);
    });
  }

  /* ---------- Qty, add-to-box, wishlist ---------- */
  function initQuantity() {
    qsa(".qty").forEach((qty) => {
      const valueElement = qs("[data-qty-value]", qty);
      if (!valueElement) return;
      const min = Number(qty.dataset.min || valueElement.getAttribute("min") || 1);
      const max = Number(qty.dataset.max || valueElement.getAttribute("max") || 20);

      const update = (next, notify = true) => {
        const capped = Math.max(min, Math.min(max, Number(next) || min));
        valueElement.value = String(capped);
        if (valueElement.tagName === "OUTPUT") valueElement.textContent = String(capped);
        if (notify) {
          qty.dispatchEvent(
            new CustomEvent("qtychange", { bubbles: true, detail: { value: capped } })
          );
        }
      };

      if (valueElement.tagName === "INPUT") {
        valueElement.addEventListener("change", () => update(valueElement.value));
      }

      qsa("[data-qty]", qty).forEach((button) => {
        button.addEventListener("click", () => {
          const current = Number(valueElement.value || valueElement.textContent) || min;
          update(current + (button.dataset.qty === "plus" ? 1 : -1));
        });
      });
    });
  }

  function initCommerce() {
    qsa("[data-add]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const card = button.closest(".product-card, .pdp-info, .box-builder");
        const qty = card ? qs("[data-qty-value]", card) : null;
        const quantity = qty ? Number(qty.value || qty.textContent) || 1 : 1;
        addToBox(button.dataset.add, quantity);
      });
    });

    qsa("[data-wish]").forEach((button) => {
      const name = button.dataset.wish;
      if (getWishlist().includes(name)) {
        button.classList.add("is-active");
        button.setAttribute("aria-pressed", "true");
      }
      button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(name, button);
      });
    });
  }

  /* ---------- Forms & newsletter ---------- */
  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value).trim());
  }

  function markInvalid(field, message) {
    if (!field) return;
    const wrapper = field.closest(".field") || field.parentElement;
    if (wrapper) wrapper.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");
    const error = wrapper ? qs(".error-text", wrapper) : null;
    if (error && message) error.textContent = message;
  }

  function clearInvalid(field) {
    if (!field) return;
    const wrapper = field.closest(".field") || field.parentElement;
    if (wrapper) wrapper.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");
  }

  function initNewsletterForms() {
    qsa(".js-newsletter").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = qs('input[type="email"]', form);
        if (!input) return;
        if (!isEmail(input.value)) {
          markInvalid(input, "Enter a valid email address.");
          input.focus();
          return;
        }
        clearInvalid(input);
        showToast("You're on the Sunday Pour list", "A little meadow calm will arrive in your inbox each Sunday.");
        form.reset();
      });

      const input = qs("input", form);
      if (input) input.addEventListener("input", () => clearInvalid(input));
    });
  }

  function initCopyButtons() {
    qsa("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const text = button.dataset.copy || "";
        try {
          await navigator.clipboard.writeText(text);
          showToast("Copied to clipboard", text);
        } catch (error) {
          showToast("Could not copy", "Please copy the code manually.", "error");
        }
      });
    });
  }

  function initDemoButtons() {
    qsa("[data-demo]").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        showToast("This is a demo experience", "Your details are never sent from this prototype.");
      });
    });
  }

  /* ---------- Footer year ---------- */
  function initYear() {
    qsa("[data-year]").forEach((node) => {
      node.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------- Page transitions & history restoration ---------- */
  function initInternalLinks() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#")) return;

      // Close open drawers when navigating to prevent trapped UI states
      if (body.classList.contains("menu-open")) {
        closeNavDrawer();
      }
      if (body.classList.contains("cart-open")) {
        closeCartDrawer();
      }
    });

    // Handle Back/Forward cache (bfcache) restoration without white screens or stuck classes
    window.addEventListener("pageshow", (event) => {
      body.classList.remove("page-leaving", "menu-open", "cart-open");
      const cartBackdrop = qs("[data-cart-backdrop]");
      if (cartBackdrop) cartBackdrop.classList.remove("is-open");
      const cartDrawer = qs("#boxCartDrawer");
      if (cartDrawer) cartDrawer.classList.remove("is-open");
      const navBackdrop = qs("[data-drawer-backdrop]");
      if (navBackdrop) navBackdrop.classList.remove("is-open");
      const navDrawer = qs(".nav-drawer");
      if (navDrawer) navDrawer.classList.remove("is-open");

      if (event.persisted) {
        markCurrentPage();
        updateBoxCounts();
        renderCartDrawer();
      }
    });

    window.addEventListener("pagehide", () => {
      body.classList.remove("page-leaving", "menu-open", "cart-open");
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    injectShell();
    initThemeAndDirection();
    initNavigation();
    initCartDrawer();
    initReveal();
    initCounters();
    initAccordions();
    initTabs();
    initQuantity();
    initCommerce();
    initNewsletterForms();
    initCopyButtons();
    initDemoButtons();
    initYear();
    initInternalLinks();
  });

  window.MeadowlyUI = {
    toast: showToast,
    formatINR,
    isEmail,
    markInvalid,
    clearInvalid,
    getBox,
    addToBox,
    removeFromBox,
    updateBoxQty,
    clearBox,
    openCart: openCartDrawer,
    closeCart: closeCartDrawer,
    renderCart: renderCartDrawer,
    updateBoxCounts,
    getBoxCount,
    icon
  };
})();
