-- =====================================================================
--  BeiHub database schema  (Supabase / PostgreSQL 15)
--  Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
--  Run the whole file in: Supabase Dashboard > SQL Editor > New query.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper functions that do not depend on tables
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. PROFILES (one row per auth user; role decides admin access)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Admin check used by every RLS policy. SECURITY DEFINER so it can read profiles
-- without being blocked by the profiles policies (and avoids recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Create a profile automatically for every new auth user (always as 'customer').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this script was run.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

-- Nobody can promote themselves. Roles can only be changed by an admin, or from the
-- SQL editor / service role (where auth.uid() is null) - which is how the first admin is made.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an admin can change roles.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. CATEGORIES
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  text,
  image_url    text,
  image_path   text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists categories_sort_idx on public.categories (sort_order, name);

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. PRODUCTS, IMAGES, VARIANTS
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid not null references public.categories (id) on delete restrict,
  name               text not null check (char_length(btrim(name)) between 1 and 160),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand              text,
  short_description  text,
  description        text,
  specs              jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  is_active          boolean not null default true,   -- published on the website
  is_featured        boolean not null default false,
  is_popular         boolean not null default false,
  is_new             boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_created_idx on public.products (is_active, created_at desc);
create index if not exists products_flags_idx on public.products (is_featured, is_popular, is_new) where is_active;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  url           text not null,
  storage_path  text,                      -- path inside the 'product-images' bucket (null for sample images)
  alt           text,
  sort_order    integer not null default 0,
  is_main       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);
-- At most one main image per product.
create unique index if not exists product_images_one_main_idx on public.product_images (product_id) where is_main;

-- The first image uploaded for a product automatically becomes the main image.
create or replace function public.product_images_before_insert()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.product_images pi where pi.product_id = new.product_id and pi.is_main
  ) then
    new.is_main := true;
  end if;
  return new;
end;
$$;

drop trigger if exists product_images_bi on public.product_images;
create trigger product_images_bi before insert on public.product_images
  for each row execute function public.product_images_before_insert();

-- If the main image is deleted, promote the next image.
create or replace function public.product_images_after_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_main then
    update public.product_images
       set is_main = true
     where id = (
       select pi.id from public.product_images pi
       where pi.product_id = old.product_id
       order by pi.sort_order, pi.created_at
       limit 1
     );
  end if;
  return old;
end;
$$;

drop trigger if exists product_images_ad on public.product_images;
create trigger product_images_ad after delete on public.product_images
  for each row execute function public.product_images_after_delete();

create table if not exists public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  label           text not null check (char_length(btrim(label)) between 1 and 80),   -- e.g. "2,000 Litres", "55 Inch", "200Ah"
  sku             text unique,
  price           numeric(12, 2) not null check (price >= 0),
  previous_price  numeric(12, 2) check (previous_price is null or previous_price >= 0),
  stock           integer not null default 0 check (stock >= 0),
  availability    text not null default 'in_stock' check (availability in ('in_stock', 'on_order', 'out_of_stock')),
  specs           jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (product_id, label)
);
create index if not exists product_variants_product_idx on public.product_variants (product_id, sort_order);
create index if not exists product_variants_price_idx on public.product_variants (price);

drop trigger if exists product_variants_updated_at on public.product_variants;
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. STORE SETTINGS (single row) and DELIVERY LOCATIONS
-- ---------------------------------------------------------------------
create table if not exists public.store_settings (
  id                       smallint primary key default 1 check (id = 1),
  business_name            text not null default 'BeiHub',
  tagline                  text,
  logo_url                 text,
  phone                    text,
  whatsapp                 text,      -- international format without + (e.g. 254712345678)
  email                    text,
  address                  text,
  county                   text,
  business_hours           text,
  about                    text,
  payment_instructions     text,      -- shown to customers after they submit an order
  deposit_percent          numeric(5, 2) not null default 50 check (deposit_percent >= 0 and deposit_percent <= 100),
  delivery_mode            text not null default 'county' check (delivery_mode in ('free', 'fixed', 'county', 'town')),
  fixed_delivery_fee       numeric(12, 2) not null default 0 check (fixed_delivery_fee >= 0),
  default_delivery_fee     numeric(12, 2) not null default 0 check (default_delivery_fee >= 0),
  free_delivery_threshold  numeric(12, 2) check (free_delivery_threshold is null or free_delivery_threshold >= 0),
  facebook_url             text,
  instagram_url            text,
  updated_at               timestamptz not null default now()
);

drop trigger if exists store_settings_updated_at on public.store_settings;
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

create table if not exists public.delivery_locations (
  id          uuid primary key default gen_random_uuid(),
  county      text not null check (char_length(btrim(county)) > 0),
  town        text,                                   -- null = county-wide fee
  fee         numeric(12, 2) not null check (fee >= 0),
  eta         text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists delivery_locations_unique_idx
  on public.delivery_locations (lower(county), lower(coalesce(town, '')));

-- ---------------------------------------------------------------------
-- 6. ORDERS and ORDER ITEMS (prices are copied at the time of ordering)
-- ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_number             text not null unique
                           default ('BH-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0')),
  user_id                  uuid references auth.users (id) on delete set null,
  status                   text not null default 'pending'
                           check (status in ('pending', 'confirmed', 'deposit_paid', 'out_for_delivery', 'delivered', 'cancelled')),
  customer_name            text not null check (char_length(btrim(customer_name)) between 1 and 120),
  phone                    text not null check (char_length(btrim(phone)) between 5 and 30),
  whatsapp                 text check (whatsapp is null or char_length(whatsapp) <= 30),
  county                   text not null check (char_length(btrim(county)) between 1 and 80),
  town                     text not null check (char_length(btrim(town)) between 1 and 120),
  delivery_location        text not null check (char_length(btrim(delivery_location)) between 1 and 300),
  preferred_delivery_date  date,
  notes                    text check (notes is null or char_length(notes) <= 1000),
  subtotal                 numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee             numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  total                    numeric(12, 2) not null check (total >= 0),
  deposit_percent          numeric(5, 2) not null check (deposit_percent >= 0 and deposit_percent <= 100),
  deposit_amount           numeric(12, 2) not null check (deposit_amount >= 0),
  balance_amount           numeric(12, 2) not null check (balance_amount >= 0),
  admin_notes              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint orders_total_matches check (total = subtotal + delivery_fee),
  constraint orders_split_matches check (deposit_amount + balance_amount = total)
);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_phone_idx on public.orders (phone);
create index if not exists orders_user_idx on public.orders (user_id) where user_id is not null;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  variant_id     uuid references public.product_variants (id) on delete set null,
  product_name   text not null,
  variant_label  text,
  sku            text,
  image_url      text,
  unit_price     numeric(12, 2) not null check (unit_price >= 0),
  quantity       integer not null check (quantity > 0),
  line_total     numeric(12, 2) generated always as (unit_price * quantity) stored,
  created_at     timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_variant_idx on public.order_items (variant_id) where variant_id is not null;

-- ---------------------------------------------------------------------
-- 7. BUSINESS FUNCTIONS
-- ---------------------------------------------------------------------

-- Delivery fee rules (the website uses the same logic to show a preview):
--   free      -> 0
--   (any mode) free_delivery_threshold reached -> 0
--   fixed     -> fixed_delivery_fee
--   county    -> fee for the county, else default_delivery_fee
--   town      -> fee for county+town, else the county fee, else default_delivery_fee
create or replace function public.compute_delivery_fee(p_county text, p_town text, p_subtotal numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.store_settings;
  v_fee numeric;
begin
  select * into s from public.store_settings where id = 1;
  if not found then
    return 0;
  end if;

  if s.delivery_mode = 'free' then
    return 0;
  end if;
  if s.free_delivery_threshold is not null and p_subtotal >= s.free_delivery_threshold then
    return 0;
  end if;
  if s.delivery_mode = 'fixed' then
    return s.fixed_delivery_fee;
  end if;

  if s.delivery_mode = 'town' then
    select dl.fee into v_fee
    from public.delivery_locations dl
    where dl.is_active
      and dl.town is not null
      and lower(dl.county) = lower(coalesce(p_county, ''))
      and lower(dl.town) = lower(coalesce(p_town, ''))
    limit 1;
    if v_fee is not null then
      return v_fee;
    end if;
  end if;

  select dl.fee into v_fee
  from public.delivery_locations dl
  where dl.is_active
    and dl.town is null
    and lower(dl.county) = lower(coalesce(p_county, ''))
  limit 1;
  if v_fee is not null then
    return v_fee;
  end if;

  return s.default_delivery_fee;
end;
$$;

-- Customers submit orders through this function (they cannot write to the tables directly).
-- Prices, delivery fee, deposit and balance are all calculated HERE from current database
-- values, so the browser can never send a fake price.
-- p_customer: {customer_name, phone, whatsapp, county, town, delivery_location, preferred_delivery_date, notes}
-- p_items:    [{variant_id, quantity}, ...]
create or replace function public.submit_order(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name      text := nullif(btrim(p_customer ->> 'customer_name'), '');
  v_phone     text := nullif(btrim(p_customer ->> 'phone'), '');
  v_whatsapp  text := nullif(btrim(p_customer ->> 'whatsapp'), '');
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
  v_fee       numeric(12, 2);
  v_total     numeric(12, 2);
  v_deposit   numeric(12, 2);
  v_balance   numeric(12, 2);
  v_order_id  uuid;
  v_number    text;
  v_created   timestamptz;
begin
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Customer details are missing.' using errcode = '22023';
  end if;
  if v_name is null or v_phone is null or v_county is null or v_town is null or v_location is null then
    raise exception 'Please fill in your name, phone, county, town and delivery location.' using errcode = '22023';
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

  -- simple abuse guard: max 5 orders per phone number per 10 minutes
  if (select count(*) from public.orders o
       where o.phone = v_phone and o.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many orders from this phone number. Please wait a few minutes.' using errcode = '22023';
  end if;

  select * into s from public.store_settings where id = 1;
  if not found then
    raise exception 'Store settings are missing. Please contact the shop.' using errcode = '22023';
  end if;

  for v_item in select jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 100 then
      raise exception 'Invalid quantity.' using errcode = '22023';
    end if;

    select
      pv.id as variant_id, pv.label, pv.sku, pv.price, pv.availability, pv.stock,
      p.id as product_id, p.name as product_name,
      (select pi.url from public.product_images pi
        where pi.product_id = p.id
        order by pi.is_main desc, pi.sort_order asc
        limit 1) as image_url
    into v_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = (v_item ->> 'variant_id')::uuid and p.is_active;

    if not found then
      raise exception 'A product in your list is no longer available. Please refresh the page and try again.' using errcode = '22023';
    end if;
    if v_row.availability = 'out_of_stock' or (v_row.availability = 'in_stock' and v_row.stock <= 0) then
      raise exception '% (%) is currently out of stock.', v_row.product_name, v_row.label using errcode = '22023';
    end if;
    if v_row.availability = 'in_stock' and v_qty > v_row.stock then
      raise exception 'Only % of % (%) left in stock.', v_row.stock, v_row.product_name, v_row.label using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + v_row.price * v_qty;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_row.product_id,
      'variant_id', v_row.variant_id,
      'product_name', v_row.product_name,
      'variant_label', v_row.label,
      'sku', v_row.sku,
      'image_url', v_row.image_url,
      'unit_price', v_row.price,
      'quantity', v_qty
    ));
  end loop;

  v_fee     := public.compute_delivery_fee(v_county, v_town, v_subtotal);
  v_total   := v_subtotal + v_fee;
  v_deposit := round(v_total * s.deposit_percent / 100, 2);
  v_balance := v_total - v_deposit;

  insert into public.orders (
    user_id, customer_name, phone, whatsapp, county, town, delivery_location,
    preferred_delivery_date, notes, subtotal, delivery_fee, total,
    deposit_percent, deposit_amount, balance_amount
  ) values (
    auth.uid(), v_name, v_phone, v_whatsapp, v_county, v_town, v_location,
    v_date, v_notes, v_subtotal, v_fee, v_total,
    s.deposit_percent, v_deposit, v_balance
  )
  returning id, order_number, created_at into v_order_id, v_number, v_created;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, variant_label, sku, image_url, unit_price, quantity
  )
  select
    v_order_id,
    (l ->> 'product_id')::uuid,
    (l ->> 'variant_id')::uuid,
    l ->> 'product_name',
    l ->> 'variant_label',
    l ->> 'sku',
    l ->> 'image_url',
    (l ->> 'unit_price')::numeric,
    (l ->> 'quantity')::integer
  from jsonb_array_elements(v_lines) as l;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_number,
    'status', 'pending',
    'created_at', v_created,
    'customer_name', v_name,
    'phone', v_phone,
    'whatsapp', v_whatsapp,
    'county', v_county,
    'town', v_town,
    'delivery_location', v_location,
    'preferred_delivery_date', v_date,
    'notes', v_notes,
    'subtotal', v_subtotal,
    'delivery_fee', v_fee,
    'total', v_total,
    'deposit_percent', s.deposit_percent,
    'deposit_amount', v_deposit,
    'balance_amount', v_balance,
    'items', v_lines
  );
end;
$$;

-- Admin only: make one image the main image of its product.
create or replace function public.set_main_image(p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  select pi.product_id into v_product from public.product_images pi where pi.id = p_image_id;
  if v_product is null then
    raise exception 'Image not found.' using errcode = '22023';
  end if;
  update public.product_images set is_main = false where product_id = v_product and is_main;
  update public.product_images set is_main = true where id = p_image_id;
end;
$$;

revoke all on function public.submit_order(jsonb, jsonb) from public;
grant execute on function public.submit_order(jsonb, jsonb) to anon, authenticated;
revoke all on function public.set_main_image(uuid) from public;
grant execute on function public.set_main_image(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.compute_delivery_fee(text, text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. TABLE PRIVILEGES (RLS below decides which rows are visible)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.product_variants,
                public.store_settings, public.delivery_locations to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.orders, public.order_items, public.profiles from anon;

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.product_images     enable row level security;
alter table public.product_variants   enable row level security;
alter table public.store_settings     enable row level security;
alter table public.delivery_locations enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;

-- profiles
drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles: admin manage" on public.profiles;
create policy "profiles: admin manage" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- categories
drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
  for select using (is_active or public.is_admin());
drop policy if exists "categories: admin write" on public.categories;
create policy "categories: admin write" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- products
drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products
  for select using (is_active or public.is_admin());
drop policy if exists "products: admin write" on public.products;
create policy "products: admin write" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- product images
drop policy if exists "product_images: public read" on public.product_images;
create policy "product_images: public read" on public.product_images
  for select using (
    public.is_admin()
    or exists (select 1 from public.products p where p.id = product_images.product_id and p.is_active)
  );
drop policy if exists "product_images: admin write" on public.product_images;
create policy "product_images: admin write" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- product variants
drop policy if exists "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants
  for select using (
    public.is_admin()
    or exists (select 1 from public.products p where p.id = product_variants.product_id and p.is_active)
  );
drop policy if exists "product_variants: admin write" on public.product_variants;
create policy "product_variants: admin write" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- store settings (public read: business name, phone, WhatsApp, delivery rules are not secret)
drop policy if exists "store_settings: public read" on public.store_settings;
create policy "store_settings: public read" on public.store_settings
  for select using (true);
drop policy if exists "store_settings: admin write" on public.store_settings;
create policy "store_settings: admin write" on public.store_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- delivery locations
drop policy if exists "delivery_locations: public read" on public.delivery_locations;
create policy "delivery_locations: public read" on public.delivery_locations
  for select using (is_active or public.is_admin());
drop policy if exists "delivery_locations: admin write" on public.delivery_locations;
create policy "delivery_locations: admin write" on public.delivery_locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders: no public insert/select. Customers order through submit_order().
-- A signed-in customer may read only their own orders; admins can manage everything.
drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or admin" on public.orders
  for select to authenticated using (public.is_admin() or user_id = auth.uid());
drop policy if exists "orders: admin update" on public.orders;
create policy "orders: admin update" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "orders: admin delete" on public.orders;
create policy "orders: admin delete" on public.orders
  for delete to authenticated using (public.is_admin());

drop policy if exists "order_items: read own or admin" on public.order_items;
create policy "order_items: read own or admin" on public.order_items
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );
drop policy if exists "order_items: admin delete" on public.order_items;
create policy "order_items: admin delete" on public.order_items
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 10. STORAGE (public bucket for product, category and logo images)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product-images: public read" on storage.objects;
create policy "product-images: public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product-images: admin upload" on storage.objects;
create policy "product-images: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product-images: admin update" on storage.objects;
create policy "product-images: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product-images: admin delete" on storage.objects;
create policy "product-images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
