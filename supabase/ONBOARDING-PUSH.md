# Agrolyst onboarding and browser push

## What is included

- the clean `/onboarding/` route (source file `onboarding/index.html`) and `onboarding.js`: authenticated three-step customer profile form; it writes to the signed-in customer's own profiles row.
- auth-experience.css and auth-showcase.js: split-screen login/signup/onboarding presentation with an automatic slideshow that has no manual image controls.
- service-worker.js: persistent browser push event and notification-click handlers.
- supabase/migrations/20261020110000_agrolyst_onboarding_webpush.sql: profile fields, RLS-protected subscriptions and notification history; database triggers enqueue notifications when an order is created or its status changes.
- supabase/functions/push-notification/index.ts: sender for Supabase Database Webhook INSERT events on public.notifications.

## Background notification setup required

The client subscription flow and database tables are prepared, but actual delivery requires one-time secrets plus a database webhook. A browser cannot send a push notification by itself once the page is closed; the server must sign and send a push message. Users also must consent to browser notifications. See the MDN Push API guide: https://developer.mozilla.org/en-US/docs/Web/API/Push_API

### 1. Add Edge Function secrets

A private file named Agrolyst-Push-Secrets.txt is provided separately. Keep it private and do not commit it to GitHub. In Supabase Dashboard → Project → Edge Functions → Secrets, add these values from that file:

- VAPID_PRIVATE_JWK
- VAPID_PUBLIC_JWK
- PUSH_WEBHOOK_SECRET

Supabase normally provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the Edge Function runtime. If your project runtime does not expose SUPABASE_SERVICE_ROLE_KEY, add the current service-role/secret key as an Edge Function secret with that name. Never put that key in website code.

### 2. Configure the notification database webhook

In Supabase Dashboard → Database → Webhooks, create a webhook:
- Table: public.notifications
- Event: INSERT
- Method: POST
- Target Edge Function: push-notification
- Header Content-Type: application/json
- Header x-agrolyst-push-secret: the PUSH_WEBHOOK_SECRET value from the private file

The function uses verify_jwt=false because Database Webhooks use their own HTTP request; it validates the shared secret header before doing any work. Do not omit that header.

### 3. Test delivery

1. Deploy the latest website to HTTPS.
2. Sign in or create an account and complete onboarding at `/onboarding/`.
3. Tick the optional order/service notification consent and allow notifications in the browser prompt.
4. In Supabase, create a test public.notifications row for that same user_id and confirm its push_status changes to sent. Use a harmless test title/body and url='/account.html'.
5. Confirm a browser/OS notification appears with the website closed or in the background.

Order-created and order-status database triggers create notification rows only for orders linked to a signed-in user. Guest orders cannot be sent to a customer account that does not exist. A status update sends only if the application inserts the corresponding order_status_events row.

## Notes

- Web Push support is browser/OS dependent. Some mobile browsers require the site to be added to the home screen; all browsers require an explicit permission grant.
- If a browser subscription has expired, the sender marks it inactive.
- Customer notification subscriptions and profile data are protected by row-level security; the private VAPID key and webhook secret never appear in browser source.
