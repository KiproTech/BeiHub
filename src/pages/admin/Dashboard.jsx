import { Link } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { useEffect, useState } from 'react'
import { Card, PageHead, StatusBadge } from './parts.jsx'
import { api } from '../../lib/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useLiveRefresh } from '../../lib/realtime.js'
import { useAdmin } from './AdminContext.jsx'
import { availability, fmtDate, money } from '../../lib/format.js'

// Figures computed by the database. Each block is only sent to people who hold the matching permission.
function Overview() {
  const { isSuperAdmin } = useAuth()
  const [s, setS] = useState(null)
  const load = () => api.dashboardStats().then(setS).catch(() => setS({}))
  useEffect(() => { load() }, [])
  useLiveRefresh([{ table: 'orders' }, { table: 'profiles' }], load)
  if (!s) return null
  const tiles = [
    s.customers && ['Total customers', s.customers.total],
    s.admins && ['Total admins', s.admins.total],
    s.admins && ['Active admins', s.admins.active],
    s.admins && ['Pending invitations', s.pending_invitations],
    s.orders && ['Total orders', s.orders.total],
    s.orders && ['Pending orders', s.orders.pending],
    s.orders && ['Completed orders', s.orders.completed],
    s.orders && ['Cancelled orders', s.orders.cancelled],
    s.stock_alerts && ['Out of stock', s.stock_alerts.out_of_stock],
    s.stock_alerts && ['Low stock', s.stock_alerts.low_stock],
  ].filter(Boolean)
  if (!tiles.length) return null
  const list = (title, rows, render) => rows?.length ? <Card title={title}><ul className="rowlist">{rows.map(render)}</ul></Card> : null
  return (
    <>
      <h2 className="muted" style={{ fontSize: '1rem', margin: '4px 0 8px' }}>{isSuperAdmin ? 'Super Admin overview' : 'Overview'}</h2>
      <div className="stat-grid">{tiles.map(([l, v]) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>)}</div>
      <div className="grid-2">
        {list('Recent customers', s.recent_customers, (c) => <li key={c.id}><b>{c.full_name || '(no name)'}</b> <span className="muted small">{fmtDate(c.created_at)}</span></li>)}
        {list('Recent admin activity', s.recent_activity, (a, i) => <li key={i}><b>{a.description || a.action}</b><br /><span className="muted small">{a.actor_email} · {fmtDate(a.created_at)}</span></li>)}
        {list('Recent cancellations', s.recent_cancellations, (o) => <li key={o.id}><b>{o.order_number}</b> <span className="muted small">{o.cancellation_reason || ''}</span></li>)}
        {list('Recently updated products', s.recent_products, (p) => <li key={p.id}><b>{p.name}</b> <span className="muted small">{fmtDate(p.updated_at)}</span></li>)}
      </div>
    </>
  )
}

export default function Dashboard() {
  const { orders, products, categories } = useAdmin()
  const { can } = useAuth()
  const today = new Date().toDateString()
  const active = orders.filter((o) => o.status !== 'cancelled')
  const pending = orders.filter((o) => o.status === 'pending')
  const awaitingDeposit = orders.filter((o) => ['pending', 'confirmed', 'payment_pending'].includes(o.status))
  const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today)
  const toDeliver = orders.filter((o) => ['processing', 'ready_for_pickup', 'waiting_for_delivery'].includes(o.status))
  const lowRows = products.flatMap((p) => p.variants.map((v) => ({ p, v, a: availability(v) }))).filter((r) => r.v.availability !== 'on_order' && ['out', 'low'].includes(r.a.key))
  const revenue = orders.filter((o) => o.status === 'completed').reduce((a, o) => a + o.total, 0)
  const published = products.filter((p) => p.is_active).length

  const stats = [
    { label: 'New orders', value: pending.length, note: 'waiting for you to confirm', to: '/admin/orders?status=pending', tone: pending.length ? 'warn' : '' },
    { label: 'Orders today', value: todays.length, note: `${active.length} active in total`, to: '/admin/orders' },
    { label: 'Deposits to collect', value: money(awaitingDeposit.reduce((a, o) => a + o.deposit_amount, 0)), note: `${awaitingDeposit.length} orders`, to: '/admin/orders' },
    { label: 'In progress', value: toDeliver.length, note: 'being prepared or delivered', to: '/admin/orders?status=processing' },
    { label: 'Completed value', value: money(revenue), note: 'completed orders', to: '/admin/orders?status=completed' },
    { label: 'Products live', value: published, note: `${products.length - published} hidden, ${categories.length} categories`, to: '/admin/products' },
  ]

  return (
    <>
      <PageHead title="Dashboard" sub="What needs your attention today.">
        {can('MANAGE_PRODUCTS') && <Link to="/admin/products/new" className="btn btn-primary"><Icon name="plus" size={18} /> Add product</Link>}
        {can('MANAGE_PRODUCT_PRICES') && <Link to="/admin/products?tab=prices" className="btn btn-outline"><Icon name="tag" size={18} /> Update prices</Link>}
      </PageHead>
      <Overview />

      <div className="stats">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className={`stat ${s.tone ? 'stat-' + s.tone : ''}`}>
            <span className="stat-l">{s.label}</span>
            <b className="stat-v">{s.value}</b>
            <span className="stat-n">{s.note}</span>
          </Link>
        ))}
      </div>

      <div className="agrid">
        <Card title="Recent orders" actions={<Link to="/admin/orders" className="sec-link">All orders</Link>}>
          {orders.length === 0 ? (
            <p className="muted">No orders yet. They will appear here as customers submit them.</p>
          ) : (
            <div className="tablewrap">
              <table className="table table-stack">
                <thead><tr><th>Order</th><th>Customer</th><th className="num">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {orders.slice(0, 6).map((o) => (
                    <tr key={o.id}>
                      <td data-label="Order"><Link to={`/admin/orders/${o.id}`}><b>{o.order_number}</b></Link><small className="block muted">{fmtDate(o.created_at, true)}</small></td>
                      <td data-label="Customer">{o.customer_name}<small className="block muted">{o.town}, {o.county}</small></td>
                      <td data-label="Total" className="num">{money(o.total)}</td>
                      <td data-label="Status"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Stock alerts" sub="Out of stock or running low." actions={<Link to="/admin/products?tab=prices" className="sec-link">Manage stock</Link>}>
          {lowRows.length === 0 ? (
            <p className="muted">All products are well stocked.</p>
          ) : (
            <ul className="alertlist">
              {lowRows.slice(0, 8).map(({ p, v, a }) => (
                <li key={v.id}>
                  <Link to={`/admin/products/${p.id}`}>{p.name} <span className="muted">- {v.label}</span></Link>
                  <span className={`pill pill-${a.tone}`}>{a.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
