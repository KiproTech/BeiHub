// Builds supabase/seed.sql and supabase/BeiHub_database.sql (schema + seed) from
// supabase/schema.sql and src/data/catalog.js.   Run: npm run generate:sql
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES, PRODUCTS, SETTINGS, DELIVERY_LOCATIONS, variantSku, imageFiles, categoryImage } from '../src/data/catalog.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const q = (s) => (s === null || s === undefined || s === '' ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const num = (n, cast = 'numeric') => (n === null || n === undefined ? `null::${cast}` : `${Number(n)}::${cast}`)
const json = (o) => `${q(JSON.stringify(o ?? {}))}::jsonb`
const bool = (b) => (b ? 'true' : 'false')

const out = []
out.push(`-- ---------------------------------------------------------------------
-- SAMPLE DATA (safe to re-run: existing rows are never overwritten)
-- All prices are illustrative. Edit or delete anything from Admin > Products.
-- ---------------------------------------------------------------------`)

// store settings
const s = SETTINGS
out.push(`
insert into public.store_settings (
  id, business_name, tagline, phone, whatsapp, email, address, county, business_hours, about, payment_instructions,
  deposit_percent, delivery_mode, fixed_delivery_fee, default_delivery_fee, free_delivery_threshold,
  facebook_url, instagram_url
) values (
  1, ${q(s.business_name)}, ${q(s.tagline)}, ${q(s.phone)}, ${q(s.whatsapp)}, ${q(s.email)}, ${q(s.address)}, ${q(s.county)},
  ${q(s.business_hours)}, ${q(s.about)}, ${q(s.payment_instructions)}, ${s.deposit_percent}, ${q(s.delivery_mode)}, ${s.fixed_delivery_fee}, ${s.default_delivery_fee},
  ${num(s.free_delivery_threshold)}, ${q(s.facebook_url)}, ${q(s.instagram_url)}
) on conflict (id) do nothing;`)

// categories
out.push(`
insert into public.categories (name, slug, description, image_url, sort_order) values
${CATEGORIES.map((c, i) => `  (${q(c.name)}, ${q(c.slug)}, ${q(c.description)}, ${q(categoryImage(c))}, ${(i + 1) * 10})`).join(',\n')}
on conflict (slug) do nothing;`)

// delivery locations
out.push(`
insert into public.delivery_locations (county, town, fee, eta, sort_order) values
${DELIVERY_LOCATIONS.map((d, i) => `  (${q(d.county)}, ${q(d.town)}, ${d.fee}, ${q(d.eta)}, ${(i + 1) * 10})`).join(',\n')}
on conflict do nothing;`)

// products
out.push(`
insert into public.products (category_id, name, slug, brand, short_description, description, specs, is_featured, is_popular, is_new)
select c.id, v.name, v.slug, v.brand, v.short_description, v.description, v.specs, v.is_featured, v.is_popular, v.is_new
from (values
${PRODUCTS.map((p) => `  (${q(p.category)}::text, ${q(p.name)}::text, ${q(p.slug)}::text, ${q(p.brand)}::text, ${q(p.short)}::text, ${q(p.description)}::text, ${json(p.specs)}, ${bool(p.featured)}, ${bool(p.popular)}, ${bool(p.isNew)})`).join(',\n')}
) as v(category_slug, name, slug, brand, short_description, description, specs, is_featured, is_popular, is_new)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do nothing;`)

// images: 2 sample images per product. The main image (sort 0) is inserted first, then the
// detail image, in two statements so the "one main image per product" trigger is trivially safe.
for (const idx of [0, 1]) {
  const imgRows = PRODUCTS.map((p) => `  (${q(p.slug)}::text, ${q(imageFiles(p)[idx])}::text, ${q(idx === 0 ? p.name : `${p.name} - detail view`)}::text, ${idx}::int)`)
  out.push(`
insert into public.product_images (product_id, url, alt, sort_order)
select p.id, v.url, v.alt, v.sort_order
from (values
${imgRows.join(',\n')}
) as v(product_slug, url, alt, sort_order)
join public.products p on p.slug = v.product_slug
where not exists (
  select 1 from public.product_images pi where pi.product_id = p.id and pi.url = v.url
);`)
}

// variants
const varRows = []
for (const p of PRODUCTS) {
  p.variants.forEach((v, i) => {
    varRows.push(`  (${q(p.slug)}::text, ${q(v.label)}::text, ${q(variantSku(p, v))}::text, ${num(v.price)}, ${num(v.prev)}, ${v.stock}::int, ${q(v.avail)}::text, ${json({ [p.variantKey]: v.label })}, ${i}::int)`)
  })
}
out.push(`
insert into public.product_variants (product_id, label, sku, price, previous_price, stock, availability, specs, sort_order)
select p.id, v.label, v.sku, v.price, v.previous_price, v.stock, v.availability, v.specs, v.sort_order
from (values
${varRows.join(',\n')}
) as v(product_slug, label, sku, price, previous_price, stock, availability, specs, sort_order)
join public.products p on p.slug = v.product_slug
on conflict (sku) do nothing;`)

const seed = out.join('\n') + '\n'
writeFileSync(join(root, 'supabase', 'seed.sql'), seed)

const schema = readFileSync(join(root, 'supabase', 'schema.sql'), 'utf8')
const footer = `
-- ---------------------------------------------------------------------
-- MAKE YOURSELF AN ADMIN
-- 1) Supabase Dashboard > Authentication > Users > Add user (email + password, tick "Auto Confirm User").
-- 2) Run this (replace the email), then sign in at /admin/login:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
--
-- ---------------------------------------------------------------------
`
const header = `-- =====================================================================
--  BeiHub_database.sql  -  complete database setup for the BeiHub application
--  Contains: tables, relationships, constraints, indexes, triggers, functions,
--            Row Level Security policies, storage bucket + policies, sample data.
--  Contains NO credentials or service-role keys.
--  Generated by scripts/build-sql.mjs  (do not edit the generated copy by hand;
--  edit supabase/schema.sql or src/data/catalog.js and rebuild).
-- =====================================================================

`
const full = header + schema + '\n' + seed + footer
writeFileSync(join(root, 'supabase', 'BeiHub_database.sql'), full)
console.log('Wrote supabase/seed.sql and supabase/BeiHub_database.sql (' + full.split('\n').length + ' lines)')
