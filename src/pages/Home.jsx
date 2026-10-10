import { useMemo } from 'react'
import { Link } from '../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../components/Icons.jsx'
import { ProductRow, SectionHead } from '../components/Sections.jsx'
import { ProductImage, Spinner } from '../components/ui.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { cheapestVariant, productsOnSale, saleVariant } from '../lib/catalogQuery.js'
import { discountPercent, money, round2, variantTitle } from '../lib/format.js'
import { waLink } from '../lib/whatsapp.js'

const WHY = [
  { icon: 'shield', title: 'Quality products', text: 'We list products we are confident to stand behind, with clear specifications so you know what you are buying.' },
  { icon: 'tag', title: 'Competitive prices', text: 'Prices are shown upfront in Kenya Shillings. When we run offers, the old price and your saving are shown.' },
  { icon: 'list', title: 'Convenient ordering', text: 'Browse freely, build an Order List from your phone, then log in to confirm your details and submit. No online payment needed.' },
  { icon: 'truck', title: 'Delivery options', text: 'We deliver to your location. The delivery fee is shown before you submit, based on where you are.' },
  { icon: 'headset', title: 'Customer support', text: 'Call or WhatsApp us before or after you order. A real person confirms every order.' },
]
const STEPS = [
  { t: 'Browse', d: 'Explore categories or search for what you need.' },
  { t: 'Choose a product', d: 'Pick the size or option and check the price.' },
  { t: 'Add to Order List', d: 'Add everything you want and change quantities.' },
  { t: 'Log in and submit', d: 'Create a free account, verify your email and confirm your contact details.' },
  { t: 'We confirm with you', d: 'Your order is pending until we contact you. A deposit of up to {pct}% may be required.' },
  { t: 'Receive and pay balance', d: 'We deliver, and you pay the remaining balance.' },
]

function Hero({ settings, rows, image }) {
  const wa = settings.whatsapp
  return (
    <section className="hero">
      <div className="wrap hero-in">
        <div className="hero-copy">
          <h1>{settings.tagline || settings.business_name}</h1>
          <p className="hero-sub">
            {settings.business_name} is one store that sells quality products and delivers them to you. Browse our products and prices, build your Order List and place your order from your phone.
          </p>
          <div className="hero-cta">
            <Link to="/products" className="btn btn-primary btn-lg">Browse Products</Link>
            {wa && (
              <a href={waLink(wa, `Hello ${settings.business_name}, I would like to place an order.`)} target="_blank" rel="noreferrer" className="btn btn-wa btn-lg">
                <WhatsAppIcon size={20} /> Order via WhatsApp
              </a>
            )}
          </div>
          <ul className="hero-points">
            <li><Icon name="check" size={18} /> No online payment needed</li>
            {settings.deposit_percent != null && <li><Icon name="check" size={18} /> {settings.deposit_percent}% deposit, balance on delivery</li>}
            <li><Icon name="check" size={18} /> Delivery to your location</li>
          </ul>
        </div>
        <div className="hero-art">
          <img src={image || '/brand/hero.svg'} alt={image ? settings.business_name : 'Water tank, refrigerator, television, solar panel and laptop'} width="900" height="640" />
          {rows.map((r, i) => (
            <Link key={r.product.id} to={`/product/${r.product.slug}?v=${r.variant.id}`} className={`hero-tag hero-tag-${i + 1}`}>
              <span className="hero-tag-name">{variantTitle(r.product, r.variant)}</span>
              <span className="hero-tag-price">{money(r.variant.price)}</span>
              {r.variant.previous_price > r.variant.price && <s>{money(r.variant.previous_price)}</s>}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const { settings, categories, products, media, mediaList, loading, error, reload } = useStore()

  const sections = useMemo(() => {
    const newest = [...products].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    // a row needs a real variant to be orderable; anything else is skipped instead of crashing the page
    const rowOf = (p, v) => {
      const variant = v || cheapestVariant(p)
      return variant?.id ? { product: p, variantId: variant.id } : null
    }
    const featured = products.filter((p) => p.is_featured)
    const popular = products.filter((p) => p.is_popular)
    const flaggedNew = newest.filter((p) => p.is_new)
    const newArr = [...flaggedNew, ...newest.filter((p) => !p.is_new)].slice(0, 8)
    const offers = productsOnSale(products)
      .map((p) => ({ p, v: saleVariant(p) }))
      .sort((a, b) => discountPercent(b.v.previous_price, b.v.price) - discountPercent(a.v.previous_price, a.v.price))
    const saving = (x) => x.v.previous_price - x.v.price
    const heroRows = [...offers].filter((x) => x.p.is_featured || x.p.is_popular).sort((a, b) => saving(b) - saving(a)).slice(0, 3).map(({ p, v }) => ({ product: p, variant: v }))
    return {
      featured: (featured.length ? featured : newest.slice(0, 4)).slice(0, 8).map((p) => rowOf(p)).filter(Boolean),
      popular: popular.slice(0, 8).map((p) => rowOf(p)).filter(Boolean),
      newArr: newArr.map((p) => rowOf(p)).filter(Boolean),
      offers: offers.slice(0, 8).map(({ p, v }) => rowOf(p, v)).filter(Boolean),
      heroRows,
      counts: Object.fromEntries(categories.map((c) => [c.id, products.filter((p) => p.category_id === c.id).length])),
    }
  }, [products, categories])

  const pct = settings.deposit_percent ?? 0
  const example = 28000
  const dep = round2((example * pct) / 100)

  return (
    <>
      <Hero settings={settings} rows={sections.heroRows} image={media.hero?.url} />

      {mediaList('banner').length > 0 && (
        <section className="promos wrap" aria-label="Promotions">
          {mediaList('banner').map((b) => <img key={b.id} src={b.url} alt={b.alt || b.title || 'Promotion'} loading="lazy" />)}
        </section>
      )}

      <div className="truststrip">
        <div className="wrap truststrip-in">
          <span><Icon name="shield" size={20} /> Clear prices in KSh</span>
          <span><Icon name="truck" size={20} /> Delivery to your door</span>
          {settings.deposit_percent != null && <span><Icon name="wallet" size={20} /> Deposit of up to {settings.deposit_percent}% may be required</span>}
          <span><Icon name="headset" size={20} /> Call or WhatsApp support</span>
        </div>
      </div>

      {error && (
        <div className="wrap section">
          <div className="notice notice-bad">
            {error} <button className="btn btn-sm btn-outline" onClick={() => reload()}>Try again</button>
          </div>
        </div>
      )}
      {loading && !products.length && <Spinner />}

      {categories.length > 0 && (
        <section className="section" id="categories">
          <div className="wrap">
            <SectionHead title="Browse by category" sub="Find what you need, with prices and availability." to="/categories" linkText="All categories" />
            <div className="catgrid">
              {categories.map((c) => (
                <Link key={c.id} to={`/products?category=${c.slug}`} className="catcard">
                  <span className="catcard-img"><ProductImage src={c.image_url} alt="" /></span>
                  <span className="catcard-name">{c.name}</span>
                  <span className="catcard-count">{sections.counts[c.id] || 0} products</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <ProductRow id="featured" title="Featured products" sub="Hand-picked by our team." to="/products" rows={sections.featured} />
      <ProductRow id="offers" title="Special offers" sub="Reduced prices. See what you save." to="/products?sale=1&sort=discount" rows={sections.offers} />
      <ProductRow id="popular" title="Popular products" sub="What most customers are ordering." to="/products" rows={sections.popular} />
      <ProductRow id="new" title="New arrivals" sub="Recently added to the catalogue." to="/products?sort=newest" rows={sections.newArr} />

      <section className="section section-tint" id="why">
        <div className="wrap">
          <SectionHead title={`Why choose ${settings.business_name}`} />
          <div className="whygrid">
            {WHY.map((w) => (
              <div key={w.title} className="why">
                <span className="why-icon"><Icon name={w.icon} size={24} /></span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="wrap">
          <SectionHead title="How it works" sub="From browsing to delivery in six steps." />
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <span className="steps-n">{i + 1}</span>
                <h3>{s.t}</h3>
                <p>{s.d.replace('{pct}', pct)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="payment">
        <div className="wrap">
          <div className="payterms">
            <div className="payterms-copy">
              <h2>Simple payment terms</h2>
              <p>
                There is no online payment on this website. You submit your order, our team contacts you to confirm it, and a deposit of up to the percentage shown may be required before we proceed.
              </p>
              <p className="muted">{settings.payment_instructions}</p>
            </div>
            <div className="payterms-tags" aria-label="Payment example">
              <div className="paytag paytag-a">
                <span className="paytag-pct">{pct}%</span>
                <span className="paytag-what">Deposit</span>
                <span className="paytag-note">Paid to confirm your order</span>
              </div>
              <div className="paytag paytag-b">
                <span className="paytag-pct">{100 - pct}%</span>
                <span className="paytag-what">Balance</span>
                <span className="paytag-note">Paid when your order is delivered</span>
              </div>
              <p className="payterms-ex">
                Example: an order of <b>{money(example)}</b> needs a deposit of <b>{money(dep)}</b>, and <b>{money(example - dep)}</b> on delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-tint" id="contact">
        <div className="wrap contact">
          <div>
            <h2>Talk to us</h2>
            <p className="muted">Questions about a product, stock or delivery? Reach out. We reply quickly during business hours.</p>
            <div className="contact-cta">
              {settings.whatsapp && (
                <a className="btn btn-wa btn-lg" target="_blank" rel="noreferrer" href={waLink(settings.whatsapp, `Hello ${settings.business_name}, I need help with an order.`)}>
                  <WhatsAppIcon size={20} /> Chat on WhatsApp
                </a>
              )}
              {settings.phone && (
                <a className="btn btn-dark btn-lg" href={`tel:${settings.phone.replace(/\s/g, '')}`}>
                  <Icon name="phone" size={20} /> Call {settings.phone}
                </a>
              )}
            </div>
          </div>
          <ul className="contact-list">
            {settings.phone && <li><Icon name="phone" /><div><b>Phone</b><span>{settings.phone}</span></div></li>}
            {settings.whatsapp && <li><WhatsAppIcon /><div><b>WhatsApp</b><span>+{String(settings.whatsapp).replace(/\D/g, '')}</span></div></li>}
            {settings.email && <li><Icon name="mail" /><div><b>Email</b><span>{settings.email}</span></div></li>}
            {settings.address && <li><Icon name="pin" /><div><b>Location</b><span>{settings.address}</span></div></li>}
            {settings.business_hours && <li><Icon name="clock" /><div><b>Hours</b><span>{settings.business_hours}</span></div></li>}
          </ul>
        </div>
      </section>
    </>
  )
}
