-- Performance indexes for shop foreign keys and profile bootstrap function.
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_status_events_created_by_idx on public.order_status_events(created_by);
create index if not exists orders_delivery_zone_id_idx on public.orders(delivery_zone_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
