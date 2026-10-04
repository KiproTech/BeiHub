import { useState } from 'react'
import { Icon } from '../../components/Icons.jsx'
import { Modal } from '../../components/ui.jsx'
import { Card, Field, PageHead, Toggle, confirmDelete } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'
import { COUNTIES } from '../../data/counties.js'
import { money } from '../../lib/format.js'

const MODES = [
  { key: 'free', title: 'Free delivery', text: 'No delivery fee on any order.' },
  { key: 'fixed', title: 'Fixed fee', text: 'The same fee for every order.' },
  { key: 'county', title: 'By county', text: 'A fee for each county. Other counties use the default fee.' },
  { key: 'town', title: 'By town', text: 'A fee for specific towns, falling back to the county fee, then the default fee.' },
]

function LocationForm({ loc, onClose }) {
  const { reload, run } = useAdmin()
  const [f, setF] = useState({ county: 'Nairobi', town: '', fee: '', eta: '', is_active: true, ...loc })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const save = async () => {
    if (f.fee === '' || !(Number(f.fee) >= 0)) return run(async () => { throw new Error('Enter a delivery fee (0 for free).') })
    setBusy(true)
    const ok = await run(() => api.saveLocation({ ...f, fee: Number(f.fee), town: f.town?.trim() || null }), 'Delivery fee saved')
    setBusy(false)
    if (ok) { await reload(); onClose() }
  }
  return (
    <Modal title={loc?.id ? 'Edit delivery fee' : 'Add delivery fee'} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>Save</button></>}>
      <Field label="County"><select value={f.county} onChange={(e) => set('county', e.target.value)}>{COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Town (optional)" hint="Leave empty for a county-wide fee."><input value={f.town || ''} onChange={(e) => set('town', e.target.value)} placeholder="e.g. Thika" /></Field>
      <Field label="Delivery fee (KSh)"><input type="number" inputMode="decimal" min="0" step="any" value={f.fee} onChange={(e) => set('fee', e.target.value)} /></Field>
      <Field label="Delivery time (optional)"><input value={f.eta || ''} onChange={(e) => set('eta', e.target.value)} placeholder="e.g. 2-3 days" /></Field>
      <Toggle checked={f.is_active} onChange={(v) => set('is_active', v)} label="Active" />
    </Modal>
  )
}

export default function Delivery() {
  const { settings, locations, reload, run } = useAdmin()
  const [s, setS] = useState({
    delivery_mode: settings.delivery_mode || 'county',
    fixed_delivery_fee: String(settings.fixed_delivery_fee ?? 0),
    default_delivery_fee: String(settings.default_delivery_fee ?? 0),
    free_delivery_threshold: settings.free_delivery_threshold == null ? '' : String(settings.free_delivery_threshold),
  })
  const [editing, setEditing] = useState(null)
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }))
  const usesTable = s.delivery_mode === 'county' || s.delivery_mode === 'town'

  const save = async () => {
    const payload = {
      ...settings,
      delivery_mode: s.delivery_mode,
      fixed_delivery_fee: Number(s.fixed_delivery_fee) || 0,
      default_delivery_fee: Number(s.default_delivery_fee) || 0,
      free_delivery_threshold: s.free_delivery_threshold === '' ? null : Number(s.free_delivery_threshold),
    }
    if (await run(() => api.saveSettings(payload), 'Delivery settings saved')) reload()
  }
  const del = async (l) => {
    if (!confirmDelete(`the fee for ${l.town ? l.town + ', ' : ''}${l.county}`)) return
    if (await run(() => api.deleteLocation(l.id), 'Deleted')) reload()
  }
  const toggle = async (l, v) => { if (await run(() => api.saveLocation({ ...l, is_active: v }))) reload() }

  return (
    <>
      <PageHead title="Delivery" sub="Choose how delivery is charged. Customers see the fee before they submit an order.">
        <button className="btn btn-primary" onClick={save}>Save delivery settings</button>
      </PageHead>

      <Card title="Delivery pricing">
        <div className="modegrid" role="radiogroup" aria-label="Delivery pricing mode">
          {MODES.map((m) => (
            <button key={m.key} role="radio" aria-checked={s.delivery_mode === m.key} className={`modecard ${s.delivery_mode === m.key ? 'is-active' : ''}`} onClick={() => setS((x) => ({ ...x, delivery_mode: m.key }))}>
              <b>{m.title}</b><span>{m.text}</span>
            </button>
          ))}
        </div>
        <div className="aform">
          {s.delivery_mode === 'fixed' && <Field label="Fixed delivery fee (KSh)"><input type="number" inputMode="decimal" min="0" step="any" value={s.fixed_delivery_fee} onChange={set('fixed_delivery_fee')} /></Field>}
          {usesTable && <Field label="Default fee (KSh)" hint="Used for counties or towns not listed below."><input type="number" inputMode="decimal" min="0" step="any" value={s.default_delivery_fee} onChange={set('default_delivery_fee')} /></Field>}
          {s.delivery_mode !== 'free' && <Field label="Free delivery above (KSh, optional)" hint="Orders at or above this subtotal get free delivery."><input type="number" inputMode="decimal" min="0" step="any" value={s.free_delivery_threshold} onChange={set('free_delivery_threshold')} placeholder="No free-delivery threshold" /></Field>}
        </div>
      </Card>

      {usesTable && (
        <Card title={s.delivery_mode === 'town' ? 'County and town fees' : 'County fees'} actions={<button className="btn btn-sm btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={16} /> Add fee</button>}>
          {locations.length === 0 ? <p className="muted">No fees yet. Add a county to start.</p> : (
            <div className="tablewrap">
              <table className="table table-stack">
                <thead><tr><th>County</th><th>Town</th><th className="num">Fee</th><th>Time</th><th>Active</th><th /></tr></thead>
                <tbody>
                  {locations.map((l) => (
                    <tr key={l.id}>
                      <td data-label="County"><b>{l.county}</b></td>
                      <td data-label="Town">{l.town || <span className="muted">Whole county</span>}{s.delivery_mode === 'county' && l.town && <small className="block muted">Only used in "By town" mode</small>}</td>
                      <td data-label="Fee" className="num">{money(l.fee)}</td>
                      <td data-label="Time">{l.eta || '-'}</td>
                      <td data-label="Active"><Toggle checked={l.is_active} onChange={(v) => toggle(l, v)} /></td>
                      <td className="td-act"><button className="btn btn-sm btn-outline" onClick={() => setEditing(l)}>Edit</button> <button className="icon-btn" aria-label="Delete" onClick={() => del(l)}><Icon name="trash" size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {editing && <LocationForm loc={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </>
  )
}
