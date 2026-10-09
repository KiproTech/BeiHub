import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from '../../lib/router.jsx'
import { Icon, WhatsAppIcon } from '../../components/Icons.jsx'
import { OrderContact, OrderSheet, OrderStatusPill, OrderTimeline, OrderTracker, PaymentPill } from '../../components/OrderParts.jsx'
import { ConfirmDialog, ProductImage } from '../../components/ui.jsx'
import { Card, PageHead, confirmDelete } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useStore } from '../../context/StoreContext.jsx'
import { api } from '../../lib/api.js'
import { fmtDate, money, waDigits } from '../../lib/format.js'
import { ORDER_STATUSES, PAYMENT_STATUSES, allowedNext, statusInfo } from '../../lib/orderFlow.js'
import { waLink } from '../../lib/whatsapp.js'

const matches = (o, t) =>
  !t || `${o.order_number} ${o.customer_name} ${o.phone} ${o.alternative_phone || ''} ${o.customer_email || ''} ${o.county} ${o.town}`.toLowerCase().includes(t)

export default function Orders() {
  const { orders } = useAdmin()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') || ''
  const [q, setQ] = useState('')
  const [pay, setPay] = useState('')

  const counts = useMemo(() => Object.fromEntries(ORDER_STATUSES.map((s) => [s.key, orders.filter((o) => o.status === s.key).length])), [orders])
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return orders.filter((o) => (!status || o.status === status) && (!pay || o.payment_status === pay) && matches(o, t))
  }, [orders, status, q, pay])

  return (
    <>
      <PageHead title="Orders" sub="Confirm each order with the customer, track the payment, then move it through to completion." />
      <div className="tabs tabs-scroll" role="tablist">
        <button className={!status ? 'is-active' : ''} onClick={() => setParams({})}>All <span className="badge-n">{orders.length}</span></button>
        {ORDER_STATUSES.map((s) => (
          <button key={s.key} className={status === s.key ? 'is-active' : ''} onClick={() => setParams({ status: s.key })}>{s.short} <span className="badge-n">{counts[s.key]}</span></button>
        ))}
      </div>
      <div className="afilters">
        <div className="afilters-search"><Icon name="search" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order number (BH-000001), name, phone, email" aria-label="Search orders" /></div>
        <label className="select-wrap"><span className="sr-only">Payment</span>
          <select value={pay} onChange={(e) => setPay(e.target.value)}><option value="">Any payment</option>{PAYMENT_STATUSES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select><Icon name="down" size={16} /></label>
      </div>
      <Card>
        {rows.length === 0 ? (
          <p className="muted">{orders.length ? 'No orders match these filters.' : 'No orders yet. They will appear here as customers submit them.'}</p>
        ) : (
          <div className="tablewrap">
            <table className="table table-stack">
              <thead><tr><th>Order</th><th>Customer</th><th>Contact</th><th className="num">Total</th><th>Payment</th><th>Status</th><th>Updated</th><th /></tr></thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td data-label="Order"><Link to={`/admin/orders/${o.id}`}><b>{o.order_number}</b></Link><small className="block muted">{fmtDate(o.created_at, true)}</small></td>
                    <td data-label="Customer">{o.customer_name}<small className="block muted">{o.fulfilment_method === 'pickup' ? 'Pickup' : `${o.town}, ${o.county}`}</small></td>
                    <td data-label="Contact">{o.phone}<small className="block muted">{o.customer_email || 'No email'}</small></td>
                    <td data-label="Total" className="num">{money(o.total)}</td>
                    <td data-label="Payment"><PaymentPill status={o.payment_status} /></td>
                    <td data-label="Status"><OrderStatusPill status={o.status} /></td>
                    <td data-label="Updated"><small className="muted">{fmtDate(o.status_updated_at || o.updated_at || o.created_at, true)}</small></td>
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

const STEP_HELP = {
  confirmed: 'Tell the customer their order is confirmed.',
  payment_pending: 'Ask the customer to pay the deposit. They are notified.',
  processing: 'The deposit is received and you are preparing the order.',
  ready_for_pickup: 'The customer can collect the order.',
  waiting_for_delivery: 'The order is ready and waiting for delivery.',
  completed: 'The order was collected or delivered and all payments are done.',
}

export function OrderDetail({ id }) {
  const { can, canAny } = useAuth()
  const { orders, reload, run, cancelReasons, updateTemplates } = useAdmin()
  const { settings } = useStore()
  const navigate = useNavigate()
  const order = orders.find((o) => o.id === id)
  const [dialog, setDialog] = useState(null) // { kind: 'status'|'cancel'|'payment', value }
  const [text, setText] = useState('')           // 'Other - please specify' text, custom message, or payment note
  const [reasonCode, setReasonCode] = useState('')
  const [updateCode, setUpdateCode] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  if (!order)
    return (
      <>
        <PageHead title="Order not found" />
        <Link to="/admin/orders" className="btn btn-primary">Back to orders</Link>
      </>
    )

  const next = allowedNext(order)
  // buttons follow the permissions (the database enforces the same rules on the request itself)
  const forward = can('UPDATE_ORDER_STATUS') ? next.filter((s) => s !== 'cancelled') : []
  const canCancel = can('CANCEL_ORDERS') && next.includes('cancelled')
  const canMessage = canAny(['MANAGE_ORDERS', 'MANAGE_NOTIFICATIONS'])
  const canManage = can('MANAGE_ORDERS')
  const depositBlocked = (s) => s === 'processing' && order.payment_status !== 'confirmed' && order.deposit_amount > 0
  const close = () => { setDialog(null); setText(''); setReasonCode(''); setUpdateCode('') }
  const reason = (cancelReasons || []).find((r) => r.code === reasonCode)
  const cancelInvalid = dialog?.kind === 'cancel' && (!reason || (reason.requires_detail && text.trim().length < 3))
  const updateInvalid = dialog?.kind === 'update' && !updateCode && !text.trim()
  const wa = waDigits(order.whatsapp || order.phone)

  const apply = async () => {
    setBusy(true)
    let ok
    if (dialog.kind === 'payment') ok = await run(() => api.setPaymentStatus(order.id, dialog.value, text), 'Payment updated')
    else if (dialog.kind === 'update') ok = await run(() => api.sendOrderUpdate(order.id, { updateCode, message: text }), 'Update sent to the customer')
    else if (dialog.kind === 'cancel') ok = await run(() => api.setOrderStatus(order.id, 'cancelled', { reasonCode, reason: text }), 'Order cancelled. The customer can see the reason.')
    else ok = await run(() => api.setOrderStatus(order.id, dialog.value, { updateCode, message: text }), `Order marked ${statusInfo(dialog.value).label.toLowerCase()}`)
    setBusy(false)
    if (ok) { close(); reload() }
  }
  const addNote = async () => {
    if (await run(() => api.addOrderNote(order.id, note), 'Note added')) { setNote(''); reload() }
  }
  const del = async () => {
    if (!confirmDelete(`order ${order.order_number}`)) return
    if (await run(() => api.deleteOrder(order.id), 'Order deleted')) { await reload(); navigate('/admin/orders') }
  }
  const finished = ['completed', 'cancelled'].includes(order.status)

  return (
    <>
      <div className="admin-print-hide">
      <PageHead title={order.order_number} sub={`Placed ${fmtDate(order.created_at, true)} · last update ${fmtDate(order.status_updated_at || order.updated_at || order.created_at, true)}`}>
        <Link to="/admin/orders" className="btn btn-outline"><Icon name="left" size={16} /> All orders</Link>
        <button className="btn btn-outline" onClick={() => window.print()}><Icon name="print" size={16} /> Print</button>
      </PageHead>

      <div className="pillrow" style={{ marginBottom: 12 }}><OrderStatusPill status={order.status} /><PaymentPill status={order.payment_status} /><span className="chip">{order.fulfilment_method === 'pickup' ? 'Pickup' : 'Delivery'}</span></div>

      <Card title="Order progress" sub={finished ? 'This order is closed.' : 'Move the order to its next stage. The customer is notified each time.'}>
        <OrderTracker order={order} />
        {!finished && (
          <div className="stepbtns">
            {forward.map((s) => (
              <button key={s} className="btn btn-primary" disabled={depositBlocked(s)} title={depositBlocked(s) ? 'Mark the payment as confirmed first' : ''} onClick={() => setDialog({ kind: 'status', value: s })}>
                {s === 'completed' ? <Icon name="check" size={16} /> : null} Mark as {statusInfo(s).label.toLowerCase()}
              </button>
            ))}
            {canMessage && <button className="btn btn-outline" onClick={() => setDialog({ kind: 'update' })}><Icon name="mail" size={16} /> Send update</button>}
            {canCancel && <button className="btn btn-outline vcard-del" onClick={() => setDialog({ kind: 'cancel', value: 'cancelled' })}><Icon name="close" size={16} /> Cancel order</button>}
          </div>
        )}
        {!finished && forward.some(depositBlocked) && <p className="muted small">To start processing, first mark the deposit as received under Payment.</p>}
        {order.status === 'cancelled' && order.cancellation_reason && <p><b>Cancellation reason shown to the customer:</b> {order.cancellation_reason}</p>}
      </Card>

      <div className="aform2">
        <Card title="Payment" sub="Payments are handled manually for now. M-Pesa or another gateway can plug in here later.">
          <dl className="defs">
            <div><dt>Order total</dt><dd>{money(order.total)}</dd></div>
            <div><dt>Deposit ({order.deposit_percent}%)</dt><dd>{money(order.deposit_amount)}</dd></div>
            <div><dt>Balance</dt><dd>{money(order.balance_amount)}</dd></div>
            <div><dt>Payment status</dt><dd><PaymentPill status={order.payment_status} /></dd></div>
          </dl>
          {!['cancelled', 'completed'].includes(order.status) && (
            <div className="btnrow">
              {canManage && order.payment_status !== 'pending' && <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'payment', value: 'pending' })}>Mark payment pending</button>}
              {canManage && order.payment_status !== 'confirmed' && <button className="btn btn-sm btn-primary" onClick={() => setDialog({ kind: 'payment', value: 'confirmed' })}>Mark payment confirmed</button>}
              {canManage && order.payment_status !== 'unpaid' && <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'payment', value: 'unpaid' })}>Reset to not paid</button>}
            </div>
          )}
        </Card>

        <Card title="Customer" actions={<div className="btnrow">
          <a className="btn btn-sm btn-outline" href={`tel:${order.phone.replace(/\s/g, '')}`}><Icon name="phone" size={15} /> Call</a>
          {wa && <a className="btn btn-sm btn-wa" target="_blank" rel="noreferrer" href={waLink(wa, `Hello ${order.customer_name}, this is ${settings.business_name} about your order ${order.order_number}.`)}><WhatsAppIcon size={15} /> WhatsApp</a>}
          {order.customer_email && <a className="btn btn-sm btn-outline" href={`mailto:${order.customer_email}?subject=${encodeURIComponent(`Your order ${order.order_number}`)}`}><Icon name="mail" size={15} /> Email</a>}
        </div>}>
          <OrderContact order={order} />
          <p className="muted small">These are the details the customer gave for this order.</p>
        </Card>
      </div>

      <Card title="Ordered products">
        <div className="tablewrap">
          <table className="table table-stack">
            <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Total</th></tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id || i.variant_id}>
                  <td data-label="Product"><div className="sheetdoc-prod"><ProductImage src={i.image_url} alt="" /><span><b>{i.product_name}</b>{i.variant_label && i.variant_label !== 'Standard' && <small className="block muted">{i.variant_label}</small>}{i.sku && <small className="block muted">SKU {i.sku}</small>}</span></div></td>
                  <td data-label="Qty" className="num">{i.quantity}</td>
                  <td data-label="Unit price" className="num">{money(i.unit_price)}</td>
                  <td data-label="Total" className="num">{money(i.unit_price * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="num">Items subtotal</td><td className="num">{money(order.subtotal)}</td></tr>
              <tr><td colSpan={3} className="num">Delivery fee</td><td className="num">{order.delivery_fee ? money(order.delivery_fee) : 'Free'}</td></tr>
              <tr><td colSpan={3} className="num"><b>Total</b></td><td className="num"><b>{money(order.total)}</b></td></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Timeline and history" sub="Customer-visible updates and internal notes (marked Internal) in one list.">
        <OrderTimeline events={order.events} admin />
        {canManage && (
          <>
            <label className="field"><span>Add an internal note (the customer cannot see it)</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called customer, deposit via M-Pesa, delivery booked for Friday" />
            </label>
            <button className="btn btn-outline btn-sm" disabled={!note.trim()} onClick={addNote}>Add note</button>
          </>
        )}
      </Card>

      <Card title="Danger zone"><button className="btn btn-outline vcard-del" onClick={del}><Icon name="trash" size={16} /> Delete this order</button><p className="muted small">Deleting removes the order and its history for good. Cancel it instead if you want the customer to keep a record.</p></Card>

      {dialog && (
        <ConfirmDialog
          title={dialog.kind === 'cancel' ? `Cancel ${order.order_number}?` : dialog.kind === 'update' ? `Send an update to the customer` : dialog.kind === 'payment' ? `Mark payment ${dialog.value === 'unpaid' ? 'as not paid' : dialog.value}?` : `Mark ${order.order_number} as ${statusInfo(dialog.value).label.toLowerCase()}?`}
          confirmLabel={dialog.kind === 'cancel' ? 'Cancel order' : dialog.kind === 'update' ? 'Send update' : 'Confirm'}
          tone={dialog.kind === 'cancel' ? 'danger' : 'primary'}
          busy={busy}
          disabled={cancelInvalid || updateInvalid}
          onConfirm={apply}
          onClose={close}
        >
          {dialog.kind === 'status' && <p>{STEP_HELP[dialog.value]}</p>}
          {dialog.kind === 'cancel' && (
            <>
              <div className="notice notice-warn"><Icon name="alert" size={18} /> Choose a reason. The customer will see it in their order and notifications.</div>
              <label className="field"><span>Cancellation reason (required)</span>
                <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} autoFocus>
                  <option value="">Select reason</option>
                  {(cancelReasons || []).map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </label>
              {reason && (
                <label className="field"><span>{reason.requires_detail ? 'Please specify (required)' : 'Extra details (optional)'}</span>
                  <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
                </label>
              )}
              {reason?.requires_detail && text.trim().length > 0 && text.trim().length < 3 && <p className="field-error">Please write a little more.</p>}
            </>
          )}
          {(dialog.kind === 'status' || dialog.kind === 'update') && (
            <>
              <label className="field"><span>Order update{dialog.kind === 'status' ? ' (optional)' : ''}</span>
                <select value={updateCode} onChange={(e) => setUpdateCode(e.target.value)} autoFocus={dialog.kind === 'update'}>
                  <option value="">{dialog.kind === 'update' ? 'Select update' : 'No standard message'}</option>
                  {(updateTemplates || []).map((t) => <option key={t.code} value={t.code}>{t.message}</option>)}
                </select>
              </label>
              <label className="field"><span>Custom message (optional)</span>
                <textarea rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
            </>
          )}
          {dialog.kind === 'payment' && (
            <label className="field"><span>Reference or note (optional, e.g. M-Pesa code)</span>
              <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            </label>
          )}
        </ConfirmDialog>
      )}

      </div>
      <div className="print-sheet"><OrderSheet order={order} settings={settings} signatures /></div>
    </>
  )
}
