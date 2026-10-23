# Agrolyst onboarding and browser push

## What is included

- the clean `/onboarding/` route (source file `onboarding/index.html`) and `onboarding.js`: authenticated three-step customer profile form; it writes to the signed-in customer's own profiles row.
- auth-experience.css and auth-showcase.js: split-screen login/signup/onboarding presentation with an automatic slideshow that has no manual image controls.
- service-worker.js: persistent browser push event and notification-click handlers.
- supabase/migrations/20261020110000_agrolyst_onboarding_webpush.sql: profile fields, RLS-protected subscriptions and notification history; database triggers enqueue notifications when an order is created or its status changes.
- supabase/functions/push-notification/index.ts: sender for Supabase Database Webhook INSERT events on public.notifications.

## Background notification delivery

The main Supabase project has been configured for Web Push delivery:
- VAPID private/public JWKs and the webhook shared secret are generated and stored in Supabase Vault, not in website code or GitHub.
- The `push-notification` Edge Function reads its configuration through a service-role-only RPC.
- Database triggers call the Edge Function when a notification is created and retry pending/failed notifications when a user registers or refreshes an active push subscription.
- The browser's public VAPID key is in `account/index.html`; deploy the latest GitHub commit to Hostinger so browsers subscribe with the matching key.

### Finish browser-side activation

1. Deploy the latest website commit to HTTPS.
2. Each user must visit `/account/`, open Preferences, enable desktop/browser notifications, and approve the browser permission prompt.
3. Keep the browser installed/available and allow notifications in operating-system settings. The website itself does not need to be open for supported browser/OS combinations.
4. Existing subscriptions created with the previous public key are automatically replaced when that user next enables notifications on the updated site. Pending account announcements are retried after the new subscription is saved.
5. Check `public.notifications.push_status`: `sent` means the push provider accepted delivery; `no_subscribers` means that user has not enabled a subscription yet; `failed` means inspect the Edge Function logs and `push_error`.

No separate private secrets file or manually configured Database Webhook is required for the current setup. Never expose the private VAPID key or webhook secret in client-side code.

## Notes

- Web Push support is browser/OS dependent. Some mobile browsers require the site to be added to the home screen; all browsers require an explicit permission grant.
- If a browser subscription has expired, the sender marks it inactive.
- Customer notification subscriptions and profile data are protected by row-level security; the private VAPID key and webhook secret never appear in browser source.
