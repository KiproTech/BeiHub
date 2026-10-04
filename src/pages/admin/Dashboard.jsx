import { Link } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { Card, PageHead, StatusBadge } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { availability, fmtDate, money } from '../../lib/format.js'

export default function Dashboard() {
  const { orders, products, categories } = useAdmin()
  const today = new Date().toDateString()
  const active = orders.filter((o) => o.status !== 'cancelled')
  const pending = orders.filter((o) => o.status === 'pending')
  const awaitingDeposit = orders.filter((o) => ['pending', 'confirmed'].includes(o.status))
  const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today)
  const toDeliver = orders.filter((o) => ['deposit_paid', 'out_for_delivery'].includes(o.status))
  const lowRows = products.flatMap((p) => p.variants.map((v) => ({ p, v, a: availability(v) }))).filter((r) => r.v.availability !== 'on_order' && ['out', 'low'].includes(r.a.key))
  const revenue = orders.filter((o) => o.status === 'delivered').reduce((a, o) => a + o.total, 0)
  const published = products.filter((p) => p.is_active).length

  const stats = [
    { label: 'New orders', value: pending.length, note: 'waiting for you to confirm', to: '/admin/orders?status=pending', tone: pending.length ? 'warn' : '' },
    { label: 'Orders today', value: todays.length, note: `${active.length} active in total`, to: '/admin/orders' },
    { label: 'Deposits to collect', value: money(awaitingDeposit.reduce((a, o) => a + o.deposit_amount, 0)), note: `${awaitingDeposit.length} orders`, to: '/admin/orders' },
    { label: 'To deliver', value: toDeliver.length, note: 'deposit received', to: '/admin/orders?status=deposit_paid' },
    { label: 'Delivered value', value: money(revenue), note: 'completed orders', to: '/admin/orders?status=delivered' },
    { label: 'Products live', value: published, note: `${products.length - published} hidden, ${categories.length} categories`, to: '/admin/products' },
  ]

  return (
    <>
      <PageHead title="Dashboard" sub="What needs your attention today.">
        <Link to="/admin/products/new" className="btn btn-primary"><Icon name="plus" size={18} /> Add product</Link>
        <Link to="/admin/products?tab=prices" className="btn btn-outline"><Icon name="tag" size={18} /> Update prices</Link>
      </PageHead>

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
