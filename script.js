// Configure these values before launch.
const BUSINESS_EMAIL = "replace-with-your-email@example.com";
// International digits only, e.g. Nigeria: 2348012345678 (no +, spaces or leading local 0).
const WHATSAPP_NUMBER = "2340000000000";

function whatsappUrl(message) {
  const number = String(WHATSAPP_NUMBER).replace(/\D/g, "");
  if (!number || number === "2340000000000") {
    alert("Please add Agrolyst Farms' real WhatsApp number in script.js before launch.");
    return null;
  }
  return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
}
function openWhatsApp(message) {
  const url = whatsappUrl(message);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
const menu = document.getElementById("menu");
const nav = document.getElementById("nav");
menu?.addEventListener("click", () => {
  const opened = nav.classList.toggle("open");
  menu.setAttribute("aria-expanded", String(opened));
  menu.textContent = opened ? "×" : "☰";
});
nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => nav.classList.remove("open")));
document.getElementById("year").textContent = new Date().getFullYear();

document.querySelectorAll("[data-product]").forEach(button => {
  button.addEventListener("click", () => {
    const product = button.getAttribute("data-product");
    openWhatsApp("Hello Agrolyst Farms, I am interested in " + product + ". Please share current availability, prices and delivery options.");
  });
});
document.getElementById("floatingWa")?.addEventListener("click", event => {
  event.preventDefault();
  openWhatsApp("Hello Agrolyst Farms, I would like to make a product enquiry.");
});
document.getElementById("whatsappForm")?.addEventListener("click", () => {
  const form = document.getElementById("contactForm");
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  openWhatsApp("Hello Agrolyst Farms, I would like to make an enquiry.\n\nName: " + data.get("name") +
    "\nEmail: " + data.get("email") + "\nInterest: " + data.get("interest") +
    "\n\nMessage: " + data.get("message"));
});
document.getElementById("contactForm")?.addEventListener("submit", event => {
  event.preventDefault();
  if (BUSINESS_EMAIL.includes("replace-with-your-email")) {
    alert("Please add Agrolyst Farms' real business email in script.js before launch.");
    return;
  }
  const data = new FormData(event.currentTarget);
  const subject = encodeURIComponent("Agrolyst Farms enquiry: " + data.get("interest"));
  const body = encodeURIComponent("Name: " + data.get("name") + "\nEmail: " + data.get("email") +
    "\nInterest: " + data.get("interest") + "\n\nMessage:\n" + data.get("message"));
  window.location.href = "mailto:" + BUSINESS_EMAIL + "?subject=" + subject + "&body=" + body;
});