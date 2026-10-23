create or replace function public.register_push_subscription(
  p_endpoint text,
  p_subscription jsonb,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'You must be signed in to register push notifications';
  end if;
  if nullif(trim(p_endpoint), '') is null or p_subscription is null then
    raise exception 'A push endpoint and subscription are required';
  end if;

  insert into public.push_subscriptions
    (user_id, endpoint, subscription, user_agent, is_active, updated_at)
  values
    (v_user_id, p_endpoint, p_subscription, p_user_agent, true, now())
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription,
        user_agent = excluded.user_agent,
        is_active = true,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_subscription(text, jsonb, text) from public, anon;
grant execute on function public.register_push_subscription(text, jsonb, text) to authenticated;
