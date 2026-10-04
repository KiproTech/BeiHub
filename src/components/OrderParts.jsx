import { money, fmtDate, statusInfo } from '../lib/format.js'
import { ProductImage } from './ui.jsx'

export function TotalsBox({ totals, settings, deliveryPending, deliveryLabel }) {
  const pct = settings.deposit_percent
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
          <p><b>{order.customer_name}</b><br />Phone: {order.phone}{order.whatsapp ? <><br />WhatsApp: {order.whatsapp}</> : null}</p>
        </section>
        <section>
          <h3>Delivery</h3>
          <p>{order.delivery_location}<br />{order.town}, {order.county}{order.preferred_delivery_date ? <><br />Preferred date: {fmtDate(order.preferred_delivery_date)}</> : null}</p>
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
