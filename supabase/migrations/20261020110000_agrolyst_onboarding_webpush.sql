
-- Agrolyst customer onboarding and web push notifications.
alter table public.profiles
  add column if not exists customer_type text,
  add column if not exists business_name text,
  add column if not exists farm_type text,
  add column if not exists farm_scale text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text not null default 'Nigeria',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists push_notifications_enabled boolean not null default false;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, is_active);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Customers can read own push subscriptions" on public.push_subscriptions;
create policy "Customers can read own push subscriptions" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Customers can register own push subscriptions" on public.push_subscriptions;
create policy "Customers can register own push subscriptions" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Customers can update own push subscriptions" on public.push_subscriptions;
create policy "Customers can update own push subscriptions" on public.push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Customers can remove own push subscriptions" on public.push_subscriptions;
create policy "Customers can remove own push subscriptions" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.push_subscriptions to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null default '/account.html',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_status text not null default 'pending' check (push_status in ('pending','sent','no_subscribers','failed')),
  push_attempted_at timestamptz,
  push_sent_at timestamptz,
  push_error text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Customers can read own notifications" on public.notifications;
create policy "Customers can read own notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.notifications to authenticated;

create or replace function public.notify_customer_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    insert into public.notifications(user_id, title, body, url, data)
    values (
      new.user_id,
      'Order received',
      'We have received order ' || new.order_number || '. We will keep you updated as it progresses.',
      '/account.html',
      jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'status', new.status::text)
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_customer_new_order() from public, anon, authenticated;
drop trigger if exists orders_notify_customer_new_order on public.orders;
create trigger orders_notify_customer_new_order
after insert on public.orders
for each row execute function public.notify_customer_new_order();

create or replace function public.notify_customer_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  order_ref text;
  human_status text;
  message_body text;
begin
  if new.to_status is not distinct from new.from_status then
    return new;
  end if;
  select o.user_id, o.order_number into recipient, order_ref
  from public.orders o where o.id = new.order_id;
  if recipient is null then
    return new;
  end if;
  human_status := initcap(replace(new.to_status::text, '_', ' '));
  message_body := 'Your order ' || order_ref || ' is now ' || human_status || '.';
  if new.note is not null and length(trim(new.note)) > 0 then
    message_body := message_body || ' ' || left(trim(new.note), 300);
  end if;
  insert into public.notifications(user_id, title, body, url, data)
  values (
    recipient,
    'Order update: ' || human_status,
    message_body,
    '/account.html',
    jsonb_build_object('order_id', new.order_id, 'order_number', order_ref, 'status', new.to_status::text)
  );
  return new;
end;
$$;
revoke all on function public.notify_customer_order_status() from public, anon, authenticated;
drop trigger if exists order_status_events_notify_customer on public.order_status_events;
create trigger order_status_events_notify_customer
after insert on public.order_status_events
for each row execute function public.notify_customer_order_status();

create or replace function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_push_subscription_updated_at();
