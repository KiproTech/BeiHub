import { money, fmtDate, statusInfo } from '../lib/format.js'
import { ProductImage, StatusPill } from './ui.jsx'
import { Icon } from './Icons.jsx'
import { trackerSteps, trackerIndex, statusInfo as flowStatus, paymentInfo } from '../lib/orderFlow.js'

const fmt = fmtDate

export function TotalsBox({ totals, settings, deliveryPending, deliveryLabel }) {
  const pct = settings.deposit_percent ?? 0
  return (
    <dl className="totals">
      <div><dt>Items subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
      <div>
        <dt>Delivery fee{deliveryLabel ? <small>{deliveryLabel}</small> : null}</dt>
        <dd>{deliveryPending ? <span className="muted">Choose county</span> : totals.deliveryFee === 0 ? 'Free' : money(totals.deliveryFee)}</dd>
      </div>
      <div className="totals-total"><dt>Order total</dt><dd>{money(totals.total)}</dd></div>
      <div className="totals-split"><dt>{pct}% deposit <small>to confirm order</small></dt><dd>{money(totals.deposit)}</dd></div>
      <div className="totals-split"><dt>{100 - pct}% balance <small>on delivery</small></dt><dd>{money(totals.balance)}</dd></div>
    </dl>
  )
}

// Printable order summary, used on the confirmation page and in the admin.
export function OrderSheet({ order, settings, signatures }) {
  const st = statusInfo(order.status)
  return (
    <div className="sheetdoc">
      <header className="sheetdoc-head">
        <div>
          <h2>{settings.business_name}</h2>
          <p>
            {[settings.phone, settings.email].filter(Boolean).join('  |  ')}
            {settings.address ? <><br />{settings.address}</> : null}
          </p>
        </div>
        <div className="sheetdoc-no">
          <span>Order</span>
          <b>{order.order_number}</b>
          <small>{fmtDate(order.created_at, true)}</small>
          <small>Status: {st.short}</small>
        </div>
      </header>

      <div className="sheetdoc-cols">
        <section>
          <h3>Customer</h3>
          <p><b>{order.customer_name}</b><br />Phone: {order.phone}{order.alternative_phone ? <><br />Alt. phone: {order.alternative_phone}</> : null}{order.whatsapp ? <><br />WhatsApp: {order.whatsapp}</> : null}{order.customer_email ? <><br />Email: {order.customer_email}</> : null}</p>
        </section>
        <section>
          <h3>{order.fulfilment_method === 'pickup' ? 'Pickup' : 'Delivery'}</h3>
          <p>{order.fulfilment_method === 'pickup' ? 'Customer pickup' : <>{order.delivery_location}<br />{order.town}, {order.county}</>}{order.preferred_delivery_date ? <><br />Preferred date: {fmtDate(order.preferred_delivery_date)}</> : null}</p>
        </section>
      </div>

      <table className="table sheetdoc-table">
        <thead>
          <tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Total</th></tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id || i.variant_id}>
              <td>
                <div className="sheetdoc-prod">
                  {i.image_url && <ProductImage src={i.image_url} alt="" className="sheetdoc-img" />}
                  <div>
                    <b>{i.variant_label && !/^(standard|default)$/i.test(i.variant_label) ? `${i.product_name} \u2014 ${i.variant_label}` : i.product_name}</b>
                    {i.sku && <small>SKU: {i.sku}</small>}
                  </div>
                </div>
              </td>
              <td className="num">{i.quantity}</td>
              <td className="num">{money(i.unit_price)}</td>
              <td className="num">{money(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sheetdoc-totals">
        <dl className="totals">
          <div><dt>Items subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          <div><dt>Delivery fee</dt><dd>{order.delivery_fee === 0 ? 'Free' : money(order.delivery_fee)}</dd></div>
          <div className="totals-total"><dt>Order total</dt><dd>{money(order.total)}</dd></div>
          <div className="totals-split"><dt>{order.deposit_percent}% deposit</dt><dd>{money(order.deposit_amount)}</dd></div>
          <div className="totals-split"><dt>Balance on delivery</dt><dd>{money(order.balance_amount)}</dd></div>
        </dl>
      </div>

      {order.notes && <p className="sheetdoc-notes"><b>Customer notes:</b> {order.notes}</p>}
      {settings.payment_instructions && <p className="sheetdoc-pay small">{settings.payment_instructions}</p>}
      {signatures && (
        <div className="sheetdoc-sign">
          <span>Delivered by / signature</span>
          <span>Customer name / signature</span>
        </div>
      )}
    </div>
  )
}

/* ---------- order tracking (customer + admin) ---------- */

export const OrderStatusPill = ({ status }) => <StatusPill info={flowStatus(status)} />
export const PaymentPill = ({ status }) => <StatusPill info={paymentInfo(status)} />

// Horizontal progress: Submitted > Confirmed > Payment > Processing > Ready > Completed
export function OrderTracker({ order }) {
  if (order.status === 'cancelled') {
    return (
      <div className="notice notice-bad" role="status">
        <Icon name="alert" size={18} />
        <span>
          This order was cancelled{order.cancelled_at ? ` on ${fmt(order.cancelled_at, true)}` : ''}.
          {order.cancellation_reason ? <> <b>Reason:</b> {order.cancellation_reason}</> : null}
        </span>
      </div>
    )
  }
  const steps = trackerSteps(order)
  const at = trackerIndex(order)
  return (
    <ol className="tracker" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s.key} className={i < at || order.status === 'completed' ? 'is-done' : i === at ? 'is-current' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="tracker-dot">{i < at || order.status === 'completed' ? <Icon name="check" size={14} stroke={3} /> : i + 1}</span>
          <span className="tracker-label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

// Vertical history with date/time of every important change
export function OrderTimeline({ events, admin }) {
  const list = (events || []).filter((e) => admin || e.visible_to_customer !== false)
  if (!list.length) return <p className="muted small">No updates yet.</p>
  return (
    <ol className="timeline">
      {list.map((e) => (
        <li key={e.id} className={`timeline-item ${e.visible_to_customer === false ? 'is-internal' : ''} ${e.to_status === 'cancelled' ? 'is-bad' : ''}`}>
          <span className="timeline-dot" />
          <div>
            <b>{e.title}</b>
            {e.visible_to_customer === false && <span className="chip">Internal</span>}
            {e.message && <p>{e.message}</p>}
            <time dateTime={e.created_at}>{fmt(e.created_at, true)}</time>
          </div>
        </li>
      ))}
    </ol>
  )
}

// Contact details stored WITH the order (never read from the live profile)
export function OrderContact({ order }) {
  const pref = { phone: 'Phone call', whatsapp: 'WhatsApp', email: 'Email' }[order.preferred_contact] || 'Phone call'
  return (
    <dl className="defs">
      <div><dt>Full name</dt><dd>{order.customer_name}</dd></div>
      <div><dt>Phone</dt><dd><a href={`tel:${String(order.phone).replace(/\s/g, '')}`}>{order.phone}</a></dd></div>
      {order.alternative_phone && <div><dt>Alternative phone</dt><dd>{order.alternative_phone}</dd></div>}
      {order.whatsapp && <div><dt>WhatsApp</dt><dd>{order.whatsapp}</dd></div>}
      <div><dt>Email</dt><dd>{order.customer_email ? <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a> : <span className="muted">Not recorded</span>}</dd></div>
      <div><dt>Preferred contact</dt><dd>{pref}</dd></div>
      <div><dt>{order.fulfilment_method === 'pickup' ? 'Collection' : 'Delivery'}</dt><dd>{order.fulfilment_method === 'pickup' ? 'Customer pickup' : `${order.delivery_location}, ${order.town}, ${order.county}`}</dd></div>
      {order.preferred_delivery_date && <div><dt>Preferred date</dt><dd>{fmt(order.preferred_delivery_date)}</dd></div>}
      {order.notes && <div><dt>Customer notes</dt><dd>{order.notes}</dd></div>}
    </dl>
  )
}
