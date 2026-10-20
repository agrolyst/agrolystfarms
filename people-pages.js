(() => {
"use strict";
const root=document.querySelector("[data-people-page]");
if(!root)return;
if(window.matchMedia("(prefers-reduced-motion: reduce)").matches||!("IntersectionObserver" in window))return;
document.documentElement.classList.add("people-js");
const observer=new IntersectionObserver((entries,instance)=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-in");instance.unobserve(entry.target)}}),{rootMargin:"0px 0px -48px 0px",threshold:.08});
root.querySelectorAll(".people-reveal").forEach(item=>observer.observe(item));
root.querySelectorAll(".people-subnav a").forEach(link=>link.addEventListener("click",()=>{const target=root.querySelector(link.hash);if(target)target.setAttribute("tabindex","-1")}));
})();