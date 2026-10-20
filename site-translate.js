(() => {
  const languages = [
    ["en","English"],["ha","Hausa"],["yo","Yoruba"],["ig","Igbo"],
    ["fr","French"],["ar","Arabic"],["es","Spanish"],["pt","Portuguese"],
    ["sw","Swahili"],["hi","Hindi"],["zh-CN","Chinese"],["de","German"]
  ];
  const selectMarkup = () => '<label class="ag-translate-float" aria-label="Translate this website with Google"><span aria-hidden="true">文</span><select data-ag-translate aria-label="Translate this website with Google"><option value="">Translate</option>' +
    languages.map(([code,name]) => '<option value="' + code + '">' + name + '</option>').join("") + '</select></label>';

  function translateTo(language) {
    if (!language) return;
    if (language === "en") {
      const original = new URL(location.href);
      if (original.hostname.endsWith(".translate.goog")) {
        const originalPath = original.pathname;
        const originalHost = original.hostname.replace(/-translate\.goog$/, "").replace(/-/g, ".");
        const url = new URL("https://" + originalHost + originalPath);
        original.searchParams.forEach((value, key) => { if (!key.startsWith("_x_tr_")) url.searchParams.set(key, value); });
        location.href = url.href;
      }
      return;
    }
    // Google Translate's website proxy translates page content and rewrites internal links
    // so visitors can continue navigating pages in their chosen language.
    const host = location.hostname;
    const originalHost = host.endsWith(".translate.goog")
      ? host.replace(/\.translate\.goog$/, "").replace(/-/g, ".")
      : host;
    const translatedHost = originalHost.replace(/\./g, "-") + ".translate.goog";
    const translated = new URL("https://" + translatedHost + location.pathname);
    translated.searchParams.set("_x_tr_sl", "auto");
    translated.searchParams.set("_x_tr_tl", language);
    translated.searchParams.set("_x_tr_hl", "en");
    translated.searchParams.set("_x_tr_pto", "wapp");
    new URLSearchParams(location.search).forEach((value,key) => {
      if (!key.startsWith("_x_tr_")) translated.searchParams.set(key,value);
    });
    location.href = translated.href;
  }

  function bind(root = document) {
    root.querySelectorAll("[data-ag-translate]").forEach(select => {
      if (select.dataset.translateBound === "true") return;
      select.dataset.translateBound = "true";
      select.addEventListener("change", () => translateTo(select.value));
    });
  }

  function addFloatingPicker() {
    if (document.querySelector("[data-ag-shared-header], [data-shared-header-mount]")) return;
    if (document.querySelector(".ag-translate-float")) return;
    const template = document.createElement("div");
    template.innerHTML = selectMarkup();
    const control = template.firstElementChild;
    control.classList.add("ag-translate-float--standalone");
    document.body.appendChild(control);
    bind(control);
  }

  function boot() {
    bind();
    addFloatingPicker();
    window.addEventListener("agrolyst:header-ready", event => bind(event.detail?.header || document));
    const observer = new MutationObserver(() => {
      bind();
      addFloatingPicker();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Avoid keeping a long-lived observer after the shared header and picker are available.
    window.setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();