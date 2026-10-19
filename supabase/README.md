# Agrolyst Supabase shop files

This folder contains the database migration and frontend modules for a Supabase-powered product catalogue.

## Files

- `migrations/20261019173809_agrolyst_shop_foundation.sql` — schema, initial RLS rules and store settings.
- `migrations/20261019174005_shop_fk_indexes_and_profile_trigger.sql` — foreign-key indexes and profile bootstrap trigger.
- `migrations/20261019174846_agrolyst_checkout_order_rpc.sql` — transactional order creation with server-side price, inventory and delivery checks.
- `migrations/20261019180640_agrolyst_payment_receipts.sql` — private receipt storage and public-configurable bank transfer settings.
- `functions/create-order/index.ts` — source of the deployed `create-order` Edge Function.
- `functions/upload-payment-receipt/index.ts` — source of the deployed private receipt-upload Edge Function.
- `supabase-config.js` — project URL and browser-safe publishable key only.
- `supabase-client.js` — shared Supabase browser client.
- `catalog-api.js` — fetches categories/products/pricing/inventory from Supabase; no products are hardcoded.

## Apply the migration

These migrations have been applied to the existing Agrolyst Supabase project (ref: `rcrgooivgssuerrgnuqw`) and the created tables were verified. For a fresh environment, apply migrations in timestamp order. Back up important data before applying schema changes to another production project.

Current setup status:
1. The migrations have been applied to the existing Agrolyst Supabase project and the tables were verified.
2. The `create-order` Edge Function is deployed and validates checkout input before using the transactional database function.
3. The homepage product section fetches active catalogue items from Supabase. No products or prices are seeded in SQL.

To go live with sales:
1. Add product categories and products in Supabase. Set product prices, unit labels, published status and stock rules.
2. Add product images to Supabase Storage or another public HTTPS image host, then save those URLs in `products.image_url` / `product_images.image_url`.
3. Configure delivery zones, areas, delivery fees and minimum order values in `delivery_zones`.
4. Add verified bank transfer instructions to the customer-facing order follow-up process. Do not send money to unverified bank details.

## Security design and important next step

- RLS is enabled for all tables.
- Anonymous users can read only active catalogue rows and active delivery zones.
- Customer-facing roles have no direct permission to insert orders or set order/payment status. This is intentional: order creation and payment verification must be implemented in a trusted server-side Edge Function, which validates the database prices, inventory, minimum delivery order and delivery zone before writing an order.
- Do not expose the Supabase service-role or secret key in website code.
- Bank transfer order submission and private receipt upload are active. Uploaded receipts remain pending manual verification. Paystack, Flutterwave and pay-on-delivery are not active yet; these require their credentials, server-side verification/webhooks and explicit enablement.
- Bank details are not stored in source code; add those to a protected admin setting before displaying them during checkout.
- No products or product prices are seeded in the migration.

The default delivery-zone minimum is ₦10,000, but actual delivery zones and fees must be configured in `delivery_zones`. Customers may use farm pickup while delivery coverage is being configured.
