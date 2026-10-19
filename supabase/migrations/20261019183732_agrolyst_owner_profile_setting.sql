-- Public, optional owner profile used by the company website.
insert into public.store_settings(key, value)
values ('owner_profile', jsonb_build_object('display_name', '', 'role_title', '', 'biography', '', 'portrait_url', '', 'quote', '', 'image_alt', ''))
on conflict (key) do nothing;

drop policy if exists "Anyone can read public store settings" on public.store_settings;
create policy "Anyone can read public store settings"
on public.store_settings for select to anon, authenticated
using (key in ('store_public', 'delivery_policy', 'payment_options', 'bank_transfer_details', 'owner_profile'));
