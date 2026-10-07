import { useEffect, useRef } from 'react'
import { Icon } from './Icons.jsx'
import { availability, discountPercent, money } from '../lib/format.js'

export function Price({ price, previous, size = 'md' }) {
  const d = discountPercent(previous, price)
  return (
    <div className={`price price-${size}`}>
      <span className="price-now">{money(price)}</span>
      {d > 0 && (
        <>
          <s className="price-was">{money(previous)}</s>
          <span className="price-save">Save {money(previous - price)}</span>
        </>
      )}
    </div>
  )
}

export const DiscountTag = ({ previous, price }) => {
  const d = discountPercent(previous, price)
  return d > 0 ? <span className="tag-badge">-{d}%</span> : null
}

export function StockPill({ variant }) {
  const a = availability(variant)
  return <span className={`pill pill-${a.tone}`}>{a.label}</span>
}

export function QtyStepper({ value, onChange, min = 1, max = 100, size }) {
  return (
    <div className={`qty ${size === 'sm' ? 'qty-sm' : ''}`}>
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <Icon name="minus" size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Quantity"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min)
        }}
      />
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-art"><Icon name="box" size={34} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Modal({ title, onClose, children, wide, footer }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// default image chosen by the admin (Admin > Media), used when a product has no picture
let defaults = { product: null }
export const setDefaultImages = (d) => {
  defaults = { ...defaults, ...d }
}
export function ProductImage({ src, alt, className = '', fallback = 'product', ...rest }) {
  return <img className={`pimg ${className}`} src={src || defaults[fallback] || '/sample-products/placeholder.svg'} alt={alt || ''} loading="lazy" decoding="async" {...rest} />
}

// A confirmation dialog for risky actions (replaces window.confirm on the new screens)
export function ConfirmDialog({ title, children, confirmLabel = 'Confirm', tone = 'primary', busy, disabled, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>Go back</button>
          <button className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy || disabled}>{busy ? 'Please wait...' : confirmLabel}</button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

export function StatusPill({ info }) {
  return <span className={`pill pill-${info.tone}`}>{info.label}</span>
}

export function ErrorBox({ children, onRetry }) {
  return (
    <div className="notice notice-bad" role="alert">
      <span>{children}</span>
      {onRetry && <button className="btn btn-sm btn-outline" onClick={onRetry}>Try again</button>}
    </div>
  )
}
