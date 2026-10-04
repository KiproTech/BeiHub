import { useMemo, useState } from 'react'
import { Link, useNavigate } from '../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../components/Icons.jsx'
import { Empty, ProductImage } from '../components/ui.jsx'
import { TotalsBox } from '../components/OrderParts.jsx'
import { useList } from '../context/ListContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../lib/api.js'
import { COUNTIES } from '../data/counties.js'
import { friendlyError } from '../lib/errors.js'
import { isKenyanPhone, money } from '../lib/format.js'
import { buildOrderMessage, waLink } from '../lib/whatsapp.js'

export const LAST_ORDER_KEY = 'beihub.lastOrder.v1'

const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function Field({ label, error, hint, children }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && !error && <small className="muted">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

export default function Checkout() {
  const list = useList()
  const { settings, locations, reload } = useStore()
  const navigate = useNavigate()
  const { lines, valid, totals, customer, deliveryPending, hasProblems } = list
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sameWa, setSameWa] = useState(!customer.whatsapp || customer.whatsapp === customer.phone)

  const towns = useMemo(
    () => [...new Set(locations.filter((l) => l.town && l.county.toLowerCase() === customer.county.toLowerCase()).map((l) => l.town))],
    [locations, customer.county],
  )

  if (!lines.length)
    return (
      <div className="wrap section">
        <Empty title="Nothing to order yet" action={<Link to="/shop" className="btn btn-primary btn-lg">Browse products</Link>}>
          Add products to your Order List first.
        </Empty>
      </div>
    )

  const set = (k) => (e) => {
    list.setCustomer({ [k]: e.target.value })
    if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!customer.customer_name.trim() || customer.customer_name.trim().length < 2) e.customer_name = 'Enter your full name.'
    if (!customer.phone.trim()) e.phone = 'Enter your phone number.'
    else if (!isKenyanPhone(customer.phone)) e.phone = 'Enter a valid Kenyan number, e.g. 0712 345 678.'
    if (!sameWa && customer.whatsapp.trim() && !isKenyanPhone(customer.whatsapp)) e.whatsapp = 'Enter a valid WhatsApp number or tick the box above.'
    if (!customer.county) e.county = 'Select your county.'
    if (!customer.town.trim()) e.town = 'Enter your town or city.'
    if (!customer.delivery_location.trim() || customer.delivery_location.trim().length < 4) e.delivery_location = 'Describe where we should deliver (estate, street, landmark).'
    setErrors(e)
    return e
  }

  const payload = () => ({
    ...customer,
    whatsapp: sameWa ? customer.phone : customer.whatsapp,
    preferred_delivery_date: customer.preferred_delivery_date || null,
  })

  const submit = async (ev) => {
    ev.preventDefault()
    setServerError('')
    const e = validate()
    if (Object.keys(e).length) {
      document.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus()
      return
    }
    if (busy) return
    setBusy(true)
    try {
      const order = await api.submitOrder(payload(), valid.map((l) => ({ variant_id: l.variantId, quantity: l.qty })))
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order))
      list.clear()
      list.resetCustomerNotes()
      navigate('/order-confirmation')
    } catch (err) {
      setServerError(friendlyError(err))
      reload(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  const waMessage = buildOrderMessage({
    settings,
    customer: payload(),
    totals,
    lines: valid.map((l) => ({ title: l.title, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
  })

  return (
    <div className="wrap checkout">
      <nav className="crumbs"><Link to="/order-list">Order List</Link> <Icon name="right" size={14} /> <span>Delivery details</span></nav>
      <h1>Your details</h1>
      <p className="muted">We use these only to confirm and deliver your order.</p>

      {serverError && <div className="notice notice-bad" role="alert"><Icon name="alert" size={18} /> {serverError}</div>}
      {hasProblems && <div className="notice notice-bad"><Icon name="alert" size={18} /> Some items in your list are unavailable. <Link to="/order-list">Review your list</Link></div>}

      <form className="checkout-grid" onSubmit={submit} noValidate>
        <div className="formcard">
          <h2>Contact</h2>
          <Field label="Full name" error={errors.customer_name}>
            <input type="text" autoComplete="name" value={customer.customer_name} onChange={set('customer_name')} maxLength={120} />
          </Field>
          <div className="row2">
            <Field label="Phone number" error={errors.phone}>
              <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={customer.phone} onChange={set('phone')} maxLength={30} />
            </Field>
            <Field label="WhatsApp number" error={errors.whatsapp}>
              <input type="tel" inputMode="tel" placeholder="0712 345 678" value={sameWa ? customer.phone : customer.whatsapp} disabled={sameWa} onChange={set('whatsapp')} maxLength={30} />
            </Field>
          </div>
          <label className="check"><input type="checkbox" checked={sameWa} onChange={(e) => setSameWa(e.target.checked)} /> My WhatsApp number is the same as my phone number</label>

          <h2>Delivery</h2>
          <div className="row2">
            <Field label="County" error={errors.county}>
              <select value={customer.county} onChange={set('county')} autoComplete="address-level1">
                <option value="">Select county</option>
                {COUNTIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Town / City" error={errors.town}>
              <input type="text" list="towns" autoComplete="address-level2" value={customer.town} onChange={set('town')} maxLength={120} />
              <datalist id="towns">{towns.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
          </div>
          <Field label="Delivery location" error={errors.delivery_location} hint="Estate, street, building or nearest landmark.">
            <textarea rows={3} value={customer.delivery_location} onChange={set('delivery_location')} maxLength={300} />
          </Field>
          <Field label="Preferred delivery date (optional)">
            <input type="date" min={tomorrow()} value={customer.preferred_delivery_date} onChange={set('preferred_delivery_date')} />
          </Field>
          <Field label="Additional instructions (optional)">
            <textarea rows={3} value={customer.notes} onChange={set('notes')} maxLength={1000} placeholder="e.g. call before delivery, gate colour, floor number" />
          </Field>
        </div>

        <aside className="summary">
          <h2>Order summary</h2>
          <ul className="minilines">
            {valid.map((l) => (
              <li key={l.variantId}>
                <ProductImage src={l.image} alt="" />
                <div><b>{l.title}</b><small>{l.qty} x {money(l.unitPrice)}</small></div>
                <span>{money(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <TotalsBox totals={totals} settings={settings} deliveryPending={deliveryPending} />
          <div className="payterms-mini">
            <b>How payment works</b>
            <p>No online payment. After you submit, we confirm with you and share deposit details. Pay {settings.deposit_percent}% ({money(totals.deposit)}) to confirm, and {money(totals.balance)} on delivery.</p>
          </div>
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || hasProblems || !valid.length}>
            {busy ? 'Submitting...' : 'Submit Order'}
          </button>
          {settings.whatsapp && (
            <a className="btn btn-wa btn-block" target="_blank" rel="noreferrer" href={waLink(settings.whatsapp, waMessage)}>
              <WhatsAppIcon size={20} /> Send via WhatsApp instead
            </a>
          )}
          <p className="muted small center">By submitting you agree we may contact you to confirm this order.</p>
        </aside>
      </form>
    </div>
  )
}
