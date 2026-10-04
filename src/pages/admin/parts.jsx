import { useState } from 'react'
import { Icon } from '../../components/Icons.jsx'
import { statusInfo } from '../../lib/format.js'

export function PageHead({ title, sub, children }) {
  return (
    <div className="ahead">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="ahead-actions admin-actions">{children}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-dot" /></span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  )
}

export const StatusBadge = ({ status }) => {
  const s = statusInfo(status)
  return <span className={`pill pill-${s.tone}`}>{s.short}</span>
}

// Edit a { key: value } object as rows
export function KeyValueEditor({ value, onChange, keyPlaceholder = 'Name (e.g. Warranty)', valuePlaceholder = 'Value (e.g. 2 years)' }) {
  const [rows, setRows] = useState(() => Object.entries(value || {}).map(([k, v]) => ({ k, v: String(v) })))
  const push = (next) => {
    setRows(next)
    onChange(Object.fromEntries(next.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v])))
  }
  return (
    <div className="kv">
      {rows.map((r, i) => (
        <div className="kv-row" key={i}>
          <input value={r.k} placeholder={keyPlaceholder} aria-label="Specification name" onChange={(e) => push(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
          <input value={r.v} placeholder={valuePlaceholder} aria-label="Specification value" onChange={(e) => push(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
          <button type="button" className="icon-btn" aria-label="Remove row" onClick={() => push(rows.filter((_, j) => j !== i))}><Icon name="trash" size={18} /></button>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline" onClick={() => setRows([...rows, { k: '', v: '' }])}><Icon name="plus" size={16} /> Add row</button>
    </div>
  )
}

export function Card({ title, sub, children, actions, id }) {
  return (
    <section className="acard" id={id}>
      {(title || actions) && (
        <header className="acard-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p className="muted small">{sub}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export const Field = ({ label, hint, children, className = '' }) => (
  <label className={`field ${className}`}>
    <span>{label}</span>
    {children}
    {hint && <small className="muted">{hint}</small>}
  </label>
)

export const confirmDelete = (what) => window.confirm(`Delete ${what}? This cannot be undone.`)
