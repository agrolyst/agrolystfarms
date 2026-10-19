# Agrolyst Supabase shop files

This folder contains the database migration and frontend modules for a Supabase-powered product catalogue.

## Files

- `migrations/20261019180000_agrolyst_shop_foundation.sql` — schema, indexes, initial RLS rules and store settings.
- `supabase-config.js` — project URL and browser-safe publishable key only.
- `supabase-client.js` — shared Supabase browser client.
- `catalog-api.js` — fetches categories/products/pricing/inventory from Supabase; no products are hardcoded.

## Apply the migration

The migration is intended for the existing Agrolyst Supabase project (ref: `rcrgooivgssuerrgnuqw`). Review it, then apply it through the Supabase Dashboard SQL Editor or the Supabase CLI. Back up any important data before applying changes to production.

After applying:
1. Confirm the tables exist under Database > Tables.
2. Add categories and products through the dashboard or an authenticated admin workflow.
3. Add public product images to Supabase Storage and save their public URLs to `products.image_url` / `product_images.image_url`.
4. Replace any existing frontend product cards with calls to `fetchCategories()` and `fetchCatalog()`.

## Security design and important next step

- RLS is enabled for all tables.
- Anonymous users can read only active catalogue rows and active delivery zones.
- Customer-facing roles have no direct permission to insert orders or set order/payment status. This is intentional: order creation and payment verification must be implemented in a trusted server-side Edge Function, which validates the database prices, inventory, minimum delivery order and delivery zone before writing an order.
- Do not expose the Supabase service-role or secret key in website code.
- Payment integrations remain disabled until real merchant credentials and webhook verification are configured.
- Bank details are not stored in source code; add those to a protected admin setting before displaying them during checkout.
- No products or product prices are seeded in the migration.

The initial delivery minimum is configurable as a store setting and delivery-zone field. Confirm the commercial policy before enabling checkout.
