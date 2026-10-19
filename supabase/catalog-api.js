import { supabase } from "./supabase-client.js";

/**
 * Returns active products and the category/pricing data for the storefront.
 * Individual products are never hardcoded here.
 */
export async function fetchCatalog({ categoryId = null, search = "", page = 0, pageSize = 24 } = {}) {
  const start = Math.max(0, page) * pageSize;
  let query = supabase
    .from("products")
    .select("id,name,slug,sku,short_description,description,unit_label,unit_quantity,currency,base_price,image_url,is_featured,category_id,categories(id,name,slug),product_images(id,image_url,alt_text,sort_order),product_prices(id,min_quantity,unit_price,label,valid_from,valid_until),inventory(quantity_on_hand,quantity_reserved,track_stock)", { count: "exact" })
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(start, start + pageSize - 1);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (search.trim()) query = query.ilike("name", `%${search.trim().replace(/[%_]/g, "\\$&")}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  return { products: data ?? [], count: count ?? 0 };
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories").select("id,name,slug,description,image_url")
    .eq("is_active", true).order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Uses price tiers fetched from Supabase; tier prices apply at the highest threshold met. */
export function priceForQuantity(product, quantity) {
  const now = Date.now();
  const tiers = (product.product_prices ?? [])
    .filter(t => (!t.valid_from || Date.parse(t.valid_from) <= now) && (!t.valid_until || Date.parse(t.valid_until) > now))
    .filter(t => Number(t.min_quantity) <= quantity)
    .sort((a, b) => Number(b.min_quantity) - Number(a.min_quantity));
  return Number(tiers[0]?.unit_price ?? product.base_price ?? 0);
}


/** Fetch specific product IDs from the database for items already in a customer's cart. */
export async function fetchProductsByIds(ids = []) {
  const uniqueIds = [...new Set(ids)].filter(id => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
  if (!uniqueIds.length) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id,name,slug,sku,short_description,description,unit_label,unit_quantity,currency,base_price,image_url,is_featured,category_id,categories(id,name,slug),product_images(id,image_url,alt_text,sort_order),product_prices(id,min_quantity,unit_price,label,valid_from,valid_until),inventory(quantity_on_hand,quantity_reserved,track_stock)")
    .eq("status", "active")
    .in("id", uniqueIds);
  if (error) throw error;
  return data ?? [];
}
