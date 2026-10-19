import { fetchCatalog, fetchCategories, fetchProductsByIds, priceForQuantity } from "./supabase/catalog-api.js";
import { supabase } from "./supabase/supabase-client.js";

const el = (id) => document.getElementById(id);
const productGrid = el("productGrid");
if (productGrid) {
  const cartKey = "agrolyst-shop-cart-v1";
  const state = { page: 0, pageSize: 24, count: 0, search: "", categoryId: "", loading: false, products: new Map(), zones: [], cart: readCart(), subtotal: 0, fee: 0, minimum: 0, bankDetails: null, currentOrder: null };
  const naira = (value) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(Number(value) || 0);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const safeImage = (url) => {
    if (typeof url !== "string" || url.length > 2000000) return "";
    // Products sometimes have a base64 image URL saved directly in Supabase; allow only image MIME types.
    if (/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/i.test(url)) return url.replace(/[\r\n]/g, "");
    try { const parsed = new URL(url, location.origin); return parsed.protocol === "https:" ? parsed.href : ""; }
    catch { return ""; }
  };
  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(cartKey) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(cartKey, JSON.stringify(state.cart)); } catch { /* A private browser session can disable storage. */ }
    const count = Object.values(state.cart).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
    el("cartCount").textContent = String(count);
  }
  function productPrice(product, qty = 1) { return priceForQuantity(product, qty); }
  function availableStock(product) {
    const inv = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
    if (!inv || !inv.track_stock) return null;
    return Math.max(0, Number(inv.quantity_on_hand || 0) - Number(inv.quantity_reserved || 0));
  }
  function productCard(product) {
    const img = safeImage(product.image_url) || safeImage((product.product_images || []).sort((a,b) => Number(a.sort_order)-Number(b.sort_order))[0]?.image_url);
    const category = product.categories?.name || "Farm products";
    const price = productPrice(product, 1);
    const stock = availableStock(product);
    const outOfStock = stock !== null && stock <= 0;
    const hasPrice = Number(price) > 0;
    return `<article class="shop-product-card">
      <div class="shop-product-image">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">` : '<div class="product-image-placeholder"><span aria-hidden="true">🌱</span><small>Product photo coming soon</small></div>'}
      ${product.is_featured ? '<span class="product-featured">Featured</span>' : ''}</div>
      <div class="card-copy">
        <small>${escapeHtml(category)}</small>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.short_description || product.description || "Contact Agrolyst for product specifications and current availability.")}</p>
        <div class="product-price">${hasPrice ? escapeHtml(naira(price)) + ` <span>/ ${escapeHtml(product.unit_label || "unit")}</span>` : '<span class="price-on-request">Price on request</span>'}</div>
        ${stock !== null ? `<p class="stock-note">${outOfStock ? "Currently out of stock" : `Available: ${escapeHtml(stock)} ${escapeHtml(product.unit_label || "unit")}`}</p>` : ''}
        <div class="product-actions">
          <button type="button" class="btn green add-to-cart" data-add-product="${escapeHtml(product.id)}" ${(!hasPrice || outOfStock) ? "disabled" : ""}>${outOfStock ? "Out of stock" : hasPrice ? "Add to cart" : "Price on request"}</button>
          <button type="button" class="product-chat" data-chat-product="${escapeHtml(product.name)}">Chat to order ↗</button>
        </div>
      </div></article>`;
  }
  async function loadCategories() {
    const select = el("categoryFilter");
    try {
      const categories = await fetchCategories();
      select.innerHTML = '<option value="">All categories</option>' + categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    } catch (error) {
      console.error("Unable to load categories from Supabase", error);
    }
  }
  async function loadZones() {
    const { data, error } = await supabase.from("delivery_zones")
      .select("id,name,state,area_names,fee,minimum_order_amount,estimated_days_min,estimated_days_max")
      .eq("is_active", true).order("name");
    if (error) {
      console.error("Unable to load delivery zones", error);
      state.zones = [];
    } else state.zones = data || [];
    const select = el("deliveryZone");
    select.innerHTML = '<option value="">Choose a delivery zone</option>' + state.zones.map(z =>
      `<option value="${escapeHtml(z.id)}">${escapeHtml(z.name)} · ${escapeHtml(naira(z.fee))}</option>`
    ).join("");
    if (!state.zones.length) {
      el("deliveryFeeMessage").textContent = "Delivery areas have not been configured yet. Please choose farm pickup or contact Agrolyst to arrange delivery.";
    }
    updateDeliverySummary();
  }
  async function loadBankDetails() {
    const { data, error } = await supabase.from("store_settings").select("value").eq("key", "bank_transfer_details").maybeSingle();
    if (error) {
      console.warn("Bank-transfer instructions are not available yet.", error);
      state.bankDetails = null;
    } else state.bankDetails = data?.value || null;
    renderBankTransferDetails();
  }
  function renderBankTransferDetails() {
    const target = el("bankTransferInstructions");
    if (!target) return;
    const d = state.bankDetails || {};
    if (d.bank_name && d.account_name && d.account_number) {
      target.innerHTML = `<h4>Official Agrolyst bank-transfer details</h4>
        <p><strong>Bank:</strong> ${escapeHtml(d.bank_name)}</p>
        <p><strong>Account name:</strong> ${escapeHtml(d.account_name)}</p>
        <p><strong>Account number:</strong> ${escapeHtml(d.account_number)}</p>
        ${d.instructions ? `<p>${escapeHtml(d.instructions)}</p>` : ""}
        <p>After transferring, upload your payment receipt below. Your order remains unpaid until the team verifies it.</p>`;
    } else {
      target.innerHTML = "<h4>Bank transfer instructions</h4><p>Agrolyst has not published verified bank details on the website yet. Please do not transfer money until the team confirms the official account details directly.</p>";
    }
  }
  async function loadProducts({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    if (!append) {
      state.page = 0;
      productGrid.innerHTML = "";
      el("shopStatus").textContent = "Loading current products from our catalogue…";
    }
    try {
      const result = await fetchCatalog({ categoryId: state.categoryId || null, search: state.search, page: state.page, pageSize: state.pageSize });
      state.count = result.count;
      for (const product of result.products) state.products.set(product.id, product);
      if (append) productGrid.insertAdjacentHTML("beforeend", result.products.map(productCard).join(""));
      else productGrid.innerHTML = result.products.map(productCard).join("");
      if (!result.products.length && !append) {
        el("shopStatus").textContent = state.search || state.categoryId
          ? "No matching products were found. Try a different search or category."
          : "Our current catalogue is being updated. New products will appear here once they are added and published in Supabase.";
      } else {
        const displayed = Math.min((state.page + 1) * state.pageSize, state.count);
        el("shopStatus").textContent = `Showing ${displayed} of ${state.count} available catalogue product${state.count === 1 ? "" : "s"}.`;
      }
      el("loadMoreProducts").hidden = (state.page + 1) * state.pageSize >= state.count;
    } catch (error) {
      console.error("Product catalogue request failed", error);
      if (!append) productGrid.innerHTML = "";
      el("shopStatus").textContent = "We could not load the product catalogue just now. Please refresh the page or contact Agrolyst.";
      el("loadMoreProducts").hidden = true;
    } finally { state.loading = false; }
  }
  async function ensureCartProducts() {
    const ids = Object.keys(state.cart).filter(id => Number(state.cart[id]) > 0);
    const missing = ids.filter(id => !state.products.has(id));
    if (missing.length) {
      try { (await fetchProductsByIds(missing)).forEach(product => state.products.set(product.id, product)); }
      catch (error) { console.error("Unable to refresh cart products", error); }
    }
    for (const id of ids) if (!state.products.has(id)) delete state.cart[id];
    saveCart();
  }
  function computeSubtotal() {
    let subtotal = 0;
    for (const [id, qtyRaw] of Object.entries(state.cart)) {
      const product = state.products.get(id);
      const qty = Number(qtyRaw);
      if (product && qty > 0) subtotal += productPrice(product, qty) * qty;
    }
    return Math.round(subtotal * 100) / 100;
  }
  async function renderCart() {
    await ensureCartProducts();
    const lines = Object.entries(state.cart).filter(([id, qty]) => state.products.has(id) && Number(qty) > 0);
    const container = el("cartLines");
    if (!lines.length) container.innerHTML = '<p class="cart-empty">Your cart is empty. Add products from the catalogue to get started.</p>';
    else container.innerHTML = lines.map(([id, qtyRaw]) => {
      const p = state.products.get(id); const qty = Number(qtyRaw);
      const price = productPrice(p, qty);
      const line = price * qty;
      const step = Math.max(.001, Number(p.unit_quantity) || 1);
      return `<div class="cart-line" data-cart-line="${escapeHtml(id)}">
        <div class="cart-line-main"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(naira(price))} per ${escapeHtml(p.unit_label || "unit")}</small></div>
        <div class="quantity-control"><button type="button" data-qty-change="-1" data-product-id="${escapeHtml(id)}" aria-label="Decrease quantity">−</button><span>${escapeHtml(qty)}</span><button type="button" data-qty-change="1" data-step="${escapeHtml(step)}" data-product-id="${escapeHtml(id)}" aria-label="Increase quantity">+</button></div>
        <strong class="cart-line-total">${escapeHtml(naira(line))}</strong>
        <button type="button" class="cart-remove" data-remove-product="${escapeHtml(id)}">Remove</button>
      </div>`;
    }).join("");
    state.subtotal = computeSubtotal();
    el("cartSubtotal").textContent = naira(state.subtotal);
    el("checkoutSubtotal").textContent = naira(state.subtotal);
    el("checkoutDeliveryFee").textContent = naira(state.fee);
    el("checkoutTotal").textContent = naira(state.subtotal + state.fee);
    saveCart();
    updateDeliverySummary();
  }
  function updateDeliverySummary() {
    const fulfillment = el("fulfillment").value;
    const zone = state.zones.find(z => z.id === el("deliveryZone").value);
    state.fee = fulfillment === "delivery" && zone ? Number(zone.fee || 0) : 0;
    state.minimum = fulfillment === "delivery" && zone ? Number(zone.minimum_order_amount || 0) : 0;
    if (fulfillment === "delivery" && zone) {
      el("deliveryFeeMessage").textContent = `Delivery fee: ${naira(state.fee)}. Estimated delivery: ${zone.estimated_days_min}–${zone.estimated_days_max} day(s), subject to confirmation.`;
      el("deliveryState").value = zone.state || "Ogun";
      const options = Array.isArray(zone.area_names) ? zone.area_names : [];
      let dl = el("deliveryAreaOptions");
      if (!dl) { dl = document.createElement("datalist"); dl.id = "deliveryAreaOptions"; el("deliveryArea").insertAdjacentElement("afterend", dl); el("deliveryArea").setAttribute("list", dl.id); }
      dl.innerHTML = options.map(area => `<option value="${escapeHtml(area)}"></option>`).join("");
    }
    if (fulfillment === "delivery" && !zone) {
      el("checkoutPolicy").textContent = state.zones.length ? "Choose a delivery zone to calculate delivery fees and its minimum order." : "Delivery is not available online until delivery zones are added in Supabase. You may choose farm pickup.";
    } else if (fulfillment === "delivery" && state.subtotal < state.minimum) {
      el("checkoutPolicy").textContent = `The selected delivery zone requires a minimum product subtotal of ${naira(state.minimum)}. Your current subtotal is ${naira(state.subtotal)}.`;
    } else if (fulfillment === "delivery") {
      el("checkoutPolicy").textContent = `Your order meets this zone's ${naira(state.minimum)} delivery minimum.`;
    } else {
      el("checkoutPolicy").textContent = "Farm pickup selected. Agrolyst will confirm your pickup time.";
    }
    el("checkoutDeliveryFee").textContent = naira(state.fee);
    el("checkoutTotal").textContent = naira(state.subtotal + state.fee);
  }
  function setFulfillmentUI() {
    const delivery = el("fulfillment").value === "delivery";
    el("deliveryFields").hidden = !delivery;
    el("deliveryZone").required = delivery;
    el("deliveryAddress").required = delivery;
    el("deliveryArea").required = delivery;
    el("deliveryState").required = delivery;
    updateDeliverySummary();
  }
  function addProduct(id, quantity = 1) {
    const product = state.products.get(id);
    if (!product) return;
    const stock = availableStock(product);
    const nextQty = Number(state.cart[id] || 0) + quantity;
    if (stock !== null && nextQty > stock) {
      el("shopStatus").textContent = `Only ${stock} ${product.unit_label || "unit"} currently available for ${product.name}.`;
      return;
    }
    if (productPrice(product, nextQty) <= 0) {
      el("shopStatus").textContent = "This product needs a price to be added to checkout. Please contact Agrolyst.";
      return;
    }
    state.cart[id] = Math.round(nextQty * 1000) / 1000;
    saveCart();
    void renderCart();
    el("shopStatus").textContent = `${product.name} added to your cart.`;
  }
  productGrid.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-product]");
    const chat = event.target.closest("[data-chat-product]");
    if (add) addProduct(add.dataset.addProduct, 1);
    if (chat) {
      const productName = chat.dataset.chatProduct || "a product";
      if (typeof window.openWhatsApp === "function") window.openWhatsApp(`Hello Agrolyst Farms, I would like to enquire about ${productName}. Please share current availability, prices and delivery options.`);
      else location.hash = "#contact";
    }
  });
  el("cartLines").addEventListener("click", (event) => {
    const change = event.target.closest("[data-qty-change]");
    const remove = event.target.closest("[data-remove-product]");
    if (remove) { delete state.cart[remove.dataset.removeProduct]; void renderCart(); return; }
    if (change) {
      const id = change.dataset.productId;
      const current = Number(state.cart[id] || 0);
      const step = Math.max(.001, Number(change.dataset.step) || 1);
      const next = Math.max(0, Math.round((current + Number(change.dataset.qtyChange) * step) * 1000) / 1000);
      if (next <= 0) delete state.cart[id];
      else {
        const product = state.products.get(id);
        const stock = product ? availableStock(product) : null;
        if (stock !== null && next > stock) { el("checkoutStatus").textContent = `Only ${stock} units currently available.`; return; }
        state.cart[id] = next;
      }
      saveCart();
      void renderCart();
    }
  });
  el("cartToggle").addEventListener("click", async () => { el("cartPanel").hidden = false; await renderCart(); el("cartPanel").scrollIntoView({ behavior: "smooth", block: "start" }); });
  el("closeCart").addEventListener("click", () => { el("cartPanel").hidden = true; });
  el("checkoutStart").addEventListener("click", async () => {
    await renderCart();
    if (!Object.keys(state.cart).length) { el("checkoutStatus").textContent = "Add at least one priced product to your cart first."; return; }
    const needsPrice = Object.entries(state.cart).some(([id, qty]) => !state.products.has(id) || productPrice(state.products.get(id), Number(qty)) <= 0);
    if (needsPrice) { el("checkoutStatus").textContent = "One or more items need a current price. Remove them or contact Agrolyst before checkout."; return; }
    el("checkoutPanel").hidden = false;
    el("checkoutPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user) {
        if (user.user_metadata?.full_name || user.user_metadata?.name) el("checkoutName").value = user.user_metadata.full_name || user.user_metadata.name;
        if (user.email) el("checkoutEmail").value = user.email;
        const { data: profile } = await supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle();
        if (profile?.full_name && !el("checkoutName").value) el("checkoutName").value = profile.full_name;
        if (profile?.phone) el("checkoutPhone").value = profile.phone;
      }
    } catch (error) { console.info("Customer profile could not be prefilled; customer can enter details manually.", error); }
  });
  el("fulfillment").addEventListener("change", setFulfillmentUI);
  el("deliveryZone").addEventListener("change", updateDeliverySummary);
  el("loadMoreProducts").addEventListener("click", async () => { state.page += 1; await loadProducts({ append: true }); });
  el("categoryFilter").addEventListener("change", async () => { state.categoryId = el("categoryFilter").value; await loadProducts(); });
  let searchTimer;
  el("productSearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => { state.search = el("productSearch").value.trim(); await loadProducts(); }, 300);
  });
  el("shopCheckoutForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = el("shopCheckoutForm");
    if (!form.reportValidity()) return;
    await renderCart();
    if (!Object.keys(state.cart).length) { el("checkoutStatus").textContent = "Your cart is empty."; return; }
    const fulfillment = el("fulfillment").value;
    const zone = state.zones.find(z => z.id === el("deliveryZone").value);
    if (fulfillment === "delivery" && !zone) { el("checkoutStatus").textContent = "Online delivery is not configured for this area yet. Choose farm pickup or contact us."; return; }
    if (fulfillment === "delivery" && state.subtotal < state.minimum) { el("checkoutStatus").textContent = `Home delivery requires at least ${naira(state.minimum)} in products for this zone.`; return; }
    const date = el("preferredDate").value;
    const slot = el("timeSlot").value;
    const startTime = slot.split("-")[0];
    const chosenDate = new Date(`${date}T${startTime}:00`);
    if (Number.isNaN(chosenDate.getTime()) || chosenDate.getTime() < Date.now() + 30 * 60 * 1000) {
      el("checkoutStatus").textContent = "Choose a date and time slot at least 30 minutes in the future.";
      return;
    }
    const button = el("placeOrderButton");
    button.disabled = true;
    button.textContent = "Placing order…";
    el("checkoutStatus").textContent = "Checking current prices and availability with Supabase…";
    try {
      const items = Object.entries(state.cart).map(([product_id, quantity]) => ({ product_id, quantity: Number(quantity) }));
      const { data, error } = await supabase.functions.invoke("create-order", {
        body: {
          customer: { name: el("checkoutName").value, phone: el("checkoutPhone").value, email: el("checkoutEmail").value },
          fulfillment,
          delivery_address: fulfillment === "delivery" ? el("deliveryAddress").value : null,
          delivery_area: fulfillment === "delivery" ? el("deliveryArea").value : null,
          delivery_state: fulfillment === "delivery" ? el("deliveryState").value : null,
          delivery_zone_id: fulfillment === "delivery" ? zone.id : null,
          preferred_delivery_at: chosenDate.toISOString(),
          delivery_time_slot: slot,
          payment_method: el("paymentMethod").value,
          customer_notes: el("checkoutNotes").value,
          items
        }
      });
      if (error) {
        let detail = error.message || "Order could not be placed.";
        try { const json = await error.context?.json(); if (json?.error) detail = json.error; } catch { /* use message */ }
        throw new Error(detail);
      }
      if (!data?.success || !data.order?.order_number) throw new Error("The order response could not be confirmed. Please contact Agrolyst before retrying.");
      el("confirmedOrderNumber").textContent = data.order.order_number;
      el("confirmedOrderTotal").textContent = `Order total: ${naira(data.order.total)}. Payment status: awaiting bank transfer.`;
      state.currentOrder = { order_number: data.order.order_number, phone: el("checkoutPhone").value };
      el("receiptStatus").textContent = "";
      el("receiptUploadForm").reset();
      renderBankTransferDetails();
      el("checkoutResult").hidden = false;
      el("checkoutPanel").hidden = true;
      el("cartLines").innerHTML = "";
      state.cart = {};
      saveCart();
      el("cartSubtotal").textContent = naira(0);
      el("checkoutStart").hidden = true;
      el("checkoutResult").scrollIntoView({ behavior: "smooth", block: "start" });
      el("shopStatus").textContent = `Order ${data.order.order_number} placed successfully.`;
    } catch (error) {
      console.error("Checkout failed", error);
      el("checkoutStatus").textContent = error.message || "Order could not be placed. Please try again or contact Agrolyst.";
    } finally {
      button.disabled = false;
      button.textContent = "Place order ↗";
    }
  });
  el("receiptUploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.currentOrder) { el("receiptStatus").textContent = "Place an order first, then submit its receipt."; return; }
    const file = el("receiptFile").files?.[0];
    if (!file) { el("receiptStatus").textContent = "Choose a receipt file first."; return; }
    if (file.size > 5 * 1024 * 1024) { el("receiptStatus").textContent = "The receipt must be 5 MB or smaller."; return; }
    const button = el("uploadReceiptButton");
    button.disabled = true;
    button.textContent = "Uploading receipt…";
    el("receiptStatus").textContent = "Submitting your receipt securely…";
    try {
      const formData = new FormData();
      formData.set("order_number", state.currentOrder.order_number);
      formData.set("customer_phone", state.currentOrder.phone);
      formData.set("receipt", file);
      const { data, error } = await supabase.functions.invoke("upload-payment-receipt", { body: formData });
      if (error) {
        let detail = error.message || "Receipt submission failed.";
        try { const json = await error.context?.json(); if (json?.error) detail = json.error; } catch { /* use message */ }
        throw new Error(detail);
      }
      if (!data?.success) throw new Error(data?.error || "Receipt submission could not be confirmed.");
      el("receiptStatus").textContent = data.message || "Receipt received and awaiting verification.";
      el("receiptUploadForm").reset();
    } catch (error) {
      console.error("Receipt upload failed", error);
      el("receiptStatus").textContent = error.message || "Receipt submission failed. Please try again.";
    } finally {
      button.disabled = false;
      button.textContent = "Submit payment receipt ↗";
    }
  });
  el("finishOrder").addEventListener("click", () => {
    state.currentOrder = null;
    el("checkoutResult").hidden = true;
    el("checkoutPanel").hidden = true;
    el("checkoutStart").hidden = false;
    el("cartPanel").hidden = true;
    el("productSearch").value = "";
    state.search = "";
    void loadProducts();
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  });
  const today = new Date();
  el("preferredDate").min = [today.getFullYear(), String(today.getMonth()+1).padStart(2,"0"), String(today.getDate()).padStart(2,"0")].join("-");
  loadCategories();
  loadZones();
  loadBankDetails();
  void loadProducts();
  void renderCart();
}
