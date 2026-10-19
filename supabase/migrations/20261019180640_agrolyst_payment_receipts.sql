-- Private storage for bank-transfer receipts and public, configurable transfer instructions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read public store settings" on public.store_settings;
create policy "Anyone can read public store settings"
on public.store_settings for select to anon, authenticated
using (key in ('store_public', 'delivery_policy', 'payment_options', 'bank_transfer_details'));

insert into public.store_settings(key, value)
values ('bank_transfer_details', jsonb_build_object('bank_name', '', 'account_name', '', 'account_number', '', 'instructions', ''))
on conflict (key) do nothing;
