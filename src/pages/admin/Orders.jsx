import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '../../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../../components/Icons.jsx'
import { OrderSheet } from '../../components/OrderParts.jsx'
import { ProductImage } from '../../components/ui.jsx'
import { Card, PageHead, StatusBadge, confirmDelete } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { useStore } from '../../context/StoreContext.jsx'
import { api } from '../../lib/api.js'
import { ORDER_STATUSES, fmtDate, money, statusInfo, waDigits } from '../../lib/format.js'
import { waLink } from '../../lib/whatsapp.js'

export default function Orders() {
  const { orders } = useAdmin()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const [q, setQ] = useState('')

  const counts = useMemo(() => Object.fromEntries(ORDER_STATUSES.map((s) => [s.key, orders.filter((o) => o.status === s.key).length])), [orders])
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return orders.filter((o) => (!status || o.status === status) && (!t || `${o.order_number} ${o.customer_name} ${o.phone} ${o.county} ${o.town}`.toLowerCase().includes(t)))
  }, [orders, status, q])

  return (
    <>
      <PageHead title="Orders" sub="Confirm each order with the customer, record the deposit, then deliver." />
      <div className="tabs tabs-scroll" role="tablist">
        <button className={!status ? 'is-active' : ''} onClick={() => setParams({})}>All <span className="badge-n">{orders.length}</span></button>
        {ORDER_STATUSES.map((s) => (
          <button key={s.key} className={status === s.key ? 'is-active' : ''} onClick={() => setParams({ status: s.key })}>{s.short} <span className="badge-n">{counts[s.key]}</span></button>
        ))}
      </div>
      <div className="afilters">
        <div className="afilters-search"><Icon name="search" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order no., name, phone, county" aria-label="Search orders" /></div>
      </div>
      <Card>
        {rows.length === 0 ? (
          <p className="muted">No orders found.</p>
        ) : (
          <div className="tablewrap">
            <table className="table table-stack">
              <thead><tr><th>Order</th><th>Customer</th><th>Delivery</th><th className="num">Total</th><th className="num">Deposit</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td data-label="Order"><Link to={`/admin/orders/${o.id}`}><b>{o.order_number}</b></Link><small className="block muted">{fmtDate(o.created_at, true)}</small></td>
                    <td data-label="Customer">{o.customer_name}<small className="block muted">{o.phone}</small></td>
                    <td data-label="Delivery">{o.town}<small className="block muted">{o.county}</small></td>
                    <td data-label="Total" className="num">{money(o.total)}</td>
                    <td data-label="Deposit" className="num">{money(o.deposit_amount)}</td>
                    <td data-label="Status"><StatusBadge status={o.status} /></td>
                    <td className="td-act"><Link to={`/admin/orders/${o.id}`} className="btn btn-sm btn-outline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

export function OrderDetail({ id }) {
  const { orders, reload, run } = useAdmin()
  const { settings } = useStore()
  const navigate = useNavigate()
  const order = orders.find((o) => o.id === id)
  const [notes, setNotes] = useState(order?.admin_notes || '')
  useEffect(() => setNotes(order?.admin_notes || ''), [order?.admin_notes])

  if (!order)
    return (
      <>
        <PageHead title="Order not found" />
        <Link to="/admin/orders" className="btn btn-primary">Back to orders</Link>
      </>
    )

  const setStatus = async (status) => {
    if (await run(() => api.updateOrder(order.id, { status }), `Status updated: ${statusInfo(status).short}`)) reload({ publicToo: false })
  }
  const saveNotes = async () => {
    if (await run(() => api.updateOrder(order.id, { admin_notes: notes }), 'Notes saved')) reload({ publicToo: false })
  }
  const del = async () => {
    if (!confirmDelete(`order ${order.order_number}`)) return
    if (await run(() => api.deleteOrder(order.id), 'Order deleted')) { await reload({ publicToo: false }); navigate('/admin/orders') }
  }

  const nextStatus = { pending: 'confirmed', confirmed: 'deposit_paid', deposit_paid: 'out_for_delivery', out_for_delivery: 'delivered' }[order.status]
  const nextLabel = { confirmed: 'Mark as confirmed', deposit_paid: 'Mark deposit received', out_for_delivery: 'Mark out for delivery', delivered: 'Mark as delivered' }[nextStatus]
  const waNum = order.whatsapp || order.phone
  const greeting = `Hello ${order.customer_name.split(' ')[0]}, this is ${settings.business_name} about your order ${order.order_number} (total ${money(order.total)}). To confirm it, please pay the ${order.deposit_percent}% deposit of ${money(order.deposit_amount)}. The balance of ${money(order.balance_amount)} is paid on delivery. Thank you!`

  return (
    <>
      <div className="admin-print-hide">
        <PageHead title={order.order_number} sub={`Placed ${fmtDate(order.created_at, true)}`}>
          <Link to="/admin/orders" className="btn btn-outline"><Icon name="left" size={16} /> All orders</Link>
          <button className="btn btn-dark" onClick={() => window.print()}><Icon name="print" size={18} /> Print order</button>
        </PageHead>

        <div className="agrid agrid-order">
          <div className="astack">
            <Card title="Status" sub="Update as the order moves along.">
              <div className="statusbar">
                <StatusBadge status={order.status} />
                <label className="select-wrap">
                  <span className="sr-only">Change status</span>
                  <select value={order.status} onChange={(e) => setStatus(e.target.value)}>
                    {ORDER_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <Icon name="down" size={16} />
                </label>
                {nextStatus && <button className="btn btn-primary" onClick={() => setStatus(nextStatus)}>{nextLabel}</button>}
              </div>
            </Card>

            <Card title="Items">
              <div className="tablewrap">
                <table className="table">
                  <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {order.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div className="sheetdoc-prod">
                            <ProductImage src={i.image_url} alt="" className="sheetdoc-img" />
                            <div><b>{i.product_name}</b><small className="block">Variant: <b>{i.variant_label || '-'}</b>{i.sku ? ` | ${i.sku}` : ''}</small></div>
                          </div>
                        </td>
                        <td className="num">{i.quantity}</td>
                        <td className="num">{money(i.unit_price)}</td>
                        <td className="num">{money(i.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">Prices above are the prices at the time the order was placed. Later price changes do not affect this order.</p>
              <dl className="totals totals-right">
                <div><dt>Items subtotal</dt><dd>{money(order.subtotal)}</dd></div>
                <div><dt>Delivery fee</dt><dd>{order.delivery_fee === 0 ? 'Free' : money(order.delivery_fee)}</dd></div>
                <div className="totals-total"><dt>Order total</dt><dd>{money(order.total)}</dd></div>
                <div className="totals-split"><dt>{order.deposit_percent}% deposit</dt><dd>{money(order.deposit_amount)}</dd></div>
                <div className="totals-split"><dt>Balance on delivery</dt><dd>{money(order.balance_amount)}</dd></div>
              </dl>
            </Card>
          </div>

          <div className="astack">
            <Card title="Customer">
              <dl className="kvlist">
                <div><dt>Name</dt><dd>{order.customer_name}</dd></div>
                <div><dt>Phone</dt><dd><a href={`tel:${order.phone.replace(/\s/g, '')}`}>{order.phone}</a></dd></div>
                <div><dt>WhatsApp</dt><dd>{order.whatsapp || '-'}</dd></div>
              </dl>
              <a className="btn btn-wa btn-block" target="_blank" rel="noreferrer" href={waLink(waDigits(waNum), greeting)}><WhatsAppIcon size={18} /> Message customer on WhatsApp</a>
            </Card>
            <Card title="Delivery">
              <dl className="kvlist">
                <div><dt>County</dt><dd>{order.county}</dd></div>
                <div><dt>Town / City</dt><dd>{order.town}</dd></div>
                <div><dt>Location</dt><dd>{order.delivery_location}</dd></div>
                <div><dt>Preferred date</dt><dd>{order.preferred_delivery_date ? fmtDate(order.preferred_delivery_date) : 'Not specified'}</dd></div>
                {order.notes && <div><dt>Customer notes</dt><dd>{order.notes}</dd></div>}
              </dl>
            </Card>
            <Card title="Your notes" sub="Only visible to staff.">
              <textarea className="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Called customer, deposit via M-Pesa, delivery booked for Friday" />
              <button className="btn btn-outline btn-sm" disabled={notes === (order.admin_notes || '')} onClick={saveNotes}>Save notes</button>
            </Card>
            <button className="link-btn link-danger" onClick={del}><Icon name="trash" size={16} /> Delete this order</button>
          </div>
        </div>
      </div>
      <div className="print-sheet"><OrderSheet order={order} settings={settings} signatures /></div>
    </>
  )
}
