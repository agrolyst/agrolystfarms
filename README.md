# Agrolyst Integrated Farms

Official Agrolyst Farms website and Supabase-powered product catalogue.

## Website

- Homepage and live catalogue: `index.html` (products are fetched from Supabase; no individual products are hardcoded).
- Customer sign-in, account and legal pages: `auth.html`, `account.html`, `privacy.html`, `agreement.html`.
- SEO: page-specific titles and descriptions, Google site verification tag, Open Graph metadata, homepage WebSite/OnlineStore structured data, `sitemap.xml` and `robots.txt`.
- Brand assets: keep `Agrolyst Logo.jpeg` as the official logo, favicon and social/structured-data image.

## Supabase shop setup

See [Supabase shop README](supabase/README.md) for database migrations, catalog API, deployed order creation function, required product setup, delivery-zone configuration and payment limitations.

Products, their categories, prices, quantity pricing, inventory and availability must be maintained in Supabase rather than in the website source.
