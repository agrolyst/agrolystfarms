(() => {
  const mount = document.querySelector("[data-shared-header-mount]");
  if (!mount) return;

  const PARTIAL_URL = "/partials/site-header.html";
  const SUPABASE_URL = "https://rcrgooivgssuerrgnuqw.supabase.co";
  const SUPABASE_PUBLIC_KEY = "sb_publishable_j8SoLv73ssa13M_rAJwB6g_rPb8whHD";

  async function ensureSupabase() {
    if (window.supabase?.createClient) return window.supabase;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error("Supabase client did not initialise."));
      script.onerror = () => reject(new Error("Could not load the account session client."));
      document.head.appendChild(script);
    });
  }

  function setMenuClosed(header) {
    const nav = header.querySelector(".ag-shared-nav");
    const toggle = header.querySelector(".ag-shared-menu-toggle");
    const about = header.querySelector(".ag-shared-dropdown");
    const aboutToggle = header.querySelector(".ag-shared-dropdown__toggle");
    nav?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-label", "Open navigation menu");
    about?.classList.remove("is-open");
    aboutToggle?.setAttribute("aria-expanded", "false");
  }

  function wireHeader(header) {
    const nav = header.querySelector(".ag-shared-nav");
    const menuToggle = header.querySelector(".ag-shared-menu-toggle");
    const aboutDropdown = header.querySelector(".ag-shared-dropdown");
    const aboutToggle = header.querySelector(".ag-shared-dropdown__toggle");

    menuToggle?.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      if (!open) {
        aboutDropdown.classList.remove("is-open");
        aboutToggle.setAttribute("aria-expanded", "false");
      }
    });

    aboutToggle?.addEventListener("click", (event) => {
      event.preventDefault();
      const open = !aboutDropdown.classList.contains("is-open");
      aboutDropdown.classList.toggle("is-open", open);
      aboutToggle.setAttribute("aria-expanded", String(open));
    });

    nav?.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => setMenuClosed(header));
    });

    document.addEventListener("click", event => {
      if (!header.contains(event.target)) {
        aboutDropdown?.classList.remove("is-open");
        aboutToggle?.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        setMenuClosed(header);
        aboutToggle?.focus();
      }
    });

    const path = location.pathname.replace(/\/+$/, "") || "/";
    const routeMap = { products: "/products", partnerships: "/partnerships", account: "/account", contact: "/#contact", approach: "/#approach" };
    header.querySelectorAll("[data-nav-route]").forEach(link => {
      const route = link.dataset.navRoute;
      const target = routeMap[route];
      if ((route === "home" && path === "/") ||
          (route === "products" && path === "/products") ||
          (route === "partnerships" && path === "/partnerships") ||
          (route === "account" && path === "/account")) {
        link.setAttribute("aria-current", "page");
      }
    });

    const aboutActive = path === "/about" || path === "/about";
    if (aboutActive) {
      aboutToggle.classList.add("is-current");
      aboutToggle.setAttribute("aria-current", "page");
    }

    syncAccountLink(header).catch(error => console.info("Account link remains on sign-in.", error));
  }

  async function syncAccountLink(header) {
    const link = header.querySelector("#accountNav");
    if (!link) return;
    const sdk = await ensureSupabase();
    const client = sdk.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

    async function render(session) {
      if (session?.user) {
        link.textContent = "My Account";
        link.href = "/account/";
        link.setAttribute("aria-label", "Open your Agrolyst customer account");
      } else {
        link.textContent = "Sign in";
        link.href = "/login/";
        link.removeAttribute("aria-label");
      }
    }

    const { data } = await client.auth.getSession();
    await render(data?.session);
    client.auth.onAuthStateChange((_event, session) => { void render(session); });
  }

  async function load() {
    try {
      const response = await fetch(PARTIAL_URL, { credentials: "same-origin" });
      if (!response.ok) throw new Error("Shared header could not be loaded.");
      const html = await response.text();
      const template = document.createElement("template");
      template.innerHTML = html.trim();
      const header = template.content.firstElementChild;
      if (!header || !header.matches("[data-ag-shared-header]")) throw new Error("Shared header partial is invalid.");
      mount.replaceWith(header);
      wireHeader(header);
    } catch (error) {
      console.error("Agrolyst shared header failed to load.", error);
      mount.textContent = "Agrolyst Integrated Farms and Services";
      mount.setAttribute("role", "alert");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once: true });
  else void load();
})();