// Run with:  npm test   (= node --test tests/catalog-visibility.test.mjs)
// Tests the customer-side catalogue rules on the real modules (no mock data layer, no network).
// The database rules (RLS, triggers, submit_order) are NOT covered here - see README of the migration.
import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryCounts, visibleCategories, queryCatalog } from '../src/lib/catalogQuery.js'
import { availability } from '../src/lib/format.js'
import { shapeProduct } from '../src/lib/shape.js'

const cats = [
  { id: 'c1', name: 'Water Tanks', slug: 'water-tanks' },
  { id: 'c2', name: 'Pumps', slug: 'pumps' },
  { id: 'c3', name: 'Fittings', slug: 'fittings' },
]
const mk = (id, category_id, status = 'available', extra = {}) =>
  shapeProduct({
    id, category_id, name: `Product ${id}`, slug: `p-${id}`, status, created_at: `2026-01-0${id.length}`,
    product_variants: [{ id: `v-${id}`, label: '1 unit', price: 100, stock: 10, availability: 'in_stock', ...extra }],
  })
// what the storefront receives: the database only returns available / out_of_stock products
const storefront = (all) => all.filter((p) => ['available', 'out_of_stock'].includes(p.status))
const byName = (list) => list.map((c) => c.name)

test('1. a category with three available products is shown with a count of three', () => {
  const products = storefront([mk('a', 'c1'), mk('b', 'c1'), mk('c', 'c1'), mk('d', 'c2')])
  assert.deepEqual(byName(visibleCategories(cats, products)), ['Water Tanks', 'Pumps'])
  assert.equal(categoryCounts(products).c1, 3)
})

test('2. hiding one product lowers the count to two', () => {
  const products = storefront([mk('a', 'c1'), mk('b', 'c1', 'hidden'), mk('c', 'c1'), mk('d', 'c2')])
  assert.equal(categoryCounts(products).c1, 2)
  assert.ok(byName(visibleCategories(cats, products)).includes('Water Tanks'))
})

test('3. when every product in a category is hidden the category disappears', () => {
  const products = storefront([mk('a', 'c1', 'hidden'), mk('b', 'c1', 'hidden'), mk('c', 'c1', 'hidden'), mk('d', 'c2')])
  assert.deepEqual(byName(visibleCategories(cats, products)), ['Pumps'])
  assert.equal(categoryCounts(products).c1, undefined)
})

test('3b. a category that only has discontinued products disappears too', () => {
  const products = storefront([mk('a', 'c3', 'discontinued'), mk('d', 'c2')])
  assert.deepEqual(byName(visibleCategories(cats, products)), ['Pumps'])
})

test('3c. a category that never had any product is not shown', () => {
  assert.deepEqual(visibleCategories(cats, []), [])
})

test('4. restoring one hidden product brings the category back', () => {
  const hidden = [mk('a', 'c1', 'hidden'), mk('d', 'c2')]
  assert.ok(!byName(visibleCategories(cats, storefront(hidden))).includes('Water Tanks'))
  const restored = [mk('a', 'c1', 'available'), mk('d', 'c2')]
  const shown = visibleCategories(cats, storefront(restored))
  assert.ok(byName(shown).includes('Water Tanks'))
  assert.equal(categoryCounts(storefront(restored)).c1, 1)
})

test('5. a category with no visible products is not a valid filter: it never falls back to "all products"', () => {
  const products = storefront([mk('a', 'c1', 'hidden'), mk('d', 'c2')])
  const visible = visibleCategories(cats, products)
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]))
  const catBySlug = Object.fromEntries(visible.map((c) => [c.slug, c]))
  assert.deepEqual(queryCatalog(products, catById, catBySlug, { category: 'water-tanks' }), [])
  assert.deepEqual(queryCatalog(products, catById, catBySlug, { category: 'does-not-exist' }), [])
  assert.equal(queryCatalog(products, catById, catBySlug, { category: 'pumps' }).length, 1)
  assert.equal(queryCatalog(products, catById, catBySlug, {}).length, 1)
})

test('5b. search never returns a hidden product (it is not in the storefront data)', () => {
  const all = [mk('a', 'c1', 'hidden'), mk('d', 'c2')]
  all[0].name = 'KENTANK'
  const products = storefront(all)
  const catById = Object.fromEntries(cats.map((c) => [c.id, c]))
  assert.equal(queryCatalog(products, catById, {}, { q: 'KENTANK' }).length, 0)
})

test('7. out-of-stock products stay listed but cannot be ordered', () => {
  const oos = mk('x', 'c2', 'out_of_stock')
  const products = storefront([oos])
  assert.equal(products.length, 1)
  assert.equal(visibleCategories(cats, products).length, 1)
  assert.equal(availability(oos.variants[0]).canOrder, false)
  assert.equal(availability(mk('y', 'c2', 'available').variants[0]).canOrder, true)
})

test('7b. discontinued products are not in the customer catalogue at all', () => {
  assert.equal(storefront([mk('z', 'c2', 'discontinued')]).length, 0)
})

test('shape: every variant carries its product status so ordering rules can use it', () => {
  assert.equal(mk('q', 'c1', 'out_of_stock').variants[0].product_status, 'out_of_stock')
})
