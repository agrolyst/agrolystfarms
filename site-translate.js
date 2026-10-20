(() => {
  "use strict";
  const ORIGINAL_ORIGIN = "https://agrolystfarms.com";
  const TRANSLATE_PROXY_ORIGIN = "https://agrolystfarms-com.translate.goog";
  const languages = [
    ["en","English"],["ha","Hausa"],["yo","Yoruba"],["ig","Igbo"],
    ["fr","French"],["ar","Arabic"],["es","Spanish"],["pt","Portuguese"],
    ["sw","Swahili"],["hi","Hindi"],["zh-CN","Chinese"],["de","German"]
  ];
  const languageOptions = () => languages.map(([code,name]) =>
    '<option value="' + code + '">' + name + '</option>'
  ).join("");

  function selectMarkup() {
    return '<label class="ag-translate-float ag-translate-float--standalone" aria-label="Translate this page with Google">' +
      '<span aria-hidden="true">文</span>' +
      '<select data-ag-translate aria-label="Translate this page with Google">' +
      '<option value="">Translate page</option>' + languageOptions() +
      '</select></label>';
  }

  function preserveNonTranslationParams(target) {
    new URLSearchParams(location.search).forEach((value, key) => {
      if (!key.startsWith("_x_tr_") && key !== "_x_tr_hl") target.searchParams.set(key, value);
    });
  }

  function translatedPageUrl(language) {
    const target = new URL(TRANSLATE_PROXY_ORIGIN + location.pathname);
    target.searchParams.set("_x_tr_sl", "auto");
    target.searchParams.set("_x_tr_tl", language);
    target.searchParams.set("_x_tr_hl", "en");
    target.searchParams.set("_x_tr_pto", "wapp");
    preserveNonTranslationParams(target);
    if (location.hash) target.hash = location.hash;
    return target;
  }

  function originalPageUrl() {
    const target = new URL(ORIGINAL_ORIGIN + location.pathname);
    preserveNonTranslationParams(target);
    if (location.hash) target.hash = location.hash;
    return target;
  }

  function translateTo(language) {
    if (!language) return;
    const isTranslatedHost = location.hostname.endsWith(".translate.goog");
    if (language === "en") {
      if (isTranslatedHost) location.assign(originalPageUrl().href);
      return;
    }
    const currentTarget = new URLSearchParams(location.search).get("_x_tr_tl");
    if (isTranslatedHost && currentTarget === language) return;
    location.assign(translatedPageUrl(language).href);
  }

  function bind(root = document) {
    root.querySelectorAll("[data-ag-translate]").forEach(select => {
      if (select.dataset.translateBound === "true") return;
      select.dataset.translateBound = "true";
      const selectedLanguage = new URLSearchParams(location.search).get("_x_tr_tl");
      if (selectedLanguage && [...select.options].some(option => option.value === selectedLanguage)) {
        select.value = selectedLanguage;
      }
      select.addEventListener("change", () => translateTo(select.value));
    });
  }

  function addFloatingPicker() {
    if (document.querySelector(".ag-translate-float--standalone")) return;
    if (!document.body) return;
    const template = document.createElement("div");
    template.innerHTML = selectMarkup();
    const control = template.firstElementChild;
    document.body.appendChild(control);
    bind(control);
  }

  function boot() {
    addFloatingPicker();
    bind();
    // Header insertion is asynchronous. Keeping the picker independent of the header
    // means it remains in the same fixed corner on both original and translated pages.
    const observer = new MutationObserver(() => {
      addFloatingPicker();
      bind();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 12000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();