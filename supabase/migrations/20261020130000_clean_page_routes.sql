-- Keep stored push-notification destinations aligned with extensionless website routes.
alter table public.notifications
  alter column url set default '/account/';

update public.notifications
set url = replace(url, '.html', '/')
where url like '%.html%';

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
      '/account/',
      jsonb_build_object('order_id', new.id, 'order_number', new.order_number, 'status', new.status::text)
    );
  end if;
  return new;
end;
$$;

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
    '/account/',
    jsonb_build_object('order_id', new.order_id, 'order_number', order_ref, 'status', new.to_status::text)
  );
  return new;
end;
$$;
