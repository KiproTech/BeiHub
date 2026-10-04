import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { ProductImage } from '../../components/ui.jsx'
import { Card, PageHead, Toggle, confirmDelete } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'
import { discountPercent, money } from '../../lib/format.js'
import { mainImage } from '../../lib/catalogQuery.js'
import { matchProduct, tokenize } from '../../lib/search.js'

function Filters({ q, setQ, cat, setCat, categories, extra }) {
  return (
    <div className="afilters">
      <div className="afilters-search">
        <Icon name="search" size={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or SKU" aria-label="Search products" />
      </div>
      <label className="select-wrap">
        <span className="sr-only">Category</span>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Icon name="down" size={16} />
      </label>
      {extra}
    </div>
  )
}

function VariantPriceRow({ product, v }) {
  const { reload, run } = useAdmin()
  const init = { price: String(v.price), previous_price: v.previous_price == null ? '' : String(v.previous_price), stock: String(v.stock), availability: v.availability }
  const [f, setF] = useState(init)
  useEffect(() => setF(init), [v.price, v.previous_price, v.stock, v.availability]) // eslint-disable-line
  const dirty = JSON.stringify(f) !== JSON.stringify(init)
  const price = Number(f.price)
  const prev = f.previous_price === '' ? null : Number(f.previous_price)
  const disc = discountPercent(prev, price)
  const bad = !(price >= 0) || f.price === '' || (f.previous_price !== '' && !(prev >= 0))
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async () => {
    const ok = await run(() => api.saveVariant({ ...v, price, previous_price: prev, stock: parseInt(f.stock, 10) || 0, availability: f.availability }), `Saved ${product.name} - ${v.label}`)
    if (ok) reload()
  }
  return (
    <tr className={dirty ? 'is-dirty' : ''}>
      <td className="pr-name" data-label="Variant"><b>{v.label}</b><small className="muted block">{v.sku}</small></td>
      <td data-label="Current price (KSh)"><input type="number" inputMode="decimal" min="0" step="any" value={f.price} onChange={set('price')} aria-label={`Current price for ${v.label}`} /></td>
      <td data-label="Previous price (KSh)"><input type="number" inputMode="decimal" min="0" step="any" value={f.previous_price} onChange={set('previous_price')} placeholder="None" aria-label={`Previous price for ${v.label}`} /></td>
      <td data-label="Discount" className="pr-disc">{disc > 0 ? <span className="tag-badge">-{disc}%</span> : <span className="muted">-</span>}</td>
      <td data-label="Stock"><input type="number" inputMode="numeric" min="0" step="1" value={f.stock} onChange={set('stock')} aria-label={`Stock for ${v.label}`} /></td>
      <td data-label="Availability">
        <select value={f.availability} onChange={set('availability')} aria-label={`Availability for ${v.label}`}>
          <option value="in_stock">In stock</option>
          <option value="on_order">Available on order</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </td>
      <td className="pr-save"><button className="btn btn-sm btn-primary" disabled={!dirty || bad} onClick={save}>Save</button></td>
    </tr>
  )
}

function PricesTab({ rows }) {
  if (!rows.length) return <Card><p className="muted">No products match.</p></Card>
  return (
    <div className="pricegroups">
      {rows.map((p) => (
        <Card key={p.id} title={p.name} sub={p.is_active ? null : 'Hidden from website'} actions={<Link to={`/admin/products/${p.id}`} className="btn btn-sm btn-outline"><Icon name="edit" size={16} /> Edit product</Link>}>
          <div className="tablewrap">
            <table className="table table-stack pricetable">
              <thead>
                <tr><th>Variant</th><th>Current price (KSh)</th><th>Previous price (KSh)</th><th>Discount</th><th>Stock</th><th>Availability</th><th /></tr>
              </thead>
              <tbody>{p.variants.map((v) => <VariantPriceRow key={v.id} product={p} v={v} />)}</tbody>
            </table>
          </div>
          {p.variants.length === 0 && <p className="muted small">This product has no variants yet. Open the product to add one.</p>}
        </Card>
      ))}
    </div>
  )
}

export default function Products() {
  const { products, categories, catById, reload, run } = useAdmin()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'prices' ? 'prices' : 'list'
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState('')

  const rows = useMemo(() => {
    const t = tokenize(q)
    return products.filter((p) => {
      if (cat && p.category_id !== cat) return false
      if (status === 'hidden' && p.is_active) return false
      if (status === 'live' && !p.is_active) return false
      if (status === 'featured' && !p.is_featured) return false
      return !!matchProduct(p, catById[p.category_id]?.name || '', t)
    })
  }, [products, q, cat, status, catById])

  const patch = async (p, changes, msg) => {
    if (await run(() => api.saveProduct({ id: p.id, ...changes }), msg)) reload()
  }
  const del = async (p) => {
    if (!confirmDelete(`"${p.name}" with all its images and variants`)) return
    if (await run(() => api.deleteProduct(p.id), 'Product deleted')) reload()
  }

  return (
    <>
      <PageHead title="Products" sub="Add products, manage variants, change prices and stock.">
        <Link to="/admin/products/new" className="btn btn-primary"><Icon name="plus" size={18} /> Add product</Link>
      </PageHead>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? 'is-active' : ''} onClick={() => setParams({})}>All products <span className="badge-n">{products.length}</span></button>
        <button role="tab" aria-selected={tab === 'prices'} className={tab === 'prices' ? 'is-active' : ''} onClick={() => setParams({ tab: 'prices' })}>Prices &amp; stock</button>
      </div>

      <Filters
        q={q} setQ={setQ} cat={cat} setCat={setCat} categories={categories}
        extra={tab === 'list' && (
          <label className="select-wrap">
            <span className="sr-only">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              <option value="live">Live on website</option>
              <option value="hidden">Hidden</option>
              <option value="featured">Featured</option>
            </select>
            <Icon name="down" size={16} />
          </label>
        )}
      />

      {tab === 'prices' ? (
        <PricesTab rows={rows} />
      ) : (
        <Card>
          {rows.length === 0 ? (
            <p className="muted">No products match your search.</p>
          ) : (
            <ul className="rowlist">
              {rows.map((p) => {
                const prices = p.variants.map((v) => v.price)
                const img = mainImage(p)
                return (
                  <li key={p.id} className="rowitem rowitem-product">
                    <Link to={`/admin/products/${p.id}`} className="rowitem-img"><ProductImage src={img?.url} alt="" /></Link>
                    <div className="rowitem-main">
                      <Link to={`/admin/products/${p.id}`}><b>{p.name}</b></Link>
                      <small className="muted">{catById[p.category_id]?.name} | {p.variants.length} variant{p.variants.length === 1 ? '' : 's'} | {p.images.length} image{p.images.length === 1 ? '' : 's'}</small>
                      <small className="rowitem-price">{prices.length ? (Math.min(...prices) === Math.max(...prices) ? money(prices[0]) : `${money(Math.min(...prices))} - ${money(Math.max(...prices))}`) : 'No variants'}</small>
                    </div>
                    <div className="rowitem-flags">
                      <Toggle checked={p.is_active} onChange={(v) => patch(p, { is_active: v }, v ? 'Product is now live' : 'Product hidden')} label={p.is_active ? 'Live' : 'Hidden'} />
                      <Toggle checked={p.is_featured} onChange={(v) => patch(p, { is_featured: v })} label="Featured" />
                    </div>
                    <div className="rowitem-act">
                      <Link to={`/admin/products/${p.id}`} className="btn btn-sm btn-outline"><Icon name="edit" size={16} /> Edit</Link>
                      <Link to={`/product/${p.slug}`} className="icon-btn" aria-label={`View ${p.name} on website`} target="_blank"><Icon name="eye" size={18} /></Link>
                      <button className="icon-btn" aria-label={`Delete ${p.name}`} onClick={() => del(p)}><Icon name="trash" size={18} /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}
    </>
  )
}
