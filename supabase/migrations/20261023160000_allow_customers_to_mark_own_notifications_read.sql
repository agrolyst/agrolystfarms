drop policy if exists "Customers can update own notification read status" on public.notifications;
create policy "Customers can update own notification read status"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on table public.notifications from anon, authenticated;
grant update (read_at) on table public.notifications to authenticated;
