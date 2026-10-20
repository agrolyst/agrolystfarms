(() => {
  "use strict";
  const root = document.querySelector("[data-board-page]");
  if (!root) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("board-js");
  const revealItems = root.querySelectorAll(".board-reveal");
  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      instance.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -48px 0px", threshold: 0.08 });
  revealItems.forEach(item => observer.observe(item));

  root.querySelectorAll(".board-subnav a").forEach(link => {
    link.addEventListener("click", () => {
      const target = root.querySelector(link.hash);
      if (target) target.setAttribute("tabindex", "-1");
    });
  });
})();