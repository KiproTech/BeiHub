import { Link } from '../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../components/Icons.jsx'
import { Empty } from '../components/ui.jsx'
import { OrderSheet } from '../components/OrderParts.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { shapeOrder } from '../lib/shape.js'
import { money, variantTitle } from '../lib/format.js'
import { buildOrderMessage, waLink } from '../lib/whatsapp.js'
import { LAST_ORDER_KEY } from './Checkout.jsx'

function loadOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || 'null')
    return raw ? shapeOrder(raw) : null
  } catch {
    return null
  }
}

export default function Confirmation() {
  const { settings } = useStore()
  const order = loadOrder()

  if (!order)
    return (
      <div className="wrap section">
        <Empty title="No recent order found" action={<Link to="/shop" className="btn btn-primary btn-lg">Continue shopping</Link>}>
          If you just placed an order, we have received it and will contact you. Otherwise start by browsing our products.
        </Empty>
      </div>
    )

  const msg = buildOrderMessage({
    settings,
    orderNumber: order.order_number,
    customer: order,
    totals: { subtotal: order.subtotal, deliveryFee: order.delivery_fee, total: order.total, deposit: order.deposit_amount, balance: order.balance_amount },
    lines: order.items.map((i) => ({ title: variantTitle({ name: i.product_name }, { label: i.variant_label }), qty: i.quantity, unitPrice: i.unit_price, lineTotal: i.line_total })),
  })

  return (
    <div className="wrap confirm">
      <div className="confirm-hero no-print">
        <span className="confirm-check"><Icon name="check" size={34} stroke={3} /></span>
        <h1>Thank you, {order.customer_name.split(' ')[0]}. Your order is in.</h1>
        <p>
          Order number <b className="orderno">{order.order_number}</b>. Keep it handy. Nothing has been charged. Our team will contact you on <b>{order.phone}</b> to confirm.
        </p>
      </div>

      <div className="confirm-grid">
        <div className="no-print">
          <div className="formcard">
            <h2>What happens next</h2>
            <ol className="nextsteps">
              <li><b>We confirm your order.</b> We check stock and delivery to {order.town}, {order.county}.</li>
              <li><b>You pay the {order.deposit_percent}% deposit: {money(order.deposit_amount)}.</b> We send you our payment details when we call.</li>
              <li><b>We deliver your order.</b> You pay the balance of {money(order.balance_amount)} on delivery.</li>
            </ol>
            {settings.payment_instructions && <p className="muted small">{settings.payment_instructions}</p>}
          </div>
          <div className="confirm-actions">
            {settings.whatsapp && (
              <a className="btn btn-wa btn-lg" target="_blank" rel="noreferrer" href={waLink(settings.whatsapp, msg)}>
                <WhatsAppIcon size={20} /> Send order on WhatsApp
              </a>
            )}
            <button className="btn btn-dark btn-lg" onClick={() => window.print()}><Icon name="print" size={20} /> Print order summary</button>
            <Link to="/shop" className="btn btn-outline btn-lg">Continue shopping</Link>
          </div>
        </div>
        <div className="print-area">
          <OrderSheet order={order} settings={settings} />
        </div>
      </div>
    </div>
  )
}
