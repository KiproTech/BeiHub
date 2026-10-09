-- =====================================================================
--  beihub_migration.sql   -   BeiHub roles, permissions and admin management
--
--  Adds, on top of the single-business database:
--    1. three roles: super_admin / admin / customer (always read from the database)
--    2. a permission catalogue + per-admin permissions, enforced by RLS and by the RPCs
--    3. a Super Admin that is identified in the DATABASE (never in the React code)
--    4. secure, expiring, one-time admin invitations
--    5. Super Admin tools: administrators, customers + their orders, dashboard figures
--    6. a tamper-proof audit log (actor, role, description, old / new values)
--    7. login / logout tracking
--
--  RUN ORDER (Supabase Dashboard > SQL Editor)
--    1. supabase/BeiHub_database.sql
--    2. supabase/archive/01_marketplace_upgrade.sql
--    3. supabase/archive/02_single_business_upgrade.sql
--    4. supabase/beihub_migration.sql                     THIS FILE
--  If steps 1-3 were already run on your project, run ONLY this file.
--
--  SAFE TO RE-RUN. Existing data is kept. Existing admins keep everything they could do
--  before, except managing other administrators (that is Super Admin only unless granted).
--
--  AFTER RUNNING (cannot be done in SQL)
--    Authentication > Providers > Email: "Confirm email" ON
--    Authentication > URL Configuration: Site URL + Redirect URLs (see README)
--    Authentication > Email Templates > "Magic Link": reword it as the admin invitation (see README)
--    Authentication > SMTP: use your own SMTP provider (the built-in sender is limited to a few mails per hour)
-- =====================================================================

do $$
begin
  if to_regclass('public.order_cancellation_reasons') is null then
    raise exception 'Run BeiHub_database.sql, archive/01_marketplace_upgrade.sql and archive/02_single_business_upgrade.sql before this file.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 1. ROLES + extra profile columns
--    profiles.role is the ONE place a role lives. The browser never decides it.
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'admin', 'super_admin'));

alter table public.profiles
  add column if not exists last_login_at  timestamptz,
  add column if not exists last_logout_at timestamptz,
  add column if not exists suspended_at   timestamptz,
  add column if not exists suspended_by   uuid references auth.users (id) on delete set null,
  add column if not exists admin_since    timestamptz,
  add column if not exists invited_by     uuid references auth.users (id) on delete set null;

-- there can only ever be ONE super admin (ownership moves only through transfer_super_admin())
create unique index if not exists profiles_single_super_admin on public.profiles ((true)) where role = 'super_admin';
create index if not exists profiles_role_idx on public.profiles (role);


-- ---------------------------------------------------------------------
-- 2. PERMISSIONS
-- ---------------------------------------------------------------------
create table if not exists public.permissions (
  code        text primary key check (code ~ '^[A-Z_]+$'),
  label       text not null,
  description text,
  sort_order  integer not null default 0,
  restricted  boolean not null default false     -- only the Super Admin may grant a restricted permission
);

insert into public.permissions (code, label, description, sort_order, restricted) values
  ('MANAGE_PRODUCTS',          'Manage products',         'Create, edit, hide and delete products, variants and categories.',                10, false),
  ('MANAGE_PRODUCT_PRICES',    'Manage prices',           'Change product prices and previous (struck-through) prices.',                     20, false),
  ('MANAGE_PRODUCT_IMAGES',    'Manage product images',   'Upload, replace and delete product pictures.',                                    30, false),
  ('MANAGE_ORDERS',            'Manage orders',           'See orders, add notes, update payment status and send updates.',                  40, false),
  ('UPDATE_ORDER_STATUS',      'Update order status',     'Move an order forward (confirmed, processing, ready, completed ...).',            50, false),
  ('CANCEL_ORDERS',            'Cancel orders',           'Cancel an order with a predefined reason.',                                       60, false),
  ('MANAGE_CUSTOMERS',         'Manage customers',        'See customers and their order history; suspend or reactivate customer accounts.', 70, false),
  ('MANAGE_BUSINESS_SETTINGS', 'Manage business settings','Contact details, opening hours, delivery information, delivery fees.',            80, false),
  ('MANAGE_MEDIA',             'Manage media',            'Logo, banners, favicon and other website pictures.',                              90, false),
  ('VIEW_REPORTS',             'View reports',            'See dashboard figures and order totals.',                                         100, false),
  ('VIEW_AUDIT_LOGS',          'View audit logs',         'Read the record of administrator actions.',                                       110, false),
  ('MANAGE_NOTIFICATIONS',     'Manage notifications',    'Send updates and messages to customers.',                                         120, false),
  ('MANAGE_ADMINS',            'Manage administrators',   'Invite, suspend and change permissions of other administrators.',                 130, true)
on conflict (code) do update set label = excluded.label, description = excluded.description,
                                 sort_order = excluded.sort_order, restricted = excluded.restricted;

create table if not exists public.admin_permissions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  permission text not null references public.permissions (code) on update cascade on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);
create index if not exists admin_permissions_perm_idx on public.admin_permissions (permission);


-- ---------------------------------------------------------------------
-- 3. ROLE / PERMISSION HELPERS  (SECURITY DEFINER: they read profiles without recursion)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()                    -- "is staff": admin OR super admin, account active
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role in ('admin', 'super_admin') and not p.is_suspended);
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'super_admin' and not p.is_suspended);
$$;

create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and not p.is_suspended
       and (p.role = 'super_admin'
            or (p.role = 'admin' and exists (select 1 from public.admin_permissions ap
                                              where ap.user_id = p.id and ap.permission = p_permission)))
  );
$$;

create or replace function public.has_any_permission(p_permissions text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and not p.is_suspended
       and (p.role = 'super_admin'
            or (p.role = 'admin' and exists (select 1 from public.admin_permissions ap
                                              where ap.user_id = p.id and ap.permission = any (p_permissions))))
  );
$$;

-- who may see orders at all (customers always see their own through a separate policy)
create or replace function public.can_view_orders()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_permission(array['MANAGE_ORDERS', 'UPDATE_ORDER_STATUS', 'CANCEL_ORDERS', 'MANAGE_CUSTOMERS', 'VIEW_REPORTS']);
$$;

-- the browser asks "what am I?" - the answer is ONLY used to decide what to show; every request is re-checked by RLS
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'role', p.role,
           'suspended', p.is_suspended,
           'permissions', case
             when p.is_suspended then '[]'::jsonb
             when p.role = 'super_admin' then coalesce((select jsonb_agg(c.code order by c.sort_order) from public.permissions c), '[]'::jsonb)
             when p.role = 'admin' then coalesce((select jsonb_agg(ap.permission order by ap.permission) from public.admin_permissions ap where ap.user_id = p.id), '[]'::jsonb)
             else '[]'::jsonb end)
    from public.profiles p where p.id = auth.uid();
$$;

grant execute on function public.is_admin(), public.is_super_admin(), public.has_permission(text),
                          public.has_any_permission(text[]), public.can_view_orders(), public.my_access()
  to anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. THE SUPER ADMIN LIVES IN THE DATABASE
--    The e-mail below is promoted to super_admin automatically - but ONLY once Supabase has
--    VERIFIED that address (email_confirmed_at). Nobody can get the role by registering with it.
--    The table has no policies and no grants: only the functions below can read it.
-- ---------------------------------------------------------------------
create table if not exists public.super_admin_bootstrap (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.super_admin_bootstrap enable row level security;
revoke all on public.super_admin_bootstrap from anon, authenticated;

insert into public.super_admin_bootstrap (email) values ('akiprotichamos@gmail.com') on conflict do nothing;

create or replace function public._promote_bootstrap(p_user uuid, p_email text, p_confirmed timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_confirmed is not null
     and exists (select 1 from public.super_admin_bootstrap b where b.email = lower(p_email))
     and not exists (select 1 from public.profiles where role = 'super_admin' and id <> p_user) then
    perform set_config('beihub.rbac_rpc', 'on', true);
    update public.profiles set role = 'super_admin', admin_since = coalesce(admin_since, now())
     where id = p_user and role <> 'super_admin';
  end if;
end;
$$;
revoke all on function public._promote_bootstrap(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), new.phone))
  on conflict (id) do nothing;
  perform public._promote_bootstrap(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;

create or replace function public.promote_on_email_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._promote_bootstrap(new.id, new.email, new.email_confirmed_at);
  return new;
end;
$$;
drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at, email on auth.users
  for each row execute function public.promote_on_email_confirmed();

-- promote the owner if the account already exists and is verified
select public._promote_bootstrap(u.id, u.email, u.email_confirmed_at)
  from auth.users u where lower(u.email) in (select email from public.super_admin_bootstrap);

-- existing admins keep everything they could do before (except managing other administrators)
insert into public.admin_permissions (user_id, permission)
select p.id, c.code from public.profiles p cross join public.permissions c
 where p.role = 'admin' and c.code <> 'MANAGE_ADMINS'
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 5. NOBODY CAN EDIT ROLES OR ACCOUNT STATUS DIRECTLY
--    Before: any admin could UPDATE any profile (including role) through the API.
--    Now: role / suspension / login columns can only change inside the audited functions below
--    (they set beihub.rbac_rpc, which a browser cannot do), not even for the Super Admin.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('beihub.rbac_rpc', true), '') = 'on' then
    return new;
  end if;
  if auth.uid() is not null and (
        new.role is distinct from old.role
     or new.is_suspended is distinct from old.is_suspended
     or new.suspended_reason is distinct from old.suspended_reason
     or new.suspended_at is distinct from old.suspended_at
     or new.suspended_by is distinct from old.suspended_by
     or new.admin_since is distinct from old.admin_since
     or new.invited_by is distinct from old.invited_by
     or new.last_login_at is distinct from old.last_login_at
     or new.last_logout_at is distinct from old.last_logout_at) then
    raise exception 'Roles and account status can only be changed through the administrator tools.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- a profile row is created only by handle_new_user(); nobody inserts or deletes profiles through the API
drop policy if exists "profiles: admin manage" on public.profiles;
drop policy if exists "profiles: read own or admin" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: read own or authorised staff" on public.profiles;
drop policy if exists "profiles: read own or authorised staff" on public.profiles;
create policy "profiles: read own or authorised staff" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_any_permission(array['MANAGE_CUSTOMERS', 'MANAGE_ADMINS']));
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;

alter table public.permissions        enable row level security;
alter table public.admin_permissions  enable row level security;
revoke all on public.permissions, public.admin_permissions from anon, authenticated;
grant select on public.permissions, public.admin_permissions to authenticated;
drop policy if exists "permissions: staff read" on public.permissions;
drop policy if exists "permissions: staff read" on public.permissions;
create policy "permissions: staff read" on public.permissions for select to authenticated using (public.is_admin());
drop policy if exists "admin_permissions: own or admin managers" on public.admin_permissions;
drop policy if exists "admin_permissions: own or admin managers" on public.admin_permissions;
create policy "admin_permissions: own or admin managers" on public.admin_permissions
  for select to authenticated using (user_id = auth.uid() or public.has_permission('MANAGE_ADMINS'));
-- (no insert / update / delete policy: permissions change only through admin_set_admin_permissions())


-- ---------------------------------------------------------------------
-- 6. AUDIT LOG  (who did what, as which role; append-only)
-- ---------------------------------------------------------------------
alter table public.audit_log add column if not exists description text;

drop function if exists public.write_audit(text, text, text, text, jsonb, jsonb);
create or replace function public.write_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_label       text,
  p_old         jsonb,
  p_new         jsonb,
  p_description text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_role  text;
begin
  if v_uid is null then
    return;                       -- SQL editor / migrations / service role: not a user action
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  insert into public.audit_log (actor_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, old_values, new_values, description)
  values (v_uid, v_email, coalesce(v_role, 'customer'), p_action, p_entity_type, p_entity_id, p_label, p_old, p_new, p_description);
end;
$$;
revoke all on function public.write_audit(text, text, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- append-only: nobody (not even the Super Admin) can edit or delete audit records through the API.
-- (The only allowed change is Postgres clearing actor_id when that auth user is deleted.)
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;
create or replace function public.audit_log_immutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'Audit records cannot be changed or deleted.' using errcode = '42501';
end;
$$;
drop trigger if exists audit_log_immutable_bud on public.audit_log;
create trigger audit_log_immutable_bud before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

drop policy if exists "audit_log: admin read" on public.audit_log;
drop policy if exists "audit_log: permitted read" on public.audit_log;
drop policy if exists "audit_log: permitted read" on public.audit_log;
create policy "audit_log: permitted read" on public.audit_log
  for select to authenticated using (public.has_permission('VIEW_AUDIT_LOGS'));
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);


-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY BY PERMISSION  (replaces "any admin can do anything")
-- ---------------------------------------------------------------------
-- catalogue
drop policy if exists "categories: admin write" on public.categories;
drop policy if exists "categories: permitted write" on public.categories;
create policy "categories: permitted write" on public.categories
  for all to authenticated using (public.has_permission('MANAGE_PRODUCTS')) with check (public.has_permission('MANAGE_PRODUCTS'));

drop policy if exists "products: admin write" on public.products;
drop policy if exists "products: permitted write" on public.products;
create policy "products: permitted write" on public.products
  for all to authenticated using (public.has_permission('MANAGE_PRODUCTS')) with check (public.has_permission('MANAGE_PRODUCTS'));

drop policy if exists "product_images: admin write" on public.product_images;
drop policy if exists "product_images: permitted write" on public.product_images;
create policy "product_images: permitted write" on public.product_images
  for all to authenticated using (public.has_permission('MANAGE_PRODUCT_IMAGES')) with check (public.has_permission('MANAGE_PRODUCT_IMAGES'));

drop policy if exists "product_variants: admin write" on public.product_variants;
drop policy if exists "product_variants: permitted write" on public.product_variants;
create policy "product_variants: permitted write" on public.product_variants
  for all to authenticated
  using      (public.has_any_permission(array['MANAGE_PRODUCTS', 'MANAGE_PRODUCT_PRICES']))
  with check (public.has_any_permission(array['MANAGE_PRODUCTS', 'MANAGE_PRODUCT_PRICES']));

-- A variant row holds both the PRICE and the stock / label. Prices need their own permission.
create or replace function public.guard_variant_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);                       -- migrations / SQL editor
  end if;
  if tg_op in ('INSERT', 'DELETE') then
    if not public.has_permission('MANAGE_PRODUCTS') then
      raise exception 'You do not have permission to add or remove product variants.' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end if;
  if (to_jsonb(new) - 'price' - 'previous_price' - 'updated_at') is distinct from (to_jsonb(old) - 'price' - 'previous_price' - 'updated_at')
     and not public.has_permission('MANAGE_PRODUCTS') then
    raise exception 'You do not have permission to change product details or stock.' using errcode = '42501';
  end if;
  if (new.price is distinct from old.price or new.previous_price is distinct from old.previous_price)
     and not public.has_permission('MANAGE_PRODUCT_PRICES') then
    raise exception 'You do not have permission to change prices.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists product_variants_guard_biud on public.product_variants;
create trigger product_variants_guard_biud before insert or update or delete on public.product_variants
  for each row execute function public.guard_variant_write();

-- business information + media + delivery fees
drop policy if exists "store_settings: admin write" on public.store_settings;
drop policy if exists "store_settings: permitted write" on public.store_settings;
create policy "store_settings: permitted write" on public.store_settings
  for all to authenticated using (public.has_permission('MANAGE_BUSINESS_SETTINGS')) with check (public.has_permission('MANAGE_BUSINESS_SETTINGS'));

drop policy if exists "delivery_locations: admin write" on public.delivery_locations;
drop policy if exists "delivery_locations: permitted write" on public.delivery_locations;
create policy "delivery_locations: permitted write" on public.delivery_locations
  for all to authenticated using (public.has_permission('MANAGE_BUSINESS_SETTINGS')) with check (public.has_permission('MANAGE_BUSINESS_SETTINGS'));

drop policy if exists "site_media: admin write" on public.site_media;
drop policy if exists "site_media: permitted write" on public.site_media;
create policy "site_media: permitted write" on public.site_media
  for all to authenticated using (public.has_permission('MANAGE_MEDIA')) with check (public.has_permission('MANAGE_MEDIA'));

-- orders: customers see their own; staff see orders only with an order-related permission; only the Super Admin deletes
drop policy if exists "orders: read own or admin" on public.orders;
drop policy if exists "orders: read own or permitted" on public.orders;
create policy "orders: read own or permitted" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.can_view_orders());
drop policy if exists "orders: admin delete" on public.orders;
drop policy if exists "orders: super admin delete" on public.orders;
create policy "orders: super admin delete" on public.orders
  for delete to authenticated using (public.is_super_admin());

drop policy if exists "order_items: read own or admin" on public.order_items;
drop policy if exists "order_items: read own or permitted" on public.order_items;
create policy "order_items: read own or permitted" on public.order_items
  for select to authenticated
  using (public.can_view_orders() or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));
drop policy if exists "order_items: admin delete" on public.order_items;
drop policy if exists "order_items: super admin delete" on public.order_items;
create policy "order_items: super admin delete" on public.order_items
  for delete to authenticated using (public.is_super_admin());

drop policy if exists "order_events: read" on public.order_events;
drop policy if exists "order_events: read" on public.order_events;
create policy "order_events: read" on public.order_events
  for select to authenticated
  using (public.can_view_orders()
         or (visible_to_customer and exists (select 1 from public.orders o where o.id = order_events.order_id and o.user_id = auth.uid())));

drop policy if exists "order_cancellation_reasons: admin all" on public.order_cancellation_reasons;
drop policy if exists "order_cancellation_reasons: staff read" on public.order_cancellation_reasons;
create policy "order_cancellation_reasons: staff read" on public.order_cancellation_reasons
  for select to authenticated using (public.is_admin());
drop policy if exists "order_cancellation_reasons: permitted write" on public.order_cancellation_reasons;
create policy "order_cancellation_reasons: permitted write" on public.order_cancellation_reasons
  for all to authenticated using (public.has_permission('MANAGE_ORDERS')) with check (public.has_permission('MANAGE_ORDERS'));
drop policy if exists "order_update_templates: admin all" on public.order_update_templates;
drop policy if exists "order_update_templates: staff read" on public.order_update_templates;
create policy "order_update_templates: staff read" on public.order_update_templates
  for select to authenticated using (public.is_admin());
drop policy if exists "order_update_templates: permitted write" on public.order_update_templates;
create policy "order_update_templates: permitted write" on public.order_update_templates
  for all to authenticated using (public.has_permission('MANAGE_ORDERS')) with check (public.has_permission('MANAGE_ORDERS'));

do $$ begin
  if to_regclass('public.legacy_shops_archive') is not null then
    drop policy if exists "legacy_shops_archive: admin read" on public.legacy_shops_archive;
    drop policy if exists "legacy_shops_archive: super admin read" on public.legacy_shops_archive;
    create policy "legacy_shops_archive: super admin read" on public.legacy_shops_archive
      for select to authenticated using (public.is_super_admin());
  end if;
end $$;

-- storage: the folder decides which permission is needed
create or replace function public.can_write_storage_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case split_part(coalesce(p_name, ''), '/', 1)
           when 'products'   then public.has_permission('MANAGE_PRODUCT_IMAGES')
           when 'categories' then public.has_permission('MANAGE_PRODUCTS')
           else                   public.has_permission('MANAGE_MEDIA')
         end;
$$;
grant execute on function public.can_write_storage_path(text) to authenticated;

drop policy if exists "product-images: admin upload" on storage.objects;
drop policy if exists "product-images: admin update" on storage.objects;
drop policy if exists "product-images: admin delete" on storage.objects;
drop policy if exists "product-images: permitted upload" on storage.objects;
create policy "product-images: permitted upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.can_write_storage_path(name));
drop policy if exists "product-images: permitted update" on storage.objects;
create policy "product-images: permitted update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.can_write_storage_path(name))
  with check (bucket_id = 'product-images' and public.can_write_storage_path(name));
drop policy if exists "product-images: permitted delete" on storage.objects;
create policy "product-images: permitted delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.can_write_storage_path(name));


-- ---------------------------------------------------------------------
-- 8. ORDER / IMAGE / MEDIA FUNCTIONS now check the matching permission
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_payment_status(p_order_id uuid, p_payment_status text, p_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o       public.orders;
  v_old   text;
  v_msg   text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if not (public.has_permission('MANAGE_ORDERS')) then
    raise exception 'You do not have permission to manage orders.' using errcode = '42501';
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_order_note(p_order_id uuid, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not (public.has_permission('MANAGE_ORDERS')) then
    raise exception 'You do not have permission to manage orders.' using errcode = '42501';
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
$function$;

CREATE OR REPLACE FUNCTION public.set_main_image(p_image_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_product uuid;
begin
  if not (public.has_permission('MANAGE_PRODUCT_IMAGES')) then
    raise exception 'You do not have permission to manage product images.' using errcode = '42501';
  end if;
  select pi.product_id into v_product from public.product_images pi where pi.id = p_image_id;
  if v_product is null then
    raise exception 'Image not found.' using errcode = '22023';
  end if;
  update public.product_images set is_main = false where product_id = v_product and is_main;
  update public.product_images set is_main = true where id = p_image_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_primary_site_media(p_media_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_slot text;
begin
  if not (public.has_permission('MANAGE_MEDIA')) then
    raise exception 'You do not have permission to manage media.' using errcode = '42501';
  end if;
  select slot into v_slot from public.site_media where id = p_media_id;
  if v_slot is null then
    raise exception 'Image not found.' using errcode = '22023';
  end if;
  update public.site_media set is_primary = false where slot = v_slot and is_primary;
  update public.site_media set is_primary = true  where id = p_media_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_order_status(p_order_id uuid, p_status text, p_reason text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_reason_code text DEFAULT NULL::text, p_update_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not (public.has_any_permission(array['UPDATE_ORDER_STATUS', 'CANCEL_ORDERS'])) then
    raise exception 'You do not have permission to change order status.' using errcode = '42501';
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
  if p_status = 'cancelled' and not public.has_permission('CANCEL_ORDERS') then
    raise exception 'You do not have permission to cancel orders.' using errcode = '42501';
  end if;
  if p_status <> 'cancelled' and not public.has_permission('UPDATE_ORDER_STATUS') then
    raise exception 'You do not have permission to update order status.' using errcode = '42501';
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_send_order_update(p_order_id uuid, p_update_code text DEFAULT NULL::text, p_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o       public.orders;
  v_ucode text := nullif(btrim(coalesce(p_update_code, '')), '');
  v_msg   text := nullif(btrim(coalesce(p_message, '')), '');
  v_tpl   text;
  v_text  text;
begin
  if not (public.has_any_permission(array['MANAGE_ORDERS', 'MANAGE_NOTIFICATIONS'])) then
    raise exception 'You do not have permission to send order updates.' using errcode = '42501';
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
$function$;


-- ---------------------------------------------------------------------
-- 9. ADMIN INVITATIONS
--    - the e-mail link carries a one-time token; only its SHA-256 hash is stored
--    - expires after 7 days, can be revoked or re-sent (a re-send invalidates the old token)
--    - accepting needs: a signed-in session whose VERIFIED e-mail equals the invited address + the token
--    - a normal registration can never become an admin
--    The table is reachable ONLY through the functions below (no grants, no policies).
-- ---------------------------------------------------------------------
create table if not exists public.admin_invitations (
  id               uuid primary key default gen_random_uuid(),
  email            text not null check (email = lower(email)),
  full_name        text not null,
  phone            text,
  role             text not null default 'admin' check (role = 'admin'),
  permissions      text[] not null default '{}',
  token_hash       text not null,
  status           text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by       uuid references auth.users (id) on delete set null,
  invited_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  last_sent_at     timestamptz not null default now(),
  send_count       integer not null default 1,
  accepted_at      timestamptz,
  accepted_user_id uuid references auth.users (id) on delete set null,
  revoked_at       timestamptz,
  revoked_by       uuid references auth.users (id) on delete set null
);
create unique index if not exists admin_invitations_one_pending on public.admin_invitations (email) where status = 'pending';
create unique index if not exists admin_invitations_token_idx   on public.admin_invitations (token_hash);
create index if not exists admin_invitations_status_idx on public.admin_invitations (status, invited_at desc);
alter table public.admin_invitations enable row level security;
revoke all on public.admin_invitations from anon, authenticated;

create or replace function public._can_manage_admins()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.has_permission('MANAGE_ADMINS');
$$;
revoke all on function public._can_manage_admins() from public, anon, authenticated;

create or replace function public._token_hash(p_token text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;
revoke all on function public._token_hash(text) from public, anon, authenticated;

-- may the caller grant exactly this set of permissions?
create or replace function public._check_grantable(p_perms text[])
returns void language plpgsql stable security definer set search_path = public as $$
declare bad text;
begin
  select x into bad from unnest(p_perms) x where not exists (select 1 from public.permissions c where c.code = x) limit 1;
  if bad is not null then
    raise exception 'Unknown permission: %.', bad using errcode = '22023';
  end if;
  if not public.is_super_admin() then
    select x into bad from unnest(p_perms) x
     where exists (select 1 from public.permissions c where c.code = x and c.restricted) or not public.has_permission(x) limit 1;
    if bad is not null then
      raise exception 'You cannot grant the permission %.', bad using errcode = '42501';
    end if;
  end if;
end;
$$;
revoke all on function public._check_grantable(text[]) from public, anon, authenticated;

create or replace function public.admin_create_invitation(p_email text, p_full_name text, p_phone text, p_permissions text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_perms text[];
  v_token text;
  v_id    uuid;
  v_exp   timestamptz := now() + interval '7 days';
begin
  if not public._can_manage_admins() then
    raise exception 'You do not have permission to manage administrators.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Enter the administrator''s full name.' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9][0-9 ()\-]{5,24}$' then
    raise exception 'The phone number looks invalid.' using errcode = '22023';
  end if;
  v_perms := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_permissions, '{}')) x), '{}');
  perform public._check_grantable(v_perms);

  if exists (select 1 from auth.users u join public.profiles p on p.id = u.id
              where lower(u.email) = v_email and p.role in ('admin', 'super_admin')) then
    raise exception 'This person is already an administrator.' using errcode = '22023';
  end if;
  update public.admin_invitations set status = 'expired' where status = 'pending' and expires_at < now();
  if exists (select 1 from public.admin_invitations where email = v_email and status = 'pending') then
    raise exception 'There is already a pending invitation for this email. Resend or revoke it.' using errcode = '22023';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.admin_invitations (email, full_name, phone, permissions, token_hash, invited_by, expires_at)
  values (v_email, v_name, v_phone, v_perms, public._token_hash(v_token), auth.uid(), v_exp)
  returning id into v_id;

  perform public.write_audit('admin.invited', 'admin_invitation', v_id::text, v_email, null,
    jsonb_build_object('permissions', to_jsonb(v_perms), 'expires_at', v_exp), 'Invited ' || v_name || ' (' || v_email || ') as an administrator');
  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'expires_at', v_exp);
end;
$$;

-- a NEW token (the old link stops working) + a fresh 7 days
create or replace function public.admin_reissue_invitation(p_invitation uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv     public.admin_invitations;
  v_token text;
  v_exp   timestamptz := now() + interval '7 days';
begin
  if not public._can_manage_admins() then
    raise exception 'You do not have permission to manage administrators.' using errcode = '42501';
  end if;
  select * into inv from public.admin_invitations where id = p_invitation for update;
  if not found then raise exception 'Invitation not found.' using errcode = '22023'; end if;
  if inv.status in ('accepted', 'revoked') then
    raise exception 'A % invitation cannot be sent again. Create a new invitation instead.', inv.status using errcode = '22023';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.admin_invitations
     set token_hash = public._token_hash(v_token), status = 'pending', expires_at = v_exp,
         last_sent_at = now(), send_count = send_count + 1
   where id = inv.id;
  perform public.write_audit('admin.invitation_resent', 'admin_invitation', inv.id::text, inv.email, null,
    jsonb_build_object('expires_at', v_exp), 'Re-sent the invitation to ' || inv.email);
  return jsonb_build_object('id', inv.id, 'token', v_token, 'email', inv.email, 'expires_at', v_exp);
end;
$$;

create or replace function public.admin_revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv public.admin_invitations;
begin
  if not public._can_manage_admins() then
    raise exception 'You do not have permission to manage administrators.' using errcode = '42501';
  end if;
  select * into inv from public.admin_invitations where id = p_invitation for update;
  if not found then raise exception 'Invitation not found.' using errcode = '22023'; end if;
  if inv.status not in ('pending', 'expired') then
    raise exception 'A % invitation cannot be revoked.', inv.status using errcode = '22023';
  end if;
  update public.admin_invitations set status = 'revoked', revoked_at = now(), revoked_by = auth.uid() where id = inv.id;
  perform public.write_audit('admin.invitation_revoked', 'admin_invitation', inv.id::text, inv.email, null, null, 'Revoked the invitation for ' || inv.email);
end;
$$;

create or replace function public.admin_list_invitations()
returns table (id uuid, email text, full_name text, phone text, permissions text[], status text,
               invited_by_name text, invited_at timestamptz, expires_at timestamptz, last_sent_at timestamptz,
               send_count integer, accepted_at timestamptz, revoked_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._can_manage_admins() then
    raise exception 'You do not have permission to manage administrators.' using errcode = '42501';
  end if;
  update public.admin_invitations i set status = 'expired' where i.status = 'pending' and i.expires_at < now();
  return query
    select i.id, i.email, i.full_name, i.phone, i.permissions, i.status,
           coalesce(nullif(pr.full_name, ''), u.email::text), i.invited_at, i.expires_at, i.last_sent_at,
           i.send_count, i.accepted_at, i.revoked_at
      from public.admin_invitations i
      left join public.profiles pr on pr.id = i.invited_by
      left join auth.users u on u.id = i.invited_by
     order by i.invited_at desc;      -- token_hash is never returned
end;
$$;

-- shared checks for the person who clicked the e-mail link. ONE generic message on purpose.
create or replace function public._invitation_for_caller(p_token text, p_lock boolean)
returns public.admin_invitations language plpgsql security definer set search_path = public as $$
declare
  inv     public.admin_invitations;
  v_email text;
  v_conf  timestamptz;
  v_msg   constant text := 'This invitation is invalid, has expired, was revoked, or was sent to a different email address.';
begin
  if auth.uid() is null then
    raise exception 'Please open the link from your invitation email to sign in.' using errcode = '28000';
  end if;
  select u.email, u.email_confirmed_at into v_email, v_conf from auth.users u where u.id = auth.uid();
  if v_conf is null then
    raise exception 'Your email address is not verified yet. Open the link from your invitation email.' using errcode = '28000';
  end if;
  if p_lock then
    select * into inv from public.admin_invitations where token_hash = public._token_hash(p_token) for update;
  else
    select * into inv from public.admin_invitations where token_hash = public._token_hash(p_token);
  end if;
  if not found or inv.status <> 'pending' or lower(inv.email) <> lower(v_email) then
    raise exception '%', v_msg using errcode = '22023';
  end if;
  if inv.expires_at < now() then
    update public.admin_invitations set status = 'expired' where id = inv.id;
    raise exception '%', v_msg using errcode = '22023';
  end if;
  return inv;
end;
$$;
revoke all on function public._invitation_for_caller(text, boolean) from public, anon, authenticated;

create or replace function public.invitation_preview(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv public.admin_invitations;
begin
  inv := public._invitation_for_caller(p_token, false);
  return jsonb_build_object('email', inv.email, 'full_name', inv.full_name, 'phone', inv.phone,
                            'permissions', to_jsonb(inv.permissions), 'expires_at', inv.expires_at);
end;
$$;

create or replace function public.accept_admin_invitation(p_token text, p_full_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv     public.admin_invitations;
  v_user  uuid := auth.uid();
  v_name  text := btrim(coalesce(p_full_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  pr      public.profiles;
begin
  inv := public._invitation_for_caller(p_token, true);
  select * into pr from public.profiles where id = v_user;
  if not found or pr.is_suspended then
    raise exception 'This account cannot accept the invitation.' using errcode = '42501';
  end if;
  if pr.role in ('admin', 'super_admin') then
    raise exception 'You are already an administrator.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Enter your full name.' using errcode = '22023';
  end if;
  if v_phone is null or v_phone !~ '^\+?[0-9][0-9 ()\-]{5,24}$' then
    raise exception 'Enter a valid phone number.' using errcode = '22023';
  end if;

  perform set_config('beihub.rbac_rpc', 'on', true);
  update public.profiles
     set role = 'admin', full_name = v_name, phone = v_phone, admin_since = now(), invited_by = inv.invited_by
   where id = v_user;
  insert into public.admin_permissions (user_id, permission, granted_by)
  select v_user, x, inv.invited_by from unnest(inv.permissions) x
  on conflict do nothing;
  update public.admin_invitations set status = 'accepted', accepted_at = now(), accepted_user_id = v_user where id = inv.id;

  perform public.write_audit('admin.invitation_accepted', 'admin', v_user::text, inv.email, null,
    jsonb_build_object('permissions', to_jsonb(inv.permissions)), v_name || ' accepted the administrator invitation');
  return public.my_access();
end;
$$;

grant execute on function
  public.admin_create_invitation(text, text, text, text[]), public.admin_reissue_invitation(uuid),
  public.admin_revoke_invitation(uuid), public.admin_list_invitations(),
  public.invitation_preview(text), public.accept_admin_invitation(text, text, text)
  to authenticated;
revoke all on function
  public.admin_create_invitation(text, text, text, text[]), public.admin_reissue_invitation(uuid),
  public.admin_revoke_invitation(uuid), public.admin_list_invitations(),
  public.invitation_preview(text), public.accept_admin_invitation(text, text, text)
  from public, anon;


-- ---------------------------------------------------------------------
-- 10. ADMINISTRATORS: list, permissions, suspend / reactivate, revoke, transfer ownership
--     Rules enforced here (not in React):
--       * nobody can change, suspend or revoke the Super Admin
--       * nobody can change their own permissions or suspend / revoke themselves
--       * an admin who was granted MANAGE_ADMINS can only manage plain admins, can never grant
--         MANAGE_ADMINS and can only grant permissions they hold themselves
-- ---------------------------------------------------------------------
create or replace function public.admin_list_admins()
returns table (id uuid, full_name text, email text, phone text, role text, is_suspended boolean, suspended_reason text,
               email_verified boolean, last_login_at timestamptz, last_logout_at timestamptz, created_at timestamptz,
               admin_since timestamptz, invited_by_name text, permissions text[])
language plpgsql security definer set search_path = public as $$
begin
  if not public._can_manage_admins() then
    raise exception 'You do not have permission to manage administrators.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, u.email::text, p.phone, p.role, p.is_suspended, p.suspended_reason,
           (u.email_confirmed_at is not null), coalesce(p.last_login_at, u.last_sign_in_at), p.last_logout_at, p.created_at,
           p.admin_since, coalesce(nullif(ip.full_name, ''), iu.email::text),
           case when p.role = 'super_admin' then (select array_agg(c.code order by c.sort_order) from public.permissions c)
                else coalesce((select array_agg(ap.permission order by ap.permission) from public.admin_permissions ap where ap.user_id = p.id), '{}') end
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.profiles ip on ip.id = p.invited_by
      left join auth.users iu on iu.id = p.invited_by
     where p.role in ('admin', 'super_admin')
     order by (p.role = 'super_admin') desc, p.created_at;
end;
$$;

-- common guard for actions on ANOTHER administrator
create or replace function public._target_admin(p_user uuid)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare t public.profiles;
begin
  if not public._can_manage_admins() then
    raise exception 'You do not have permission to manage administrators.' using errcode = '42501';
  end if;
  select * into t from public.profiles where id = p_user;
  if not found or t.role not in ('admin', 'super_admin') then
    raise exception 'Administrator not found.' using errcode = '22023';
  end if;
  if t.role = 'super_admin' then
    raise exception 'The Super Admin cannot be changed.' using errcode = '42501';
  end if;
  if t.id = auth.uid() then
    raise exception 'You cannot do this to your own account.' using errcode = '42501';
  end if;
  if not public.is_super_admin() and exists (select 1 from public.admin_permissions where user_id = t.id and permission = 'MANAGE_ADMINS') then
    raise exception 'Only the Super Admin can manage an administrator who can manage administrators.' using errcode = '42501';
  end if;
  return t;
end;
$$;
revoke all on function public._target_admin(uuid) from public, anon, authenticated;

create or replace function public.admin_set_admin_permissions(p_user uuid, p_permissions text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t       public.profiles;
  v_new   text[] := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_permissions, '{}')) x), '{}');
  v_old   text[];
begin
  t := public._target_admin(p_user);
  select coalesce(array_agg(permission order by permission), '{}') into v_old from public.admin_permissions where user_id = t.id;
  -- only the permissions that are being ADDED must be grantable by the caller
  perform public._check_grantable(coalesce((select array_agg(x) from unnest(v_new) x where x <> all (v_old)), '{}'));
  delete from public.admin_permissions where user_id = t.id and permission <> all (v_new);
  insert into public.admin_permissions (user_id, permission, granted_by)
  select t.id, x, auth.uid() from unnest(v_new) x on conflict do nothing;
  perform public.write_audit('admin.permissions_changed', 'admin', t.id::text, coalesce(nullif(t.full_name, ''), t.id::text),
    jsonb_build_object('permissions', to_jsonb(v_old)), jsonb_build_object('permissions', to_jsonb(v_new)),
    'Changed the permissions of ' || coalesce(nullif(t.full_name, ''), t.id::text));
  return jsonb_build_object('permissions', to_jsonb(v_new));
end;
$$;

create or replace function public.admin_set_admin_suspended(p_user uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  t      public.profiles;
  v_why  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  t := public._target_admin(p_user);
  if p_suspended and v_why is null then
    raise exception 'Enter a reason for the suspension.' using errcode = '22023';
  end if;
  perform set_config('beihub.rbac_rpc', 'on', true);
  update public.profiles
     set is_suspended = p_suspended,
         suspended_reason = case when p_suspended then v_why else null end,
         suspended_at = case when p_suspended then now() else null end,
         suspended_by = case when p_suspended then auth.uid() else null end
   where id = t.id;
  perform public.write_audit(case when p_suspended then 'admin.suspended' else 'admin.reactivated' end, 'admin', t.id::text,
    coalesce(nullif(t.full_name, ''), t.id::text), jsonb_build_object('suspended', t.is_suspended),
    jsonb_build_object('suspended', p_suspended, 'reason', v_why),
    case when p_suspended then 'Suspended administrator ' else 'Reactivated administrator ' end || coalesce(nullif(t.full_name, ''), t.id::text));
end;
$$;

create or replace function public.admin_revoke_admin(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.profiles;
  v_old text[];
begin
  t := public._target_admin(p_user);
  select coalesce(array_agg(permission order by permission), '{}') into v_old from public.admin_permissions where user_id = t.id;
  perform set_config('beihub.rbac_rpc', 'on', true);
  delete from public.admin_permissions where user_id = t.id;
  update public.profiles set role = 'customer', admin_since = null where id = t.id;
  perform public.write_audit('admin.revoked', 'admin', t.id::text, coalesce(nullif(t.full_name, ''), t.id::text),
    jsonb_build_object('role', 'admin', 'permissions', to_jsonb(v_old)), jsonb_build_object('role', 'customer'),
    'Removed administrator access from ' || coalesce(nullif(t.full_name, ''), t.id::text));
end;
$$;

-- Deliberate ownership transfer (the ONLY way the Super Admin changes): the Super Admin must name the
-- new owner's e-mail twice. The old owner becomes a normal admin with every permission except MANAGE_ADMINS.
create or replace function public.transfer_super_admin(p_new_owner uuid, p_confirm_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me     uuid := auth.uid();
  t      public.profiles;
  v_mail text;
  v_conf timestamptz;
begin
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can transfer ownership.' using errcode = '42501';
  end if;
  select * into t from public.profiles where id = p_new_owner;
  if not found or t.role <> 'admin' or t.is_suspended or t.id = me then
    raise exception 'The new owner must be another active administrator.' using errcode = '22023';
  end if;
  select u.email, u.email_confirmed_at into v_mail, v_conf from auth.users u where u.id = t.id;
  if v_conf is null or lower(btrim(coalesce(p_confirm_email, ''))) <> lower(v_mail) then
    raise exception 'Type the new owner''s email address exactly to confirm.' using errcode = '22023';
  end if;

  perform set_config('beihub.rbac_rpc', 'on', true);
  update public.profiles set role = 'admin' where id = me;              -- demote first (only one super admin may exist)
  update public.profiles set role = 'super_admin', admin_since = coalesce(admin_since, now()) where id = t.id;
  delete from public.admin_permissions where user_id = t.id;
  insert into public.admin_permissions (user_id, permission, granted_by)
  select me, c.code, me from public.permissions c where c.code <> 'MANAGE_ADMINS' on conflict do nothing;
  delete from public.super_admin_bootstrap;
  insert into public.super_admin_bootstrap (email) values (lower(v_mail));

  perform public.write_audit('admin.ownership_transferred', 'admin', t.id::text, v_mail, jsonb_build_object('owner', me), jsonb_build_object('owner', t.id),
    'Transferred Super Admin ownership to ' || v_mail);
end;
$$;

grant execute on function public.admin_list_admins(), public.admin_set_admin_permissions(uuid, text[]),
  public.admin_set_admin_suspended(uuid, boolean, text), public.admin_revoke_admin(uuid),
  public.transfer_super_admin(uuid, text) to authenticated;
revoke all on function public.admin_list_admins(), public.admin_set_admin_permissions(uuid, text[]),
  public.admin_set_admin_suspended(uuid, boolean, text), public.admin_revoke_admin(uuid),
  public.transfer_super_admin(uuid, text) from public, anon;


-- ---------------------------------------------------------------------
-- 11. CUSTOMER MANAGEMENT + ORDER TRACKING  (MANAGE_CUSTOMERS; the Super Admin has it implicitly)
--     A customer's orders are read with the normal orders policy (can_view_orders), filtered by user_id.
-- ---------------------------------------------------------------------
create or replace function public.admin_list_customers(
  p_search text default null,
  p_filter text default 'all',      -- all | active | suspended | verified | unverified | has_orders | no_orders
  p_limit  integer default 50,
  p_offset integer default 0,
  p_user   uuid default null)
returns table (id uuid, full_name text, email text, phone text, is_suspended boolean, suspended_reason text,
               email_verified boolean, created_at timestamptz, last_login_at timestamptz,
               order_count bigint, total_value numeric, last_order_at timestamptz, total_rows bigint)
language plpgsql security definer set search_path = public as $$
declare v_s text := lower(btrim(coalesce(p_search, '')));
begin
  if not public.has_permission('MANAGE_CUSTOMERS') then
    raise exception 'You do not have permission to manage customers.' using errcode = '42501';
  end if;
  if p_filter not in ('all', 'active', 'suspended', 'verified', 'unverified', 'has_orders', 'no_orders') then
    raise exception 'Unknown filter.' using errcode = '22023';
  end if;
  return query
  with base as (
    select p.id, p.full_name, u.email::text as email, p.phone, p.is_suspended, p.suspended_reason,
           (u.email_confirmed_at is not null) as email_verified, p.created_at,
           coalesce(p.last_login_at, u.last_sign_in_at) as last_login_at,
           (select count(*) from public.orders o where o.user_id = p.id) as order_count,
           (select coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0) from public.orders o where o.user_id = p.id) as total_value,
           (select max(o.created_at) from public.orders o where o.user_id = p.id) as last_order_at
      from public.profiles p join auth.users u on u.id = p.id
     where p.role = 'customer' and (p_user is null or p.id = p_user)
  )
  select b.id, b.full_name, b.email, b.phone, b.is_suspended, b.suspended_reason, b.email_verified, b.created_at,
         b.last_login_at, b.order_count, b.total_value, b.last_order_at, count(*) over ()
    from base b
   where (v_s = '' or strpos(lower(coalesce(b.full_name, '')), v_s) > 0 or strpos(lower(coalesce(b.email, '')), v_s) > 0
          or strpos(lower(coalesce(b.phone, '')), v_s) > 0)
     and case p_filter
           when 'active'     then not b.is_suspended
           when 'suspended'  then b.is_suspended
           when 'verified'   then b.email_verified
           when 'unverified' then not b.email_verified
           when 'has_orders' then b.order_count > 0
           when 'no_orders'  then b.order_count = 0
           else true end
   order by b.created_at desc
   limit greatest(least(coalesce(p_limit, 50), 200), 1) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_set_customer_suspended(p_user uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  t     public.profiles;
  v_why text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.has_permission('MANAGE_CUSTOMERS') then
    raise exception 'You do not have permission to manage customers.' using errcode = '42501';
  end if;
  select * into t from public.profiles where id = p_user;
  if not found or t.role <> 'customer' then
    raise exception 'Customer not found.' using errcode = '22023';
  end if;
  if p_suspended and v_why is null then
    raise exception 'Enter a reason for the suspension.' using errcode = '22023';
  end if;
  perform set_config('beihub.rbac_rpc', 'on', true);
  update public.profiles
     set is_suspended = p_suspended,
         suspended_reason = case when p_suspended then v_why else null end,
         suspended_at = case when p_suspended then now() else null end,
         suspended_by = case when p_suspended then auth.uid() else null end
   where id = t.id;
  perform public.write_audit(case when p_suspended then 'customer.suspended' else 'customer.reactivated' end, 'customer', t.id::text,
    coalesce(nullif(t.full_name, ''), t.id::text), jsonb_build_object('suspended', t.is_suspended),
    jsonb_build_object('suspended', p_suspended, 'reason', v_why),
    case when p_suspended then 'Suspended customer ' else 'Reactivated customer ' end || coalesce(nullif(t.full_name, ''), t.id::text));
end;
$$;


-- ---------------------------------------------------------------------
-- 12. LOGIN / LOGOUT TRACKING  (Supabase Auth stays the authority for passwords and sessions)
--     The browser reports "I just signed in / out"; the server only ever records it for auth.uid().
--     Failed attempts are not available to SQL in Supabase (see Authentication > Logs).
-- ---------------------------------------------------------------------
create or replace function public.record_login()
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if auth.uid() is null then return; end if;
  perform set_config('beihub.rbac_rpc', 'on', true);
  update public.profiles set last_login_at = now() where id = auth.uid() returning role into v_role;
  if v_role in ('admin', 'super_admin') then
    perform public.write_audit('auth.login', 'user', auth.uid()::text, null, null, null, 'Signed in');
  end if;
end;
$$;

create or replace function public.record_logout()
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if auth.uid() is null then return; end if;
  perform set_config('beihub.rbac_rpc', 'on', true);
  update public.profiles set last_logout_at = now() where id = auth.uid() returning role into v_role;
  if v_role in ('admin', 'super_admin') then
    perform public.write_audit('auth.logout', 'user', auth.uid()::text, null, null, null, 'Signed out');
  end if;
end;
$$;
grant execute on function public.admin_list_customers(text, text, integer, integer, uuid), public.admin_set_customer_suspended(uuid, boolean, text),
  public.record_login(), public.record_logout() to authenticated;
revoke all on function public.admin_list_customers(text, text, integer, integer, uuid), public.admin_set_customer_suspended(uuid, boolean, text),
  public.record_login(), public.record_logout() from public, anon;


-- ---------------------------------------------------------------------
-- 13. DASHBOARD FIGURES  (each block is returned only if the caller holds the matching permission)
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_orders  boolean := public.can_view_orders();
  v_cust    boolean := public.has_any_permission(array['MANAGE_CUSTOMERS', 'VIEW_REPORTS']);
  v_admins  boolean := public._can_manage_admins();
  v_audit   boolean := public.has_permission('VIEW_AUDIT_LOGS');
  v_catalog boolean := public.has_any_permission(array['MANAGE_PRODUCTS', 'MANAGE_PRODUCT_PRICES', 'VIEW_REPORTS']);
  r jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;
  if v_orders then
    r := r || jsonb_build_object(
      'orders', (select jsonb_build_object(
                   'total', count(*), 'pending', count(*) filter (where status = 'pending'),
                   'in_progress', count(*) filter (where status in ('confirmed', 'payment_pending', 'processing', 'ready_for_pickup', 'waiting_for_delivery')),
                   'completed', count(*) filter (where status = 'completed'), 'cancelled', count(*) filter (where status = 'cancelled'))
                   from public.orders),
      'recent_orders', coalesce((select jsonb_agg(x) from (select o.id, o.order_number, o.customer_name, o.total, o.status, o.created_at
                                   from public.orders o order by o.created_at desc limit 6) x), '[]'::jsonb),
      'recent_cancellations', coalesce((select jsonb_agg(x) from (select o.id, o.order_number, o.cancellation_reason, o.cancelled_at
                                   from public.orders o where o.status = 'cancelled' order by o.cancelled_at desc nulls last limit 5) x), '[]'::jsonb));
  end if;
  if v_cust then
    r := r || jsonb_build_object(
      'customers', (select jsonb_build_object('total', count(*), 'suspended', count(*) filter (where is_suspended)) from public.profiles where role = 'customer'),
      'recent_customers', coalesce((select jsonb_agg(x) from (select p.id, p.full_name, p.created_at from public.profiles p
                                   where p.role = 'customer' order by p.created_at desc limit 5) x), '[]'::jsonb));
  end if;
  if v_admins then
    r := r || jsonb_build_object(
      'admins', (select jsonb_build_object('total', count(*), 'active', count(*) filter (where not is_suspended))
                   from public.profiles where role in ('admin', 'super_admin')),
      'pending_invitations', (select count(*) from public.admin_invitations where status = 'pending' and expires_at > now()));
  end if;
  if v_audit then
    r := r || jsonb_build_object('recent_activity', coalesce((select jsonb_agg(x) from (
      select a.action, a.actor_email, a.actor_role, a.description, a.created_at from public.audit_log a order by a.created_at desc limit 8) x), '[]'::jsonb));
  end if;
  if v_catalog then
    r := r || jsonb_build_object(
      'stock_alerts', (select jsonb_build_object('out_of_stock', count(*) filter (where v.availability = 'out_of_stock' or v.stock = 0),
                                                 'low_stock', count(*) filter (where v.availability <> 'out_of_stock' and v.stock between 1 and 3))
                         from public.product_variants v join public.products p on p.id = v.product_id where p.is_active),
      'recent_products', coalesce((select jsonb_agg(x) from (select p.id, p.name, p.updated_at from public.products p order by p.updated_at desc limit 5) x), '[]'::jsonb));
  end if;
  return r;
end;
$$;
grant execute on function public.admin_dashboard_stats() to authenticated;
revoke all on function public.admin_dashboard_stats() from public, anon;


-- ---------------------------------------------------------------------
-- 14. REALTIME: a suspended / re-permissioned person's open screens refresh
-- ---------------------------------------------------------------------
do $$
declare v_all boolean;
begin
  select puballtables into v_all from pg_publication where pubname = 'supabase_realtime';
  if v_all is false then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_permissions') then
      alter publication supabase_realtime add table public.admin_permissions;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
      alter publication supabase_realtime add table public.profiles;   -- subscribers only receive rows RLS lets them read
    end if;
  end if;
end $$;
alter table public.admin_permissions replica identity full;
alter table public.profiles          replica identity full;

-- ---------------------------------------------------------------------
-- 15. DONE. Useful checks:
--   select email, role from auth.users u join public.profiles p on p.id = u.id where p.role <> 'customer';
--   select code, label from public.permissions order by sort_order;
--   select p.full_name, ap.permission from public.admin_permissions ap join public.profiles p on p.id = ap.user_id order by 1, 2;
--   select * from public.audit_log order by created_at desc limit 20;
-- ---------------------------------------------------------------------
