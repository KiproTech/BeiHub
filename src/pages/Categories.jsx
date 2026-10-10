import { useMemo } from 'react'
import { Link } from '../lib/router.jsx'
import { ProductImage, Spinner } from '../components/ui.jsx'
import { useStore } from '../context/StoreContext.jsx'

export default function Categories() {
  const { categories, products, loading } = useStore()
  const counts = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, products.filter((p) => p.category_id === c.id).length])), [categories, products])
  return (
    <div className="wrap section">
      <h1>Categories</h1>
      <p className="muted">Pick a category to see its products, prices and availability.</p>
      {loading && !categories.length ? <Spinner /> : !categories.length ? (
        <p className="muted">No products are available right now. Please check back soon.</p>
      ) : (
        <div className="catgrid">
          {categories.map((c) => (
            <Link key={c.id} to={`/products?category=${c.slug}`} className="catcard">
              <span className="catcard-img"><ProductImage src={c.image_url} alt="" /></span>
              <span className="catcard-name">{c.name}</span>
              <span className="catcard-count">{counts[c.id] || 0} products</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
