import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from '../lib/router.jsx'
import { Icon } from '../components/Icons.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { Empty, Spinner } from '../components/ui.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { queryCatalog, sizeFacets, SORTS } from '../lib/catalogQuery.js'
import { money } from '../lib/format.js'

const PAGE = 24
const RANGES = [
  { label: 'Under 10,000', min: '', max: 10000 },
  { label: '10,000 - 50,000', min: 10000, max: 50000 },
  { label: '50,000 - 100,000', min: 50000, max: 100000 },
  { label: 'Over 100,000', min: 100000, max: '' },
]

function FilterPanel({ f, set, categories, counts, sizes, onReset, activeCount }) {
  const [min, setMin] = useState(f.min)
  const [max, setMax] = useState(f.max)
  useEffect(() => {
    setMin(f.min)
    setMax(f.max)
  }, [f.min, f.max])
  const applyPrice = () => set({ min: min === '' ? '' : Math.max(0, Number(min)), max: max === '' ? '' : Math.max(0, Number(max)) })

  return (
    <div className="filters">
      <div className="filter-group">
        <h3>Category</h3>
        <ul className="filter-list">
          <li>
            <button className={!f.category ? 'is-active' : ''} onClick={() => set({ category: '', size: '' })}>
              All categories
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button className={f.category === c.slug ? 'is-active' : ''} onClick={() => set({ category: c.slug, size: '' })}>
                <span>{c.name}</span>
                <span className="count">{counts[c.id] || 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="filter-group">
        <h3>Price (KSh)</h3>
        <div className="price-inputs">
          <input type="number" inputMode="numeric" min="0" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} onBlur={applyPrice} onKeyDown={(e) => e.key === 'Enter' && applyPrice()} aria-label="Minimum price" />
          <span>to</span>
          <input type="number" inputMode="numeric" min="0" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} onBlur={applyPrice} onKeyDown={(e) => e.key === 'Enter' && applyPrice()} aria-label="Maximum price" />
        </div>
        <div className="chips">
          {RANGES.map((r) => (
            <button key={r.label} className={`chip-btn ${String(f.min) === String(r.min) && String(f.max) === String(r.max) ? 'is-active' : ''}`} onClick={() => set({ min: r.min, max: r.max })}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <h3>Size / capacity</h3>
        {f.category ? (
          sizes.length > 1 || (sizes.length === 1 && sizes[0].label !== 'Standard') ? (
            <div className="chips">
              {sizes.map((s) => (
                <button key={s.label} className={`chip-btn ${f.size === s.label ? 'is-active' : ''}`} onClick={() => set({ size: f.size === s.label ? '' : s.label })}>
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small">No size options in this category.</p>
          )
        ) : (
          <p className="muted small">Choose a category above to filter by size or capacity.</p>
        )}
      </div>

      <div className="filter-group">
        <h3>Availability</h3>
        <label className="check"><input type="checkbox" checked={f.inStock} onChange={(e) => set({ stock: e.target.checked ? 1 : '' })} /> In stock only</label>
        <label className="check"><input type="checkbox" checked={f.onSale} onChange={(e) => set({ sale: e.target.checked ? 1 : '' })} /> On offer (discounted)</label>
      </div>

      {activeCount > 0 && <button className="btn btn-outline btn-block" onClick={onReset}>Clear all filters</button>}
    </div>
  )
}

export default function Shop() {
  const { products, categories, catById, catBySlug, loading, error } = useStore()
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const f = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    min: params.get('min') || '',
    max: params.get('max') || '',
    size: params.get('size') || '',
    inStock: params.get('stock') === '1',
    onSale: params.get('sale') === '1',
    sort: params.get('sort') || '',
  }
  const set = (patch) => {
    const cur = { q: f.q, category: f.category, min: f.min, max: f.max, size: f.size, stock: f.inStock ? 1 : '', sale: f.onSale ? 1 : '', sort: f.sort }
    setParams({ ...cur, ...patch })
    setLimit(PAGE)
  }
  const reset = () => setParams({ q: f.q, sort: f.sort })

  const results = useMemo(() => queryCatalog(products, catById, catBySlug, f), [products, catById, catBySlug, f.q, f.category, f.min, f.max, f.size, f.inStock, f.onSale, f.sort]) // eslint-disable-line
  const counts = useMemo(() => {
    const noCat = queryCatalog(products, catById, catBySlug, { ...f, category: '', size: '' })
    const m = {}
    noCat.forEach((r) => (m[r.product.category_id] = (m[r.product.category_id] || 0) + 1))
    return m
  }, [products, catById, catBySlug, f.q, f.min, f.max, f.inStock, f.onSale]) // eslint-disable-line
  const sizes = useMemo(() => (f.category ? sizeFacets(products.filter((p) => p.category_id === catBySlug[f.category]?.id)) : []), [products, f.category, catBySlug])

  const activeChips = []
  if (f.q) activeChips.push({ k: 'q', label: `"${f.q}"`, clear: { q: '' } })
  if (f.category) activeChips.push({ k: 'c', label: catBySlug[f.category]?.name || f.category, clear: { category: '', size: '' } })
  if (f.size) activeChips.push({ k: 's', label: f.size, clear: { size: '' } })
  if (f.min !== '' || f.max !== '') activeChips.push({ k: 'p', label: `${f.min !== '' ? money(f.min) : 'Any'} - ${f.max !== '' ? money(f.max) : 'Any'}`, clear: { min: '', max: '' } })
  if (f.inStock) activeChips.push({ k: 'i', label: 'In stock', clear: { stock: '' } })
  if (f.onSale) activeChips.push({ k: 'o', label: 'On offer', clear: { sale: '' } })
  const filterCount = activeChips.filter((c) => c.k !== 'q').length

  const cat = f.category ? catBySlug[f.category] : null
  const title = f.q ? `Results for "${f.q}"` : cat ? cat.name : 'All products'
  const shown = results.slice(0, limit)

  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sheet])

  const panel = (
    <FilterPanel f={f} set={set} categories={categories} counts={counts} sizes={sizes} onReset={reset} activeCount={filterCount} />
  )

  return (
    <div className="wrap shop">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> <Icon name="right" size={14} /> <Link to="/shop">Shop</Link>
        {cat && (
          <>
            <Icon name="right" size={14} /> <span>{cat.name}</span>
          </>
        )}
      </nav>

      <div className="shop-head">
        <div>
          <h1>{title}</h1>
          {cat?.description && !f.q && <p className="muted">{cat.description}</p>}
        </div>
      </div>

      <div className="shop-layout">
        <aside className="shop-side" aria-label="Filters">{panel}</aside>

        <div className="shop-main">
          <div className="shop-toolbar">
            <button className="btn btn-outline filterbtn" onClick={() => setSheet(true)}>
              <Icon name="filter" size={18} /> Filters{filterCount > 0 && <span className="badge-n">{filterCount}</span>}
            </button>
            <span className="muted resultcount" aria-live="polite">{results.length} product{results.length === 1 ? '' : 's'}</span>
            <label className="select-wrap select-sort">
              <span className="sr-only">Sort by</span>
              <select value={f.sort || (f.q ? 'relevance' : 'newest')} onChange={(e) => set({ sort: e.target.value })}>
                {SORTS.filter((s) => s.key !== 'relevance' || f.q).map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <Icon name="down" size={16} />
            </label>
          </div>

          {activeChips.length > 0 && (
            <div className="active-chips">
              {activeChips.map((c) => (
                <button key={c.k} className="chip-x" onClick={() => set(c.clear)} aria-label={`Remove filter ${c.label}`}>
                  {c.label} <Icon name="close" size={14} />
                </button>
              ))}
              <button className="link-btn" onClick={reset}>Clear all</button>
            </div>
          )}

          {error && <div className="notice notice-bad">{error}</div>}
          {loading && !products.length ? (
            <Spinner />
          ) : results.length === 0 ? (
            <Empty
              title="No products match"
              action={<button className="btn btn-primary" onClick={() => setParams({})}>Show all products</button>}
            >
              Try a different word (for example "tank", "tv" or "solar"), widen the price range or clear a filter.
            </Empty>
          ) : (
            <>
              <div className="pgrid">
                {shown.map((r) => (
                  <ProductCard key={`${r.product.id}:${r.variant.id}`} product={r.product} initialVariantId={r.variant.id} />
                ))}
              </div>
              {results.length > shown.length && (
                <div className="center">
                  <button className="btn btn-outline btn-lg" onClick={() => setLimit((l) => l + PAGE)}>
                    Show more ({results.length - shown.length} left)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {sheet && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="sheet-head">
            <h2>Filters</h2>
            <button className="icon-btn" onClick={() => setSheet(false)} aria-label="Close filters"><Icon name="close" /></button>
          </div>
          <div className="sheet-body">{panel}</div>
          <div className="sheet-foot">
            <button className="btn btn-primary btn-block btn-lg" onClick={() => setSheet(false)}>Show {results.length} product{results.length === 1 ? '' : 's'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
