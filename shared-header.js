(() => {
  const mountSelector = "[data-shared-header-mount]";
  const partialUrl = "/partials/site-header.html";
  const supabaseUrl = "https://rcrgooivgssuerrgnuqw.supabase.co";
  const supabasePublicKey = "sb_publishable_j8SoLv73ssa13M_rAJwB6g_rPb8whHD";
  const appearanceStorageKey = "agrolyst-appearance-v1";
  const defaultAppearance = { mode: "light", theme: "forest", layout: "top" };

  function applySavedAppearance() {
    let settings = { ...defaultAppearance };
    try {
      settings = { ...settings, ...JSON.parse(localStorage.getItem(appearanceStorageKey) || "{}") };
    } catch (error) {
      console.info("Using default Agrolyst appearance settings.");
    }
    const resolvedMode = settings.mode === "system"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : settings.mode;
    const root = document.documentElement;
    root.dataset.agTheme = resolvedMode === "dark" ? "dark" : "light";
    root.dataset.agAccent = ["forest", "blue", "purple", "harvest"].includes(settings.theme) ? settings.theme : "forest";
    root.dataset.agHeaderLayout = ["top", "left", "right", "bottom"].includes(settings.layout) ? settings.layout : "top";
  }

  applySavedAppearance();
  window.addEventListener("storage", event => {
    if (event.key === appearanceStorageKey) applySavedAppearance();
  });
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    try {
      const settings = JSON.parse(localStorage.getItem(appearanceStorageKey) || "{}");
      if (settings.mode === "system") applySavedAppearance();
    } catch (error) {}
  });

  function activeTranslateParams() {
    if (!location.hostname.endsWith(".translate.goog")) return null;
    const params = new URLSearchParams(location.search);
    return params.get("_x_tr_tl") ? params : null;
  }

  function addTranslateParams(url) {
    const params = activeTranslateParams();
    if (!params) return url;
    params.forEach((value, key) => {
      if (key.startsWith("_x_tr_")) url.searchParams.set(key, value);
    });
    return url;
  }

  function translatedAssetUrl(path) {
    return addTranslateParams(new URL(path, location.origin)).href;
  }

  function preserveTranslatedNavigation(header) {
    const params = activeTranslateParams();
    if (!params) return;
    header.querySelectorAll('a[href^="/"]').forEach(link => {
      const target = new URL(link.getAttribute("href"), location.href);
      if (target.origin !== location.origin) return;
      link.href = addTranslateParams(target).href;
    });
  }

  async function ensureSupabase() {
    if (window.supabase?.createClient) return window.supabase;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error("Supabase client did not initialise."));
      script.onerror = () => reject(new Error("Could not load account session client."));
      document.head.appendChild(script);
    });
  }

  function closeDropdowns(header, except = null) {
    header.querySelectorAll(".ag-shared-dropdown").forEach(dropdown => {
      if (dropdown === except) return;
      dropdown.classList.remove("is-open");
      dropdown.querySelector(".ag-shared-dropdown__toggle")?.setAttribute("aria-expanded", "false");
    });
  }

  function closeMobileNav(header) {
    const nav = header.querySelector(".ag-shared-nav");
    const toggle = header.querySelector(".ag-shared-menu-toggle");
    nav?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-label", "Open navigation menu");
    closeDropdowns(header);
  }

  async function syncAccountLink(header) {
    const link = header.querySelector("#accountNav");
    if (!link) return;
    try {
      const sdk = await ensureSupabase();
      const client = sdk.createClient(supabaseUrl, supabasePublicKey);
      const render = session => {
        if (session?.user) {
          link.textContent = "My Account";
          link.href = "/account/";
          link.setAttribute("aria-label", "Open your Agrolyst customer account");
        } else {
          link.textContent = "Sign in";
          link.href = "/login/";
          link.removeAttribute("aria-label");
        }
      };
      const { data } = await client.auth.getSession();
      render(data?.session);
      client.auth.onAuthStateChange((_event, session) => render(session));
    } catch (error) {
      console.info("Account navigation remains on sign-in until session state is available.", error);
    }
  }

  function wireHeader(header) {
    const nav = header.querySelector(".ag-shared-nav");
    const menuToggle = header.querySelector(".ag-shared-menu-toggle");

    menuToggle?.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      if (!open) closeDropdowns(header);
    });

    header.querySelectorAll(".ag-shared-dropdown__toggle").forEach(toggle => {
      toggle.addEventListener("click", event => {
        event.preventDefault();
        const dropdown = toggle.closest(".ag-shared-dropdown");
        const open = !dropdown.classList.contains("is-open");
        closeDropdowns(header, dropdown);
        dropdown.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
    });

    nav?.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        closeMobileNav(header);
      });
    });

    document.addEventListener("click", event => {
      if (!header.contains(event.target)) closeDropdowns(header);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const openedToggle = header.querySelector(".ag-shared-dropdown.is-open .ag-shared-dropdown__toggle");
        closeMobileNav(header);
        if (openedToggle) openedToggle.focus();
      }
    });

    const pathname = location.pathname.replace(/\/+$/, "") || "/";
    const activeRoutes = {
      "/about": "About Us", "/owners": "About Us", "/team": "About Us", "/board": "About Us", "/website-technology": "About Us", "/technical-support": "About Us",
      "/partners": "About Us", "/ambassadors": "About Us", "/careers": "About Us",
      "/products": "Products", "/agribusiness-accelerator": "Products",
      "/agribusiness-brand-strategy-masterclass": "Products", "/marketplace": "Community",
      "/our-communities": "Community", "/add-testimonial": "Community",
      "/associate-directory": "Opportunities", "/data": "Opportunities", "/events": "Opportunities",
      "/training-workshop": "Opportunities", "/financial-support": "Opportunities", "/capacity-building": "Opportunities",
      "/podcast": "Narrative Changers", "/food-culture": "Narrative Changers",
      "/agribusiness-clinic": "Narrative Changers", "/agrifood-webinar-series": "Narrative Changers",
      "/news-updates": "Narrative Changers", "/partnerships": "About Us"
    };
    const activeLabel = activeRoutes[pathname];
    if (activeLabel) {
      header.querySelectorAll(".ag-shared-dropdown__toggle").forEach(toggle => {
        if (toggle.textContent.trim().startsWith(activeLabel)) toggle.setAttribute("aria-current", "page");
      });
    }
    preserveTranslatedNavigation(header);
    syncAccountLink(header);
    window.dispatchEvent(new CustomEvent("agrolyst:header-ready", { detail: { header } }));
  }

  async function loadHeader(mount) {
    if (!mount || mount.dataset.headerLoading === "true") return;
    mount.dataset.headerLoading = "true";
    try {
      const response = await fetch(translatedAssetUrl(partialUrl), { credentials: "same-origin" });
      if (!response.ok) throw new Error("Shared header could not be loaded.");
      const markup = await response.text();
      const template = document.createElement("template");
      template.innerHTML = markup.trim();
      const header = template.content.firstElementChild;
      if (!header?.matches("[data-ag-shared-header]")) throw new Error("Shared header partial is invalid.");
      mount.replaceWith(header);
      wireHeader(header);
    } catch (error) {
      console.error("Agrolyst shared header failed to load.", error);
      mount.textContent = "Agrolyst Integrated Farms and Services";
      mount.setAttribute("role", "alert");
    }
  }

  function start() {
    document.querySelectorAll(mountSelector).forEach(mount => loadHeader(mount));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();