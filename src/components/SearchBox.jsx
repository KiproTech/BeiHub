import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icons.jsx'
import { useNavigate } from '../lib/router.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { queryCatalog } from '../lib/catalogQuery.js'
import { money, variantTitle } from '../lib/format.js'
import { tokenize } from '../lib/search.js'

export default function SearchBox({ initial = '', className = '', placeholder = 'Search products, e.g. 2,000 litre tank', autoFocus }) {
  const [q, setQ] = useState(initial)
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const navigate = useNavigate()
  const { products, categories, catById, catBySlug } = useStore()

  useEffect(() => setQ(initial), [initial])
  useEffect(() => {
    const onDoc = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [])

  const { hits, cats } = useMemo(() => {
    const t = tokenize(q)
    if (!t.length) return { hits: [], cats: [] }
    return {
      hits: queryCatalog(products, catById, catBySlug, { q }).slice(0, 5),
      cats: categories.filter((c) => t.every((x) => c.name.toLowerCase().includes(x))).slice(0, 2),
    }
  }, [q, products, categories, catById, catBySlug])

  const submit = (e) => {
    e.preventDefault()
    setOpen(false)
    navigate(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  }
  const go = (to) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div className={`searchbox ${className}`} ref={box}>
      <form onSubmit={submit} role="search">
        <Icon name="search" size={20} className="searchbox-icon" />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder={placeholder}
          aria-label="Search products"
          enterKeyHint="search"
        />
        <button type="submit" className="searchbox-go">Search</button>
      </form>
      {open && (hits.length > 0 || cats.length > 0) && (
        <div className="suggest" role="listbox">
          {cats.map((c) => (
            <button key={c.id} type="button" className="suggest-row" onClick={() => go(`/shop?category=${c.slug}`)}>
              <Icon name="grid" size={18} />
              <span>Category: <strong>{c.name}</strong></span>
            </button>
          ))}
          {hits.map(({ product, variant }) => (
            <button key={product.id} type="button" className="suggest-row" onClick={() => go(`/product/${product.slug}?v=${variant.id}`)}>
              <img src={(product.images.find((i) => i.is_main) || product.images[0])?.url} alt="" />
              <span className="suggest-name">{variantTitle(product, variant)}</span>
              <span className="suggest-price">{money(variant.price)}</span>
            </button>
          ))}
          <button type="button" className="suggest-all" onClick={submit}>See all results for "{q}"</button>
        </div>
      )}
    </div>
  )
}
