import { useCallback, useEffect, useState } from 'react'
import { Link } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { OrderStatusPill, PaymentPill } from '../../components/OrderParts.jsx'
import { ConfirmDialog, Modal, Spinner } from '../../components/ui.jsx'
import { Card, Field, PageHead } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'
import { fmtDate, money } from '../../lib/format.js'
import { useLiveRefresh } from '../../lib/realtime.js'

// Customers: list, search, filter, account status and full order history.
// Reading uses database functions that check MANAGE_CUSTOMERS; nothing here is trusted on its own.
const PAGE = 25
const FILTERS = [['all', 'All customers'], ['active', 'Active'], ['suspended', 'Suspended'], ['verified', 'Email verified'], ['unverified', 'Email not verified'], ['has_orders', 'Has orders'], ['no_orders', 'No orders']]
const when = (v) => (v ? fmtDate(v) : 'Never')

export default function Customers() {
  const { run } = useAdmin()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { const t = setTimeout(() => { setSearch(q.trim()); setPage(0) }, 300); return () => clearTimeout(t) }, [q])
  const load = useCallback(async () => {
    try {
      setRows(await api.listCustomers({ search, filter, limit: PAGE, offset: page * PAGE }))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [search, filter, page])
  useEffect(() => { load() }, [load])
  useLiveRefresh([{ table: 'orders' }, { table: 'profiles' }], load)

  const total = rows?.[0] ? Number(rows[0].total_rows) : 0
  const act = async (fn, ok) => {
    setBusy(true)
    const r = await run(fn, ok)
    setBusy(false)
    if (r) { setDialog(null); load() }
  }

  return (
    <>
      <PageHead title="Customers" sub="Registered customers, their account status and what they have ordered." />
      <div className="afilters">
        <label className="afilters-search"><Icon name="search" size={18} /><input type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="select-wrap"><select value={filter} aria-label="Filter customers" onChange={(e) => { setFilter(e.target.value); setPage(0) }}>{FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>

      {error ? <div className="notice notice-bad" role="alert">{error}</div> : !rows ? <Spinner label="Loading customers" /> : (
        <Card>
          {!rows.length ? <p className="muted">No customers match.</p> : (
            <div className="table-scroll">
              <table className="table table-stack">
                <thead><tr><th>Customer</th><th>Contact</th><th>Status</th><th>Registered</th><th>Last login</th><th className="num">Orders</th><th className="num">Total</th><th>Last order</th><th>Actions</th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td data-label="Customer"><b>{c.full_name || '(no name)'}</b></td>
                      <td data-label="Contact">{c.email}<br /><span className="muted small">{c.phone || 'no phone'}</span></td>
                      <td data-label="Status">
                        <span className={`pill pill-${c.is_suspended ? 'bad' : 'good'}`}>{c.is_suspended ? 'Suspended' : 'Active'}</span>{' '}
                        <span className={`pill pill-${c.email_verified ? 'good' : 'warn'}`}>{c.email_verified ? 'Verified' : 'Not verified'}</span>
                      </td>
                      <td data-label="Registered">{when(c.created_at)}</td>
                      <td data-label="Last login">{when(c.last_login_at)}</td>
                      <td data-label="Orders" className="num">{c.order_count}</td>
                      <td data-label="Total" className="num">{money(Number(c.total_value))}</td>
                      <td data-label="Last order">{c.last_order_at ? when(c.last_order_at) : '-'}</td>
                      <td data-label="Actions">
                        <div className="admin-actions">
                          <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'orders', c })}>Orders</button>
                          {c.is_suspended
                            ? <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'reactivate', c })}>Reactivate</button>
                            : <button className="btn btn-sm btn-outline" onClick={() => setDialog({ kind: 'suspend', c, reason: '' })}>Suspend</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > PAGE && (
            <div className="pager">
              <button className="btn btn-sm btn-outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="muted small">{page * PAGE + 1}-{Math.min(total, (page + 1) * PAGE)} of {total}</span>
              <button className="btn btn-sm btn-outline" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </Card>
      )}

      {dialog?.kind === 'orders' && <CustomerOrders c={dialog.c} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'suspend' && (
        <ConfirmDialog title={`Suspend ${dialog.c.full_name || dialog.c.email}?`} confirmLabel="Suspend account" tone="danger" busy={busy} disabled={dialog.reason.trim().length < 3} onClose={() => setDialog(null)}
          onConfirm={() => act(() => api.setCustomerSuspended(dialog.c.id, true, dialog.reason), 'Customer suspended')}>
          <p>They can still sign in but cannot place new orders. Their existing orders stay as they are.</p>
          <Field label="Reason (required)"><input value={dialog.reason} maxLength={200} autoFocus onChange={(e) => setDialog({ ...dialog, reason: e.target.value })} /></Field>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'reactivate' && (
        <ConfirmDialog title={`Reactivate ${dialog.c.full_name || dialog.c.email}?`} confirmLabel="Reactivate" busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => act(() => api.setCustomerSuspended(dialog.c.id, false), 'Customer reactivated')}>
          <p>They can place orders again.</p>
        </ConfirmDialog>
      )}
    </>
  )
}

function CustomerOrders({ c, onClose }) {
  const [orders, setOrders] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.listCustomerOrders(c.id).then(setOrders).catch((e) => setErr(e.message)) }, [c.id])
  return (
    <Modal wide title={c.full_name || c.email} onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Close</button>}>
      <dl className="kv">
        <div><dt>Email</dt><dd>{c.email} {c.email_verified ? '(verified)' : '(not verified)'}</dd></div>
        <div><dt>Phone</dt><dd>{c.phone || '-'}</dd></div>
        <div><dt>Account</dt><dd>{c.is_suspended ? `Suspended${c.suspended_reason ? `: ${c.suspended_reason}` : ''}` : 'Active'}</dd></div>
        <div><dt>Registered</dt><dd>{when(c.created_at)}</dd></div>
        <div><dt>Orders</dt><dd>{c.order_count} · {money(Number(c.total_value))} (excluding cancelled)</dd></div>
      </dl>
      <h3>Order history</h3>
      {err ? <div className="notice notice-bad">{err}</div> : !orders ? <Spinner /> : !orders.length ? <p className="muted">This customer has not ordered yet.</p> : (
        <ul className="rowlist">
          {orders.map((o) => (
            <li key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="admin-actions" style={{ justifyContent: 'space-between' }}>
                <Link to={`/admin/orders/${o.id}`} onClick={onClose}><b>{o.order_number}</b></Link>
                <span><OrderStatusPill status={o.status} /> <PaymentPill status={o.payment_status} /></span>
              </div>
              <div>{o.items.map((i) => `${i.product_name}${i.variant_label ? ` (${i.variant_label})` : ''} × ${i.quantity}`).join(', ')}</div>
              <div className="muted small">{money(o.total)} · {when(o.created_at)}{o.status === 'cancelled' && o.cancellation_reason ? ` · Cancelled: ${o.cancellation_reason}` : ''}</div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Open an order to see its items, the contact details saved with it, the timeline and admin updates.</p>
    </Modal>
  )
}
