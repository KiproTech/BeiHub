import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from '../lib/router.jsx'
import { Icon } from '../components/Icons.jsx'
import { ConfirmDialog, ErrorBox, ProductImage, Spinner, Empty } from '../components/ui.jsx'
import { LoginPrompt, VerifyBanner } from '../components/AuthParts.jsx'
import { OrderContact, OrderStatusPill, OrderTimeline, OrderTracker, PaymentPill, TotalsBox } from '../components/OrderParts.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { api } from '../lib/api.js'
import { friendlyError } from '../lib/errors.js'
import { fmtDate, money } from '../lib/format.js'
import { canCustomerCancel, CONTACT_METHODS, statusInfo } from '../lib/orderFlow.js'
import { useLiveRefresh } from '../lib/realtime.js'

function AccountNav() {
  const { pathname } = useLocation()
  const { unread } = useNotifications()
  const tab = (to, label, match, badge) => (
    <Link to={to} className={`subnav-link ${match ? 'is-active' : ''}`}>{label}{badge > 0 && <span className="badge-n">{badge}</span>}</Link>
  )
  return (
    <nav className="subnav" aria-label="My account">
      {tab('/account/orders', 'My orders', pathname.startsWith('/account/orders') || pathname === '/account')}
      {tab('/account/notifications', 'Notifications', pathname === '/account/notifications', unread)}
      {tab('/account/profile', 'Profile', pathname === '/account/profile')}
    </nav>
  )
}

function Gate({ children }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <Spinner label="Loading your account" />
  if (!user) return <LoginPrompt next={pathname}>Log in to see your orders, track their progress and read updates from our team.</LoginPrompt>
  return (
    <div className="wrap section account">
      <VerifyBanner />
      <AccountNav />
      {children}
    </div>
  )
}

function useMyOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    try {
      setOrders(await api.listMyOrders())
    } catch (e) {
      setError(friendlyError(e))
      setOrders((o) => o || [])
    }
  }, [])
  useEffect(() => {
    if (user) load()
  }, [user, load])
  // the admin changed one of my orders (any device)? -> read it again from Supabase
  useLiveRefresh(user ? [{ table: 'orders', filter: `user_id=eq.${user.id}` }, { table: 'order_events' }] : [], load, { enabled: !!user })
  return { orders, error, reload: load }
}

const itemsSummary = (o) => {
  const names = o.items.slice(0, 2).map((i) => `${i.product_name}${i.variant_label && i.variant_label !== 'Standard' ? ` (${i.variant_label})` : ''} x${i.quantity}`)
  return names.join(', ') + (o.items.length > 2 ? ` +${o.items.length - 2} more` : '')
}

export function MyOrders() {
  return (
    <Gate>
      <MyOrdersInner />
    </Gate>
  )
}

function MyOrdersInner() {
  const { orders, error, reload } = useMyOrders()
  const [filter, setFilter] = useState('all')
  const shown = useMemo(() => {
    if (!orders) return []
    if (filter === 'active') return orders.filter((o) => !['completed', 'cancelled'].includes(o.status))
    if (filter === 'done') return orders.filter((o) => ['completed', 'cancelled'].includes(o.status))
    return orders
  }, [orders, filter])

  return (
    <>
      <div className="sec-head">
        <h1>My orders</h1>
        <label className="select-wrap">
          <span className="sr-only">Show</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All orders</option>
            <option value="active">In progress</option>
            <option value="done">Completed or cancelled</option>
          </select>
          <Icon name="down" size={16} />
        </label>
      </div>
      {error && <ErrorBox onRetry={reload}>{error}</ErrorBox>}
      {orders === null ? (
        <Spinner label="Loading your orders" />
      ) : shown.length === 0 ? (
        <Empty title={orders.length ? 'No orders in this view' : 'You have no orders yet'} action={<Link to="/products" className="btn btn-primary">Browse products</Link>}>
          {orders.length ? 'Try another filter.' : 'When you place an order it will appear here so you can follow its progress.'}
        </Empty>
      ) : (
        <ul className="ordercards">
          {shown.map((o) => (
            <li key={o.id}>
              <Link to={`/account/orders/${o.id}`} className="ordercard">
                <div className="ordercard-top">
                  <b className="orderno">{o.order_number}</b>
                  <OrderStatusPill status={o.status} />
                </div>
                <p className="ordercard-items">{itemsSummary(o)}</p>
                <div className="ordercard-meta">
                  <span>Placed {fmtDate(o.created_at, true)}</span>
                  <span>Updated {fmtDate(o.status_updated_at || o.updated_at || o.created_at, true)}</span>
                  <b>{money(o.total)}</b>
                </div>
                {o.status === 'cancelled' && o.cancellation_reason && <p className="ordercard-reason">Reason: {o.cancellation_reason}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function OrderDetail({ id }) {
  return (
    <Gate>
      <OrderDetailInner id={id} />
    </Gate>
  )
}

function OrderDetailInner({ id }) {
  const { orders, error, reload } = useMyOrders()
  const { settings } = useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const order = orders?.find((o) => o.id === id)

  const cancel = async () => {
    setBusy(true)
    try {
      await api.cancelMyOrder(order.id, reason)
      toast.success('Your order was cancelled.')
      setCancelling(false)
      reload()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  if (error && !orders?.length) return <ErrorBox onRetry={reload}>{error}</ErrorBox>
  if (orders === null) return <Spinner label="Loading order" />
  if (!order)
    return (
      <Empty title="Order not found" action={<button className="btn btn-primary" onClick={() => navigate('/account/orders')}>Back to my orders</button>}>
        This order does not exist or belongs to another account.
      </Empty>
    )

  const st = statusInfo(order.status)
  const totals = { subtotal: order.subtotal, deliveryFee: order.delivery_fee, total: order.total, deposit: order.deposit_amount, balance: order.balance_amount }
  return (
    <>
      <Link to="/account/orders" className="back-link"><Icon name="left" size={16} /> All orders</Link>
      <div className="sec-head">
        <div>
          <h1 className="orderno-h">{order.order_number}</h1>
          <p className="muted small">Placed {fmtDate(order.created_at, true)} | Last update {fmtDate(order.status_updated_at || order.updated_at || order.created_at, true)}</p>
        </div>
        <div className="pillrow"><OrderStatusPill status={order.status} /><PaymentPill status={order.payment_status} /></div>
      </div>

      <section className="card">
        <OrderTracker order={order} />
        {order.status !== 'cancelled' && <p className="statushelp"><b>{st.label}:</b> {st.customer}</p>}
        {order.status === 'payment_pending' && (
          <div className="notice notice-warn">
            <Icon name="wallet" size={18} />
            <span>A payment of up to <b>{order.deposit_percent}%</b> (about <b>{money(order.deposit_amount)}</b>) is needed. Our team will contact you on <b>{order.phone}</b>{order.customer_email ? <> / <b>{order.customer_email}</b></> : null} with the payment instructions. Please do not pay anyone else.</span>
          </div>
        )}
        {order.status === 'pending' && (
          <div className="btnrow"><button className="btn btn-outline btn-sm" onClick={() => setCancelling(true)}>Cancel this order</button></div>
        )}
        {!canCustomerCancel(order) && !['completed', 'cancelled'].includes(order.status) && (
          <p className="muted small">Need to change or cancel this order? Contact us{settings.phone ? <> on <a href={`tel:${settings.phone.replace(/\s/g, '')}`}>{settings.phone}</a></> : null}.</p>
        )}
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Products</h2>
          <ul className="minilines">
            {order.items.map((i) => (
              <li key={i.id || i.variant_id}>
                <ProductImage src={i.image_url} alt="" />
                <div>
                  <b>{i.product_name}</b>
                  {i.variant_label && i.variant_label !== 'Standard' && <small className="muted block">{i.variant_label}</small>}
                  <small className="muted block">{money(i.unit_price)} x {i.quantity}</small>
                </div>
                <b>{money(i.unit_price * i.quantity)}</b>
              </li>
            ))}
          </ul>
          <TotalsBox totals={totals} settings={{ deposit_percent: order.deposit_percent }} deliveryLabel={order.fulfilment_method === 'pickup' ? 'pickup' : undefined} />
        </section>
        <section className="card">
          <h2>Contact details on this order</h2>
          <OrderContact order={order} />
          <p className="muted small">These details were saved with the order. Changing your profile later does not change them.</p>
        </section>
      </div>

      <section className="card">
        <h2>Order timeline</h2>
        <OrderTimeline events={order.events} />
      </section>

      {cancelling && (
        <ConfirmDialog title="Cancel this order?" confirmLabel="Yes, cancel order" tone="danger" busy={busy} onConfirm={cancel} onClose={() => setCancelling(false)}>
          <p>Order <b>{order.order_number}</b> will be cancelled. You can only do this while it is still pending.</p>
          <label className="field"><span>Reason (optional)</span><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us why, if you like" /></label>
        </ConfirmDialog>
      )}
    </>
  )
}

export function NotificationsPage() {
  return (
    <Gate>
      <NotificationsInner />
    </Gate>
  )
}

function NotificationsInner() {
  const { items, unread, loaded, error, reload, markRead } = useNotifications()
  const navigate = useNavigate()
  const open = (n) => {
    if (!n.is_read) markRead([n.id])
    if (n.order_id) navigate(`/account/orders/${n.order_id}`)
  }
  return (
    <>
      <div className="sec-head">
        <h1>Notifications</h1>
        {unread > 0 && <button className="btn btn-outline btn-sm" onClick={() => markRead()}>Mark all as read</button>}
      </div>
      {error && <ErrorBox onRetry={reload}>{error}</ErrorBox>}
      {!loaded ? (
        <Spinner label="Loading notifications" />
      ) : items.length === 0 ? (
        <Empty title="No notifications yet">Updates about your orders will appear here.</Empty>
      ) : (
        <ul className="notifs">
          {items.map((n) => (
            <li key={n.id}>
              <button className={`notif ${n.is_read ? '' : 'is-unread'}`} onClick={() => open(n)}>
                <span className="notif-dot" aria-hidden="true" />
                <span className="notif-body">
                  <b>{n.title}</b>
                  <span>{n.message}</span>
                  <time dateTime={n.created_at}>{fmtDate(n.created_at, true)}</time>
                </span>
                {n.order_id && <Icon name="right" size={18} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function ProfilePage() {
  return (
    <Gate>
      <ProfileInner />
    </Gate>
  )
}

function ProfileInner() {
  const { user, updateProfile, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState({ full_name: user.full_name, phone: user.phone, alternative_phone: user.alternative_phone, preferred_contact: user.preferred_contact })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updateProfile(f)
      toast.success('Profile saved.')
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <h1>Profile</h1>
      <form className="card stack" onSubmit={save}>
        <div className="defs"><div><dt>Email</dt><dd>{user.email} {user.email_verified ? <span className="pill pill-good">Verified</span> : <span className="pill pill-warn">Not verified</span>}</dd></div></div>
        <label className="field"><span>Full name</span><input required value={f.full_name} onChange={set('full_name')} /></label>
        <div className="row2">
          <label className="field"><span>Phone number</span><input type="tel" value={f.phone} onChange={set('phone')} /></label>
          <label className="field"><span>Alternative phone (optional)</span><input type="tel" value={f.alternative_phone} onChange={set('alternative_phone')} /></label>
        </div>
        <label className="field"><span>Preferred contact method</span>
          <select value={f.preferred_contact} onChange={set('preferred_contact')}>{CONTACT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select>
        </label>
        <p className="muted small">These details pre-fill your next order. Orders you already placed keep the details you gave at the time.</p>
        <div className="btnrow">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button>
          <Link to="/forgot-password" className="btn btn-outline">Change password</Link>
          <button type="button" className="btn btn-outline" onClick={async () => { await signOut(); navigate('/') }}>Log out</button>
        </div>
      </form>
    </>
  )
}
