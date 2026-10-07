import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from '../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../components/Icons.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { DiscountTag, Empty, Price, ProductImage, QtyStepper, Spinner, StockPill } from '../components/ui.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useList } from '../context/ListContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { availability, discountPercent, money, variantTitle } from '../lib/format.js'
import { priceRange, productImages } from '../lib/catalogQuery.js'
import { buildEnquiryMessage, waLink } from '../lib/whatsapp.js'

function Gallery({ images, name, badge }) {
  const [i, setI] = useState(0)
  const touch = useRef(null)
  const n = images.length
  useEffect(() => setI(0), [images[0]?.url])
  const go = (d) => setI((x) => (x + d + n) % n)
  const cur = images[i]
  return (
    <div className="gallery">
      <div
        className="gallery-main"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null || n < 2) return
          const dx = e.changedTouches[0].clientX - touch.current
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
          touch.current = null
        }}
      >
        <ProductImage src={cur?.url} alt={cur?.alt || name} loading="eager" />
        {badge}
        {n > 1 && (
          <>
            <button className="gallery-nav gallery-prev" onClick={() => go(-1)} aria-label="Previous image"><Icon name="left" /></button>
            <button className="gallery-nav gallery-next" onClick={() => go(1)} aria-label="Next image"><Icon name="right" /></button>
            <span className="gallery-count">{i + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="gallery-thumbs">
          {images.map((m, idx) => (
            <button key={m.id} className={idx === i ? 'is-active' : ''} onClick={() => setI(idx)} aria-label={`Show image ${idx + 1}`}>
              <ProductImage src={m.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Product({ slug }) {
  const { products, catById, settings, loading } = useStore()
  const list = useList()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const product = products.find((p) => p.slug === slug)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const picker = useRef(null)

  const vParam = params.get('v')
  const variant = product?.variants.find((v) => v.id === vParam) || (product?.variants.length === 1 ? product.variants[0] : null)
  const av = variant ? availability(variant) : null

  useEffect(() => {
    if (product) document.title = `${variantTitle(product, variant)} | ${settings.business_name}`
  }, [product, variant, settings.business_name])
  useEffect(() => {
    setAdded(false)
    if (av?.max) setQty((q) => Math.min(q, av.max))
  }, [variant?.id]) // eslint-disable-line

  const related = useMemo(() => (product ? products.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 4) : []), [products, product])

  if (loading && !products.length) return <Spinner />
  if (!product)
    return (
      <div className="wrap section">
        <Empty title="Product not found" action={<Link to="/products" className="btn btn-primary">Browse all products</Link>}>
          This product may have been removed or is no longer on sale.
        </Empty>
      </div>
    )

  const cat = catById[product.category_id]
  const images = productImages(product)
  const range = priceRange(product)
  const multi = product.variants.length > 1
  const optionName = Object.keys(product.variants[0]?.specs || {})[0] || 'Option'
  const choose = (id) => setParams({ v: id })
  const specs = { ...product.specs, ...(variant?.specs || {}) }
  const specRows = Object.entries(specs)
  const needChoice = multi && !variant

  const add = () => {
    if (!variant) {
      picker.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast.info(`Please choose a ${optionName.toLowerCase()} first.`)
      return
    }
    list.add(variant.id, qty)
    setAdded(true)
    toast.success(`Added ${qty} x ${variantTitle(product, variant)}`)
  }

  return (
    <div className="wrap pdp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> <Icon name="right" size={14} />
        {cat && (
          <>
            <Link to={`/products?category=${cat.slug}`}>{cat.name}</Link> <Icon name="right" size={14} />
          </>
        )}
        <span>{product.name}</span>
      </nav>

      <div className="pdp-grid">
        <Gallery images={images} name={product.name} badge={variant && <div className="pcard-badges"><DiscountTag previous={variant.previous_price} price={variant.price} /></div>} />

        <div className="pdp-info">
          <div className="pdp-tags">
            {cat && <Link to={`/products?category=${cat.slug}`} className="pcard-cat">{cat.name}</Link>}
            {product.brand && <span className="chip">{product.brand}</span>}
            {product.is_new && <span className="chip chip-new">New</span>}
          </div>
          <h1>{variantTitle(product, variant)}</h1>
          {product.short_description && <p className="pdp-short">{product.short_description}</p>}

          <div className="pdp-price">
            {variant ? (
              <>
                <Price price={variant.price} previous={variant.previous_price} size="lg" />
                <StockPill variant={variant} />
              </>
            ) : (
              <div className="price price-lg">
                <span className="price-from">From</span>
                <span className="price-now">{money(range.min)}</span>
                {range.max > range.min && <span className="muted"> to {money(range.max)}</span>}
              </div>
            )}
          </div>

          {multi && (
            <div className="picker" ref={picker}>
              <div className="picker-label">
                <b>Choose {optionName.toLowerCase()}</b>
                {needChoice && <span className="picker-req">Required</span>}
              </div>
              {product.variants.length <= 8 ? (
                <div className="vchips" role="radiogroup" aria-label={optionName}>
                  {product.variants.map((v) => {
                    const a = availability(v)
                    return (
                      <button key={v.id} role="radio" aria-checked={variant?.id === v.id} className={`vchip ${variant?.id === v.id ? 'is-active' : ''} ${!a.canOrder ? 'is-out' : ''}`} onClick={() => choose(v.id)}>
                        <span className="vchip-l">{v.label}</span>
                        <span className="vchip-p">{money(v.price)}</span>
                        {discountPercent(v.previous_price, v.price) > 0 && <span className="vchip-d">-{discountPercent(v.previous_price, v.price)}%</span>}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <label className="select-wrap select-big">
                  <span className="sr-only">{optionName}</span>
                  <select value={variant?.id || ''} onChange={(e) => e.target.value && choose(e.target.value)}>
                    <option value="">Select {optionName.toLowerCase()}...</option>
                    {product.variants.map((v) => (
                      <option key={v.id} value={v.id}>{v.label} - {money(v.price)}{!availability(v).canOrder ? ' (out of stock)' : ''}</option>
                    ))}
                  </select>
                  <Icon name="down" size={18} />
                </label>
              )}
            </div>
          )}

          <div className="pdp-buy">
            <QtyStepper value={qty} onChange={setQty} max={av?.max || 100} />
            <button className="btn btn-primary btn-lg pdp-add" onClick={add} disabled={!!variant && !av.canOrder}>
              <Icon name="plus" size={20} />
              {variant && !av.canOrder ? 'Out of stock' : needChoice ? `Choose ${optionName.toLowerCase()} to add` : 'Add to Order List'}
            </button>
          </div>
          {variant && av.canOrder && <p className="muted small">Subtotal: <b>{money(variant.price * qty)}</b></p>}
          {added && (
            <div className="notice notice-good">
              <Icon name="check" size={18} /> Added to your Order List.
              <Link to="/order-list" className="btn btn-sm btn-dark">View Order List</Link>
              <Link to="/products" className="btn btn-sm btn-outline">Continue shopping</Link>
            </div>
          )}

          {settings.whatsapp && (
            <a className="btn btn-wa btn-block" target="_blank" rel="noreferrer" href={waLink(settings.whatsapp, buildEnquiryMessage({ settings, product, variant, qty }))}>
              <WhatsAppIcon size={20} /> Enquire on WhatsApp
            </a>
          )}

          {(settings.phone || settings.delivery_info) && (
            <div className="storebox">
              {settings.delivery_info && <p><Icon name="truck" size={16} /> {settings.delivery_info}</p>}
              {settings.phone && <p><Icon name="phone" size={16} /> <a href={`tel:${settings.phone.replace(/\s/g, '')}`}>{settings.phone}</a>{settings.business_hours ? <span className="muted"> &middot; {settings.business_hours}</span> : null}</p>}
            </div>
          )}

          <ul className="pdp-assure">
            {settings.deposit_percent != null && <li><Icon name="wallet" size={18} /> A deposit of up to {settings.deposit_percent}% may be required to confirm your order</li>}
            <li><Icon name="truck" size={18} /> Delivery fee is shown before you submit your order</li>
            {variant?.sku && <li><Icon name="tag" size={18} /> SKU: {variant.sku}</li>}
          </ul>
        </div>
      </div>

      {multi && (
        <section className="pdp-section">
          <h2>All options and prices</h2>
          <div className="tablewrap">
            <table className="table optable">
              <thead>
                <tr><th>{optionName}</th><th>Price</th><th>Availability</th><th><span className="sr-only">Select</span></th></tr>
              </thead>
              <tbody>
                {product.variants.map((v) => {
                  const a = availability(v)
                  return (
                    <tr key={v.id} className={variant?.id === v.id ? 'is-active' : ''}>
                      <td data-label={optionName}><b>{v.label}</b></td>
                      <td data-label="Price">
                        {money(v.price)} {discountPercent(v.previous_price, v.price) > 0 && <s className="muted small">{money(v.previous_price)}</s>}
                      </td>
                      <td data-label="Availability"><span className={`pill pill-${a.tone}`}>{a.label}</span></td>
                      <td className="td-act">
                        <button className="btn btn-sm btn-outline" onClick={() => { choose(v.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                          {variant?.id === v.id ? 'Selected' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="pdp-cols">
        <section className="pdp-section">
          <h2>Description</h2>
          <div className="prose">{(product.description || product.short_description || '').split('\n').filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}</div>
        </section>
        <section className="pdp-section">
          <h2>Specifications</h2>
          <dl className="specs">
            {product.brand && <div><dt>Brand</dt><dd>{product.brand}</dd></div>}
            {specRows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{String(val)}</dd></div>)}
            {variant?.sku && <div><dt>SKU</dt><dd>{variant.sku}</dd></div>}
            {variant && <div><dt>Stock</dt><dd>{variant.availability === 'on_order' ? 'Available on order' : av.canOrder ? `${variant.stock} available` : 'Out of stock'}</dd></div>}
          </dl>
          {needChoice && <p className="muted small">Choose an option above to see its exact specifications, SKU and stock.</p>}
        </section>
      </div>

      {related.length > 0 && (
        <section className="pdp-section">
          <h2>You may also like</h2>
          <div className="pgrid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}

    </div>
  )
}
