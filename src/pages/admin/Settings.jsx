import { useMemo, useState } from 'react'
import { Link } from '../../lib/router.jsx'
import { Card, Field, PageHead } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'
import { waDigits } from '../../lib/format.js'

// Business Settings = the ONE business record in Supabase (store_settings, id = 1).
// Saving sends only the fields that were changed, validated here and again by the database.
const TEXT_FIELDS = ['business_name', 'tagline', 'phone', 'whatsapp', 'email', 'address', 'county', 'business_hours', 'about', 'delivery_info',
  'google_maps_url', 'support_phone', 'support_email', 'support_hours', 'other_contact_info', 'payment_instructions',
  'facebook_url', 'instagram_url', 'twitter_url', 'tiktok_url', 'youtube_url']
const PHONE = /^\+?[0-9][0-9 ()-]{5,24}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const URL_RE = /^https?:\/\/\S+$/i
const blank = (v) => (v == null ? '' : String(v)).trim()

function validate(f) {
  if (!blank(f.business_name)) return 'Enter your business name.'
  if (blank(f.phone) && !PHONE.test(blank(f.phone))) return 'The business phone number looks invalid.'
  if (blank(f.support_phone) && !PHONE.test(blank(f.support_phone))) return 'The support phone number looks invalid.'
  const wa = waDigits(f.whatsapp)
  if (blank(f.whatsapp) && !/^\d{9,15}$/.test(wa)) return 'The WhatsApp number must have 9 to 15 digits, e.g. 0712 345 678 or 254712345678.'
  if (blank(f.email) && !EMAIL.test(blank(f.email))) return 'The business email address looks invalid.'
  if (blank(f.support_email) && !EMAIL.test(blank(f.support_email))) return 'The support email address looks invalid.'
  for (const k of ['google_maps_url', 'facebook_url', 'instagram_url', 'twitter_url', 'tiktok_url', 'youtube_url']) {
    if (blank(f[k]) && !URL_RE.test(blank(f[k]))) return 'Links must start with http:// or https://'
  }
  const pct = Number(f.deposit_percent)
  if (!(pct >= 0 && pct <= 100)) return 'Deposit must be between 0 and 100 percent.'
  return ''
}

export default function Settings() {
  const { settings, reload, run } = useAdmin()
  // `base` = what the form was opened with (the database value at that moment). Only differences are saved.
  const [base, setBase] = useState(settings)
  const [f, setF] = useState({ ...settings })
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('contact')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const wa = waDigits(f.whatsapp)

  const changes = useMemo(() => {
    const out = {}
    for (const k of TEXT_FIELDS) {
      const next = k === 'whatsapp' ? waDigits(f[k]) : blank(f[k])
      if (next !== blank(base[k])) out[k] = next === '' && k !== 'business_name' ? null : next
    }
    const pct = Number(f.deposit_percent)
    if (pct !== Number(base.deposit_percent)) out.deposit_percent = pct
    return out
  }, [f, base])
  const dirty = Object.keys(changes).length > 0

  const save = async () => {
    const problem = validate(f)
    if (problem) return run(async () => { throw new Error(problem) })
    setBusy(true)
    const saved = await run(() => api.saveSettings(changes, base), 'Business settings saved. Every device now shows the new information.')
    setBusy(false)
    if (saved) {
      await reload()
      if (saved !== true) { setBase(saved); setF((x) => ({ ...x, ...saved })) }
    } else {
      await reload() // most likely someone else changed one of these fields: refresh the shared data
    }
  }
  const discard = () => setF({ ...base })
  const reloadLatest = () => { setBase(settings); setF({ ...settings }) }

  return (
    <>
      <PageHead title="Business Settings" sub="The one place for your business information. It is saved in the central database, so phones, tablets and computers all show the same details.">
        <button className="btn btn-outline" disabled={busy} onClick={reloadLatest} title="Throw away unsaved edits and show the latest saved values">Load latest</button>
        {dirty && <button className="btn btn-outline" disabled={busy} onClick={discard}>Discard changes</button>}
        <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving...' : 'Save settings'}</button>
      </PageHead>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'contact'} className={tab === 'contact' ? 'is-active' : ''} onClick={() => setTab('contact')}>Contact information</button>
        <button role="tab" aria-selected={tab === 'business'} className={tab === 'business' ? 'is-active' : ''} onClick={() => setTab('business')}>Business &amp; payment</button>
      </div>

      {tab === 'contact' ? (
        <>
          <Card title="Business contact" sub="Shown in the header, footer, Contact page, order pages and WhatsApp links.">
            <div className="aform">
              <Field label="Business phone"><input type="tel" value={f.phone || ''} onChange={set('phone')} placeholder="+254 700 000 000" /></Field>
              <Field label="WhatsApp number" hint={wa ? `Customers will chat with: +${wa}` : 'Used for the WhatsApp buttons.'}><input type="tel" value={f.whatsapp || ''} onChange={set('whatsapp')} placeholder="0712 345 678 or 254712345678" /></Field>
              <Field label="Business email"><input type="email" value={f.email || ''} onChange={set('email')} /></Field>
              <Field label="County"><input value={f.county || ''} onChange={set('county')} /></Field>
              <Field label="Physical address" className="span2"><input value={f.address || ''} onChange={set('address')} /></Field>
              <Field label="Opening hours" className="span2"><input value={f.business_hours || ''} onChange={set('business_hours')} placeholder="Mon - Sat: 8:00am - 6:00pm" /></Field>
              <Field label="Delivery information" className="span2" hint="Shown on product pages, About, Contact and the footer. For example: 'We deliver within Nairobi in 1-2 days.'"><textarea rows={2} value={f.delivery_info || ''} onChange={set('delivery_info')} /></Field>
              <Field label="Map link (Google Maps)" className="span2" hint="Paste a share link. Customers get a 'Find us on the map' link."><input type="url" value={f.google_maps_url || ''} onChange={set('google_maps_url')} placeholder="https://maps.google.com/..." /></Field>
            </div>
          </Card>
          <Card title="Customer support" sub="Optional. Shown on the Contact page and footer when filled in.">
            <div className="aform">
              <Field label="Support phone"><input type="tel" value={f.support_phone || ''} onChange={set('support_phone')} /></Field>
              <Field label="Support email"><input type="email" value={f.support_email || ''} onChange={set('support_email')} /></Field>
              <Field label="Support hours" className="span2"><input value={f.support_hours || ''} onChange={set('support_hours')} placeholder="Mon - Fri: 8am - 5pm" /></Field>
              <Field label="Other important information" className="span2" hint="For example: 'We never ask for payment outside the instructions given by our team.'"><textarea rows={2} value={f.other_contact_info || ''} onChange={set('other_contact_info')} /></Field>
            </div>
          </Card>
          <Card title="Social media" sub="Leave empty to hide.">
            <div className="aform">
              {[['facebook_url', 'Facebook'], ['instagram_url', 'Instagram'], ['twitter_url', 'X (Twitter)'], ['tiktok_url', 'TikTok'], ['youtube_url', 'YouTube']].map(([k, l]) => (
                <Field key={k} label={l}><input type="url" value={f[k] || ''} onChange={set(k)} placeholder="https://" /></Field>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card title="Business">
            <div className="aform">
              <Field label="Business name"><input value={f.business_name || ''} onChange={set('business_name')} /></Field>
              <Field label="Tagline" hint="The headline on the home page."><input value={f.tagline || ''} onChange={set('tagline')} /></Field>
              <Field label="About your business" className="span2" hint="Shown on the About page and in the website footer."><textarea rows={4} value={f.about || ''} onChange={set('about')} /></Field>
            </div>
            <p className="muted small">The logo, favicon and other pictures are managed under <Link to="/admin/media">Media</Link>.</p>
          </Card>
          <Card title="Payment terms">
            <div className="aform">
              <Field label="Deposit that may be required (%)" hint="Customers are told a deposit of up to this percentage may be required. Payment is handled manually for now."><input type="number" inputMode="decimal" min="0" max="100" step="any" value={f.deposit_percent ?? 50} onChange={set('deposit_percent')} /></Field>
              <Field label="Payment instructions" className="span2" hint="Shown on printed orders. Customers also receive instructions from your team."><textarea rows={3} value={f.payment_instructions || ''} onChange={set('payment_instructions')} /></Field>
            </div>
          </Card>
        </>
      )}
      {dirty && <p className="muted small">Unsaved changes: {Object.keys(changes).length} field{Object.keys(changes).length === 1 ? '' : 's'}.</p>}
    </>
  )
}
