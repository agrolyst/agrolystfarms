-- Agrolyst Integrated Farms: ecommerce foundation
-- Product information and price is managed in Supabase, never embedded per-product in frontend code.
create extension if not exists pgcrypto;

create type public.product_status as enum ('draft', 'active', 'archived');
create type public.order_status as enum ('pending', 'confirmed', 'processing', 'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled');
create type public.payment_status as enum ('unpaid', 'pending_verification', 'paid', 'failed', 'refunded');
create type public.payment_method as enum ('bank_transfer', 'paystack', 'flutterwave', 'pay_on_delivery');
create type public.fulfillment_method as enum ('delivery', 'farm_pickup');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  sku text unique,
  short_description text,
  description text,
  unit_label text not null default 'unit',
  unit_quantity numeric(12,3) not null default 1 check (unit_quantity > 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  base_price numeric(14,2) not null default 0 check (base_price >= 0),
  image_url text,
  is_featured boolean not null default false,
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_active_category_idx on public.products(category_id, status);
create index products_active_created_idx on public.products(status, created_at desc);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_sort_idx on public.product_images(product_id, sort_order);

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  min_quantity numeric(12,3) not null default 1 check (min_quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  label text,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint product_prices_valid_range check (valid_until is null or valid_from is null or valid_until > valid_from),
  constraint product_prices_product_min_unique unique(product_id, min_quantity)
);
create index product_prices_product_quantity_idx on public.product_prices(product_id, min_quantity desc);

create table public.inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  quantity_on_hand numeric(14,3) not null default 0 check (quantity_on_hand >= 0),
  quantity_reserved numeric(14,3) not null default 0 check (quantity_reserved >= 0),
  track_stock boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint inventory_reserved_not_above_on_hand check (quantity_reserved <= quantity_on_hand)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  state text not null default 'Ogun',
  area_names text[] not null default '{}',
  fee numeric(14,2) not null default 0 check (fee >= 0),
  minimum_order_amount numeric(14,2) not null default 10000 check (minimum_order_amount >= 0),
  estimated_days_min integer not null default 1 check (estimated_days_min >= 0),
  estimated_days_max integer not null default 3 check (estimated_days_max >= estimated_days_min),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('AGF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  fulfillment public.fulfillment_method not null,
  delivery_address text,
  delivery_area text,
  delivery_state text,
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  preferred_delivery_at timestamptz,
  delivery_time_slot text,
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  minimum_order_amount numeric(14,2) not null default 0 check (minimum_order_amount >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  status public.order_status not null default 'pending',
  payment_method public.payment_method,
  payment_state public.payment_status not null default 'unpaid',
  customer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_fulfillment_address_check check (
    (fulfillment = 'farm_pickup') or
    (fulfillment = 'delivery' and delivery_address is not null and length(trim(delivery_address)) > 0)
  )
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  sku_snapshot text,
  unit_label_snapshot text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null default 'unpaid',
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'NGN' check (currency = 'NGN'),
  provider_reference text unique,
  receipt_path text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_created_idx on public.payments(order_id, created_at desc);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_created_idx on public.order_status_events(order_id, created_at desc);

-- Public storefront reads active catalogue only. All write paths must be server/admin protected.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_prices enable row level security;
alter table public.inventory enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_events enable row level security;

create policy "Customers can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Customers can insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Customers can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Anyone can read active categories" on public.categories for select to anon, authenticated using (is_active = true);
create policy "Anyone can read active products" on public.products for select to anon, authenticated using (status = 'active');
create policy "Anyone can read images of active products" on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy "Anyone can read prices for active products" on public.product_prices for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active' and (valid_from is null or valid_from <= now()) and (valid_until is null or valid_until > now())));
create policy "Anyone can read inventory availability for active products" on public.inventory for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));

create policy "Anyone can read active delivery zones" on public.delivery_zones for select to anon, authenticated using (is_active = true);
create policy "Anyone can read public store settings" on public.store_settings for select to anon, authenticated using (key in ('store_public', 'delivery_policy', 'payment_options'));

create policy "Customers can read own orders" on public.orders for select to authenticated using ((select auth.uid()) = user_id);
create policy "Customers can read own order items" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "Customers can read own payments" on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "Customers can read own order status history" on public.order_status_events for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.product_prices, public.inventory, public.delivery_zones to anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant select on public.profiles, public.orders, public.order_items, public.payments, public.order_status_events to authenticated;
grant insert, update on public.profiles to authenticated;

-- Bootstrap a profile whenever Supabase Auth creates a new user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Updated-at trigger function; invoker security and explicit search_path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger inventory_set_updated_at before update on public.inventory for each row execute function public.set_updated_at();
create trigger delivery_zones_set_updated_at before update on public.delivery_zones for each row execute function public.set_updated_at();
create trigger store_settings_set_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();

insert into public.store_settings(key, value) values
  ('store_public', jsonb_build_object('name', 'Agrolyst Integrated Farms', 'currency', 'NGN')),
  ('delivery_policy', jsonb_build_object('minimum_home_delivery_order', 10000, 'origin_state', 'Ogun', 'allow_farm_pickup', true)),
  ('payment_options', jsonb_build_object('bank_transfer_enabled', true, 'paystack_enabled', false, 'flutterwave_enabled', false, 'pay_on_delivery_enabled', false))
on conflict (key) do nothing;

-- No individual products or prices are seeded here: all catalogue data is added via Supabase/admin UI.
