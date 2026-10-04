import { useState } from 'react'
import { Icon } from '../../components/Icons.jsx'
import { ProductImage } from '../../components/ui.jsx'
import { Card, Field, PageHead } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'
import { IS_DEMO } from '../../lib/config.js'
import { waDigits } from '../../lib/format.js'

export default function Settings() {
  const { settings, reload, run } = useAdmin()
  const [f, setF] = useState({ ...settings })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const wa = waDigits(f.whatsapp)

  const logo = async (file) => {
    if (!file) return
    setBusy(true)
    const r = await run(() => api.uploadBrandImage(file))
    setBusy(false)
    if (r && r.url) setF((x) => ({ ...x, logo_url: r.url }))
  }
  const save = async () => {
    if (!f.business_name?.trim()) return run(async () => { throw new Error('Enter your business name.') })
    const pct = Number(f.deposit_percent)
    if (!(pct >= 0 && pct <= 100)) return run(async () => { throw new Error('Deposit must be between 0 and 100 percent.') })
    setBusy(true)
    const payload = { ...f, whatsapp: wa, deposit_percent: pct }
    delete payload.updated_at
    const ok = await run(() => api.saveSettings(payload), 'Settings saved')
    setBusy(false)
    if (ok) reload()
  }
  const resetDemo = async () => {
    if (!window.confirm('Reset all demo data (products, orders, settings) to the original samples?')) return
    await api.resetDemo()
    window.location.reload()
  }

  return (
    <>
      <PageHead title="Settings" sub="Your business details appear on the website, in WhatsApp messages and on printed orders.">
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save settings'}</button>
      </PageHead>

      <Card title="Business">
        <div className="aform">
          <Field label="Business name"><input value={f.business_name || ''} onChange={set('business_name')} /></Field>
          <Field label="Tagline"><input value={f.tagline || ''} onChange={set('tagline')} /></Field>
          <div className="field span2">
            <span>Logo</span>
            <div className="imgpick">
              <div className="imgpick-prev imgpick-logo"><ProductImage src={f.logo_url} alt="" /></div>
              <div className="imgpick-btns">
                <label className="btn btn-outline btn-sm"><Icon name="upload" size={16} /> {f.logo_url ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/*" hidden onChange={(e) => { logo(e.target.files[0]); e.target.value = '' }} /></label>
                {f.logo_url && <button className="btn btn-outline btn-sm" onClick={() => setF((x) => ({ ...x, logo_url: null }))}>Use default logo</button>}
                <small className="muted">Square or wide image, PNG with a transparent background works best.</small>
              </div>
            </div>
          </div>
          <Field label="About your business" className="span2" hint="Shown in the website footer."><textarea rows={3} value={f.about || ''} onChange={set('about')} /></Field>
        </div>
      </Card>

      <Card title="Contact">
        <div className="aform">
          <Field label="Phone number"><input type="tel" value={f.phone || ''} onChange={set('phone')} placeholder="+254 700 000 000" /></Field>
          <Field label="WhatsApp number" hint={wa ? `Customers will chat with: +${wa}` : 'Used for the Order via WhatsApp buttons.'}><input type="tel" value={f.whatsapp || ''} onChange={set('whatsapp')} placeholder="0712 345 678 or 254712345678" /></Field>
          <Field label="Email"><input type="email" value={f.email || ''} onChange={set('email')} /></Field>
          <Field label="County"><input value={f.county || ''} onChange={set('county')} /></Field>
          <Field label="Shop address / location" className="span2"><input value={f.address || ''} onChange={set('address')} /></Field>
          <Field label="Business hours" className="span2"><input value={f.business_hours || ''} onChange={set('business_hours')} placeholder="Mon - Sat: 8:00am - 6:00pm" /></Field>
        </div>
      </Card>

      <Card title="Payment terms">
        <div className="aform">
          <Field label="Deposit to confirm an order (%)" hint="The balance is paid on delivery."><input type="number" inputMode="decimal" min="0" max="100" step="any" value={f.deposit_percent ?? 50} onChange={set('deposit_percent')} /></Field>
          <Field label="Payment instructions" className="span2" hint="Shown to customers after they submit an order and on printed orders."><textarea rows={3} value={f.payment_instructions || ''} onChange={set('payment_instructions')} /></Field>
        </div>
      </Card>

      {IS_DEMO && (
        <Card title="Demo data">
          <p className="muted">You are in demo mode. Everything is stored only in this browser.</p>
          <button className="btn btn-outline" onClick={resetDemo}>Reset demo data</button>
        </Card>
      )}
    </>
  )
}
