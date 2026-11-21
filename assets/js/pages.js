/* =========================================================
   Meadowly — Page interactions
   ========================================================= */
(function () {
  "use strict";

  const ui = window.MeadowlyUI || {};
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const page = document.body.dataset.page || "";

  const toast = (title, message, type) =>
    ui.toast ? ui.toast(title, message, type) : undefined;
  const formatINR = (value) =>
    ui.formatINR
      ? ui.formatINR(value)
      : `₹${new Intl.NumberFormat("en-IN").format(Number(value) || 0)}`;

  /* ---------- Home hero slider ---------- */
  function initHeroSlider() {
    const slider = $("[data-hero-slider]");
    if (!slider) return;
    const slides = $$(".hero-slide", slider);
    const dots = $$("[data-hero-dot]", slider);
    const currentLabel = $("[data-hero-current]", slider);
    if (!slides.length) return;

    let index = 0;
    let timer = null;

    const show = (nextIndex, autoplay = true) => {
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("is-active", slideIndex === index);
        slide.setAttribute("aria-hidden", String(slideIndex !== index));
      });
      dots.forEach((dot, dotIndex) => {
        dot.setAttribute("aria-selected", String(dotIndex === index));
        dot.setAttribute("tabindex", dotIndex === index ? "0" : "-1");
      });
      if (currentLabel) currentLabel.textContent = String(index + 1).padStart(2, "0");
      restart(autoplay);
    };

    const restart = (enabled = true) => {
      window.clearInterval(timer);
      if (!enabled || reduceMotion) return;
      timer = window.setInterval(() => show(index + 1), 7200);
    };

    dots.forEach((dot, dotIndex) => {
      dot.addEventListener("click", () => show(dotIndex));
    });

    const previous = $("[data-hero-prev]", slider);
    const next = $("[data-hero-next]", slider);
    if (previous) previous.addEventListener("click", () => show(index - 1));
    if (next) next.addEventListener("click", () => show(index + 1));

    slider.addEventListener("mouseenter", () => window.clearInterval(timer));
    slider.addEventListener("mouseleave", () => restart());

    let touchStart = 0;
    slider.addEventListener(
      "touchstart",
      (event) => {
        touchStart = event.changedTouches[0].clientX;
      },
      { passive: true }
    );
    slider.addEventListener(
      "touchend",
      (event) => {
        const delta = event.changedTouches[0].clientX - touchStart;
        if (Math.abs(delta) < 40) return;
        show(index + (delta < 0 ? 1 : -1));
      },
      { passive: true }
    );

    slider.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") show(index - 1);
      if (event.key === "ArrowRight") show(index + 1);
    });

    show(0);
  }

  /* ---------- Product catalog ---------- */
  function initCatalog() {
    const grid = $("#catalogGrid");
    if (!grid) return;
    const cards = $$(".product-card[data-name]", grid);
    const chips = $$("[data-filter]");
    const search = $("#catalogSearch");
    const sort = $("#catalogSort");
    const count = $("#catalogCount");
    const empty = $("#catalogEmpty");
    let activeFilter = "all";

    const apply = () => {
      const term = (search ? search.value : "").trim().toLowerCase();
      const mode = sort ? sort.value : "featured";
      const visible = [];

      cards.forEach((card) => {
        const category = card.dataset.category || "";
        const searchText = `${card.dataset.name || ""} ${card.dataset.keywords || ""}`.toLowerCase();
        const show = (activeFilter === "all" || category === activeFilter) && (!term || searchText.includes(term));
        card.hidden = !show;
        if (show) visible.push(card);
      });

      const sorted = visible.slice().sort((a, b) => {
        if (mode === "price-low") return Number(a.dataset.price) - Number(b.dataset.price);
        if (mode === "price-high") return Number(b.dataset.price) - Number(a.dataset.price);
        if (mode === "rating") return Number(b.dataset.rating) - Number(a.dataset.rating);
        return Number(a.dataset.order || 0) - Number(b.dataset.order || 0);
      });

      sorted.forEach((card) => grid.appendChild(card));

      if (count) {
        count.textContent = `${visible.length} ${visible.length === 1 ? "fresh pick" : "fresh picks"}`;
      }
      if (empty) empty.classList.toggle("is-visible", visible.length === 0);
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        activeFilter = chip.dataset.filter || "all";
        chips.forEach((other) => {
          const active = other === chip;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", String(active));
        });
        apply();
      });
    });

    if (search) search.addEventListener("input", apply);
    if (sort) sort.addEventListener("change", apply);
    apply();
  }

  /* ---------- Product detail ---------- */
  function initPDP() {
    const mainImage = $("#pdpMainImage");
    if (!mainImage) return;

    const thumbs = $$("[data-pdp-thumb]");
    thumbs.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        thumbs.forEach((item) => item.classList.remove("is-active"));
        thumb.classList.add("is-active");
        const nextSrc = thumb.dataset.src;
        if (!nextSrc) return;
        mainImage.style.opacity = "0.55";
        window.setTimeout(() => {
          mainImage.src = nextSrc;
          mainImage.alt = thumb.dataset.alt || mainImage.alt;
          mainImage.style.opacity = "1";
        }, 130);
      });
    });

    let basePrice = Number($("[data-size].is-active")?.dataset.price || 78);
    let purchaseMode = "subscribe";
    const price = $("[data-pdp-price]");
    const period = $("[data-pdp-period]");
    const strike = $("[data-pdp-strike]");

    const paintPrice = () => {
      const discount = purchaseMode === "subscribe" ? 0.9 : 1;
      const finalPrice = Math.round(basePrice * discount);
      if (price) price.textContent = formatINR(finalPrice);
      if (strike) {
        strike.textContent = purchaseMode === "subscribe" ? formatINR(basePrice) : "";
        strike.hidden = purchaseMode !== "subscribe";
      }
      if (period) period.textContent = purchaseMode === "subscribe" ? "/ delivery · save 10%" : "/ bottle";
    };

    $$("[data-size]").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("[data-size]").forEach((item) => item.classList.remove("is-active"));
        chip.classList.add("is-active");
        basePrice = Number(chip.dataset.price) || basePrice;
        paintPrice();
      });
    });

    $$("[data-purchase]").forEach((button) => {
      button.addEventListener("click", () => {
        $$("[data-purchase]").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        purchaseMode = button.dataset.purchase || "subscribe";
        paintPrice();
      });
    });

    paintPrice();
  }

  /* ---------- Billing toggle ---------- */
  function initBilling() {
    const buttons = $$("[data-billing]");
    if (!buttons.length) return;

    const paint = (mode) => {
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.billing === mode));
      });
      $$("[data-plan-price]").forEach((price) => {
        const value = mode === "annual" ? price.dataset.annual : price.dataset.monthly;
        if (value) price.textContent = value;
      });
      $$("[data-plan-note]").forEach((note) => {
        const value = mode === "annual" ? note.dataset.annualNote : note.dataset.monthlyNote;
        if (value) note.textContent = value;
      });
      $$("[data-billing-period]").forEach((period) => {
        period.textContent = mode === "annual" ? "/ month · billed yearly" : "/ month";
      });
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => paint(button.dataset.billing));
    });
    paint("monthly");
  }

  /* ---------- Subscription builder ---------- */
  function initBoxBuilder() {
    const builder = $("#boxBuilder");
    if (!builder) return;
    const items = $$("[data-box-item]", builder);
    const list = $("#builderList");
    const total = $("#builderTotal");
    const summaryFrequency = $("#builderFrequency");
    const frequencyLabel = $("#builderFrequencyLabel");
    const dayButtons = $$("[data-delivery-day]");
    let multiplier = 30;
    let frequencyText = "Every morning";
    let dayText = "Mon · Wed · Sat";

    const update = () => {
      const selected = items.filter((item) => item.checked);
      if (list) {
        if (!selected.length) {
          list.innerHTML = `<p class="muted" style="font-size:.72rem;">Choose at least one bottle or pot to begin.</p>`;
        } else {
          list.innerHTML = selected
            .map((item) => {
              const line = Number(item.dataset.price) * multiplier;
              return `
                <div class="builder-summary__row">
                  <span>${item.dataset.name}</span>
                  <strong>${formatINR(line)}</strong>
                </div>
              `;
            })
            .join("");
        }
      }
      const sum = selected.reduce((running, item) => running + Number(item.dataset.price) * multiplier, 0);
      if (total) total.textContent = formatINR(sum);
      if (frequencyLabel) frequencyLabel.textContent = `${frequencyText} · ${dayText}`;
      if (summaryFrequency) summaryFrequency.textContent = `${multiplier} deliveries`;
    };

    items.forEach((item) => item.addEventListener("change", update));

    $$("[data-frequency]", builder).forEach((button) => {
      button.addEventListener("click", () => {
        $$("[data-frequency]", builder).forEach((other) =>
          other.setAttribute("aria-pressed", String(other === button))
        );
        multiplier = Number(button.dataset.frequency) || 30;
        frequencyText = button.dataset.label || button.textContent.trim();
        update();
      });
    });

    dayButtons.forEach((button) => {
      button.addEventListener("click", () => {
        dayButtons.forEach((other) => other.classList.remove("is-active"));
        button.classList.add("is-active");
        dayText = button.dataset.deliveryDay || button.textContent.trim();
        update();
      });
    });

    const addButton = $("[data-builder-add]", builder);
    if (addButton) {
      addButton.addEventListener("click", () => {
        const selected = items.filter((item) => item.checked);
        if (!selected.length) {
          toast("Your box is still empty", "Select at least one dairy item to continue.", "error");
          return;
        }
        ui.addToBox
          ? ui.addToBox("Custom morning box", 1)
          : toast("Morning box saved", "Your custom rhythm has been saved.");
      });
    }

    update();
  }

  /* ---------- Pricing calculator ---------- */
  function initPricingCalculator() {
    const form = $("#pricingCalculator");
    if (!form) return;
    const litres = $("#calcLitres");
    const days = $("#calcDays");
    const litresOutput = $("#calcLitresValue");
    const daysOutput = $("#calcDaysValue");
    const plan = $("#calcType");
    const total = $("#calcTotal");
    const baseOutput = $("#calcBase");
    const savingsOutput = $("#calcSavings");
    const addonsOutput = $("#calcAddons");
    const addons = $$("[data-calc-addon]");

    const update = () => {
      const litresValue = Number(litres?.value || 2);
      const daysValue = Number(days?.value || 20);
      const rate = Number(plan?.value || 70);
      const base = litresValue * daysValue * rate;
      const savings = base * (daysValue >= 20 ? 0.08 : 0.05);
      const addonTotal = addons.reduce((sum, item) => sum + (item.checked ? Number(item.dataset.calcAddon) : 0), 0);
      const grandTotal = base - savings + addonTotal;

      if (litresOutput) litresOutput.textContent = `${litresValue.toFixed(1)} L`;
      if (daysOutput) daysOutput.textContent = `${daysValue} days`;
      if (baseOutput) baseOutput.textContent = formatINR(base);
      if (savingsOutput) savingsOutput.textContent = `− ${formatINR(savings)}`;
      if (addonsOutput) addonsOutput.textContent = formatINR(addonTotal);
      if (total) total.textContent = formatINR(grandTotal);
    };

    [litres, days, plan, ...addons].forEach((input) => {
      if (input) input.addEventListener("input", update);
      if (input) input.addEventListener("change", update);
    });
    update();
  }

  /* ---------- Blog filtering ---------- */
  function initBlog() {
    const grid = $("#blogGrid");
    if (!grid) return;
    const cards = $$(".post-card", grid);
    const filters = $$("[data-blog-filter]");
    const loadMore = $("#blogLoadMore");
    const count = $("#blogCount");
    const empty = $("#blogEmpty");
    let active = "all";
    let expanded = false;

    const apply = () => {
      const matches = cards.filter((card) => active === "all" || card.dataset.blogCategory === active);
      matches.forEach((card, index) => {
        card.hidden = !expanded && index >= 6;
      });
      cards.filter((card) => !matches.includes(card)).forEach((card) => {
        card.hidden = true;
      });
      if (count) count.textContent = `${matches.length} ${matches.length === 1 ? "story" : "stories"}`;
      if (empty) empty.classList.toggle("is-visible", matches.length === 0);
      if (loadMore) loadMore.hidden = expanded || matches.length <= 6;
    };

    filters.forEach((filter) => {
      filter.addEventListener("click", () => {
        filters.forEach((other) => {
          other.classList.toggle("is-active", other === filter);
          other.setAttribute("aria-pressed", String(other === filter));
        });
        active = filter.dataset.blogFilter || "all";
        expanded = false;
        apply();
      });
    });

    if (loadMore) {
      loadMore.addEventListener("click", () => {
        expanded = true;
        apply();
        toast("A few more meadow stories", "The rest of the journal is now on the page.");
      });
    }
    apply();
  }

  /* ---------- Contact & delivery checker ---------- */
  function initContact() {
    const pincodeForm = $("#pincodeForm");
    if (pincodeForm) {
      const input = $("#pincodeInput");
      const result = $("#pincodeResult");
      pincodeForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = (input?.value || "").trim();
        if (!/^6\d{5}$/.test(value)) {
          toast("Enter a 6-digit pincode", "Indian pincodes are six digits long.", "error");
          input?.focus();
          return;
        }
        const served = /^64[12]/.test(value);
        if (result) {
          result.classList.add("is-visible");
          result.innerHTML = `
            <div class="area-chip">
              <svg class="icon" aria-hidden="true"><use href="assets/icons.svg#${served ? "check-circle" : "map-pin"}"></use></svg>
              <div>
                <strong>${served ? "Yes, we deliver here." : "We're not in this neighbourhood yet."}</strong>
                <div class="muted" style="font-size:.68rem;margin-top:.15rem;">
                  ${
                    served
                      ? `Pincode ${value} sits on our morning route. Next available window: 5:30–6:30 AM.`
                      : `Pincode ${value} is outside our current route. Join the waitlist and we'll write when we arrive.`
                  }
                </div>
              </div>
            </div>
          `;
        }
        if (served) {
          toast("Good news — you're on the route", `Deliveries available for pincode ${value}.`);
        } else {
          toast("We're expanding", `We've noted pincode ${value} for our next route review.`);
        }
      });
    }

    const contactForm = $("#contactForm");
    if (contactForm) {
      contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("#contactName");
        const email = $("#contactEmail");
        const message = $("#contactMessage");
        let valid = true;

        if (!name || name.value.trim().length < 2) {
          ui.markInvalid?.(name, "Please share your name.");
          valid = false;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value)) {
          ui.markInvalid?.(email, "Enter a valid email address.");
          valid = false;
        }
        if (!message || message.value.trim().length < 10) {
          ui.markInvalid?.(message, "Tell us a little more (at least 10 characters).");
          valid = false;
        }
        if (!valid) {
          toast("A little more detail, please", "Check the highlighted fields and try again.", "error");
          return;
        }
        toast("Your note is on its way", "Our care team replies within one working day.");
        contactForm.reset();
      });

      $$("input, textarea, select", contactForm).forEach((field) => {
        field.addEventListener("input", () => ui.clearInvalid?.(field));
      });
    }
  }

  /* ---------- Auth ---------- */
  function initPasswordToggles() {
    $$("[data-password-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const field = $("input", button.closest(".password-field"));
        if (!field) return;
        const isPassword = field.type === "password";
        field.type = isPassword ? "text" : "password";
        button.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
        button.setAttribute("aria-pressed", String(isPassword));
        const use = $("use", button);
        if (use) use.setAttribute("href", `assets/icons.svg#${isPassword ? "eye-off" : "eye"}`);
      });
    });
  }

  function initLogin() {
    const form = $("#loginForm");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = $("#loginEmail");
      const password = $("#loginPassword");
      let valid = true;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
        ui.markInvalid?.(email, "Enter a valid email address.");
        valid = false;
      }
      if (!password || password.value.length < 6) {
        ui.markInvalid?.(password, "Your password needs at least 6 characters.");
        valid = false;
      }
      if (!valid) {
        toast("Check your details", "Please correct the highlighted fields.", "error");
        return;
      }

      try {
        const remember = form.elements["remember"]?.checked;
        localStorage.setItem("meadowly-user", JSON.stringify({
          email: email.value.trim(),
          remember: Boolean(remember),
          loggedIn: true,
          loginTime: new Date().toISOString()
        }));
      } catch (err) {}

      toast("Welcome back to Meadowly", "Opening your morning dashboard...");
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    });

    $$("input", form).forEach((input) => {
      input.addEventListener("input", () => ui.clearInvalid?.(input));
    });

    // Forgot password handler
    const forgotBtn = $(".js-forgot-password", form.parentElement);
    if (forgotBtn) {
      forgotBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const email = $("#loginEmail");
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
          toast("Password reset link sent", `Recovery instructions sent to ${email.value.trim()}`);
        } else {
          toast("Forgot password?", "Enter your registered email address above and click Forgot password again to receive a reset link.");
          email?.focus();
        }
      });
    }
  }

  function initSignup() {
    const form = $("#signupForm");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = $("#signupName");
      const email = $("#signupEmail");
      const phone = $("#signupPhone");
      const password = $("#signupPassword");
      const confirmPassword = $("#signupConfirmPassword");
      const terms = $("#signupTerms");
      let valid = true;

      if (!name || name.value.trim().length < 2) {
        ui.markInvalid?.(name, "Please enter your full name.");
        valid = false;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
        ui.markInvalid?.(email, "Enter a valid email address.");
        valid = false;
      }
      if (!phone || phone.value.replace(/\D/g, "").length < 10) {
        ui.markInvalid?.(phone, "Enter a valid 10-digit mobile number.");
        valid = false;
      }
      if (!password || password.value.length < 6) {
        ui.markInvalid?.(password, "Password must be at least 6 characters.");
        valid = false;
      }
      if (!confirmPassword || confirmPassword.value !== (password ? password.value : "")) {
        ui.markInvalid?.(confirmPassword, "Passwords do not match.");
        valid = false;
      }
      if (terms && !terms.checked) {
        ui.markInvalid?.(terms, "You must agree to the Terms & Privacy Policy.");
        valid = false;
      }

      if (!valid) {
        toast("Check your details", "Please correct the highlighted fields.", "error");
        return;
      }

      try {
        localStorage.setItem("meadowly-user", JSON.stringify({
          name: name.value.trim(),
          email: email.value.trim(),
          phone: phone.value.trim(),
          loggedIn: true,
          signupTime: new Date().toISOString()
        }));
      } catch (err) {}

      toast("Account created successfully!", "Opening your morning dashboard...");
      window.setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 900);
    });

    $$("input", form).forEach((input) => {
      input.addEventListener("input", () => ui.clearInvalid?.(input));
      input.addEventListener("change", () => ui.clearInvalid?.(input));
    });
  }

  /* ---------- Blog details ---------- */
  function initArticle() {
    const article = $(".article-body");
    if (!article) return;
    const progress = $("#readingProgressBar");

    if (progress) {
      const update = () => {
        const rect = article.getBoundingClientRect();
        const total = rect.height - window.innerHeight * 0.35;
        const scrolled = Math.min(Math.max(-rect.top + 120, 0), Math.max(total, 1));
        progress.style.width = `${Math.min((scrolled / total) * 100, 100)}%`;
      };
      update();
      window.addEventListener("scroll", update, { passive: true });
    }

    const headings = $$("h2[id]", article);
    const tocLinks = $$("[data-toc]", document);
    if (headings.length && tocLinks.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            tocLinks.forEach((link) =>
              link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`)
            );
          });
        },
        { rootMargin: "-25% 0px -60% 0px", threshold: 0.1 }
      );
      headings.forEach((heading) => observer.observe(heading));
    }

    $$("[data-share]").forEach((button) => {
      button.addEventListener("click", async () => {
        const shareData = {
          title: document.title,
          text: "A morning with our milk — from the Meadow Journal",
          url: window.location.href
        };
        try {
          if (navigator.share) {
            await navigator.share(shareData);
          } else {
            await navigator.clipboard.writeText(window.location.href);
            toast("Link copied", "Share a little meadow calm.");
          }
        } catch (error) {
          /* Sharing can be cancelled by the reader. */
        }
      });
    });

    const commentForm = $("#commentForm");
    if (commentForm) {
      commentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("#commentName");
        const message = $("#commentMessage");
        if (!name || !message || message.value.trim().length < 4) {
          toast("Add a note first", "Please write a short comment.", "error");
          return;
        }
        const list = $("#commentList");
        if (list) {
          const item = document.createElement("div");
          item.className = "comment";
          item.innerHTML = `
            <span class="avatar" aria-hidden="true">${name.value.trim().slice(0, 1).toUpperCase()}</span>
            <div class="comment__body">
              <strong>${name.value.trim()}</strong>
              <span>Just now · Reader</span>
              <p>${message.value.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>
          `;
          list.appendChild(item);
        }
        toast("Thank you for joining the table", "Your note is now part of the conversation.");
        commentForm.reset();
      });
    }
  }

  /* ---------- Utility pages ---------- */
  function initUtilityPages() {
    const notFoundSearch = $("#notFoundSearch");
    if (notFoundSearch) {
      notFoundSearch.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = $("input", notFoundSearch);
        const query = (input?.value || "").trim();
        window.location.href = query ? `products.html?q=${encodeURIComponent(query)}` : "products.html";
      });
    }

    const countdown = $("[data-countdown]");
    if (countdown) {
      let deadline = new Date(countdown.dataset.deadline || "");
      if (Number.isNaN(deadline.getTime()) || deadline.getTime() < Date.now()) {
        deadline = new Date();
        deadline.setDate(deadline.getDate() + 2);
        deadline.setHours(6, 30, 0, 0);
      }

      const fields = {
        days: $("[data-countdown-days]", countdown),
        hours: $("[data-countdown-hours]", countdown),
        minutes: $("[data-countdown-minutes]", countdown),
        seconds: $("[data-countdown-seconds]", countdown)
      };

      const tick = () => {
        const distance = Math.max(deadline.getTime() - Date.now(), 0);
        const days = Math.floor(distance / 86400000);
        const hours = Math.floor((distance / 3600000) % 24);
        const minutes = Math.floor((distance / 60000) % 60);
        const seconds = Math.floor((distance / 1000) % 60);
        if (fields.days) fields.days.textContent = String(days).padStart(2, "0");
        if (fields.hours) fields.hours.textContent = String(hours).padStart(2, "0");
        if (fields.minutes) fields.minutes.textContent = String(minutes).padStart(2, "0");
        if (fields.seconds) fields.seconds.textContent = String(seconds).padStart(2, "0");
      };

      tick();
      window.setInterval(tick, 1000);
    }
  }

  /* ---------- Dashboard ---------- */
  function initDashboard() {
    if (page !== "dashboard") return;

    const sidebar = $(".app-sidebar");
    const backdrop = $("[data-app-backdrop]");
    const menuButton = $("[data-app-menu]");

    const openMenu = () => {
      sidebar?.classList.add("is-open");
      backdrop?.classList.add("is-open");
      menuButton?.setAttribute("aria-expanded", "true");
    };
    const closeMenu = () => {
      sidebar?.classList.remove("is-open");
      backdrop?.classList.remove("is-open");
      menuButton?.setAttribute("aria-expanded", "false");
    };
    if (menuButton) menuButton.addEventListener("click", openMenu);
    if (backdrop) backdrop.addEventListener("click", closeMenu);
    $$(".app-nav__link", sidebar || document).forEach((link) => link.addEventListener("click", closeMenu));

    const notifButton = $("[data-notif-toggle]");
    const notifPanel = $("[data-notif-panel]");
    if (notifButton && notifPanel) {
      notifButton.addEventListener("click", (event) => {
        event.stopPropagation();
        notifPanel.classList.toggle("is-open");
        notifButton.setAttribute("aria-expanded", String(notifPanel.classList.contains("is-open")));
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".notif-wrap")) {
          notifPanel.classList.remove("is-open");
          notifButton.setAttribute("aria-expanded", "false");
        }
      });
    }

    $$(".toggle-switch").forEach((toggle) => {
      const input = $("input", toggle);
      const label = $("span", toggle);
      if (!input || !label) return;
      const sync = () => {
        label.textContent = input.checked ? "On" : "Off";
      };
      input.addEventListener("change", sync);
      sync();
    });

    const grid = $("#deliveryCalendar");
    if (grid) {
      const monthLabel = $("[data-calendar-month]");
      const today = new Date();
      let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
      const paused = new Set();

      const render = () => {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const deliveryDays = new Set([1, 3, 6]);
        if (monthLabel) {
          monthLabel.textContent = new Intl.DateTimeFormat("en-IN", {
            month: "long",
            year: "numeric"
          }).format(cursor);
        }
        grid.innerHTML = "";
        for (let i = 0; i < firstDay; i += 1) {
          const empty = document.createElement("span");
          empty.className = "cal-day is-outside";
          empty.setAttribute("aria-hidden", "true");
          grid.appendChild(empty);
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
          const date = new Date(year, month, day);
          const button = document.createElement("button");
          button.type = "button";
          button.className = "cal-day";
          button.dataset.date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          button.innerHTML = `<span>${day}</span>`;
          const isToday =
            day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          if (isToday) button.classList.add("is-today");
          if (deliveryDays.has(date.getDay()) && date >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
            button.classList.add("is-delivery");
            button.innerHTML = `<span>${day}</span><i class="cal-dot" aria-hidden="true"></i>`;
          }
          if (paused.has(button.dataset.date)) {
            button.classList.add("is-paused");
            button.classList.remove("is-delivery");
            button.innerHTML = `<span>${day}</span>`;
          }
          button.setAttribute(
            "aria-label",
            `${day} ${new Intl.DateTimeFormat("en-IN", { month: "long" }).format(date)} — ${
              paused.has(button.dataset.date) ? "delivery paused" : "delivery day"
            }`
          );
          if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
            button.disabled = true;
          }
          grid.appendChild(button);
        }

        const next = new Date(today);
        next.setDate(next.getDate() + 1);
        while (!deliveryDays.has(next.getDay())) next.setDate(next.getDate() + 1);
        const nextLabel = $("[data-next-delivery]");
        if (nextLabel) {
          nextLabel.textContent = new Intl.DateTimeFormat("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short"
          }).format(next);
        }
      };

      $("[data-calendar-prev]")?.addEventListener("click", () => {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        render();
      });
      $("[data-calendar-next]")?.addEventListener("click", () => {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        render();
      });

      grid.addEventListener("click", (event) => {
        const button = event.target.closest(".cal-day");
        if (!button || button.disabled) return;
        const date = button.dataset.date;
        if (!date) return;
        if (paused.has(date)) {
          paused.delete(date);
          toast("Delivery restored", "Your milk will arrive on this day.");
        } else {
          paused.add(date);
          toast("Delivery paused", "No bottle will be left on this day.");
        }
        render();
      });

      render();
    }

    const boxTotal = $("[data-box-total]");
    const updateBoxTotal = () => {
      if (!boxTotal) return;
      const total = $$(".box-item").reduce((sum, item) => {
        const qtyElement = $("[data-qty-value]", item);
        const qty = Number(qtyElement?.value || qtyElement?.textContent || 0);
        return sum + qty * Number(item.dataset.price || 0);
      }, 0);
      boxTotal.textContent = formatINR(total);
    };
    const content = $(".app-content");
    if (content) {
      content.addEventListener("qtychange", updateBoxTotal);
      content.addEventListener("click", (event) => {
        const action = event.target.closest("[data-schedule-action]");
        if (action) {
          const name = action.dataset.scheduleAction;
          toast("Schedule updated", `${name.charAt(0).toUpperCase() + name.slice(1)} applied to your morning rhythm.`);
        }
        const download = event.target.closest("[data-download]");
        if (download) {
          const invoice = download.dataset.download || "Meadowly invoice";
          const contentText = `MEADOWLY DAIRY CO.\n${invoice}\n\nThank you for choosing small-batch dairy.\nDelivery: 5:30–6:30 AM, Coimbatore.\nFor billing questions, write to hello@meadowly.in.`;
          const blob = new Blob([contentText], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `${invoice.replace(/\s+/g, "-").toLowerCase()}.txt`;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
          toast("Invoice downloaded", "A copy has been saved to your device.");
        }
      });
      updateBoxTotal();
    }

    $$("[data-order-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.dataset.orderTab;
        $$("[data-order-tab]").forEach((other) =>
          other.setAttribute("aria-selected", String(other === tab))
        );
        $$("[data-order-panel]").forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.orderPanel === name);
        });
      });
    });

    const deliveryForm = $("#deliveryForm");
    if (deliveryForm) {
      deliveryForm.addEventListener("submit", (event) => {
        event.preventDefault();
        toast("Delivery details saved", "Your next bottle will follow the new instructions.");
      });
    }

    const preferencesForm = $("#preferencesForm");
    if (preferencesForm) {
      preferencesForm.addEventListener("submit", (event) => {
        event.preventDefault();
        toast("Preferences updated", "We'll keep the meadow exactly how you like it.");
      });
    }

    $$("[data-dash-action]").forEach((button) => {
      button.addEventListener("click", () => {
        toast(button.dataset.dashAction || "All set", "Your dashboard has been updated.");
      });
    });

    const sections = $$(".app-section[id]");
    const navLinks = $$(".app-nav__link[href^='#']");
    if (sections.length && navLinks.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navLinks.forEach((link) =>
              link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`)
            );
          });
        },
        { rootMargin: "-20% 0px -65% 0px", threshold: 0.05 }
      );
      sections.forEach((section) => observer.observe(section));
    }
  }

  /* ---------- Admin ---------- */
  function initAdmin() {
    if (page !== "admin") return;

    const sidebar = $(".app-sidebar");
    const backdrop = $("[data-app-backdrop]");
    const menuButton = $("[data-app-menu]");
    const closeMenu = () => {
      sidebar?.classList.remove("is-open");
      backdrop?.classList.remove("is-open");
      menuButton?.setAttribute("aria-expanded", "false");
    };
    if (sidebar && menuButton) {
      menuButton.addEventListener("click", () => {
        sidebar.classList.add("is-open");
        backdrop?.classList.add("is-open");
        menuButton.setAttribute("aria-expanded", "true");
      });
    }
    if (backdrop) backdrop.addEventListener("click", closeMenu);
    $$(".app-nav__link", sidebar || document).forEach((link) => link.addEventListener("click", closeMenu));

    const orderRows = $$("[data-order-row]");
    const statusFilter = $("#adminOrderStatus");
    const orderSearch = $("#adminOrderSearch");
    const orderCount = $("[data-order-count]");

    const filterOrders = () => {
      const status = statusFilter?.value || "all";
      const term = (orderSearch?.value || "").trim().toLowerCase();
      let visible = 0;
      orderRows.forEach((row) => {
        const matchesStatus = status === "all" || row.dataset.status === status;
        const matchesTerm = !term || row.textContent.toLowerCase().includes(term);
        const show = matchesStatus && matchesTerm;
        row.hidden = !show;
        if (show) visible += 1;
      });
      if (orderCount) orderCount.textContent = `${visible} order${visible === 1 ? "" : "s"}`;
    };

    if (statusFilter) statusFilter.addEventListener("change", filterOrders);
    if (orderSearch) orderSearch.addEventListener("input", filterOrders);
    filterOrders();

    $$("[data-chart-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.chartMode;
        $$("[data-chart-mode]").forEach((other) =>
          other.setAttribute("aria-pressed", String(other === button))
        );
        $$("[data-chart-series]").forEach((series) => {
          series.hidden = series.dataset.chartSeries !== mode;
        });
      });
    });

    $$("[data-dismiss-alert]").forEach((button) => {
      button.addEventListener("click", () => {
        const alert = button.closest(".alert-item");
        if (alert) {
          alert.remove();
          toast("Alert cleared", "The task has been marked as reviewed.");
        }
      });
    });

    $$("[data-complete-task]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".batch-row") || button.closest(".maintenance-task");
        if (row) {
          row.classList.add("is-complete");
          const status = $(".status", row);
          if (status) {
            status.className = "status status--butter";
            status.textContent = "Reviewed";
          }
          toast("Batch reviewed", "Quality notes have been logged.");
        }
      });
    });

    $$("[data-admin-action]").forEach((button) => {
      button.addEventListener("click", () => {
        toast(button.dataset.adminAction || "Admin action", "This change has been recorded in the admin log.");
      });
    });

    const sections = $$(".app-section[id]");
    const navLinks = $$(".app-nav__link[href^='#']");
    if (sections.length && navLinks.length && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navLinks.forEach((link) =>
              link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`)
            );
          });
        },
        { rootMargin: "-20% 0px -65% 0px", threshold: 0.05 }
      );
      sections.forEach((section) => observer.observe(section));
    }
  }

  /* ---------- Shared page extras ---------- */
  function initMisc() {
    const search = new URLSearchParams(window.location.search).get("q");
    const catalogSearch = $("#catalogSearch");
    if (search && catalogSearch) {
      catalogSearch.value = search;
      catalogSearch.dispatchEvent(new Event("input", { bubbles: true }));
    }

    $$("[data-day-pill]").forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("is-active");
      });
    });

    $$("[data-note]").forEach((button) => {
      button.addEventListener("click", () => toast(button.dataset.note, "We'll be in touch shortly."));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHeroSlider();
    initCatalog();
    initPDP();
    initBilling();
    initBoxBuilder();
    initPricingCalculator();
    initBlog();
    initContact();
    initPasswordToggles();
    initLogin();
    initSignup();
    initArticle();
    initUtilityPages();
    initDashboard();
    initAdmin();
    initMisc();
  });
})();
