import { useMemo, useState } from 'react'
import { Link } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { Card, PageHead, StatusBadge } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { fmtDate, money, waDigits } from '../../lib/format.js'

// Customers are built from orders (grouped by phone number).
export default function Customers() {
  const { orders } = useAdmin()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)

  const customers = useMemo(() => {
    const map = new Map()
    for (const o of orders) {
      const key = waDigits(o.phone) || o.phone
      const c = map.get(key) || { key, name: o.customer_name, phone: o.phone, county: o.county, town: o.town, orders: [], value: 0, last: o.created_at }
      c.orders.push(o)
      if (o.status !== 'cancelled') c.value += o.total
      if (new Date(o.created_at) > new Date(c.last)) Object.assign(c, { last: o.created_at, name: o.customer_name, county: o.county, town: o.town })
      map.set(key, c)
    }
    return [...map.values()].sort((a, b) => new Date(b.last) - new Date(a.last))
  }, [orders])

  const t = q.trim().toLowerCase()
  const rows = customers.filter((c) => !t || `${c.name} ${c.phone} ${c.county} ${c.town}`.toLowerCase().includes(t))

  return (
    <>
      <PageHead title="Customers" sub="Everyone who has ordered, grouped by phone number." />
      <div className="afilters"><div className="afilters-search"><Icon name="search" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or county" aria-label="Search customers" /></div></div>
      <Card>
        {rows.length === 0 ? (
          <p className="muted">No customers yet. They appear here after their first order.</p>
        ) : (
          <ul className="rowlist">
            {rows.map((c) => (
              <li key={c.key} className="custrow">
                <button className="custrow-head" onClick={() => setOpen(open === c.key ? null : c.key)} aria-expanded={open === c.key}>
                  <span className="custrow-avatar">{c.name.slice(0, 1).toUpperCase()}</span>
                  <span className="custrow-main"><b>{c.name}</b><small className="muted">{c.phone} | {c.town}, {c.county}</small></span>
                  <span className="custrow-stat"><b>{c.orders.length}</b><small className="muted">order{c.orders.length === 1 ? '' : 's'}</small></span>
                  <span className="custrow-stat"><b>{money(c.value)}</b><small className="muted">last {fmtDate(c.last)}</small></span>
                  <Icon name={open === c.key ? 'up' : 'down'} size={18} />
                </button>
                {open === c.key && (
                  <ul className="custrow-orders">
                    {c.orders.map((o) => (
                      <li key={o.id}>
                        <Link to={`/admin/orders/${o.id}`}><b>{o.order_number}</b></Link>
                        <span className="muted">{fmtDate(o.created_at)}</span>
                        <span>{money(o.total)}</span>
                        <StatusBadge status={o.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
