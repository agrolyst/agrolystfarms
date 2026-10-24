/* Agrolyst shared iconography, scroll reveals and page utilities.
   Uses Lucide's open-source outline icons loaded from the CDN. */
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let observeRevealNode = null;
  const icon = (name, className = "") => {
    const node = document.createElement("i");
    node.setAttribute("data-lucide", name);
    node.setAttribute("aria-hidden", "true");
    if (className) node.className = className;
    return node;
  };

  const addIcon = (container, name, className, prepend = true) => {
    if (!container || container.querySelector(":scope > [data-lucide], :scope > .site-added-icon")) return;
    const node = icon(name, className);
    node.classList.add("site-added-icon");
    if (prepend) container.insertBefore(node, container.firstChild);
    else container.appendChild(node);
  };

  const iconForLabel = (raw) => {
    const value = (raw || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (/home|homepage/.test(value)) return "house";
    if (/product|catalog|shop|feed|equipment|range/.test(value)) return "package";
    if (/about|who we are|our story|company/.test(value)) return "sprout";
    if (/partner|collaborat|distribution/.test(value)) return "handshake";
    if (/contact|enquir|message|whatsapp/.test(value)) return "message-circle";
    if (/account|sign in|sign out|owner|leadership|team/.test(value)) return "user-round";
    if (/vision|future/.test(value)) return "eye";
    if (/mission|purpose|commitment|goal/.test(value)) return "target";
    if (/philosophy|market to farm/.test(value)) return "compass";
    if (/support|technical|consult/.test(value)) return "wrench";
    if (/quality|reliable|trust|integrity/.test(value)) return "badge-check";
    if (/education|training|farmer/.test(value)) return "graduation-cap";
    if (/growth|grow|sustain|enterprise/.test(value)) return "trending-up";
    if (/land|farm|field|livestock|poultry|egg|meat/.test(value)) return "wheat";
    if (/privacy|secure|security/.test(value)) return "shield-check";
    if (/terms|policy|legal/.test(value)) return "file-text";
    if (/address|location|office/.test(value)) return "map-pin";
    if (/email/.test(value)) return "mail";
    if (/phone|call/.test(value)) return "phone";
    if (/business profile|company profile|business|registry|cac|registered|incorporat/.test(value)) return "building-2";
    if (/arrow|explore|browse|learn more|read more|view all/.test(value)) return "arrow-up-right";
    return null;
  };

  const initialiseIcons = () => {
    // Section labels: use a small outline icon in place of repeated decorative dots.
    document.querySelectorAll(".eyebrow").forEach((label) => {
      const existing = label.querySelector(":scope > [data-lucide]");
      if (existing) return;
      const name = iconForLabel(label.textContent);
      if (!name) return;
      const dot = label.querySelector(":scope > i:not([data-lucide])");
      if (dot) dot.remove();
      addIcon(label, name, "site-section-icon", true);
    });

    // Navigation links receive consistent, light-weight outline icons.
    document.querySelectorAll("header nav a, .legal-top a").forEach((link) => {
      if (link.closest(".ag-shared-header")) return;
      if (link.querySelector("[data-lucide]")) return;
      const href = (link.getAttribute("href") || "").toLowerCase();
      const text = link.textContent || "";
      let name = iconForLabel(text);
      if (href.includes("about")) name = "sprout";
      else if (href.includes("products") || href.includes("#products")) name = "package";
      else if (href.includes("partnership")) name = "handshake";
      else if (href.includes("auth") || href.includes("account")) name = "user-round";
      else if (href.includes("#contact") || /contact/i.test(text)) name = "message-circle";
      else if (href === "/" || href === "#home" || href === "#top") name = "house";
      if (name) addIcon(link, name, "site-link-icon", true);
    });

    // Purpose, product range and partnership cards have an icon tile.
    const addCardTile = (card, target = card) => {
      if (!target || target.querySelector(":scope > .site-card-icon")) return;
      const heading = card.querySelector("h3, strong, h4");
      const name = iconForLabel(((heading && heading.textContent) || "") + " " + card.textContent);
      if (!name) return;
      const badge = document.createElement("span");
      badge.className = "site-card-icon";
      badge.appendChild(icon(name));
      target.insertBefore(badge, target.firstChild);
    };
    document.querySelectorAll(".purpose-card, .partnership-grid article, .principles-grid article, .registry-fact, .registry-contact-card").forEach((card) => addCardTile(card));
    // Preserve existing two-column product cards and the three-item value row.
    document.querySelectorAll(".range-card").forEach((card) => addCardTile(card, card.querySelector(":scope > div") || card));
    document.querySelectorAll(".values > div").forEach((card) => addCardTile(card, card.querySelector(":scope > span") || card));

    // Add a small icon to important action links, while avoiding duplicate decoration.
    document.querySelectorAll("a.btn, .nav-cta, .floating-wa, .plain").forEach((link) => {
      if (link.querySelector("[data-lucide]")) return;
      const text = link.textContent || "";
      const name = link.classList.contains("floating-wa") ? "message-circle" :
        (link.classList.contains("plain") ? "arrow-right" : "arrow-up-right");
      if (!text.trim()) return;
      addIcon(link, name, "site-action-icon", true);
    });

    // Icon-only mobile navigation affordance and accessible form helpers.
    const menu = document.getElementById("menu");
    if (menu && !menu.querySelector("[data-lucide]")) {
      menu.textContent = "";
      menu.appendChild(icon("menu"));
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  };

  const initialiseScrollMotion = () => {
    const selectors = [
      "main > section", ".hero-content", ".inner-hero-content",
      ".purpose-card", ".range-card", ".partnership-grid article",
      ".principles-grid article", ".values > div", ".owner-layout > *",
      ".story-grid > *", ".two-col-photo > *", ".intro-image-row > *",
      ".support-grid > *", ".partner-contact-inner > *",
      ".cards > *", ".shop-toolbar", ".catalog-cta",
      ".registry-highlight", ".registry-fact", ".registry-contact-card",
      ".auth-brand", ".auth-card", ".account-panel", ".callback-card",
      ".legal-content"
    ];
    const nodes = [...new Set(selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))))];
    nodes.forEach((node) => node.classList.add("scroll-reveal"));
    if (reducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
        else entry.target.classList.remove("is-visible");
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -5% 0px" });

    observeRevealNode = (node) => {
      if (!node || !(node instanceof Element)) return;
      node.classList.add("scroll-reveal");
      observer.observe(node);
    };
    nodes.forEach((node) => observer.observe(node));
  };

  const decorateDynamicProductCards = () => {
    const decorate = (root) => {
      const candidates = [];
      if (root instanceof Element && root.matches(".shop-product-card")) candidates.push(root);
      if (root && root.querySelectorAll) candidates.push(...root.querySelectorAll(".shop-product-card"));
      candidates.forEach((card) => {
        const copy = card.querySelector(".card-copy");
        if (copy && !copy.querySelector(":scope > .site-card-icon")) {
          const heading = copy.querySelector("h3");
          const name = iconForLabel((heading && heading.textContent) || copy.textContent) || "package";
          const badge = document.createElement("span");
          badge.className = "site-card-icon";
          badge.appendChild(icon(name));
          copy.insertBefore(badge, copy.firstChild);
        }
        if (observeRevealNode) observeRevealNode(card);
      });
      if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
      }
    };
    document.querySelectorAll("#productGrid, #catalogGrid").forEach((grid) => {
      decorate(grid);
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) decorate(node);
        }));
      });
      observer.observe(grid, { childList: true, subtree: true });
    });
  };

  const initialiseScrollUtilities = () => {
    const progress = document.createElement("div");
    progress.className = "site-scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    document.body.appendChild(progress);

    const topButton = document.createElement("button");
    topButton.className = "site-back-to-top";
    topButton.type = "button";
    topButton.setAttribute("aria-label", "Back to top");
    topButton.setAttribute("title", "Back to top");
    topButton.appendChild(icon("arrow-up"));
    document.body.appendChild(topButton);
    topButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" }));

    let ticking = false;
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progressValue = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      progress.style.width = progressValue + "%";
      topButton.classList.toggle("is-visible", window.scrollY > 500);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  };


  const installPageLoader = () => {
    if (document.getElementById("agrolyst-page-loader")) return;
    const style = document.createElement("style");
    style.id = "agrolyst-page-loader-style";
    style.textContent = `
      #agrolyst-page-loader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#07130d;opacity:1;visibility:visible;transition:opacity .28s ease,visibility .28s ease}
      #agrolyst-page-loader.is-hidden{opacity:0;visibility:hidden;pointer-events:none}
      #agrolyst-page-loader img{display:block;width:min(78vw,520px);height:min(78vw,520px);max-width:92vw;max-height:92vh;object-fit:contain;mix-blend-mode:screen}
      #agrolyst-page-loader .loader-label{position:absolute;top:calc(50% + min(39vw,260px) + 18px);color:#dce8df;font:600 11px/1.4 system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase}
      @media(prefers-reduced-motion:reduce){#agrolyst-page-loader{transition:none}}
    `;
    document.head.appendChild(style);
    const loader = document.createElement("div");
    loader.id = "agrolyst-page-loader";
    loader.setAttribute("role", "status");
    loader.setAttribute("aria-label", "Loading Agrolyst");
    const img = document.createElement("img");
    img.src = "https://s4.ezgif.com/tmp/ezgif-497b24faa1c745d7.gif";
    img.alt = "";
    img.decoding = "async";
    img.onerror = () => { img.style.display = "none"; };
    const label = document.createElement("span");
    label.className = "loader-label";
    label.textContent = "AGROLYST";
    loader.append(img, label);
    document.body.appendChild(loader);
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      loader.classList.add("is-hidden");
      window.setTimeout(() => loader.remove(), 350);
    };
    if (document.readyState === "complete") window.setTimeout(dismiss, 250);
    else window.addEventListener("load", () => window.setTimeout(dismiss, 250), { once: true });
    // Never leave the site covered if a third-party asset or page request stalls.
    window.setTimeout(dismiss, 5000);
  };

  installPageLoader();

  const boot = () => {
    initialiseIcons();
    initialiseScrollMotion();
    initialiseScrollUtilities();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();