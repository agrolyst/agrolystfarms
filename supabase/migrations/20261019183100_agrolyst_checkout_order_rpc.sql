-- Transactional, server-validated checkout for Agrolyst.
-- Only the trusted create-order Edge Function may execute this function.
create or replace function public.create_checkout_order(
  p_order jsonb, p_items jsonb, p_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_item record; v_product_name text; v_sku text; v_unit_label text;
  v_price numeric(14,2); v_subtotal numeric(14,2) := 0;
  v_delivery_fee numeric(14,2) := 0; v_minimum numeric(14,2) := 0;
  v_total numeric(14,2); v_order_id uuid; v_order_number text; v_payment_id uuid;
  v_fulfillment public.fulfillment_method; v_payment public.payment_method;
  v_zone_id uuid; v_zone_areas text[]; v_zone_fee numeric(14,2);
  v_stock record; v_stock_found boolean; v_options jsonb; v_line jsonb;
  v_lines jsonb := '[]'::jsonb; v_name text; v_phone text;
  v_address text; v_area text; v_state text; v_date timestamptz;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Not authorized to create orders';
  end if;
  if jsonb_typeof(p_order) <> 'object' or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Please provide an order and between 1 and 50 items';
  end if;
  v_name := nullif(btrim(p_order->>'customer_name'), '');
  v_phone := nullif(btrim(p_order->>'customer_phone'), '');
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then raise exception 'Enter a valid customer name'; end if;
  if v_phone is null or length(v_phone) < 7 or length(v_phone) > 30 then raise exception 'Enter a valid phone number'; end if;
  v_fulfillment := (p_order->>'fulfillment')::public.fulfillment_method;
  v_payment := (p_order->>'payment_method')::public.payment_method;
  if v_payment <> 'bank_transfer' then raise exception 'Only bank transfer is currently available at checkout'; end if;
  select value into v_options from public.store_settings where key = 'payment_options';
  if coalesce((v_options->>'bank_transfer_enabled')::boolean, false) is not true then raise exception 'Bank transfer is temporarily unavailable'; end if;
  if nullif(p_order->>'preferred_delivery_at', '') is null then raise exception 'Choose a preferred pickup or delivery date and time'; end if;
  v_date := (p_order->>'preferred_delivery_at')::timestamptz;
  if v_date <= now() or v_date > now() + interval '90 days' then raise exception 'Choose a date within the next 90 days'; end if;
  if v_fulfillment = 'delivery' then
    v_address := nullif(btrim(p_order->>'delivery_address'), '');
    v_area := nullif(btrim(p_order->>'delivery_area'), '');
    v_state := coalesce(nullif(btrim(p_order->>'delivery_state'), ''), 'Ogun');
    if v_address is null then raise exception 'Enter a delivery address'; end if;
    if v_area is null then raise exception 'Choose or enter your delivery area'; end if;
    if nullif(p_order->>'delivery_zone_id', '') is null then raise exception 'Choose a valid delivery zone'; end if;
    v_zone_id := (p_order->>'delivery_zone_id')::uuid;
    select fee, minimum_order_amount, area_names into v_zone_fee, v_minimum, v_zone_areas
    from public.delivery_zones where id = v_zone_id and is_active = true for share;
    if not found then raise exception 'That delivery zone is not available'; end if;
    if coalesce(cardinality(v_zone_areas), 0) > 0 and not (v_area = any(v_zone_areas)) then raise exception 'That delivery area is not served by the selected zone'; end if;
    if lower(v_state) <> lower((select state from public.delivery_zones where id = v_zone_id)) then raise exception 'Delivery state does not match the selected zone'; end if;
    v_delivery_fee := v_zone_fee;
  else
    v_address := null; v_area := null; v_state := null; v_zone_id := null;
  end if;
  for v_item in
    select i.product_id, sum(i.quantity)::numeric(12,3) as quantity
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity numeric)
    group by i.product_id order by i.product_id
  loop
    if v_item.product_id is null or v_item.quantity is null or v_item.quantity <= 0 or v_item.quantity > 1000000 then raise exception 'An order contains an invalid product or quantity'; end if;
    select name, sku, unit_label into v_product_name, v_sku, v_unit_label
    from public.products where id = v_item.product_id and status = 'active' for update;
    if not found then raise exception 'One of the selected products is no longer available'; end if;
    select pp.unit_price into v_price from public.product_prices pp
    where pp.product_id = v_item.product_id and pp.min_quantity <= v_item.quantity
      and (pp.valid_from is null or pp.valid_from <= now())
      and (pp.valid_until is null or pp.valid_until > now())
    order by pp.min_quantity desc limit 1;
    if not found then select base_price into v_price from public.products where id = v_item.product_id; end if;
    if v_price is null or v_price < 0 then raise exception 'A selected product does not have a valid price'; end if;
    select track_stock, quantity_on_hand, quantity_reserved into v_stock
    from public.inventory where product_id = v_item.product_id for update;
    v_stock_found := found;
    if v_stock_found and v_stock.track_stock then
      if (v_stock.quantity_on_hand - v_stock.quantity_reserved) < v_item.quantity then raise exception 'Insufficient stock for %', v_product_name; end if;
      update public.inventory set quantity_reserved = quantity_reserved + v_item.quantity, updated_at = now() where product_id = v_item.product_id;
    end if;
    v_subtotal := v_subtotal + round(v_item.quantity * v_price, 2);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('product_id', v_item.product_id, 'product_name', v_product_name, 'sku', v_sku, 'unit_label', v_unit_label, 'quantity', v_item.quantity, 'unit_price', v_price));
  end loop;
  if v_subtotal <= 0 then raise exception 'Your order total must be greater than zero'; end if;
  if v_fulfillment = 'delivery' and v_subtotal < v_minimum then raise exception 'Home delivery requires a minimum order of NGN %', to_char(v_minimum, 'FM999G999G990D00'); end if;
  v_total := v_subtotal + v_delivery_fee;
  insert into public.orders (user_id, customer_name, customer_email, customer_phone, fulfillment, delivery_address, delivery_area, delivery_state, delivery_zone_id, preferred_delivery_at, delivery_time_slot, delivery_fee, minimum_order_amount, subtotal, total, currency, payment_method, payment_state, customer_notes)
  values (p_user_id, v_name, nullif(btrim(p_order->>'customer_email'), ''), v_phone, v_fulfillment, v_address, v_area, v_state, v_zone_id, v_date, nullif(btrim(p_order->>'delivery_time_slot'), ''), v_delivery_fee, case when v_fulfillment = 'delivery' then v_minimum else 0 end, v_subtotal, v_total, 'NGN', v_payment, 'unpaid', left(coalesce(p_order->>'customer_notes', ''), 2000))
  returning id, order_number into v_order_id, v_order_number;
  for v_line in select value from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, product_id, product_name_snapshot, sku_snapshot, unit_label_snapshot, quantity, unit_price)
    values (v_order_id, (v_line->>'product_id')::uuid, v_line->>'product_name', nullif(v_line->>'sku', ''), v_line->>'unit_label', (v_line->>'quantity')::numeric, (v_line->>'unit_price')::numeric);
  end loop;
  insert into public.payments (order_id, method, status, amount, currency) values (v_order_id, v_payment, 'unpaid', v_total, 'NGN') returning id into v_payment_id;
  insert into public.order_status_events (order_id, to_status, note, created_by) values (v_order_id, 'pending', 'Order placed through website', p_user_id);
  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'payment_id', v_payment_id, 'subtotal', v_subtotal, 'delivery_fee', v_delivery_fee, 'total', v_total, 'currency', 'NGN', 'payment_method', v_payment, 'status', 'pending');
end;
$$;
revoke all on function public.create_checkout_order(jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb, jsonb, uuid) to service_role;
