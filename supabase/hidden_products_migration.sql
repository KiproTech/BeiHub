-- =====================================================================
--  hidden_products_migration.sql  -  Hidden products and empty categories
--
--  What this does (nothing is deleted, no table is added or dropped):
--    1. makes products.status the single source of truth for visibility and re-syncs products.is_active
--    2. product_is_public() and the public "read" policies for products / images / variants check the
--       status as well, so Hidden and Discontinued products can never be read by customers
--    3. a category is readable by customers only while it has at least one customer-visible product
--       (admins and staff still see every category)
--    4. verifies that the order function still refuses products that are not public
--
--  Run order: after supabase/beihub_migration.sql (it also works on a database that only ran the archive scripts).
--  SAFE TO RE-RUN.   Run in: Supabase Dashboard > SQL Editor.
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'products' and column_name = 'status') then
    raise exception 'products.status is missing. Run supabase/archive/01_marketplace_upgrade.sql first.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 1. status is the source of truth; is_active follows it
--      available / out_of_stock  -> visible to customers (is_active = true)
--      hidden / discontinued     -> not visible          (is_active = false)
--    (same trigger as the marketplace upgrade, re-stated so this file is self-contained)
-- ---------------------------------------------------------------------
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

-- Repair any row where the two columns drifted apart. status wins: touching the row without changing
-- status or is_active makes the trigger above recompute is_active from status.
update public.products
   set status = status
 where is_active is distinct from (status in ('available', 'out_of_stock'));


-- ---------------------------------------------------------------------
-- 2. Public visibility of products, images and variants
-- ---------------------------------------------------------------------
create or replace function public.product_is_public(p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.products p
                  where p.id = p_product
                    and p.is_active
                    and p.status in ('available', 'out_of_stock'));
$$;
grant execute on function public.product_is_public(uuid) to anon, authenticated;

drop policy if exists "products: public read" on public.products;
create policy "products: public read" on public.products
  for select using ((is_active and status in ('available', 'out_of_stock')) or public.is_admin());

-- images and variants already call product_is_public(); restated so the rule is certain to be in place
drop policy if exists "product_images: public read" on public.product_images;
create policy "product_images: public read" on public.product_images
  for select using (public.is_admin() or public.product_is_public(product_id));

drop policy if exists "product_variants: public read" on public.product_variants;
create policy "product_variants: public read" on public.product_variants
  for select using (public.is_admin() or public.product_is_public(product_id));


-- ---------------------------------------------------------------------
-- 3. Categories with no customer-visible product are not readable by customers
-- ---------------------------------------------------------------------
create or replace function public.category_has_public_products(p_category uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.products p
                  where p.category_id = p_category
                    and p.is_active
                    and p.status in ('available', 'out_of_stock'));
$$;
grant execute on function public.category_has_public_products(uuid) to anon, authenticated;

drop policy if exists "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
  for select using ((is_active and public.category_has_public_products(id)) or public.is_admin());

create index if not exists products_category_status_idx on public.products (category_id, status);


-- ---------------------------------------------------------------------
-- 4. The order function must keep refusing products that are not public.
--    submit_order() already requires "p.is_active" (kept in sync with status above), so a hidden or
--    discontinued product is rejected even if a customer sends a stale or hand-made request.
--    This block only CHECKS it and tells you if the function ever needs attention.
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'submit_order'
   limit 1;
  if v_def is null then
    raise warning 'submit_order() was not found. Run the earlier BeiHub scripts, then re-run this file.';
  elsif v_def not ilike '%p.is_active%' and v_def not ilike '%product_is_public%' then
    raise warning 'submit_order() does not check that the product is public. Re-run supabase/archive/02_single_business_upgrade.sql.';
  else
    raise notice 'OK: submit_order() refuses products that are hidden or discontinued.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Checks you can run afterwards
--   -- should return 0 rows (is_active always follows status)
--   select id, name, status, is_active from public.products
--    where is_active is distinct from (status in ('available', 'out_of_stock'));
--
--   -- what an anonymous visitor can see: products and categories
--   begin; set local role anon;
--   select count(*) as visible_products from public.products;
--   select name from public.categories order by name;
--   rollback;
-- ---------------------------------------------------------------------
