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
    const customColor = /^#[0-9a-fA-F]{6}$/.test(settings.customColor || "") ? settings.customColor : "#26784a";
    root.style.setProperty("--ag-custom-color", customColor);
    root.dataset.agHeaderLayout = ["top", "left", "right", "bottom"].includes(settings.layout) ? settings.layout : "top";
    root.dataset.agNavDisplay = ["text", "icons", "both"].includes(settings.navDisplayStyle) ? settings.navDisplayStyle : "text";
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
    applyNavigationDisplay(header);
    const toggle = header.querySelector(".ag-shared-menu-toggle");
    nav?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-label", "Open navigation menu");
    closeDropdowns(header);
  }

  const googleOneTapClientId = "482368984987-l7qacfrv7vc1q76objbqe1p44qe1r3lf.apps.googleusercontent.com";
  let googleIdentityPromise;

  function loadGoogleIdentity() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (googleIdentityPromise) return googleIdentityPromise;
    googleIdentityPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener("load", () => window.google?.accounts?.id ? resolve() : reject(new Error("Google Identity Services did not initialise.")), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Identity Services could not load.")), { once: true });
        if (window.google?.accounts?.id) resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => window.google?.accounts?.id ? resolve() : reject(new Error("Google Identity Services did not initialise."));
      script.onerror = () => reject(new Error("Google Identity Services could not load."));
      document.head.appendChild(script);
    });
    return googleIdentityPromise;
  }

  async function createGoogleOneTapNonce() {
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
    const hashedNonce = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
    return { nonce, hashedNonce };
  }

  async function routeOneTapUser(client, user) {
    let destination = "/onboarding/";
    try {
      const { data: profile, error } = await client.from("profiles")
        .select("onboarding_completed").eq("id", user.id).maybeSingle();
      if (!error && profile?.onboarding_completed) destination = "/";
    } catch (error) {
      console.info("Could not check onboarding completion after Google One Tap.", error);
    }
    location.assign(destination);
  }

  async function initialiseGoogleOneTap() {
    if (!window.isSecureContext || !window.crypto?.subtle || !googleOneTapClientId) return;
    try {
      const sdk = await ensureSupabase();
      const client = sdk.createClient(supabaseUrl, supabasePublicKey);
      const { data, error } = await client.auth.getSession();
      if (error || data?.session?.user) return;
      await loadGoogleIdentity();
      // Recheck after loading Google’s library so a concurrent sign-in does not show One Tap.
      const latest = await client.auth.getSession();
      if (latest.data?.session?.user) return;
      const { nonce, hashedNonce } = await createGoogleOneTapNonce();
      window.google.accounts.id.initialize({
        client_id: googleOneTapClientId,
        nonce: hashedNonce,
        context: "signin",
        auto_select: false,
        use_fedcm_for_prompt: true,
        callback: async response => {
          if (!response?.credential) return;
          try {
            const { data: authData, error: authError } = await client.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce
            });
            if (authError) throw authError;
            if (!authData?.user) throw new Error("Google did not return an authenticated user.");
            await routeOneTapUser(client, authData.user);
          } catch (error) {
            console.error("Google One Tap sign-in failed.", error);
          }
        }
      });
      window.google.accounts.id.prompt();
    } catch (error) {
      // One Tap is optional; normal website navigation and the existing login flow remain available.
      console.info("Google One Tap is currently unavailable.", error);
    }
  }

  async function syncAccountLink(header) {
    const link = header.querySelector("#accountNav");
    if (!link) return;
    try {
      const sdk = await ensureSupabase();
      const client = sdk.createClient(supabaseUrl, supabasePublicKey);
      const render = session => {
        const label = link.querySelector(".ag-nav-label");
        const icon = link.querySelector("svg");
        if (session?.user) {
          if (label) label.textContent = "My Account"; else link.textContent = "My Account";
          if (icon) icon.innerHTML = '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>';
          link.href = "/account/";
          link.setAttribute("aria-label", "Open your Agrolyst customer account");
        } else {
          if (label) label.textContent = "Sign in"; else link.textContent = "Sign in";
          if (icon) icon.innerHTML = '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/>';
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

  function applyNavigationDisplay(header) {
    const setting = (() => { try { return JSON.parse(localStorage.getItem(appearanceStorageKey) || "{}").navDisplayStyle || "text"; } catch (error) { return "text"; } })();
    const icons = {
      "About Us": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/></svg>',
      "Products": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
      "Community": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.5a3 3 0 0 1 0 5.8M18 14a5 5 0 0 1 3 5"/></svg>',
      "Opportunities": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>',
      "Narrative Changers": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v12H8l-4 3V5Z"/><path d="M8 9h8M8 13h5"/></svg>',
      "Contact": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
      "Sign in": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/></svg>',
      "My Account": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>'
    };
    header.querySelectorAll(".ag-shared-nav__link").forEach(link => {
      if (link.querySelector(".ag-nav-label")) return;
      const labelText = link.matches(".ag-shared-dropdown__toggle") ? link.childNodes[0]?.textContent?.trim() : link.textContent.trim();
      const icon = icons[labelText];
      if (!icon) return;
      const label = document.createElement("span");
      label.className = "ag-nav-label";
      label.textContent = labelText;
      if (link.matches(".ag-shared-dropdown__toggle")) {
        const textNode = [...link.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (textNode) textNode.textContent = "";
      } else link.textContent = "";
      link.insertAdjacentHTML("afterbegin", icon);
      link.appendChild(label);
    });
    header.dataset.navDisplayApplied = "true";
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
    initialiseGoogleOneTap();
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