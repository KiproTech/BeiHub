import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from '../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../components/Icons.jsx'
import { Empty, Spinner } from '../components/ui.jsx'
import { OrderSheet, OrderStatusPill } from '../components/OrderParts.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { variantTitle } from '../lib/format.js'
import { buildOrderMessage, waLink } from '../lib/whatsapp.js'

// The order is read back from Supabase (never from this device), so the page is the same on any phone or computer.
function useConfirmedOrder() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const id = params.get('id')
  const [order, setOrder] = useState(undefined)
  const load = useCallback(async () => {
    try {
      const rows = await api.listMyOrders()
      setOrder((id && rows.find((o) => o.id === id)) || (!id ? rows[0] : null) || null)
    } catch {
      setOrder((o) => (o === undefined ? null : o))
    }
  }, [id])
  useEffect(() => {
    if (user) load()
    else if (!loading) setOrder(null)
  }, [user, loading, load])
  return order
}

export default function Confirmation() {
  const { settings } = useStore()
  const order = useConfirmedOrder()

  if (order === undefined) return <Spinner label="Loading your order" />
  if (!order)
    return (
      <div className="wrap section">
        <Empty title="No recent order found" action={<Link to="/account/orders" className="btn btn-primary btn-lg">View my orders</Link>}>
          If you just placed an order, we have received it. You can follow it under My orders.
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
  const contactVia = [order.phone, order.customer_email].filter(Boolean)

  return (
    <div className="wrap confirm">
      <div className="confirm-hero no-print">
        <span className="confirm-check"><Icon name="check" size={34} stroke={3} /></span>
        <h1>Order Submitted Successfully</h1>
        <p>Thank you, {order.customer_name.split(' ')[0]}. Your order number is <b className="orderno">{order.order_number}</b>.</p>
        <OrderStatusPill status={order.status || 'pending'} />
      </div>

      <div className="confirm-grid">
        <div className="no-print">
          <div className="formcard">
            <h2>What happens next</h2>
            <ul className="ticks">
              <li>We have <b>received</b> your order.</li>
              <li>Your order is currently <b>pending</b>. It has not been confirmed yet.</li>
              <li>Our team will contact you using <b>{contactVia.join(' and ')}</b> to confirm the order and arrange the next steps.</li>
              <li>A payment of up to <b>{order.deposit_percent}%</b> may be required. We will send you the payment instructions. Nothing was charged online.</li>
              <li>Please <b>wait for our confirmation</b> and further instructions.</li>
            </ul>
          </div>
          <div className="confirm-actions">
            <Link to={order.id ? `/account/orders/${order.id}` : '/account/orders'} className="btn btn-primary btn-lg"><Icon name="clipboard" size={20} /> Track this order</Link>
            <Link to="/products" className="btn btn-outline btn-lg">Continue shopping</Link>
            <button className="btn btn-dark btn-lg" onClick={() => window.print()}><Icon name="print" size={20} /> Print order summary</button>
            {settings.whatsapp && (
              <a className="btn btn-wa btn-lg" target="_blank" rel="noreferrer" href={waLink(settings.whatsapp, msg)}>
                <WhatsAppIcon size={20} /> Message us about this order
              </a>
            )}
          </div>
        </div>
        <div className="print-area">
          <OrderSheet order={order} settings={settings} />
        </div>
      </div>
    </div>
  )
}
