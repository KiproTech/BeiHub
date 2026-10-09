-- =====================================================================
--  beihub_migration.sql   -   BeiHub "single business" upgrade
--
--  BeiHub is ONE business, not a marketplace. This migration:
--    1. makes Supabase the single source of truth for business information
--       (validated on the server, not only in the browser)
--    2. removes the multi-shop marketplace concept from the database
--       (data is migrated / archived, never blindly deleted)
--    3. adds predefined cancellation reasons and predefined customer updates
--    4. turns on Supabase Realtime for the shared tables
--    5. re-states every RLS / storage policy so ONLY the admin can write
--
--  RUN ORDER (Supabase Dashboard > SQL Editor)
--    1. supabase/BeiHub_database.sql                     original schema + sample data
--    2. supabase/archive/01_marketplace_upgrade.sql      the previous upgrade (shops, orders, audit ...)
--    3. supabase/beihub_migration.sql                    THIS FILE
--  If steps 1 and 2 were already run on your project, run ONLY this file.
--
--  SAFE TO RE-RUN: every statement is idempotent. Existing rows are kept.
--
--  WHAT IS REUSED (nothing duplicated)
--    store_settings is still THE business-information record (id = 1).
--    products / variants / images / categories / orders / order_items /
--    order_events / notifications / site_media / audit_log / delivery_locations.
--
--  WHAT IS NEW
--    order_cancellation_reasons, order_update_templates (+ 2 RPCs),
--    store_settings.delivery_info, orders.cancellation_reason_code.
--
--  AFTER RUNNING (cannot be done in SQL)
--    Authentication > Providers > Email > "Confirm email" ON
--    Authentication > URL Configuration > Site URL + Redirect URLs
--    Database > Replication: confirm the tables listed in section 6 show as enabled
-- =====================================================================

do $$
begin
  if to_regclass('public.order_events') is null or to_regclass('public.site_media') is null then
    raise exception 'Run supabase/BeiHub_database.sql and supabase/archive/01_marketplace_upgrade.sql before this file.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 1. BUSINESS INFORMATION  (store_settings = the one and only record)
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column if not exists delivery_info text;

-- Server-side validation + clean-up. The browser validates too, but the database is the authority:
-- whatever the admin saves is trimmed, checked, and then identical for every visitor.
create or replace function public.store_settings_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_phone_re text := '^\+?[0-9][0-9 ()\-]{5,24}$';
  v_email_re text := '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  v_url_re   text := '^https?://[^\s]+$';
begin
  new.business_name        := btrim(coalesce(new.business_name, ''));
  new.tagline              := nullif(btrim(new.tagline), '');
  new.phone                := nullif(btrim(new.phone), '');
  new.whatsapp             := nullif(regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g'), '');   -- digits only, e.g. 254712345678
  new.email                := lower(nullif(btrim(new.email), ''));
  new.address              := nullif(btrim(new.address), '');
  new.county               := nullif(btrim(new.county), '');
  new.business_hours       := nullif(btrim(new.business_hours), '');
  new.about                := nullif(btrim(new.about), '');
  new.delivery_info        := nullif(btrim(new.delivery_info), '');
  new.payment_instructions := nullif(btrim(new.payment_instructions), '');
  new.support_phone        := nullif(btrim(new.support_phone), '');
  new.support_email        := lower(nullif(btrim(new.support_email), ''));
  new.support_hours        := nullif(btrim(new.support_hours), '');
  new.other_contact_info   := nullif(btrim(new.other_contact_info), '');
  new.google_maps_url      := nullif(btrim(new.google_maps_url), '');
  new.facebook_url         := nullif(btrim(new.facebook_url), '');
  new.instagram_url        := nullif(btrim(new.instagram_url), '');
  new.twitter_url          := nullif(btrim(new.twitter_url), '');
  new.tiktok_url           := nullif(btrim(new.tiktok_url), '');
  new.youtube_url          := nullif(btrim(new.youtube_url), '');

  if char_length(new.business_name) not between 1 and 120 then
    raise exception 'Enter your business name (1 to 120 characters).' using errcode = '22023';
  end if;

  -- Only fields that actually change are validated, so old data never blocks an unrelated save.
  if tg_op = 'INSERT' or new.phone is distinct from old.phone then
    if new.phone is not null and new.phone !~ v_phone_re then
      raise exception 'The business phone number looks invalid. Use digits, spaces, + ( ) or -.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' or new.support_phone is distinct from old.support_phone then
    if new.support_phone is not null and new.support_phone !~ v_phone_re then
      raise exception 'The support phone number looks invalid. Use digits, spaces, + ( ) or -.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' or new.whatsapp is distinct from old.whatsapp then
    if new.whatsapp is not null and new.whatsapp !~ '^[0-9]{9,15}$' then
      raise exception 'The WhatsApp number must have 9 to 15 digits (for example 254712345678).' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    if new.email is not null and new.email !~ v_email_re then
      raise exception 'The business email address looks invalid.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' or new.support_email is distinct from old.support_email then
    if new.support_email is not null and new.support_email !~ v_email_re then
      raise exception 'The support email address looks invalid.' using errcode = '22023';
    end if;
  end if;
  -- explicit per-column checks (a NOT IN over NULLs would silently skip the test)
  if (tg_op = 'INSERT' or new.google_maps_url is distinct from old.google_maps_url) and new.google_maps_url is not null and new.google_maps_url !~ v_url_re then
    raise exception 'Links must start with http:// or https://  (map link).' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.facebook_url is distinct from old.facebook_url) and new.facebook_url is not null and new.facebook_url !~ v_url_re then
    raise exception 'Links must start with http:// or https://  (Facebook).' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.instagram_url is distinct from old.instagram_url) and new.instagram_url is not null and new.instagram_url !~ v_url_re then
    raise exception 'Links must start with http:// or https://  (Instagram).' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.twitter_url is distinct from old.twitter_url) and new.twitter_url is not null and new.twitter_url !~ v_url_re then
    raise exception 'Links must start with http:// or https://  (X / Twitter).' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.tiktok_url is distinct from old.tiktok_url) and new.tiktok_url is not null and new.tiktok_url !~ v_url_re then
    raise exception 'Links must start with http:// or https://  (TikTok).' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.youtube_url is distinct from old.youtube_url) and new.youtube_url is not null and new.youtube_url !~ v_url_re then
    raise exception 'Links must start with http:// or https://  (YouTube).' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists store_settings_normalize_biu on public.store_settings;
create trigger store_settings_normalize_biu before insert or update on public.store_settings
  for each row execute function public.store_settings_normalize();

-- Make sure the single record exists (the app can never run without it).
insert into public.store_settings (id) values (1) on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 2. MARKETPLACE -> SINGLE BUSINESS: keep the useful data
--    If the old default shop holds contact details that the central
--    settings are missing, they are copied across. Settings that are
--    already filled in always win (they are what customers see today).
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.shops') is not null then
    update public.store_settings s set
      phone          = coalesce(nullif(btrim(s.phone), ''),          nullif(btrim(sh.phone), '')),
      whatsapp       = coalesce(nullif(btrim(s.whatsapp), ''),       nullif(btrim(sh.whatsapp), '')),
      email          = coalesce(nullif(btrim(s.email), ''),          nullif(btrim(sh.email), '')),
      address        = coalesce(nullif(btrim(s.address), ''),        nullif(btrim(sh.address), '')),
      county         = coalesce(nullif(btrim(s.county), ''),         nullif(btrim(sh.county), '')),
      business_hours = coalesce(nullif(btrim(s.business_hours), ''), nullif(btrim(sh.opening_hours), '')),
      about          = coalesce(nullif(btrim(s.about), ''),          nullif(btrim(sh.description), ''))
    from (select * from public.shops where status = 'approved' order by created_at limit 1) sh
    where s.id = 1;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. REMOVE THE MULTI-SHOP LOGIC
--    Order matters: policies -> functions that read shop_id -> columns -> table.
-- ---------------------------------------------------------------------

-- 3a. Policies that depend on shops / shop ownership
do $$
begin
  if to_regclass('public.shops') is not null then
    drop policy if exists "shops: public read"  on public.shops;
    drop policy if exists "shops: admin write"  on public.shops;
    drop policy if exists "shops: owner update" on public.shops;
    drop trigger if exists shops_updated_at on public.shops;
    drop trigger if exists shops_guard_bu   on public.shops;
    drop trigger if exists audit_shops_aiud on public.shops;
  end if;
end $$;

drop policy if exists "products: owner write"        on public.products;
drop policy if exists "product_images: owner write"  on public.product_images;
drop policy if exists "product_variants: owner write" on public.product_variants;

drop policy if exists "product-images: admin or owner upload" on storage.objects;
drop policy if exists "product-images: admin or owner update" on storage.objects;
drop policy if exists "product-images: admin or owner delete" on storage.objects;

-- 3b. Public visibility no longer depends on a shop
create or replace function public.product_is_public(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.products p where p.id = p_product and p.is_active);
$$;

drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products
  for select using (is_active or public.is_admin());

drop policy if exists "product_images: public read" on public.product_images;
create policy "product_images: public read" on public.product_images
  for select using (public.is_admin() or public.product_is_public(product_id));

drop policy if exists "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants
  for select using (public.is_admin() or public.product_is_public(product_id));

-- 3c. Triggers / functions that still mention shop_id
create or replace function public.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('product.created', 'product', new.id::text, new.name, null, jsonb_build_object('status', new.status));
  elsif tg_op = 'DELETE' then
    perform public.write_audit('product.deleted', 'product', old.id::text, old.name, jsonb_build_object('name', old.name, 'status', old.status), null);
  elsif new.status is distinct from old.status then
    perform public.write_audit('product.status_changed', 'product', new.id::text, new.name, jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  elsif new.name is distinct from old.name or new.category_id is distinct from old.category_id
        or new.description is distinct from old.description then
    perform public.write_audit('product.updated', 'product', new.id::text, new.name,
      public.jsonb_changed(to_jsonb(old), to_jsonb(new), array['updated_at', 'specs', 'is_active']) -> 'old',
      public.jsonb_changed(to_jsonb(old), to_jsonb(new), array['updated_at', 'specs', 'is_active']) -> 'new');
  end if;
  return null;
end;
$$;

-- 3d. submit_order without shops (prices are still read from the database; the browser never sends one)
create or replace function public.submit_order(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_name      text := nullif(btrim(p_customer ->> 'customer_name'), '');
  v_phone     text := nullif(btrim(p_customer ->> 'phone'), '');
  v_alt       text := nullif(btrim(p_customer ->> 'alternative_phone'), '');
  v_whatsapp  text := nullif(btrim(p_customer ->> 'whatsapp'), '');
  v_email     text := lower(nullif(btrim(p_customer ->> 'customer_email'), ''));
  v_pref      text := coalesce(nullif(btrim(p_customer ->> 'preferred_contact'), ''), 'phone');
  v_method    text := coalesce(nullif(btrim(p_customer ->> 'fulfilment_method'), ''), 'delivery');
  v_county    text := nullif(btrim(p_customer ->> 'county'), '');
  v_town      text := nullif(btrim(p_customer ->> 'town'), '');
  v_location  text := nullif(btrim(p_customer ->> 'delivery_location'), '');
  v_notes     text := nullif(btrim(p_customer ->> 'notes'), '');
  v_date      date;
  s           public.store_settings;
  v_item      jsonb;
  v_row       record;
  v_qty       integer;
  v_lines     jsonb := '[]'::jsonb;
  v_subtotal  numeric(12, 2) := 0;
  v_fee       numeric(12, 2) := 0;
  v_total     numeric(12, 2);
  v_deposit   numeric(12, 2);
  v_balance   numeric(12, 2);
  v_order_id  uuid;
  v_number    text;
  v_created   timestamptz;
begin
  -- who may order
  if v_uid is null then
    raise exception 'Please log in or create an account to place an order.' using errcode = '28000';
  end if;
  if not public.is_email_verified() then
    raise exception 'Please verify your email address before placing an order.' using errcode = '28000';
  end if;
  if public.is_suspended() then
    raise exception 'Your account is suspended. Please contact support.' using errcode = '42501';
  end if;

  -- contact details
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Customer details are missing.' using errcode = '22023';
  end if;
  if v_email is null then
    select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  end if;
  if v_name is null or v_phone is null then
    raise exception 'Please fill in your full name and phone number.' using errcode = '22023';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if v_pref not in ('phone', 'whatsapp', 'email') then
    raise exception 'Invalid preferred contact method.' using errcode = '22023';
  end if;
  if v_method not in ('delivery', 'pickup') then
    raise exception 'Invalid fulfilment method.' using errcode = '22023';
  end if;
  if v_method = 'delivery' then
    if v_county is null or v_town is null or v_location is null then
      raise exception 'Please fill in your county, town and delivery location.' using errcode = '22023';
    end if;
  else
    v_county := coalesce(v_county, 'Pickup');
    v_town := coalesce(v_town, 'Pickup');
    v_location := coalesce(v_location, 'Customer pickup');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your order list is empty.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many items in one order.' using errcode = '22023';
  end if;

  begin
    v_date := nullif(p_customer ->> 'preferred_delivery_date', '')::date;
  exception when others then
    v_date := null;
  end;

  -- abuse guard: max 5 orders per customer per 10 minutes
  if (select count(*) from public.orders o
       where (o.user_id = v_uid or o.phone = v_phone) and o.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many orders in a short time. Please wait a few minutes.' using errcode = '22023';
  end if;

  select * into s from public.store_settings where id = 1;
  if not found then
    raise exception 'Store settings are missing. Please contact us.' using errcode = '22023';
  end if;

  -- price every line from the database (the browser can never send a price)
  for v_item in select jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 100 then
      raise exception 'Invalid quantity.' using errcode = '22023';
    end if;

    select
      pv.id as variant_id, pv.label, pv.sku, pv.price, pv.availability, pv.stock,
      p.id as product_id, p.name as product_name, p.status as product_status,
      (select pi.url from public.product_images pi
        where pi.product_id = p.id
        order by pi.is_main desc, pi.sort_order asc
        limit 1) as image_url
    into v_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item ->> 'variant_id')::uuid
      and p.is_active;

    if not found then
      raise exception 'A product in your list is no longer available. Please refresh the page and try again.' using errcode = '22023';
    end if;
    if v_row.product_status = 'out_of_stock'
       or v_row.availability = 'out_of_stock'
       or (v_row.availability = 'in_stock' and v_row.stock <= 0) then
      raise exception '% (%) is currently out of stock.', v_row.product_name, v_row.label using errcode = '22023';
    end if;
    if v_row.availability = 'in_stock' and v_qty > v_row.stock then
      raise exception 'Only % of % (%) left in stock.', v_row.stock, v_row.product_name, v_row.label using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + v_row.price * v_qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_row.product_id, 'variant_id', v_row.variant_id,
      'product_name', v_row.product_name, 'variant_label', v_row.label, 'sku', v_row.sku,
      'image_url', v_row.image_url, 'unit_price', v_row.price, 'quantity', v_qty));
  end loop;

  if v_method = 'delivery' then
    v_fee := public.compute_delivery_fee(v_county, v_town, v_subtotal);
  end if;
  v_total   := v_subtotal + v_fee;
  v_deposit := round(v_total * s.deposit_percent / 100, 2);
  v_balance := v_total - v_deposit;

  insert into public.orders (
    user_id, customer_name, phone, alternative_phone, whatsapp, customer_email, preferred_contact, fulfilment_method,
    county, town, delivery_location, preferred_delivery_date, notes,
    subtotal, delivery_fee, total, deposit_percent, deposit_amount, balance_amount
  ) values (
    v_uid, v_name, v_phone, v_alt, v_whatsapp, v_email, v_pref, v_method,
    v_county, v_town, v_location, v_date, v_notes,
    v_subtotal, v_fee, v_total, s.deposit_percent, v_deposit, v_balance
  )
  returning id, order_number, created_at into v_order_id, v_number, v_created;

  insert into public.order_items (order_id, product_id, variant_id, product_name, variant_label, sku, image_url, unit_price, quantity)
  select v_order_id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid,
         l ->> 'product_name', l ->> 'variant_label', l ->> 'sku', l ->> 'image_url',
         (l ->> 'unit_price')::numeric, (l ->> 'quantity')::integer
  from jsonb_array_elements(v_lines) as l;

  insert into public.order_events (order_id, event_type, to_status, title, message, actor_id)
  values (v_order_id, 'submitted', 'pending', 'Order submitted',
          'We received your order. It is pending while our team reviews it.', v_uid);

  perform public.queue_notification(v_uid, v_order_id, 'order_submitted', 'Order submitted',
    format('Your order %s was received and is pending. Our team will contact you to confirm it. A payment of up to %s%% may be required.',
           v_number, trim(to_char(s.deposit_percent, 'FM999990.##'))));

  return jsonb_build_object(
    'id', v_order_id, 'order_number', v_number, 'status', 'pending', 'payment_status', 'unpaid', 'created_at', v_created,
    'customer_name', v_name, 'phone', v_phone, 'alternative_phone', v_alt, 'whatsapp', v_whatsapp,
    'customer_email', v_email, 'preferred_contact', v_pref, 'fulfilment_method', v_method,
    'county', v_county, 'town', v_town, 'delivery_location', v_location,
    'preferred_delivery_date', v_date, 'notes', v_notes,
    'subtotal', v_subtotal, 'delivery_fee', v_fee, 'total', v_total,
    'deposit_percent', s.deposit_percent, 'deposit_amount', v_deposit, 'balance_amount', v_balance,
    'items', v_lines);
end;
$$;

-- 3e. Drop the shop helper functions, then the columns
drop function if exists public.storage_path_owner(text);
drop function if exists public.product_is_mine(uuid);
drop function if exists public.is_shop_owner(uuid);
drop function if exists public.shop_is_public(uuid);
drop function if exists public.audit_shop_change();
drop function if exists public.shops_guard();

alter table public.products    drop column if exists shop_id;
alter table public.order_items drop column if exists shop_id;
drop index if exists public.products_shop_idx;
drop index if exists public.order_items_shop_idx;

-- 3f. The shops table itself.
--     Empty (a fresh install)  -> dropped.
--     Contains rows            -> renamed to legacy_shops_archive: nothing is lost, nothing is exposed
--                                 (admin read-only). Drop it yourself once you have checked it:
--                                     drop table public.legacy_shops_archive;
do $$
begin
  if to_regclass('public.shops') is not null then
    if (select count(*) from public.shops) = 0 then
      drop table public.shops;
    else
      alter table public.shops rename to legacy_shops_archive;
    end if;
  end if;
  if to_regclass('public.legacy_shops_archive') is not null then
    alter table public.legacy_shops_archive enable row level security;
    revoke all on public.legacy_shops_archive from anon, authenticated;
    grant select on public.legacy_shops_archive to authenticated;
    drop policy if exists "legacy_shops_archive: admin read" on public.legacy_shops_archive;
    create policy "legacy_shops_archive: admin read" on public.legacy_shops_archive
      for select to authenticated using (public.is_admin());
    comment on table public.legacy_shops_archive is 'Archived rows of the removed multi-shop marketplace feature. Safe to drop once reviewed.';
  end if;
end $$;

-- the old "default shop image" slot is unused now (rows are kept, just switched off)
update public.site_media set is_active = false where slot = 'default_shop' and is_active;

-- 3g. Storage: only the admin writes to the bucket. Reading stays public (catalogue pictures).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product-images: admin upload" on storage.objects;
drop policy if exists "product-images: admin update" on storage.objects;
drop policy if exists "product-images: admin delete" on storage.objects;
create policy "product-images: admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
-- ("product-images: public read" from the original schema is kept)


-- ---------------------------------------------------------------------
-- 4. PREDEFINED CANCELLATION REASONS + CUSTOMER UPDATE MESSAGES
--    Stored in the database, so every admin device offers the same list.
-- ---------------------------------------------------------------------
create table if not exists public.order_cancellation_reasons (
  code            text primary key check (code ~ '^[a-z0-9_]+$'),
  label           text not null check (char_length(btrim(label)) between 1 and 200),
  requires_detail boolean not null default false,        -- "Other": the admin must say what
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists order_cancellation_reasons_updated_at on public.order_cancellation_reasons;
create trigger order_cancellation_reasons_updated_at before update on public.order_cancellation_reasons
  for each row execute function public.set_updated_at();

insert into public.order_cancellation_reasons (code, label, requires_detail, sort_order) values
  ('out_of_stock',              'Product is currently out of stock',                    false, 10),
  ('product_unavailable',       'Product is no longer available',                       false, 20),
  ('customer_requested',        'Customer requested cancellation',                      false, 30),
  ('customer_unreachable',      'Customer could not be reached',                        false, 40),
  ('payment_not_completed',     'Payment was not completed',                            false, 50),
  ('delivery_unavailable',      'Delivery location is unavailable',                     false, 60),
  ('order_incomplete',          'Order information is incomplete',                      false, 70),
  ('order_unconfirmed',         'Order could not be confirmed',                         false, 80),
  ('details_need_confirmation', 'Price/details require confirmation',                   false, 90),
  ('business_unable',           'Business is temporarily unable to process the order',  false, 100),
  ('duplicate_order',           'Duplicate order',                                      false, 110),
  ('other',                     'Other',                                                true,  999)
on conflict (code) do nothing;

create table if not exists public.order_update_templates (
  code        text primary key check (code ~ '^[a-z0-9_]+$'),
  message     text not null check (char_length(btrim(message)) between 1 and 300),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists order_update_templates_updated_at on public.order_update_templates;
create trigger order_update_templates_updated_at before update on public.order_update_templates
  for each row execute function public.set_updated_at();

insert into public.order_update_templates (code, message, sort_order) values
  ('received',           'Your order has been received.',                      10),
  ('confirmed',          'Your order has been confirmed.',                     20),
  ('processing',         'Your order is being processed.',                     30),
  ('payment_pending',    'Payment is pending.',                                40),
  ('ready',              'Your order is ready.',                               50),
  ('ready_for_delivery', 'Your order is ready for delivery.',                  60),
  ('dispatched',         'Your order has been dispatched.',                    70),
  ('completed',          'Your order has been completed.',                     80),
  ('need_to_contact',    'We need to contact you to confirm your order.',      90),
  ('unable_to_reach',    'We were unable to reach you.',                       100),
  ('cancelled',          'Your order has been cancelled.',                     110)
on conflict (code) do nothing;

-- orders remember WHICH predefined reason was used (cancellation_reason keeps the customer-facing text)
alter table public.orders
  add column if not exists cancellation_reason_code text
  references public.order_cancellation_reasons (code) on update cascade on delete restrict;

update public.orders set cancellation_reason_code = 'customer_requested'
 where status = 'cancelled' and cancellation_reason_code is null and cancellation_reason like 'Cancelled by the customer%';

-- the timeline gets a plain "update" event (admin message that does not change the status)
alter table public.order_events drop constraint if exists order_events_event_type_check;
alter table public.order_events add constraint order_events_event_type_check
  check (event_type in ('submitted', 'status_changed', 'payment_updated', 'note', 'update'));

-- Admin: move an order along its lifecycle.
--   Cancelling needs a PREDEFINED reason (p_reason_code). "Other" also needs p_reason (free text).
--   p_update_code adds one of the predefined customer messages; p_message is an optional extra sentence.
drop function if exists public.admin_set_order_status(uuid, text, text, text);
create or replace function public.admin_set_order_status(
  p_order_id    uuid,
  p_status      text,
  p_reason      text default null,      -- detail / "please specify" text
  p_message     text default null,      -- optional custom sentence for the customer
  p_reason_code text default null,      -- order_cancellation_reasons.code (required when cancelling)
  p_update_code text default null)      -- order_update_templates.code (optional)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o         public.orders;
  rsn       public.order_cancellation_reasons;
  v_old     text;
  v_detail  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_msg     text := nullif(btrim(coalesce(p_message, '')), '');
  v_rcode   text := nullif(btrim(coalesce(p_reason_code, '')), '');
  v_ucode   text := nullif(btrim(coalesce(p_update_code, '')), '');
  v_reason  text;                                   -- final cancellation text shown to the customer
  v_tpl     text;
  v_extra   text;
  v_text    text;
  v_ok      boolean;
  v_notice  jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = '22023';
  end if;
  v_old := o.status;
  if p_status is null or p_status not in ('pending', 'confirmed', 'payment_pending', 'processing',
                                           'ready_for_pickup', 'waiting_for_delivery', 'completed', 'cancelled') then
    raise exception 'Unknown order status.' using errcode = '22023';
  end if;
  if p_status = v_old then
    raise exception 'This order is already %.', replace(v_old, '_', ' ') using errcode = '22023';
  end if;

  v_ok := case v_old
    when 'pending'              then p_status in ('confirmed', 'cancelled')
    when 'confirmed'            then p_status in ('payment_pending', 'processing', 'cancelled')
    when 'payment_pending'      then p_status in ('processing', 'cancelled')
    when 'processing'           then p_status in ('ready_for_pickup', 'waiting_for_delivery', 'cancelled')
    when 'ready_for_pickup'     then p_status in ('completed', 'cancelled')
    when 'waiting_for_delivery' then p_status in ('completed', 'cancelled')
    else false
  end;
  if not v_ok then
    raise exception 'An order that is % cannot be changed to %.', replace(v_old, '_', ' '), replace(p_status, '_', ' ') using errcode = '22023';
  end if;

  if p_status = 'cancelled' then
    if v_rcode is null then
      raise exception 'Please choose a cancellation reason.' using errcode = '22023';
    end if;
    select * into rsn from public.order_cancellation_reasons where code = v_rcode and is_active;
    if not found then
      raise exception 'That cancellation reason is not available.' using errcode = '22023';
    end if;
    if rsn.requires_detail and (v_detail is null or char_length(v_detail) < 3) then
      raise exception 'Please specify the reason.' using errcode = '22023';
    end if;
    v_reason := case when rsn.requires_detail then v_detail
                     when v_detail is not null then rsn.label || ' (' || v_detail || ')'
                     else rsn.label end;
  else
    v_rcode := null;
  end if;

  if v_ucode is not null then
    select t.message into v_tpl from public.order_update_templates t where t.code = v_ucode and t.is_active;
    if not found then
      raise exception 'That order update is not available.' using errcode = '22023';
    end if;
  end if;
  v_extra := nullif(btrim(concat_ws(' ', v_tpl, v_msg)), '');

  if p_status = 'processing' and o.payment_status <> 'confirmed' and o.deposit_amount > 0 then
    raise exception 'Mark the payment as confirmed before moving this order to Processing.' using errcode = '22023';
  end if;
  if p_status = 'ready_for_pickup' and o.fulfilment_method <> 'pickup' then
    raise exception 'This is a delivery order. Use "Waiting for delivery".' using errcode = '22023';
  end if;
  if p_status = 'waiting_for_delivery' and o.fulfilment_method <> 'delivery' then
    raise exception 'This is a pickup order. Use "Ready for pickup".' using errcode = '22023';
  end if;

  perform set_config('beihub.order_rpc', 'on', true);
  update public.orders set
      status                   = p_status,
      payment_status           = case when p_status = 'payment_pending' and payment_status = 'unpaid' then 'pending' else payment_status end,
      cancellation_reason      = case when p_status = 'cancelled' then v_reason else cancellation_reason end,
      cancellation_reason_code = case when p_status = 'cancelled' then v_rcode  else cancellation_reason_code end,
      cancelled_at             = case when p_status = 'cancelled' then now() else cancelled_at end,
      cancelled_by             = case when p_status = 'cancelled' then auth.uid() else cancelled_by end,
      completed_at             = case when p_status = 'completed' then now() else completed_at end
    where id = o.id
    returning * into o;

  v_notice := public.order_status_notice(p_status, o.order_number, v_reason, o.deposit_amount, o.deposit_percent);

  insert into public.order_events (order_id, event_type, from_status, to_status, title, message, actor_id)
  values (o.id, 'status_changed', v_old, p_status, v_notice ->> 'title',
          case when p_status = 'cancelled' then 'Reason: ' || v_reason || coalesce(E'\n' || v_extra, '') else v_extra end,
          auth.uid());

  v_text := v_notice ->> 'message';
  if v_tpl is not null and p_status <> 'cancelled' then
    v_text := format('Order %s: %s', o.order_number, v_tpl);       -- the chosen sentence replaces the generic one
  elsif v_tpl is not null then
    v_text := v_text || ' ' || v_tpl;
  end if;
  if v_msg is not null then
    v_text := v_text || ' ' || v_msg;
  end if;
  perform public.queue_notification(o.user_id, o.id, v_notice ->> 'type', v_notice ->> 'title', v_text);

  perform public.write_audit(case when p_status = 'cancelled' then 'order.cancelled' else 'order.status_changed' end,
    'order', o.id::text, o.order_number,
    jsonb_build_object('status', v_old),
    jsonb_build_object('status', p_status, 'reason', v_reason, 'reason_code', v_rcode, 'update_code', v_ucode));

  return to_jsonb(o);
end;
$$;

-- Admin: send the customer an update WITHOUT changing the status (predefined sentence and/or custom text).
create or replace function public.admin_send_order_update(p_order_id uuid, p_update_code text default null, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o       public.orders;
  v_ucode text := nullif(btrim(coalesce(p_update_code, '')), '');
  v_msg   text := nullif(btrim(coalesce(p_message, '')), '');
  v_tpl   text;
  v_text  text;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if v_ucode is null and v_msg is null then
    raise exception 'Choose an update to send or write a message.' using errcode = '22023';
  end if;
  if v_msg is not null and char_length(v_msg) > 500 then
    raise exception 'The message is too long (500 characters at most).' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found.' using errcode = '22023';
  end if;
  if o.status in ('cancelled', 'completed') then
    raise exception 'No updates can be sent for a % order.', o.status using errcode = '22023';
  end if;
  if v_ucode is not null then
    select t.message into v_tpl from public.order_update_templates t where t.code = v_ucode and t.is_active;
    if not found then
      raise exception 'That order update is not available.' using errcode = '22023';
    end if;
  end if;
  v_text := nullif(btrim(concat_ws(' ', v_tpl, v_msg)), '');

  insert into public.order_events (order_id, event_type, title, message, actor_id)
  values (o.id, 'update', 'Update from our team', v_text, auth.uid());

  perform public.queue_notification(o.user_id, o.id, 'order_update', 'Update on your order',
                                    format('Order %s: %s', o.order_number, v_text));

  perform public.write_audit('order.update_sent', 'order', o.id::text, o.order_number,
    null, jsonb_build_object('update_code', v_ucode, 'message', v_msg));
  return to_jsonb(o);
end;
$$;

-- Customer: cancel their OWN order while it is still pending (records the predefined reason code too).
create or replace function public.customer_cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o        public.orders;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Please log in.' using errcode = '28000';
  end if;
  if public.is_suspended() then
    raise exception 'Your account is suspended. Please contact support.' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Order not found.' using errcode = '22023';
  end if;
  if o.status <> 'pending' then
    raise exception 'This order has already been confirmed. Please contact us to cancel it.' using errcode = '22023';
  end if;
  if v_reason is null then
    v_reason := 'Cancelled by the customer.';
  else
    v_reason := 'Cancelled by the customer: ' || left(v_reason, 300);
  end if;

  perform set_config('beihub.order_rpc', 'on', true);
  update public.orders
     set status = 'cancelled', cancellation_reason = v_reason, cancellation_reason_code = 'customer_requested',
         cancelled_at = now(), cancelled_by = auth.uid()
   where id = o.id returning * into o;

  insert into public.order_events (order_id, event_type, from_status, to_status, title, message, actor_id)
  values (o.id, 'status_changed', 'pending', 'cancelled', 'Order cancelled', v_reason, auth.uid());
  perform public.queue_notification(o.user_id, o.id, 'order_cancelled', 'Order cancelled',
    format('Order %s was cancelled. Reason: %s', o.order_number, v_reason));
  perform public.write_audit('order.cancelled', 'order', o.id::text, o.order_number,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'cancelled', 'reason', v_reason, 'reason_code', 'customer_requested'));
  return to_jsonb(o);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. SECURITY: privileges + Row Level Security for everything above
--    Nobody but the admin can write business information, products, prices, images,
--    order statuses, cancellation reasons or settings. The public can only READ the
--    public catalogue. Customers see only their own orders / notifications.
-- ---------------------------------------------------------------------
revoke all on public.order_cancellation_reasons, public.order_update_templates from anon, authenticated;
grant select, insert, update, delete on public.order_cancellation_reasons, public.order_update_templates to authenticated;  -- RLS: admin only

alter table public.order_cancellation_reasons enable row level security;
alter table public.order_update_templates     enable row level security;

drop policy if exists "order_cancellation_reasons: admin all" on public.order_cancellation_reasons;
create policy "order_cancellation_reasons: admin all" on public.order_cancellation_reasons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_update_templates: admin all" on public.order_update_templates;
create policy "order_update_templates: admin all" on public.order_update_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Order functions: signed-in users only (each one re-checks admin inside)
revoke all on function public.admin_set_order_status(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.admin_send_order_update(uuid, text, text)                   from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.admin_send_order_update(uuid, text, text)                   to authenticated;
grant execute on function public.product_is_public(uuid) to anon, authenticated;

-- Re-state the write rules for the business-information record (idempotent; same as the original schema).
drop policy if exists "store_settings: public read" on public.store_settings;
create policy "store_settings: public read" on public.store_settings
  for select using (true);
drop policy if exists "store_settings: admin write" on public.store_settings;
create policy "store_settings: admin write" on public.store_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.store_settings from anon;

-- Anonymous visitors may never write to anything shared.
revoke insert, update, delete on
  public.categories, public.products, public.product_images, public.product_variants,
  public.delivery_locations, public.site_media, public.store_settings from anon;


-- ---------------------------------------------------------------------
-- 6. REALTIME
--    The database stays the source of truth. These publications only tell open pages
--    "something changed - fetch it again"; a page that misses the event still gets the
--    latest data the next time it loads or regains focus.
--    Row Level Security applies to Realtime too: a customer only receives events for rows
--    they are allowed to SELECT (their own orders / notifications / timeline).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  v_all boolean;
begin
  select puballtables into v_all from pg_publication where pubname = 'supabase_realtime';
  if v_all is null then
    raise notice 'Publication supabase_realtime not found - enable Realtime for these tables in Dashboard > Database > Replication.';
  elsif v_all then
    raise notice 'supabase_realtime already publishes all tables.';
  else
    foreach t in array array['products', 'product_variants', 'product_images', 'categories', 'store_settings',
                             'delivery_locations', 'site_media', 'orders', 'order_events', 'notifications'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- DELETE / filtered UPDATE events need the full old row
alter table public.products           replica identity full;
alter table public.product_variants   replica identity full;
alter table public.product_images     replica identity full;
alter table public.categories         replica identity full;
alter table public.store_settings     replica identity full;
alter table public.delivery_locations replica identity full;
alter table public.site_media         replica identity full;
alter table public.orders             replica identity full;
alter table public.order_events       replica identity full;
alter table public.notifications      replica identity full;


-- ---------------------------------------------------------------------
-- 7. INDEXES for the admin order list and the customer "my orders" view
-- ---------------------------------------------------------------------
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists order_events_created_idx  on public.order_events (created_at desc);


-- ---------------------------------------------------------------------
-- 8. DONE. Quick sanity checks you can run:
--   select business_name, phone, whatsapp, email, address from public.store_settings;   -- the ONE business record
--   select code, label from public.order_cancellation_reasons order by sort_order;
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
--   select count(*) from public.legacy_shops_archive;                                   -- only if shops existed
-- ---------------------------------------------------------------------
