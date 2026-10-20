
(() => {
  "use strict";
  const slides = Array.from(document.querySelectorAll("[data-auth-showcase] .auth-slide"));
  if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let active = Math.max(0, slides.findIndex(slide => slide.classList.contains("is-active")));
  let timer = null;
  const advance = () => {
    slides[active].classList.remove("is-active");
    active = (active + 1) % slides.length;
    slides[active].classList.add("is-active");
  };
  const start = () => { if (!timer) timer = window.setInterval(advance, 6400); };
  const stop = () => { if (timer) window.clearInterval(timer); timer = null; };
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  start();
})();
