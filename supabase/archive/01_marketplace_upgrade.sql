-- =====================================================================
--  beihub_migration.sql
--  BeiHub upgrade: shops, verified-customer ordering, order lifecycle,
--  timeline, notifications, audit log, site media, central contact info.
--
--  RUN ORDER
--    1. supabase/BeiHub_database.sql   (the original schema - already run on your project)
--    2. supabase/beihub_migration.sql  (THIS FILE)
--
--  SAFE TO RE-RUN: every statement is idempotent (IF NOT EXISTS, CREATE OR
--  REPLACE, DROP POLICY IF EXISTS, guarded DO blocks). Existing rows are kept.
--
--  WHAT IS REUSED (not duplicated)
--    profiles, categories, products, product_images, product_variants,
--    store_settings (becomes the single place for contact info), orders,
--    order_items, delivery_locations, set_main_image(), is_admin(),
--    submit_order(), the 'product-images' storage bucket and its policies.
--
--  WHAT IS NEW (nothing equivalent existed)
--    shops, site_media, order_events, notifications, audit_log.
--
--  AFTER RUNNING (dashboard settings SQL cannot change)
--    Authentication > Providers > Email > "Confirm email"  -> ON
--    Authentication > URL Configuration -> Site URL + Redirect URLs = your site
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES: contact preferences + suspension flag
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists alternative_phone text,
  add column if not exists preferred_contact text not null default 'phone',
  add column if not exists is_suspended      boolean not null default false,
  add column if not exists suspended_reason  text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_preferred_contact_check') then
    alter table public.profiles
      add constraint profiles_preferred_contact_check
      check (preferred_contact in ('phone', 'whatsapp', 'email'));
  end if;
end $$;

-- A suspended account cannot act as admin either.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and not p.is_suspended
  );
$$;

create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_suspended from public.profiles p where p.id = auth.uid()), false);
$$;

-- True only when the signed-in user has clicked the link in the verification email.
create or replace function public.is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

-- Customers can edit their own profile but never role / suspension.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change roles.' using errcode = '42501';
    end if;
    if new.is_suspended is distinct from old.is_suspended
       or new.suspended_reason is distinct from old.suspended_reason then
      raise exception 'Only an admin can suspend or restore accounts.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Keep the phone typed at sign-up (stored in auth metadata) on the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. SHOPS
--    status: pending | approved | suspended | rejected
--    Only approved + visible shops are public.
-- ---------------------------------------------------------------------
create table if not exists public.shops (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users (id) on delete set null,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description   text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'suspended', 'rejected')),
  status_reason text,
  is_visible    boolean not null default true,
  phone         text,
  whatsapp      text,
  email         text,
  address       text,
  county        text,
  town          text,
  opening_hours text,
  latitude      numeric(9, 6) check (latitude  is null or latitude  between -90  and 90),
  longitude     numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  logo_url      text,
  logo_path     text,
  banner_url    text,
  banner_path   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists shops_status_idx on public.shops (status, is_visible);
create index if not exists shops_owner_idx  on public.shops (owner_id) where owner_id is not null;
create index if not exists shops_county_idx on public.shops (lower(county));

drop trigger if exists shops_updated_at on public.shops;
create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- Shop helpers (SECURITY DEFINER so RLS policies can call them without recursion).
create or replace function public.shop_is_public(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.shops s where s.id = p_shop and s.status = 'approved' and s.is_visible);
$$;

create or replace function public.is_shop_owner(p_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_shop is not null and exists (
    select 1 from public.shops s
    where s.id = p_shop and s.owner_id = auth.uid() and s.status = 'approved' and not public.is_suspended()
  );
$$;

-- Owners may edit their shop's details, never its approval status / visibility / owner.
create or replace function public.shops_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.status is distinct from old.status
       or new.status_reason is distinct from old.status_reason
       or new.is_visible is distinct from old.is_visible
       or new.owner_id is distinct from old.owner_id then
      raise exception 'Only an admin can change shop approval, visibility or ownership.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists shops_guard_bu on public.shops;
create trigger shops_guard_bu before update on public.shops
  for each row execute function public.shops_guard();


-- ---------------------------------------------------------------------
-- 3. PRODUCTS: shop link + product status
--    status: available | out_of_stock | hidden | discontinued
--    is_active (existing column) is kept in sync and still drives public RLS:
--    available / out_of_stock are public, hidden / discontinued are not.
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists shop_id uuid references public.shops (id) on delete restrict,
  add column if not exists status  text not null default 'available';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_status_check') then
    -- existing hidden products become 'hidden' before the constraint is added
    update public.products set status = 'hidden' where not is_active and status = 'available';
    alter table public.products
      add constraint products_status_check
      check (status in ('available', 'out_of_stock', 'hidden', 'discontinued'));
  end if;
end $$;
create index if not exists products_shop_idx   on public.products (shop_id) where shop_id is not null;
create index if not exists products_status_idx on public.products (status);

create or replace function public.products_sync_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_active is false and new.status = 'available' then
      new.status := 'hidden';
    end if;
  elsif new.status is not distinct from old.status and new.is_active is distinct from old.is_active then
    -- legacy callers that only flip is_active keep working
    new.status := case
      when new.is_active then (case when old.status in ('hidden', 'discontinued') then 'available' else old.status end)
      else 'hidden'
    end;
  end if;
  new.is_active := new.status in ('available', 'out_of_stock');
  return new;
end;
$$;
drop trigger if exists products_sync_status_bi on public.products;
create trigger products_sync_status_bi before insert or update on public.products
  for each row execute function public.products_sync_status();

create or replace function public.product_is_public(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product and p.is_active and (p.shop_id is null or public.shop_is_public(p.shop_id))
  );
$$;

create or replace function public.product_is_mine(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.products p where p.id = p_product and public.is_shop_owner(p.shop_id));
$$;

-- Default shop for existing data: built from store_settings so current products stay visible.
do $$
declare v_shop uuid;
begin
  if not exists (select 1 from public.shops) and exists (select 1 from public.store_settings where id = 1) then
    insert into public.shops (name, slug, description, status, phone, whatsapp, email, address, county, opening_hours)
    select coalesce(nullif(s.business_name, ''), 'Main store'), 'main-store', s.about, 'approved',
           s.phone, s.whatsapp, s.email, s.address, s.county, s.business_hours
    from public.store_settings s where s.id = 1
    returning id into v_shop;
    update public.products set shop_id = v_shop where shop_id is null;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 4. STORE SETTINGS: central, customer-facing contact information
--    (public read already exists; admin write already exists)
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column if not exists support_phone       text,
  add column if not exists support_email       text,
  add column if not exists support_hours       text,
  add column if not exists google_maps_url     text,
  add column if not exists twitter_url         text,
  add column if not exists tiktok_url          text,
  add column if not exists youtube_url         text,
  add column if not exists other_contact_info  text;


-- ---------------------------------------------------------------------
-- 5. SITE MEDIA (logo, favicon, hero, banners, about, default images)
-- ---------------------------------------------------------------------
create table if not exists public.site_media (
  id            uuid primary key default gen_random_uuid(),
  slot          text not null check (slot in ('logo', 'favicon', 'hero', 'banner', 'about', 'default_product', 'default_shop', 'other')),
  title         text,
  url           text not null,
  storage_path  text,
  alt           text,
  is_primary    boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists site_media_slot_idx on public.site_media (slot, sort_order);
create unique index if not exists site_media_one_primary_idx on public.site_media (slot) where is_primary;

drop trigger if exists site_media_updated_at on public.site_media;
create trigger site_media_updated_at before update on public.site_media
  for each row execute function public.set_updated_at();

create or replace function public.site_media_before_insert()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.site_media m where m.slot = new.slot and m.is_primary) then
    new.is_primary := true;
  end if;
  return new;
end;
$$;
drop trigger if exists site_media_bi on public.site_media;
create trigger site_media_bi before insert on public.site_media
  for each row execute function public.site_media_before_insert();

-- If the primary image of a slot is deleted, the next one takes over. No gaps, no dangling pointers.
create or replace function public.site_media_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_primary then
    update public.site_media set is_primary = true
     where id = (select m.id from public.site_media m where m.slot = old.slot order by m.sort_order, m.created_at limit 1);
  end if;
  return old;
end;
$$;
drop trigger if exists site_media_ad on public.site_media;
create trigger site_media_ad after delete on public.site_media
  for each row execute function public.site_media_after_delete();

-- store_settings.logo_url always mirrors the primary logo (so old code keeps working and
-- deleting the logo can never leave a broken URL behind).
create or replace function public.site_media_sync_logo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.store_settings
     set logo_url = (select m.url from public.site_media m where m.slot = 'logo' and m.is_primary and m.is_active limit 1)
   where id = 1;
  return null;
end;
$$;
drop trigger if exists site_media_sync_logo_aiud on public.site_media;
create trigger site_media_sync_logo_aiud after insert or update or delete on public.site_media
  for each statement execute function public.site_media_sync_logo();

create or replace function public.set_primary_site_media(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_slot text;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  select slot into v_slot from public.site_media where id = p_media_id;
  if v_slot is null then
    raise exception 'Image not found.' using errcode = '22023';
  end if;
  update public.site_media set is_primary = false where slot = v_slot and is_primary;
  update public.site_media set is_primary = true  where id = p_media_id;
end;
$$;

-- Bring an existing logo (from the old Settings page) into site_media once.
do $$
declare v_url text; v_path text;
begin
  select logo_url into v_url from public.store_settings where id = 1;
  if v_url is not null and not exists (select 1 from public.site_media where slot = 'logo') then
    v_path := case when position('/object/public/product-images/' in v_url) > 0
                   then split_part(v_url, '/object/public/product-images/', 2) else null end;
    insert into public.site_media (slot, title, url, storage_path, is_primary) values ('logo', 'Logo', v_url, v_path, true);
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 6. ORDERS: lifecycle, contact snapshot, order number, cancellation
-- ---------------------------------------------------------------------
-- 6a. New columns. Contact details are stored WITH the order (a later profile change never alters it).
alter table public.orders
  add column if not exists customer_email      text,
  add column if not exists alternative_phone   text,
  add column if not exists preferred_contact   text not null default 'phone',
  add column if not exists fulfilment_method   text not null default 'delivery',
  add column if not exists payment_status      text not null default 'unpaid',
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at        timestamptz,
  add column if not exists cancelled_by        uuid references auth.users (id) on delete set null,
  add column if not exists completed_at        timestamptz,
  add column if not exists status_updated_at   timestamptz not null default now();

alter table public.order_items
  add column if not exists shop_id uuid references public.shops (id) on delete set null;
create index if not exists order_items_shop_idx on public.order_items (shop_id) where shop_id is not null;
update public.order_items oi set shop_id = p.shop_id
  from public.products p where oi.product_id = p.id and oi.shop_id is null and p.shop_id is not null;

-- 6b. Status lifecycle (old values are mapped to the nearest new one).
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders drop constraint if exists orders_status_check_v2;

update public.orders set status = 'processing'           where status = 'deposit_paid';
update public.orders set status = 'waiting_for_delivery' where status = 'out_for_delivery';
update public.orders set status = 'completed'            where status = 'delivered';
update public.orders set payment_status = 'confirmed'
 where status in ('processing', 'waiting_for_delivery', 'completed') and payment_status = 'unpaid';
update public.orders set cancellation_reason = 'Cancelled before the order-status upgrade (no reason recorded).'
 where status = 'cancelled' and nullif(btrim(coalesce(cancellation_reason, '')), '') is null;

alter table public.orders alter column status set default 'pending';
alter table public.orders
  add constraint orders_status_check_v2 check (status in (
    'pending', 'confirmed', 'payment_pending', 'processing',
    'ready_for_pickup', 'waiting_for_delivery', 'completed', 'cancelled'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check check (payment_status in ('unpaid', 'pending', 'confirmed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_preferred_contact_check') then
    alter table public.orders add constraint orders_preferred_contact_check check (preferred_contact in ('phone', 'whatsapp', 'email'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_fulfilment_check') then
    alter table public.orders add constraint orders_fulfilment_check check (fulfilment_method in ('delivery', 'pickup'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_cancel_reason_check') then
    alter table public.orders add constraint orders_cancel_reason_check
      check (status <> 'cancelled' or nullif(btrim(coalesce(cancellation_reason, '')), '') is not null);
  end if;
end $$;
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc) where user_id is not null;

-- 6c. Readable order numbers: BH-000001, BH-000002 ...
--     (old numbers such as BH-2610-01001 are kept as they are; they never clash with the new format)
create sequence if not exists public.order_number_seq_v2 start 1;
alter table public.orders
  alter column order_number set default ('BH-' || lpad(nextval('public.order_number_seq_v2')::text, 6, '0'));

-- 6d. Stamp status changes.
create or replace function public.orders_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  -- Defence in depth: signed-in users may only change an order through the order functions below.
  if auth.uid() is not null and coalesce(current_setting('beihub.order_rpc', true), '') <> 'on' then
    raise exception 'Orders can only be changed through the order functions.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_guard_bu on public.orders;
create trigger orders_guard_bu before update on public.orders
  for each row execute function public.orders_before_update();

-- Nobody edits orders directly any more (RLS + privileges + trigger).
drop policy if exists "orders: admin update" on public.orders;
revoke update on public.orders from authenticated, anon;


-- ---------------------------------------------------------------------
-- 7. ORDER TIMELINE  (customer-visible events + internal admin notes)
-- ---------------------------------------------------------------------
create table if not exists public.order_events (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  event_type          text not null check (event_type in ('submitted', 'status_changed', 'payment_updated', 'note')),
  from_status         text,
  to_status           text,
  title               text not null,
  message             text,
  visible_to_customer boolean not null default true,   -- false = internal admin note
  actor_id            uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- Move the old single "admin_notes" text (which customers could have read through the
-- orders table) into admin-only timeline notes, then drop the column.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'orders' and column_name = 'admin_notes') then
    insert into public.order_events (order_id, event_type, title, message, visible_to_customer, created_at)
    select o.id, 'note', 'Admin note (imported)', o.admin_notes, false, o.updated_at
      from public.orders o where nullif(btrim(coalesce(o.admin_notes, '')), '') is not null;
    alter table public.orders drop column admin_notes;
  end if;
end $$;

-- History for orders that existed before this upgrade.
insert into public.order_events (order_id, event_type, to_status, title, message, created_at)
select o.id, 'submitted', 'pending', 'Order submitted', 'Order received.', o.created_at
  from public.orders o
 where not exists (select 1 from public.order_events e where e.order_id = o.id and e.event_type = 'submitted');


-- ---------------------------------------------------------------------
-- 8. NOTIFICATIONS (in-system now; channel column ready for email / SMS / WhatsApp)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  order_id         uuid references public.orders (id) on delete cascade,
  type             text not null,
  title            text not null,
  message          text,
  is_read          boolean not null default false,
  read_at          timestamptz,
  channel          text not null default 'in_app' check (channel in ('in_app', 'email', 'sms', 'whatsapp')),
  delivery_status  text not null default 'sent' check (delivery_status in ('pending', 'sent', 'failed')),
  created_at       timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

-- The ONE place notifications are created. To add email/SMS/WhatsApp later, either
-- (a) add rows here with another channel and delivery_status = 'pending' and let an
--     Edge Function / Database Webhook send them, or (b) call a sender from this function.
create or replace function public.queue_notification(p_user uuid, p_order uuid, p_type text, p_title text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.notifications (user_id, order_id, type, title, message)
  values (p_user, p_order, p_type, p_title, p_message);
end;
$$;
revoke all on function public.queue_notification(uuid, uuid, text, text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 9. AUDIT LOG
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references auth.users (id) on delete set null,
  actor_email   text,
  actor_role    text,
  action        text not null,         -- e.g. product.price_changed, order.cancelled
  entity_type   text not null,         -- product, order, shop, settings, image ...
  entity_id     text,
  entity_label  text,                  -- human readable (product name, order number ...)
  old_values    jsonb,
  new_values    jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx  on public.audit_log (action, created_at desc);
create index if not exists audit_log_entity_idx  on public.audit_log (entity_type, entity_id);

create or replace function public.write_audit(
  p_action text, p_entity_type text, p_entity_id text, p_label text, p_old jsonb, p_new jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_role  text;
begin
  if v_uid is null then
    return;                       -- SQL editor / migrations / service role: not a user action
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  v_role := case when public.is_admin() then 'admin' else 'user' end;
  insert into public.audit_log (actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, old_values, new_values)
  values (v_uid, v_email, v_role, p_action, p_entity_type, p_entity_id, p_label, p_old, p_new);
end;
$$;
revoke all on function public.write_audit(text, text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- {old:{changed columns}, new:{changed columns}}
create or replace function public.jsonb_changed(p_old jsonb, p_new jsonb, p_ignore text[] default array['updated_at'])
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'old', coalesce(jsonb_object_agg(k, p_old -> k) filter (where (p_old -> k) is distinct from (p_new -> k)), '{}'::jsonb),
    'new', coalesce(jsonb_object_agg(k, p_new -> k) filter (where (p_old -> k) is distinct from (p_new -> k)), '{}'::jsonb))
  from jsonb_object_keys(p_new) as k
  where not (k = any (p_ignore));
$$;

-- ---- audit triggers ----
create or replace function public.audit_variant_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text; v_pid uuid;
begin
  v_pid := coalesce(new.product_id, old.product_id);
  select p.name into v_name from public.products p where p.id = v_pid;
  if tg_op = 'UPDATE' then
    if new.price is distinct from old.price or new.previous_price is distinct from old.previous_price then
      perform public.write_audit('product.price_changed', 'product', v_pid::text, v_name || ' - ' || new.label,
        jsonb_build_object('price', old.price, 'previous_price', old.previous_price),
        jsonb_build_object('price', new.price, 'previous_price', new.previous_price));
    end if;
  elsif tg_op = 'DELETE' then
    perform public.write_audit('variant.deleted', 'product', v_pid::text, coalesce(v_name, '?') || ' - ' || old.label,
      jsonb_build_object('label', old.label, 'price', old.price), null);
  end if;
  return null;
end;
$$;
drop trigger if exists audit_variants_au on public.product_variants;
create trigger audit_variants_au after update or delete on public.product_variants
  for each row execute function public.audit_variant_change();

create or replace function public.audit_product_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('product.created', 'product', new.id::text, new.name, null, jsonb_build_object('status', new.status, 'shop_id', new.shop_id));
  elsif tg_op = 'DELETE' then
    perform public.write_audit('product.deleted', 'product', old.id::text, old.name, jsonb_build_object('name', old.name, 'status', old.status, 'shop_id', old.shop_id), null);
  elsif new.status is distinct from old.status then
    perform public.write_audit('product.status_changed', 'product', new.id::text, new.name, jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  elsif new.name is distinct from old.name or new.category_id is distinct from old.category_id
        or new.description is distinct from old.description or new.shop_id is distinct from old.shop_id then
    perform public.write_audit('product.updated', 'product', new.id::text, new.name,
      public.jsonb_changed(to_jsonb(old), to_jsonb(new), array['updated_at', 'specs', 'is_active']) -> 'old',
      public.jsonb_changed(to_jsonb(old), to_jsonb(new), array['updated_at', 'specs', 'is_active']) -> 'new');
  end if;
  return null;
end;
$$;
drop trigger if exists audit_products_aiud on public.products;
create trigger audit_products_aiud after insert or update or delete on public.products
  for each row execute function public.audit_product_change();

create or replace function public.audit_product_image_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text; v_pid uuid;
begin
  v_pid := coalesce(new.product_id, old.product_id);
  select p.name into v_name from public.products p where p.id = v_pid;
  if tg_op = 'DELETE' then
    perform public.write_audit('image.deleted', 'product_image', old.id::text, v_name, jsonb_build_object('url', old.url), null);
  elsif tg_op = 'UPDATE' then
    if new.url is distinct from old.url then
      perform public.write_audit('image.replaced', 'product_image', new.id::text, v_name, jsonb_build_object('url', old.url), jsonb_build_object('url', new.url));
    elsif new.is_main and not old.is_main then
      perform public.write_audit('image.primary_changed', 'product_image', new.id::text, v_name, null, jsonb_build_object('url', new.url));
    end if;
  elsif tg_op = 'INSERT' then
    perform public.write_audit('image.uploaded', 'product_image', new.id::text, v_name, null, jsonb_build_object('url', new.url));
  end if;
  return null;
end;
$$;
drop trigger if exists audit_product_images_aiud on public.product_images;
create trigger audit_product_images_aiud after insert or update or delete on public.product_images
  for each row execute function public.audit_product_image_change();

create or replace function public.audit_site_media_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit('image.deleted', 'site_media', old.id::text, old.slot, jsonb_build_object('url', old.url), null);
  elsif tg_op = 'UPDATE' then
    if new.url is distinct from old.url then
      perform public.write_audit('image.replaced', 'site_media', new.id::text, new.slot, jsonb_build_object('url', old.url), jsonb_build_object('url', new.url));
    elsif new.is_primary and not old.is_primary then
      perform public.write_audit('image.primary_changed', 'site_media', new.id::text, new.slot, null, jsonb_build_object('url', new.url));
    end if;
  else
    perform public.write_audit('image.uploaded', 'site_media', new.id::text, new.slot, null, jsonb_build_object('url', new.url));
  end if;
  return null;
end;
$$;
drop trigger if exists audit_site_media_aiud on public.site_media;
create trigger audit_site_media_aiud after insert or update or delete on public.site_media
  for each row execute function public.audit_site_media_change();

create or replace function public.audit_shop_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_action text;
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('shop.created', 'shop', new.id::text, new.name, null, jsonb_build_object('status', new.status));
  elsif tg_op = 'DELETE' then
    perform public.write_audit('shop.deleted', 'shop', old.id::text, old.name, jsonb_build_object('status', old.status), null);
  else
    if new.status is distinct from old.status then
      v_action := case new.status when 'approved' then 'shop.approved' when 'suspended' then 'shop.suspended'
                                  when 'rejected' then 'shop.rejected' else 'shop.status_changed' end;
      perform public.write_audit(v_action, 'shop', new.id::text, new.name,
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status, 'reason', new.status_reason));
    end if;
    if new.is_visible is distinct from old.is_visible then
      perform public.write_audit('shop.visibility_changed', 'shop', new.id::text, new.name,
        jsonb_build_object('is_visible', old.is_visible), jsonb_build_object('is_visible', new.is_visible));
    end if;
    if new.logo_url is distinct from old.logo_url or new.banner_url is distinct from old.banner_url then
      perform public.write_audit(
        case when (new.logo_url is null and old.logo_url is not null) or (new.banner_url is null and old.banner_url is not null)
             then 'image.deleted' else 'image.replaced' end,
        'shop', new.id::text, new.name,
        jsonb_build_object('logo_url', old.logo_url, 'banner_url', old.banner_url),
        jsonb_build_object('logo_url', new.logo_url, 'banner_url', new.banner_url));
    end if;
    if new.name is distinct from old.name or new.phone is distinct from old.phone or new.address is distinct from old.address
       or new.email is distinct from old.email or new.county is distinct from old.county then
      perform public.write_audit('shop.updated', 'shop', new.id::text, new.name,
        public.jsonb_changed(to_jsonb(old), to_jsonb(new), array['updated_at','status','status_reason','is_visible','logo_url','logo_path','banner_url','banner_path']) -> 'old',
        public.jsonb_changed(to_jsonb(old), to_jsonb(new), array['updated_at','status','status_reason','is_visible','logo_url','logo_path','banner_url','banner_path']) -> 'new');
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists audit_shops_aiud on public.shops;
create trigger audit_shops_aiud after insert or update or delete on public.shops
  for each row execute function public.audit_shop_change();

create or replace function public.audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
  v_contact text[] := array['phone','whatsapp','email','address','county','business_hours','support_phone','support_email',
    'support_hours','google_maps_url','facebook_url','instagram_url','twitter_url','tiktok_url','youtube_url','other_contact_info'];
begin
  d := public.jsonb_changed(to_jsonb(old), to_jsonb(new), array['updated_at', 'logo_url']);
  if d -> 'new' = '{}'::jsonb then
    return null;
  end if;
  perform public.write_audit(
    case when exists (select 1 from jsonb_object_keys(d -> 'new') k where k = any (v_contact))
         then 'settings.contact_changed' else 'settings.changed' end,
    'settings', '1', 'Store settings', d -> 'old', d -> 'new');
  return null;
end;
$$;
drop trigger if exists audit_settings_au on public.store_settings;
create trigger audit_settings_au after update on public.store_settings
  for each row execute function public.audit_settings_change();

create or replace function public.audit_category_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit('category.deleted', 'category', old.id::text, old.name, jsonb_build_object('name', old.name), null);
  elsif new.image_url is distinct from old.image_url then
    perform public.write_audit(case when new.image_url is null then 'image.deleted' else 'image.replaced' end,
      'category', new.id::text, new.name, jsonb_build_object('image_url', old.image_url), jsonb_build_object('image_url', new.image_url));
  end if;
  return null;
end;
$$;
drop trigger if exists audit_categories_aud on public.categories;
create trigger audit_categories_aud after update or delete on public.categories
  for each row execute function public.audit_category_change();

create or replace function public.audit_order_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit('order.deleted', 'order', old.id::text, old.order_number, jsonb_build_object('status', old.status, 'total', old.total), null);
  return old;
end;
$$;
drop trigger if exists audit_orders_bd on public.orders;
create trigger audit_orders_bd before delete on public.orders
  for each row execute function public.audit_order_delete();

create or replace function public.audit_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    perform public.write_audit('user.role_changed', 'user', new.id::text, new.full_name, jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  end if;
  if new.is_suspended is distinct from old.is_suspended then
    perform public.write_audit(case when new.is_suspended then 'user.suspended' else 'user.restored' end, 'user', new.id::text, new.full_name,
      jsonb_build_object('is_suspended', old.is_suspended), jsonb_build_object('is_suspended', new.is_suspended, 'reason', new.suspended_reason));
  end if;
  return null;
end;
$$;
drop trigger if exists audit_profiles_au on public.profiles;
create trigger audit_profiles_au after update on public.profiles
  for each row execute function public.audit_profile_change();


-- ---------------------------------------------------------------------
-- 10. ORDER FUNCTIONS
-- ---------------------------------------------------------------------

-- Customer-facing wording for each status (also used for notifications + timeline).
create or replace function public.order_status_notice(p_status text, p_number text, p_reason text, p_deposit numeric, p_pct numeric)
returns jsonb
language sql
immutable
as $$
  select case p_status
    when 'confirmed' then jsonb_build_object('type', 'order_confirmed', 'title', 'Order confirmed',
      'message', format('Your order %s has been confirmed by our team.', p_number))
    when 'payment_pending' then jsonb_build_object('type', 'payment_required', 'title', 'Payment required',
      'message', format('Order %s needs a payment of up to %s%% (about KSh %s) to proceed. Our team will send you the payment instructions.', p_number, trim(to_char(p_pct, 'FM999990.##')), trim(to_char(p_deposit, 'FM999,999,990.00'))))
    when 'processing' then jsonb_build_object('type', 'order_processing', 'title', 'Order is being processed',
      'message', format('Order %s is now being processed.', p_number))
    when 'ready_for_pickup' then jsonb_build_object('type', 'order_ready', 'title', 'Order ready for pickup',
      'message', format('Order %s is ready for pickup.', p_number))
    when 'waiting_for_delivery' then jsonb_build_object('type', 'order_ready', 'title', 'Order ready for delivery',
      'message', format('Order %s is ready and waiting for delivery.', p_number))
    when 'completed' then jsonb_build_object('type', 'order_completed', 'title', 'Order completed',
      'message', format('Order %s is completed. Thank you for shopping with us.', p_number))
    when 'cancelled' then jsonb_build_object('type', 'order_cancelled', 'title', 'Order cancelled',
      'message', format('Order %s was cancelled. Reason: %s', p_number, coalesce(p_reason, 'not given')))
    else jsonb_build_object('type', 'order_update', 'title', 'Order updated', 'message', format('Order %s was updated.', p_number))
  end;
$$;

-- Customers order through this function only. Requires: signed in + verified email + not suspended.
-- p_customer: {customer_name, phone, alternative_phone, whatsapp, customer_email, preferred_contact,
--              fulfilment_method, county, town, delivery_location, preferred_delivery_date, notes}
-- p_items:    [{variant_id, quantity}, ...]
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
    raise exception 'Store settings are missing. Please contact the shop.' using errcode = '22023';
  end if;

  -- price every line from the database (the browser can never send a price)
  for v_item in select jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 100 then
      raise exception 'Invalid quantity.' using errcode = '22023';
    end if;

    select
      pv.id as variant_id, pv.label, pv.sku, pv.price, pv.availability, pv.stock,
      p.id as product_id, p.name as product_name, p.status as product_status, p.shop_id,
      (select pi.url from public.product_images pi
        where pi.product_id = p.id
        order by pi.is_main desc, pi.sort_order asc
        limit 1) as image_url
    into v_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item ->> 'variant_id')::uuid
      and p.is_active
      and (p.shop_id is null or public.shop_is_public(p.shop_id));

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
      'product_id', v_row.product_id, 'variant_id', v_row.variant_id, 'shop_id', v_row.shop_id,
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

  insert into public.order_items (order_id, product_id, variant_id, shop_id, product_name, variant_label, sku, image_url, unit_price, quantity)
  select v_order_id, (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid, nullif(l ->> 'shop_id', '')::uuid,
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

-- Admin: move an order along its lifecycle.
--   pending -> confirmed -> payment_pending -> processing -> ready_for_pickup | waiting_for_delivery -> completed
--   cancelled is possible until the order is completed and ALWAYS needs a reason.
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text, p_reason text default null, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o         public.orders;
  v_old     text;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_msg     text := nullif(btrim(coalesce(p_message, '')), '');
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

  if p_status = 'cancelled' and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'Please enter a cancellation reason. The customer will see it.' using errcode = '22023';
  end if;
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
      status              = p_status,
      payment_status      = case when p_status = 'payment_pending' and payment_status = 'unpaid' then 'pending' else payment_status end,
      cancellation_reason = case when p_status = 'cancelled' then v_reason else cancellation_reason end,
      cancelled_at        = case when p_status = 'cancelled' then now() else cancelled_at end,
      cancelled_by        = case when p_status = 'cancelled' then auth.uid() else cancelled_by end,
      completed_at        = case when p_status = 'completed' then now() else completed_at end
    where id = o.id
    returning * into o;

  v_notice := public.order_status_notice(p_status, o.order_number, v_reason, o.deposit_amount, o.deposit_percent);

  insert into public.order_events (order_id, event_type, from_status, to_status, title, message, actor_id)
  values (o.id, 'status_changed', v_old, p_status, v_notice ->> 'title',
          case when p_status = 'cancelled' then 'Reason: ' || v_reason else v_msg end, auth.uid());

  perform public.queue_notification(o.user_id, o.id, v_notice ->> 'type', v_notice ->> 'title',
    v_notice ->> 'message' || case when v_msg is not null and p_status <> 'cancelled' then ' ' || v_msg else '' end);

  perform public.write_audit(case when p_status = 'cancelled' then 'order.cancelled' else 'order.status_changed' end,
    'order', o.id::text, o.order_number,
    jsonb_build_object('status', v_old),
    jsonb_build_object('status', p_status, 'reason', v_reason));

  return to_jsonb(o);
end;
$$;

-- Admin: record the manual payment state (unpaid | pending | confirmed).
create or replace function public.admin_set_payment_status(p_order_id uuid, p_payment_status text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o       public.orders;
  v_old   text;
  v_msg   text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if p_payment_status not in ('unpaid', 'pending', 'confirmed') then
    raise exception 'Unknown payment status.' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.' using errcode = '22023';
  end if;
  if o.status in ('cancelled', 'completed') then
    raise exception 'The payment of a % order cannot be changed.', o.status using errcode = '22023';
  end if;
  v_old := o.payment_status;
  if p_payment_status = v_old then
    raise exception 'Payment is already marked as %.', v_old using errcode = '22023';
  end if;

  perform set_config('beihub.order_rpc', 'on', true);
  update public.orders set payment_status = p_payment_status where id = o.id returning * into o;

  insert into public.order_events (order_id, event_type, title, message, actor_id)
  values (o.id, 'payment_updated',
          case p_payment_status when 'confirmed' then 'Payment confirmed' when 'pending' then 'Payment pending' else 'Payment reset' end,
          v_msg, auth.uid());

  if p_payment_status = 'confirmed' then
    perform public.queue_notification(o.user_id, o.id, 'payment_confirmed', 'Payment confirmed',
      format('We have received your payment for order %s. Thank you.', o.order_number));
  elsif p_payment_status = 'pending' then
    perform public.queue_notification(o.user_id, o.id, 'payment_required', 'Payment required',
      format('Order %s needs a payment of up to %s%% (about KSh %s). Our team will send you the payment instructions.',
             o.order_number, trim(to_char(o.deposit_percent, 'FM999990.##')), trim(to_char(o.deposit_amount, 'FM999,999,990.00'))));
  end if;

  perform public.write_audit('order.payment_updated', 'order', o.id::text, o.order_number,
    jsonb_build_object('payment_status', v_old), jsonb_build_object('payment_status', p_payment_status));
  return to_jsonb(o);
end;
$$;

-- Admin: internal note (never shown to the customer).
create or replace function public.admin_add_order_note(p_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if v_note is null then
    raise exception 'Write a note first.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Order not found.' using errcode = '22023';
  end if;
  insert into public.order_events (order_id, event_type, title, message, visible_to_customer, actor_id)
  values (p_order_id, 'note', 'Admin note', v_note, false, auth.uid());
end;
$$;

-- Customer: cancel their OWN order, only while it is still pending.
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
    v_reason := 'Cancelled by the customer: ' || v_reason;
  end if;

  perform set_config('beihub.order_rpc', 'on', true);
  update public.orders set status = 'cancelled', cancellation_reason = v_reason, cancelled_at = now(), cancelled_by = auth.uid()
   where id = o.id returning * into o;

  insert into public.order_events (order_id, event_type, from_status, to_status, title, message, actor_id)
  values (o.id, 'status_changed', 'pending', 'cancelled', 'Order cancelled', v_reason, auth.uid());
  perform public.queue_notification(o.user_id, o.id, 'order_cancelled', 'Order cancelled',
    format('Order %s was cancelled. Reason: %s', o.order_number, v_reason));
  perform public.write_audit('order.cancelled', 'order', o.id::text, o.order_number,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'cancelled', 'reason', v_reason));
  return to_jsonb(o);
end;
$$;


-- ---------------------------------------------------------------------
-- 11. FUNCTION PRIVILEGES
-- ---------------------------------------------------------------------
revoke all on function public.submit_order(jsonb, jsonb)                           from public;
revoke all on function public.admin_set_order_status(uuid, text, text, text)       from public;
revoke all on function public.admin_set_payment_status(uuid, text, text)           from public;
revoke all on function public.admin_add_order_note(uuid, text)                     from public;
revoke all on function public.customer_cancel_order(uuid, text)                    from public;
revoke all on function public.set_primary_site_media(uuid)                         from public;
grant execute on function public.submit_order(jsonb, jsonb)                        to authenticated;   -- guests are refused: login required
grant execute on function public.admin_set_order_status(uuid, text, text, text)    to authenticated;
grant execute on function public.admin_set_payment_status(uuid, text, text)        to authenticated;
grant execute on function public.admin_add_order_note(uuid, text)                  to authenticated;
grant execute on function public.customer_cancel_order(uuid, text)                 to authenticated;
grant execute on function public.set_primary_site_media(uuid)                      to authenticated;
revoke execute on function public.submit_order(jsonb, jsonb) from anon;
grant execute on function public.is_admin(), public.is_suspended(), public.is_email_verified(),
                          public.shop_is_public(uuid), public.is_shop_owner(uuid),
                          public.product_is_public(uuid), public.product_is_mine(uuid) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 12. TABLE PRIVILEGES for the new tables
--     (Supabase grants new tables to anon/authenticated by default - tighten that first,
--      then grant exactly what is needed. RLS below decides which rows.)
-- ---------------------------------------------------------------------
revoke all on public.shops, public.site_media, public.order_events, public.notifications, public.audit_log from anon, authenticated;

grant select on public.shops, public.site_media to anon;
grant select, insert, update, delete on public.shops, public.site_media to authenticated;   -- RLS: admin (+ owner for shops)

grant select on public.order_events to authenticated;                 -- written only by the order functions
grant select on public.audit_log    to authenticated;                 -- admin only via RLS; written only by write_audit()
grant select, delete on public.notifications to authenticated;        -- own rows only
grant update (is_read, read_at) on public.notifications to authenticated;

-- orders / order_items: customers read their own rows, nothing else
grant select, delete on public.orders to authenticated;               -- delete is admin-only via RLS
revoke insert, update on public.orders from authenticated, anon;
revoke insert, update on public.order_items from authenticated, anon;


-- ---------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.shops          enable row level security;
alter table public.site_media     enable row level security;
alter table public.order_events   enable row level security;
alter table public.notifications  enable row level security;
alter table public.audit_log      enable row level security;

-- shops: public sees approved+visible only; owners see/edit their own; admin everything
drop policy if exists "shops: public read" on public.shops;
create policy "shops: public read" on public.shops
  for select using ((status = 'approved' and is_visible) or owner_id = auth.uid() or public.is_admin());
drop policy if exists "shops: admin write" on public.shops;
create policy "shops: admin write" on public.shops
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "shops: owner update" on public.shops;
create policy "shops: owner update" on public.shops
  for update to authenticated using (public.is_shop_owner(id)) with check (public.is_shop_owner(id));

-- products / images / variants: hide anything from non-public shops; let owners manage their own
drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products
  for select using (
    (is_active and (shop_id is null or public.shop_is_public(shop_id)))
    or public.is_admin() or public.is_shop_owner(shop_id));
drop policy if exists "products: owner write" on public.products;
create policy "products: owner write" on public.products
  for all to authenticated using (public.is_shop_owner(shop_id)) with check (public.is_shop_owner(shop_id));

drop policy if exists "product_images: public read" on public.product_images;
create policy "product_images: public read" on public.product_images
  for select using (public.is_admin() or public.product_is_public(product_id) or public.product_is_mine(product_id));
drop policy if exists "product_images: owner write" on public.product_images;
create policy "product_images: owner write" on public.product_images
  for all to authenticated using (public.product_is_mine(product_id)) with check (public.product_is_mine(product_id));

drop policy if exists "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants
  for select using (public.is_admin() or public.product_is_public(product_id) or public.product_is_mine(product_id));
drop policy if exists "product_variants: owner write" on public.product_variants;
create policy "product_variants: owner write" on public.product_variants
  for all to authenticated using (public.product_is_mine(product_id)) with check (public.product_is_mine(product_id));

-- site media
drop policy if exists "site_media: public read" on public.site_media;
create policy "site_media: public read" on public.site_media
  for select using (is_active or public.is_admin());
drop policy if exists "site_media: admin write" on public.site_media;
create policy "site_media: admin write" on public.site_media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- order timeline: customers see only customer-visible events of their own orders
drop policy if exists "order_events: read" on public.order_events;
create policy "order_events: read" on public.order_events
  for select to authenticated using (
    public.is_admin()
    or (visible_to_customer and exists (select 1 from public.orders o where o.id = order_events.order_id and o.user_id = auth.uid())));

-- notifications: own only
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- audit log: admins can read; nobody can write directly
drop policy if exists "audit_log: admin read" on public.audit_log;
create policy "audit_log: admin read" on public.audit_log
  for select to authenticated using (public.is_admin());

-- orders: own or admin (admin_notes no longer lives on this table)
drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or admin" on public.orders
  for select to authenticated using (public.is_admin() or user_id = auth.uid());


-- ---------------------------------------------------------------------
-- 14. STORAGE (bucket 'product-images' is reused)
--     Folders:  products/<product_id>/  categories/  branding/  site/  shops/<shop_id>/
--     READ is public (these are public catalogue images).
--     WRITE: admin everywhere; a shop owner only inside their own shop / product folders.
-- ---------------------------------------------------------------------
create or replace function public.storage_path_owner(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  v_id  uuid;
begin
  if coalesce(array_length(parts, 1), 0) < 3 then
    return false;
  end if;
  begin
    v_id := parts[2]::uuid;
  exception when others then
    return false;
  end;
  if parts[1] = 'shops' then
    return public.is_shop_owner(v_id);
  elsif parts[1] = 'products' then
    return public.product_is_mine(v_id);
  end if;
  return false;
end;
$$;
grant execute on function public.storage_path_owner(text) to authenticated;

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
drop policy if exists "product-images: admin or owner upload" on storage.objects;
drop policy if exists "product-images: admin or owner update" on storage.objects;
drop policy if exists "product-images: admin or owner delete" on storage.objects;

create policy "product-images: admin or owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (public.is_admin() or public.storage_path_owner(name)));

create policy "product-images: admin or owner update" on storage.objects
  for update to authenticated
  using      (bucket_id = 'product-images' and (public.is_admin() or public.storage_path_owner(name)))
  with check (bucket_id = 'product-images' and (public.is_admin() or public.storage_path_owner(name)));

create policy "product-images: admin or owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (public.is_admin() or public.storage_path_owner(name)));

-- (the existing "product-images: public read" select policy is kept)


-- ---------------------------------------------------------------------
-- 15. DONE. Quick sanity checks you can run:
--   select status, count(*) from public.orders group by 1;
--   select slug, status from public.shops;
--   select slot, url, is_primary from public.site_media;
-- ---------------------------------------------------------------------
