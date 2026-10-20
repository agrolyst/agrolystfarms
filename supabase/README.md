# Agrolyst Supabase shop files

This folder contains the database migration and frontend modules for a Supabase-powered product catalogue.

## Files

- `migrations/20261019173809_agrolyst_shop_foundation.sql` — schema, initial RLS rules and store settings.
- `migrations/20261019174005_shop_fk_indexes_and_profile_trigger.sql` — foreign-key indexes and profile bootstrap trigger.
- `migrations/20261019174846_agrolyst_checkout_order_rpc.sql` — transactional order creation with server-side price, inventory and delivery checks.
- `migrations/20261019180640_agrolyst_payment_receipts.sql` — private receipt storage and public-configurable bank transfer settings.
- `migrations/20261019181412_restrict_profile_trigger_function_execution.sql` — removes client RPC access to the internal auth profile trigger.
- `migrations/20261019183732_agrolyst_owner_profile_setting.sql` and `migrations/20261019184026_agrolyst_owner_profile_setting.sql` — the public, optional owner profile setting and read policy.
- `migrations/20261020110000_agrolyst_onboarding_webpush.sql` — customer onboarding profile fields, RLS-protected browser push subscriptions, customer notification history, and order-created/order-status notification triggers.
- `functions/create-order/index.ts` — source of the deployed `create-order` Edge Function.
- `functions/upload-payment-receipt/index.ts` — source of the deployed private receipt-upload Edge Function.
- `functions/push-notification/index.ts` — deployed web push sender for new notification rows; requires VAPID secrets and a Database Webhook configured in the dashboard.
- `supabase-config.js` — project URL and browser-safe publishable key only.
- `supabase-client.js` — shared Supabase browser client.
- `catalog-api.js` — fetches categories/products/pricing/inventory from Supabase; no products are hardcoded.
- `../catalog-page.js` — renders the Supabase catalogue on `/products/`.
- `../owner-profile.js` — optionally fetches the owner name, biography and approved portrait from the `owner_profile` setting.

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


## Owner profile

The website includes a leadership/owner section. The live profile is read from the `store_settings` row with key `owner_profile`, so the site does not invent an owner's name or use a stock photo as their portrait. After the owner approves their public details, fill this row in Supabase SQL Editor, replacing the example values:

```sql
update public.store_settings
set value = jsonb_build_object(
  'display_name', 'OWNER NAME',
  'role_title', 'Founder and Owner',
  'biography', 'OWNER-APPROVED BIOGRAPHY',
  'portrait_url', 'https://YOUR-APPROVED-PUBLIC-PORTRAIT-URL',
  'quote', 'OWNER-APPROVED QUOTE',
  'image_alt', 'Portrait of OWNER NAME, founder of Agrolyst Integrated Farms and Services'
),
updated_at = now()
where key = 'owner_profile';
```

Use the owner's approved portrait hosted at a stable HTTPS URL. No real owner name or portrait was supplied at the time this section was built.

## Security design and important next step

- RLS is enabled for all tables.
- Anonymous users can read only active catalogue rows and active delivery zones.
- Customer-facing roles have no direct permission to insert orders or set order/payment status. This is intentional: the deployed `create-order` Edge Function validates database prices, inventory, minimum delivery order and delivery zone before writing an order. Receipt uploads use a separate Edge Function and remain pending until a person verifies payment.
- Do not expose the Supabase service-role or secret key in website code.
- Bank transfer order submission and private receipt upload are active. Uploaded receipts remain pending manual verification. Paystack, Flutterwave and pay-on-delivery are not active yet; these require their credentials, server-side verification/webhooks and explicit enablement.
- Bank details are not stored in source code; add those to a protected admin setting before displaying them during checkout.
- No products or product prices are seeded in the migration.

The default delivery-zone minimum is ₦10,000, but actual delivery zones and fees must be configured in `delivery_zones`. Customers may use farm pickup while delivery coverage is being configured.

## Customer onboarding and background push notifications

See [the onboarding and push setup guide](ONBOARDING-PUSH.md) for the three-step onboarding flow and the one-time configuration required for web push. The migration is applied to the existing Agrolyst Supabase project. The push sender is deployed, but background delivery is not active until VAPID secrets and the `public.notifications` INSERT webhook are configured in Supabase Dashboard. Never commit private VAPID keys or webhook secrets.
