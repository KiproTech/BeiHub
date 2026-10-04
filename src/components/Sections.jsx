import { Link } from '../lib/router.jsx'
import { Icon } from './Icons.jsx'
import ProductCard from './ProductCard.jsx'

export function SectionHead({ title, sub, to, linkText = 'View all' }) {
  return (
    <div className="sec-head">
      <div>
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {to && (
        <Link to={to} className="sec-link">
          {linkText} <Icon name="arrowRight" size={16} />
        </Link>
      )}
    </div>
  )
}

// rows: [{ product, variantId }]
export function ProductRow({ title, sub, to, rows, id }) {
  if (!rows.length) return null
  return (
    <section className="section" id={id}>
      <div className="wrap">
        <SectionHead title={title} sub={sub} to={to} />
        <div className="pgrid pgrid-row">
          {rows.map((r) => (
            <ProductCard key={`${r.product.id}:${r.variantId}`} product={r.product} initialVariantId={r.variantId} />
          ))}
        </div>
      </div>
    </section>
  )
}
