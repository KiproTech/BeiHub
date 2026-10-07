import { Link, useNavigate } from '../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../components/Icons.jsx'
import { Empty, ProductImage, QtyStepper } from '../components/ui.jsx'
import { TotalsBox } from '../components/OrderParts.jsx'
import { useList } from '../context/ListContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { rememberNext } from '../lib/nextPath.js'
import { COUNTIES } from '../data/counties.js'
import { money } from '../lib/format.js'
import { buildOrderMessage, waLink } from '../lib/whatsapp.js'

export default function OrderList() {
  const list = useList()
  const { settings, loading } = useStore()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lines, totals, customer, deliveryPending, hasProblems, valid } = list
  const needsCounty = settings.delivery_mode === 'county' || settings.delivery_mode === 'town'

  if (!lines.length)
    return (
      <div className="wrap section">
        <Empty title="Your Order List is empty" action={<Link to="/products" className="btn btn-primary btn-lg">Browse products</Link>}>
          Add the products you want, then review and place your order. No online payment is needed.
        </Empty>
      </div>
    )

  const message = buildOrderMessage({
    settings,
    customer,
    totals,
    lines: valid.map((l) => ({ title: l.title, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
  })

  return (
    <div className="wrap listpage">
      <h1>Review your order</h1>
      <p className="muted">Check your items and quantities. Next you will confirm your contact details. You will not be asked to pay online{user ? '' : ', and you only need to log in when you place the order'}.</p>

      <div className="listpage-grid">
        <div className="lines">
          {lines.map((l) => (
            <div key={l.variantId} className={`line ${l.missing || !l.canOrder ? 'line-bad' : ''}`}>
              <Link to={l.product ? `/product/${l.product.slug}?v=${l.variantId}` : '/products'} className="line-img">
                <ProductImage src={l.image} alt="" />
              </Link>
              <div className="line-main">
                <h3>{l.product ? <Link to={`/product/${l.product.slug}?v=${l.variantId}`}>{l.title}</Link> : l.title}</h3>
                {l.variant && <p className="muted small">Option: {l.variant.label}{l.variant.sku ? ` | SKU ${l.variant.sku}` : ''}</p>}
                {(l.missing || !l.canOrder) && (
                  <p className="line-warn"><Icon name="alert" size={16} /> {l.missing ? 'This product is no longer available.' : 'Out of stock right now.'} Remove it to continue.</p>
                )}
                {l.canOrder && !l.missing && (
                  <p className="line-price">
                    {money(l.unitPrice)} each {l.previousPrice > l.unitPrice && <s className="muted small">{money(l.previousPrice)}</s>}
                    {l.availability.key === 'low' && <span className="pill pill-warn">{l.availability.label}</span>}
                    {l.availability.key === 'order' && <span className="pill pill-warn">Available on order</span>}
                  </p>
                )}
              </div>
              <div className="line-qty">
                {!l.missing && l.canOrder && <QtyStepper value={l.qty} onChange={(q) => list.setQty(l.variantId, q)} max={l.max || 100} size="sm" />}
              </div>
              <div className="line-total">
                <b>{money(l.lineTotal)}</b>
                <button className="link-btn link-danger" onClick={() => list.remove(l.variantId)} aria-label={`Remove ${l.title}`}>
                  <Icon name="trash" size={16} /> Remove
                </button>
              </div>
            </div>
          ))}
          <div className="lines-foot">
            <Link to="/products" className="btn btn-outline"><Icon name="left" size={16} /> Continue shopping</Link>
            <button className="link-btn" onClick={() => window.confirm('Remove all items from your Order List?') && list.clear()}>Clear list</button>
          </div>
        </div>

        <aside className="summary">
          <h2>Order summary</h2>
          {needsCounty && (
            <label className="field">
              <span>Deliver to (county)</span>
              <select value={customer.county} onChange={(e) => list.setCustomer({ county: e.target.value })}>
                <option value="">Select county to see delivery fee</option>
                {COUNTIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          )}
          <TotalsBox totals={totals} settings={settings} deliveryPending={deliveryPending} />
          {deliveryPending && <p className="muted small">Delivery fee depends on your county. Choose it above to see your full total.</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={hasProblems || !valid.length || loading} onClick={() => { if (!user) rememberNext('/checkout'); navigate(user ? '/checkout' : '/login?next=/checkout') }}>
            {user ? 'Continue to contact details' : 'Log in to place order'}
          </button>
          {!user && <p className="muted small center">New here? <Link to="/register?next=/checkout">Create a free account</Link>. Your list is saved.</p>}
          {settings.whatsapp && valid.length > 0 && (
            <a className="btn btn-wa btn-block" target="_blank" rel="noreferrer" href={waLink(settings.whatsapp, message)}>
              <WhatsAppIcon size={20} /> Ask us on WhatsApp
            </a>
          )}
          <ul className="summary-notes">
            {settings.deposit_percent != null && <li><Icon name="wallet" size={16} /> A deposit of up to {settings.deposit_percent}% may be required after we confirm. Balance on delivery.</li>}
            <li><Icon name="shield" size={16} /> Prices are confirmed when you submit.</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
