import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '../lib/router.jsx'
import { Icon } from '../components/Icons.jsx'
import { Empty, ProductImage, Spinner } from '../components/ui.jsx'
import { LoginPrompt, VerifyBanner } from '../components/AuthParts.jsx'
import { OrderContact, TotalsBox } from '../components/OrderParts.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useList } from '../context/ListContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../lib/api.js'
import { COUNTIES } from '../data/counties.js'
import { friendlyError } from '../lib/errors.js'
import { isKenyanPhone, money } from '../lib/format.js'
import { CONTACT_METHODS } from '../lib/orderFlow.js'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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

// Flow: Order List (review)  ->  1. Contact details  ->  2. Confirm order  ->  Continue  ->  Order submitted (pending)
export default function Checkout() {
  const { user, loading: authLoading, isVerified } = useAuth()
  const list = useList()
  const { settings, locations, reload } = useStore()
  const navigate = useNavigate()
  const { lines, valid, totals, customer, deliveryPending, hasProblems } = list
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sameWa, setSameWa] = useState(!customer.whatsapp || customer.whatsapp === customer.phone)
  const prefilled = useRef(false)
  const pickup = customer.fulfilment_method === 'pickup'
  const pct = settings.deposit_percent ?? 0

  // pre-fill empty fields from the profile / login email (the order keeps its own copy afterwards)
  useEffect(() => {
    if (!user || prefilled.current) return
    prefilled.current = true
    const patch = {}
    if (!customer.customer_name) patch.customer_name = user.full_name || ''
    if (!customer.phone) patch.phone = user.phone || ''
    if (!customer.alternative_phone) patch.alternative_phone = user.alternative_phone || ''
    if (!customer.customer_email) patch.customer_email = user.email || ''
    if (user.preferred_contact && customer.preferred_contact === 'phone') patch.preferred_contact = user.preferred_contact
    if (Object.keys(patch).length) list.setCustomer(patch)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const towns = useMemo(
    () => [...new Set(locations.filter((l) => l.town && l.county.toLowerCase() === customer.county.toLowerCase()).map((l) => l.town))],
    [locations, customer.county],
  )

  if (authLoading) return <Spinner label="Loading" />
  if (!lines.length)
    return (
      <div className="wrap section">
        <Empty title="Nothing to order yet" action={<Link to="/products" className="btn btn-primary btn-lg">Browse products</Link>}>
          Add products to your Order List first.
        </Empty>
      </div>
    )
  if (!user) return <LoginPrompt next="/checkout" title="Log in to place your order">Your Order List is saved. Log in or create a free account, and you will come straight back here to finish your order.</LoginPrompt>

  const set = (k) => (e) => {
    list.setCustomer({ [k]: e.target.value })
    if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!customer.customer_name.trim() || customer.customer_name.trim().length < 2) e.customer_name = 'Enter your full name.'
    if (!customer.phone.trim()) e.phone = 'Enter your phone number.'
    else if (!isKenyanPhone(customer.phone)) e.phone = 'Enter a valid Kenyan number, e.g. 0712 345 678.'
    if (customer.alternative_phone.trim() && !isKenyanPhone(customer.alternative_phone)) e.alternative_phone = 'Enter a valid number or leave this empty.'
    if (!EMAIL_RE.test(customer.customer_email.trim())) e.customer_email = 'Enter a valid email address.'
    if (!sameWa && customer.whatsapp.trim() && !isKenyanPhone(customer.whatsapp)) e.whatsapp = 'Enter a valid WhatsApp number or tick the box above.'
    if (customer.preferred_contact === 'whatsapp' && !(sameWa ? customer.phone : customer.whatsapp).trim()) e.preferred_contact = 'Add a WhatsApp number or choose another contact method.'
    if (!pickup) {
      if (!customer.county) e.county = 'Select your county.'
      if (!customer.town.trim()) e.town = 'Enter your town or city.'
      if (!customer.delivery_location.trim() || customer.delivery_location.trim().length < 4) e.delivery_location = 'Describe where we should deliver (estate, street, landmark).'
    }
    setErrors(e)
    return e
  }

  const payload = () => ({
    ...customer,
    customer_email: customer.customer_email.trim(),
    whatsapp: sameWa ? customer.phone : customer.whatsapp,
    preferred_delivery_date: pickup ? null : customer.preferred_delivery_date || null,
  })

  const toConfirm = (ev) => {
    ev.preventDefault()
    setServerError('')
    const e = validate()
    if (Object.keys(e).length) {
      document.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus()
      return
    }
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    if (busy) return
    setServerError('')
    setBusy(true)
    try {
      const order = await api.submitOrder(payload(), valid.map((l) => ({ variant_id: l.variantId, quantity: l.qty })))
      list.clear()
      list.resetCustomerNotes()
      navigate(`/order-confirmation?id=${order.id}`)
    } catch (err) {
      setServerError(friendlyError(err))
      setStep(1)
      reload(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  const summary = (
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
      <TotalsBox totals={totals} settings={settings} deliveryPending={deliveryPending} deliveryLabel={pickup ? 'pickup' : undefined} />
    </aside>
  )

  return (
    <div className="wrap checkout">
      <nav className="crumbs"><Link to="/order-list">Review order</Link> <Icon name="right" size={14} /> <span className={step === 1 ? 'is-here' : ''}>Contact details</span> <Icon name="right" size={14} /> <span className={step === 2 ? 'is-here' : ''}>Confirm order</span></nav>
      <h1>{step === 1 ? 'Contact details' : 'Confirm your order'}</h1>

      <VerifyBanner />
      {serverError && <div className="notice notice-bad" role="alert"><Icon name="alert" size={18} /> {serverError}</div>}
      {hasProblems && <div className="notice notice-bad"><Icon name="alert" size={18} /> Some items in your list are unavailable. <Link to="/order-list">Review your list</Link></div>}

      {step === 1 ? (
        <>
          <p className="muted">We use these details to confirm your order. They are saved with this order, so later changes to your profile will not alter it.</p>
          <form className="checkout-grid" onSubmit={toConfirm} noValidate>
            <div className="formcard">
              <h2>Your contact details</h2>
              <Field label="Full name" error={errors.customer_name}>
                <input type="text" autoComplete="name" value={customer.customer_name} onChange={set('customer_name')} maxLength={120} />
              </Field>
              <div className="row2">
                <Field label="Phone number" error={errors.phone}>
                  <input type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={customer.phone} onChange={set('phone')} maxLength={30} />
                </Field>
                <Field label="Alternative phone (optional)" error={errors.alternative_phone}>
                  <input type="tel" inputMode="tel" placeholder="0733 000 000" value={customer.alternative_phone} onChange={set('alternative_phone')} maxLength={30} />
                </Field>
              </div>
              <Field label="Email address" error={errors.customer_email} hint="Order updates are sent here and to your notifications.">
                <input type="email" autoComplete="email" value={customer.customer_email} onChange={set('customer_email')} maxLength={160} />
              </Field>
              <div className="row2">
                <Field label="WhatsApp number" error={errors.whatsapp}>
                  <input type="tel" inputMode="tel" placeholder="0712 345 678" value={sameWa ? customer.phone : customer.whatsapp} disabled={sameWa} onChange={set('whatsapp')} maxLength={30} />
                </Field>
                <Field label="Preferred contact method" error={errors.preferred_contact}>
                  <select value={customer.preferred_contact} onChange={set('preferred_contact')}>
                    {CONTACT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </Field>
              </div>
              <label className="check"><input type="checkbox" checked={sameWa} onChange={(e) => setSameWa(e.target.checked)} /> My WhatsApp number is the same as my phone number</label>

              <h2>Delivery or pickup</h2>
              <div className="choice" role="radiogroup" aria-label="Delivery or pickup">
                {[['delivery', 'Delivery', 'We bring it to you'], ['pickup', 'Pickup', 'You collect it from us']].map(([k, t, s]) => (
                  <label key={k} className={`choice-opt ${customer.fulfilment_method === k ? 'is-on' : ''}`}>
                    <input type="radio" name="fulfilment" checked={customer.fulfilment_method === k} onChange={() => list.setCustomer({ fulfilment_method: k })} />
                    <b>{t}</b><small>{s}</small>
                  </label>
                ))}
              </div>
              {!pickup && (
                <>
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
                </>
              )}
              <Field label="Order notes (optional)">
                <textarea rows={3} value={customer.notes} onChange={set('notes')} maxLength={1000} placeholder="e.g. call before delivery, gate colour, floor number" />
              </Field>
            </div>

            <div className="summary-col">
              {summary}
              {!isVerified && <div className="notice notice-warn"><Icon name="mail" size={18} /> Verify your email address first. You cannot submit an order until it is verified.</div>}
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={hasProblems || !valid.length}>Confirm order</button>
              <p className="muted small center">Next you will review everything before submitting.</p>
            </div>
          </form>
        </>
      ) : (
        <div className="checkout-grid">
          <div className="formcard">
            <h2>Please check your order</h2>
            <OrderContact order={{ ...payload(), fulfilment_method: customer.fulfilment_method, delivery_location: customer.delivery_location, town: customer.town, county: customer.county }} />
            <button className="link-btn" onClick={() => setStep(1)}><Icon name="edit" size={15} /> Edit details</button>

            <div className="notice notice-warn paynotice">
              <Icon name="wallet" size={20} />
              <p>
                <b>Before you continue:</b> Your order will be processed shortly. A payment of up to {pct}% may be required to proceed with the order. After submitting your order, our team will contact you using the contact details provided to confirm the order and arrange the next steps.
              </p>
            </div>
            <p className="muted small">Up to {pct}% deposit may be required to confirm your order. Our team will contact you with payment instructions. You do not pay anything online now.</p>
          </div>
          <div className="summary-col">
            {summary}
            <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={busy || !isVerified || hasProblems || !valid.length}>{busy ? 'Submitting...' : 'Continue'}</button>
            {!isVerified && <p className="field-error center">Verify your email to continue.</p>}
            <button className="btn btn-outline btn-block" onClick={() => setStep(1)} disabled={busy}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
