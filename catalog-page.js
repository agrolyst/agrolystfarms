import { fetchCatalog, fetchCategories, priceForQuantity } from "./supabase/catalog-api.js";

const $ = id => document.getElementById(id);
const grid = $("catalogGrid");
if (grid) {
  const state = { page: 0, pageSize: 18, categoryId: "", search: "", count: 0, busy: false };
  const money = value => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(value) || 0);
  const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  function safeImage(value) {
    if (typeof value !== "string" || value.length > 2000000) return "";
    if (/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(value)) return value.replace(/[\r\n]/g, "");
    try { const u = new URL(value, location.origin); return u.protocol === "https:" ? u.href : ""; } catch { return ""; }
  }
  async function categories() {
    try {
      const list = await fetchCategories();
      $("catalogCategory").innerHTML = '<option value="">All categories</option>' + list.map(c => '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</option>').join("");
    } catch (error) { console.error("Catalogue categories could not load.", error); }
  }
  function card(p) {
    const images = (p.product_images || []).slice().sort((a,b) => Number(a.sort_order) - Number(b.sort_order));
    const url = safeImage(p.image_url) || safeImage(images[0] && images[0].image_url);
    const photo = url ? '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" decoding="async">' : '<div class="product-image-placeholder"><span aria-hidden="true">🌱</span><small>Product image coming soon</small></div>';
    const price = priceForQuantity(p, 1);
    const priceLabel = Number(price) > 0 ? escapeHtml(money(price)) + ' <span>/ ' + escapeHtml(p.unit_label || "unit") + '</span>' : '<span class="price-on-request">Price on request</span>';
    return '<article class="shop-product-card"><div class="shop-product-image">' + photo + (p.is_featured ? '<span class="product-featured">Featured</span>' : '') + '</div>' +
      '<div class="card-copy"><small>' + escapeHtml((p.categories && p.categories.name) || "Farm products") + '</small><h3>' + escapeHtml(p.name) + '</h3>' +
      '<p>' + escapeHtml(p.short_description || p.description || "Contact Agrolyst for specifications and availability.") + '</p><div class="product-price">' + priceLabel + '</div>' +
      '<div class="product-actions"><a class="btn green" href="index.html#products">Add to cart / order ↗</a><a class="product-chat" href="index.html#contact">Ask about this product →</a></div></div></article>';
  }
  async function load(append) {
    if (state.busy) return;
    state.busy = true;
    if (!append) { state.page = 0; grid.innerHTML = ""; $("catalogStatus").textContent = "Loading current products from Supabase…"; }
    try {
      const result = await fetchCatalog({ categoryId: state.categoryId || null, search: state.search, page: state.page, pageSize: state.pageSize });
      state.count = result.count;
      const markup = result.products.map(card).join("");
      if (append) grid.insertAdjacentHTML("beforeend", markup); else grid.innerHTML = markup;
      if (result.products.length) {
        $("catalogStatus").textContent = "Showing " + Math.min((state.page + 1) * state.pageSize, result.count) + " of " + result.count + " active catalogue product" + (result.count === 1 ? "" : "s") + ".";
      } else {
        $("catalogStatus").textContent = (state.search || state.categoryId)
          ? "No matching products found. Try another search or category."
          : "The live catalogue is being updated. Products will appear here when added and published in Supabase.";
      }
      $("catalogLoadMore").hidden = (state.page + 1) * state.pageSize >= result.count;
    } catch (error) {
      console.error("Supabase catalogue could not load.", error);
      $("catalogStatus").textContent = "We could not load the catalogue right now. Please refresh the page or contact Agrolyst.";
      $("catalogLoadMore").hidden = true;
    } finally { state.busy = false; }
  }
  $("catalogCategory").addEventListener("change", async () => { state.categoryId = $("catalogCategory").value; await load(false); });
  let timer;
  $("catalogSearch").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { state.search = $("catalogSearch").value.trim(); await load(false); }, 300);
  });
  $("catalogLoadMore").addEventListener("click", async () => { state.page += 1; await load(true); });
  categories();
  load(false);
}
