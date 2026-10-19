# Agrolyst Integrated Farms and Services

Official Agrolyst Farms website and Supabase-powered product catalogue.

## Public website pages
- `index.html` — homepage, live Supabase catalogue, cart and checkout.
- `about.html` — company profile, mission, vision, philosophy and owner/leadership section.
- `products.html` — product ranges plus catalogue fetched from Supabase.
- `partnerships.html` — manufacturer, supplier, farmer, distributor, investor and institutional partnership opportunities.
- `privacy.html` and `agreement.html` — privacy and terms pages.
- `auth.html`, `callback.html`, `account.html` — customer authentication and account flow.

## SEO and brand
- Page-specific titles, descriptions, canonical URLs and Google verification meta tag.
- Homepage `WebSite` and `OnlineStore` structured data with the official Agrolyst logo.
- Open Graph/social preview metadata, `sitemap.xml` and `robots.txt`.
- Keep `Agrolyst Logo.jpeg` as the official logo, favicon and social/structured-data image.

## Supabase
All catalogue product names, images, prices, stock, and wholesale pricing are loaded from Supabase rather than hardcoded in product-card HTML. Read [the Supabase shop guide](supabase/README.md) for schema, checkout, receipt upload, delivery-zone and owner-profile setup.

Google decides what it displays in Search after it crawls the live deployment. Deploy the latest default-branch changes, then check URLs and submit the sitemap in Google Search Console.
