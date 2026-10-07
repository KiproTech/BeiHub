import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icons.jsx'
import { Spinner, ErrorBox } from '../../components/ui.jsx'
import { Card, PageHead } from './parts.jsx'
import { api } from '../../lib/api.js'
import { friendlyError } from '../../lib/errors.js'
import { fmtDate } from '../../lib/format.js'

const LABELS = {
  'product.price_changed': 'Changed product price', 'product.created': 'Added product', 'product.deleted': 'Deleted product', 'product.updated': 'Edited product',
  'product.status_changed': 'Changed product status', 'variant.deleted': 'Deleted product variant',
  'image.uploaded': 'Uploaded image', 'image.replaced': 'Replaced image', 'image.deleted': 'Deleted image', 'image.primary_changed': 'Changed primary image',
  'order.cancelled': 'Cancelled order', 'order.status_changed': 'Changed order status', 'order.payment_updated': 'Updated order payment', 'order.deleted': 'Deleted order',
  'order.update_sent': 'Sent order update to customer',
  'settings.contact_changed': 'Changed contact information', 'settings.changed': 'Changed settings', 'category.deleted': 'Deleted category',
  'user.role_changed': 'Changed user role', 'user.suspended': 'Suspended user', 'user.restored': 'Restored user',
}
const label = (a) => LABELS[a] || a.replace(/[._]/g, ' ')
const show = (v) => (v == null ? 'empty' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function Changes({ a }) {
  const keys = [...new Set([...Object.keys(a.old_values || {}), ...Object.keys(a.new_values || {})])]
  if (!keys.length) return <span className="muted">-</span>
  return (
    <div className="audit-vals">
      {keys.map((k) => (
        <div key={k}><b>{k.replace(/_/g, ' ')}:</b> {a.old_values && k in a.old_values && <span className="old">{show(a.old_values[k])}</span>} {a.new_values && k in a.new_values && <>{a.old_values && k in a.old_values ? '→ ' : ''}<span className="new">{show(a.new_values[k])}</span></>}</div>
      ))}
    </div>
  )
}

export default function Audit() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const load = useCallback(async () => {
    setError('')
    try { setRows(await api.listAudit()) } catch (e) { setError(friendlyError(e)); setRows((r) => r || []) }
  }, [])
  useEffect(() => { load() }, [load])
  const types = useMemo(() => [...new Set((rows || []).map((r) => r.entity_type))].sort(), [rows])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (rows || []).filter((r) => (!type || r.entity_type === type) && (!t || `${label(r.action)} ${r.action} ${r.entity_label || ''} ${r.actor_email || ''}`.toLowerCase().includes(t)))
  }, [rows, q, type])

  return (
    <>
      <PageHead title="Audit log" sub="A record of important changes: who did what, when, and the old and new values.">
        <button className="btn btn-outline" onClick={load}><Icon name="history" size={16} /> Refresh</button>
      </PageHead>
      <div className="afilters">
        <div className="afilters-search"><Icon name="search" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, record or person" aria-label="Search audit log" /></div>
        <label className="select-wrap"><span className="sr-only">Record type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All record types</option>{types.map((t) => <option key={t}>{t}</option>)}</select><Icon name="down" size={16} />
        </label>
      </div>
      {error && <ErrorBox onRetry={load}>{error}</ErrorBox>}
      <Card>
        {rows === null ? <Spinner /> : shown.length === 0 ? <p className="muted">{rows.length ? 'Nothing matches your search.' : 'Nothing recorded yet. Important admin actions will appear here.'}</p> : (
          <div className="tablewrap">
            <table className="table table-stack">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Changes</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td data-label="When"><small>{fmtDate(r.created_at, true)}</small></td>
                    <td data-label="Who">{r.actor_email || 'System'}<small className="block muted">{r.actor_role}</small></td>
                    <td data-label="Action"><b>{label(r.action)}</b></td>
                    <td data-label="Record">{r.entity_label || r.entity_id}<small className="block muted">{r.entity_type}</small></td>
                    <td data-label="Changes"><Changes a={r} /></td>
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
