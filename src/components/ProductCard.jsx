import { useState } from 'react'
import { Link } from '../lib/router.jsx'
import { Icon } from './Icons.jsx'
import { DiscountTag, Price, ProductImage, StockPill } from './ui.jsx'
import { useList } from '../context/ListContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { availability, variantTitle } from '../lib/format.js'
import { mainImage } from '../lib/catalogQuery.js'

export default function ProductCard({ product, initialVariantId }) {
  const { catById } = useStore()
  const list = useList()
  const toast = useToast()
  const [variantId, setVariantId] = useState(initialVariantId || product.variants[0]?.id)
  const v = product.variants.find((x) => x.id === variantId) || product.variants[0]
  if (!v) return null
  const av = availability(v)
  const multi = product.variants.length > 1
  const img = mainImage(product)
  const href = `/product/${product.slug}?v=${v.id}`
  const inList = list.items.find((i) => i.variantId === v.id)

  const add = () => {
    list.add(v.id, 1)
    toast.success(`Added to your Order List: ${variantTitle(product, v)}`)
  }

  return (
    <article className="pcard">
      <Link to={href} className="pcard-media" aria-label={`View ${variantTitle(product, v)}`}>
        <ProductImage src={img?.url} alt={img?.alt || product.name} />
        <div className="pcard-badges">
          <DiscountTag previous={v.previous_price} price={v.price} />
          {product.is_new && <span className="chip chip-new">New</span>}
        </div>
      </Link>
      <div className="pcard-body">
        <span className="pcard-cat">{catById[product.category_id]?.name}</span>
        <h3 className="pcard-title">
          <Link to={href}>{variantTitle(product, v)}</Link>
        </h3>
        {multi && (
          <label className="select-wrap">
            <span className="sr-only">Choose size or option for {product.name}</span>
            <select value={v.id} onChange={(e) => setVariantId(e.target.value)}>
              {product.variants.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                  {!availability(x).canOrder ? ' (out of stock)' : ''}
                </option>
              ))}
            </select>
            <Icon name="down" size={16} />
          </label>
        )}
        <Price price={v.price} previous={v.previous_price} />
        <div className="pcard-meta">
          <StockPill variant={v} />
          {multi && <span className="muted small">{product.variants.length} options</span>}
        </div>
        <div className="pcard-actions">
          <button className="btn btn-primary" onClick={add} disabled={!av.canOrder}>
            <Icon name={inList ? 'check' : 'plus'} size={18} />
            {av.canOrder ? (inList ? `In list (${inList.qty})` : 'Add to List') : 'Out of stock'}
          </button>
          <Link to={href} className="btn btn-outline">View Details</Link>
        </div>
      </div>
    </article>
  )
}
