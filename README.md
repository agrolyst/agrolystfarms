# Agrolyst Integrated Farms and Services

Official Agrolyst Farms website and Supabase-powered product catalogue.

## Public website pages
- `index.html` — homepage, live Supabase catalogue, cart and checkout.
- `/about/` — company profile, mission, vision, philosophy and owner/leadership section.
- `/products/` — product ranges plus catalogue fetched from Supabase.
- `/partnerships/` — manufacturer, supplier, farmer, distributor, investor and institutional partnership opportunities.
- `/privacy/` and `/agreement/` — privacy and terms pages.
- `/login/` and `/signup/` — dedicated customer authentication pages with page-specific SEO metadata.
- `auth.html`, `/callback/`, `/account/` — legacy authentication and customer account flow (kept out of the public sitemap where appropriate).

## SEO and brand
- Page-specific titles, descriptions, canonical URLs, indexable public login/signup pages, XML sitemap and Google verification meta tag.
- Homepage `WebSite` and `OnlineStore` structured data with the official Agrolyst logo.
- Stable root-level `/favicon.jpeg` is an exact copy of the official square 1080 × 1080 logo and is used for browser/search favicon, social previews and organization logo metadata.
- Open Graph/social preview metadata, `sitemap.xml`, `robots.txt` and the installable web app manifest.
- Keep `Agrolyst Logo.jpeg` as the original source asset; `/favicon.jpeg` is a no-space URL alias with identical image bytes for crawlers.

## Supabase
All catalogue product names, images, prices, stock, and wholesale pricing are loaded from Supabase rather than hardcoded in product-card HTML. Read [the Supabase shop guide](supabase/README.md) for schema, checkout, receipt upload, delivery-zone and owner-profile setup.

Google decides what it displays in Search after it crawls the live deployment. Deploy the latest default-branch changes, then check URLs and submit the sitemap in Google Search Console.

## Customer onboarding and notifications
- The profile setup page stores private customer details in the RLS-protected `profiles` table.
- Web push subscriptions are saved to `push_subscriptions`, and order notifications are recorded in `notifications`.
- For background push delivery, follow `supabase/ONBOARDING-PUSH.md` to add the VAPID and webhook secrets and configure a webhook in the Supabase Dashboard. Do not commit the private push-key file or any Edge Function secret.

The customer profile setup is served at `https://agrolystfarms.com/onboarding/` from `onboarding/index.html`. The old `/onboarding.html` URL redirects to the clean route.
## Shared header and navigation

The desktop dropdown and mobile navigation are stored in one shared partial so menu changes do not need to be copied between pages.

- `partials/site-header.html` — the shared header and all dropdown menu links.
- `shared-header.css` — the header layout, dropdown appearance and responsive menu styles.
- `shared-header.js` — loads the partial, handles dropdowns and mobile navigation, and updates the account link.
- `site-translate.js` and `site-translate.css` — language selection using Google Translate's website-translation route.

Pages using the shared header include the homepage, About Us, Products, Partnerships, Account, Privacy, Terms, and each individual page in the dropdown menus.

To add the header to another page, include `<div data-shared-header-mount></div>` where the header should appear, add `<link rel="stylesheet" href="/shared-header.css">` in the document head, and load `<script src="/shared-header.js" defer></script>` before `</body>`. Also include `site-translate.css` and `site-translate.js` if the new page should have the same language selector.

### Separate navigation pages

About Us: `/about/`, `/team/`, `/board/`, `/partners/`, `/ambassadors/`, `/careers/`.

Products: `/products/`, `/agribusiness-accelerator/`, `/agribusiness-brand-strategy-masterclass/`.

Community: `/our-communities/`, `/marketplace/`, `/add-testimonial/`.

Opportunities: `/associate-directory/`, `/data/`, `/events/`, `/training-workshop/`, `/financial-support/`, `/capacity-building/`.

Narrative Changers: `/podcast/`, `/food-culture/`, `/agribusiness-clinic/`, `/agrifood-webinar-series/`, `/news-updates/`.

### Translation

The language selector opens the selected page through Google Translate's website translation proxy, allowing translated pages to keep navigating to other translated URLs. This is distinct from the legacy embedded Website Translator widget, which Google says is no longer supported from October 1, 2026. For on-site API-based translation rather than Google's translated-site view, configure Google Cloud Translation and its API credentials separately.
