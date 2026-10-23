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
    const trigger = header.querySelector("#accountNav");
    const backdrop = header.querySelector("#agProfileBackdrop");
    const dialog = header.querySelector("#agProfileDialog");
    const closeButton = header.querySelector("#agProfileClose");
    const googleButton = header.querySelector("#agProfileGoogle");
    const status = header.querySelector("#agProfileStatus");
    const signedOutActions = header.querySelector("#agProfileSignedOut");
    const signedInActions = header.querySelector("#agProfileSignedIn");
    if (!trigger || !backdrop || !dialog) return;

    let client;
    let activeUser = null;
    let previousFocus = null;

    const showStatus = (message, isError = false) => {
      status.textContent = message || "";
      status.classList.toggle("is-error", Boolean(isError));
    };
    const openDialog = () => {
      previousFocus = document.activeElement;
      backdrop.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      dialog.focus();
      closeButton?.focus();
    };
    const closeDialog = () => {
      backdrop.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    };
    const render = user => {
      activeUser = user || null;
      const label = header.querySelector("#agProfileLabel");
      const avatar = header.querySelector("#agProfileAvatar");
      const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Profile";
      label.textContent = "Profile";
      avatar.textContent = user ? (displayName.trim()[0] || "P").toUpperCase() : "P";
      trigger.setAttribute("aria-label", user ? "Open profile menu" : "Open sign-in and profile options");
      signedOutActions.hidden = Boolean(user);
      googleButton.hidden = Boolean(user);
      signedInActions.hidden = !user;
      header.querySelector("#agProfileTitle").textContent = user ? "Your profile" : "Sign in to Agrolyst";
      header.querySelector("#agProfileIntro").textContent = user
        ? "You are signed in. Manage your account, orders and preferences from your profile."
        : "Sign in to manage your Agrolyst profile, orders and preferences.";
      if (user) showStatus("Signed in as " + (user.email || displayName) + ".", false);
      else showStatus("");
    };

    try {
      const sdk = await ensureSupabase();
      client = sdk.createClient(supabaseUrl, supabasePublicKey);
      const { data } = await client.auth.getSession();
      render(data?.session?.user || null);
      client.auth.onAuthStateChange((_event, session) => {
        const wasSignedIn = Boolean(activeUser);
        render(session?.user || null);
        if (!wasSignedIn && session?.user && !backdrop.hidden) {
          showStatus("Google sign-in successful. Your profile is ready.", false);
        }
      });
    } catch (error) {
      console.info("Profile dialog could not read the current session.", error);
      render(null);
    }

    trigger.addEventListener("click", () => {
      if (backdrop.hidden) openDialog();
      else closeDialog();
    });
    closeButton?.addEventListener("click", closeDialog);
    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) closeDialog();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !backdrop.hidden) closeDialog();
    });

    googleButton?.addEventListener("click", async () => {
      if (!client) {
        showStatus("Sign-in is still loading. Please try again.", true);
        return;
      }
      // Open a blank window immediately so the browser does not block the OAuth popup.
      const popup = window.open("about:blank", "agrolystGoogleSignIn", "popup=yes,width=520,height=680,resizable=yes,scrollbars=yes");
      if (!popup) {
        showStatus("Your browser blocked the sign-in popup. Allow popups for agrolystfarms.com and try again.", true);
        return;
      }
      googleButton.disabled = true;
      showStatus("Opening secure Google sign-in…");
      try {
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: "https://agrolystfarms.com/callback/",
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" }
          }
        });
        if (error) throw error;
        if (!data?.url) throw new Error("Google sign-in could not start. Please try again.");
        popup.location.href = data.url;
        showStatus("Complete sign-in in the Google popup. This page will update when you finish.");
      } catch (error) {
        try { popup.close(); } catch (_) {}
        showStatus(error.message || "Google sign-in failed. Please try again.", true);
      } finally {
        googleButton.disabled = false;
      }
    });

    header.querySelector("#agProfileSignOut")?.addEventListener("click", async () => {
      if (!client) return;
      const signOut = header.querySelector("#agProfileSignOut");
      signOut.disabled = true;
      try {
        const { error } = await client.auth.signOut();
        if (error) throw error;
        render(null);
        showStatus("You have been signed out.", false);
      } catch (error) {
        showStatus(error.message || "Could not sign out. Please try again.", true);
      } finally {
        signOut.disabled = false;
      }
    });

    window.addEventListener("message", event => {
      if (event.origin !== location.origin || event.data?.type !== "agrolyst:oauth-success") return;
      client?.auth.getSession().then(({ data }) => {
        render(data?.session?.user || null);
        if (data?.session?.user) showStatus("Google sign-in successful. You are now signed in.", false);
      }).catch(error => console.warn("Could not refresh the signed-in profile.", error));
    });
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