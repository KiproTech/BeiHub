import { useRef, useState } from 'react'
import { Link } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { ConfirmDialog } from '../../components/ui.jsx'
import { Card, PageHead, Toggle } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'

const SLOTS = [
  { slot: 'logo', title: 'Logo', sub: 'Shown in the header and footer. A PNG with a transparent background works best.' },
  { slot: 'favicon', title: 'Favicon', sub: 'The small icon in the browser tab. Use a square image.' },
  { slot: 'hero', title: 'Landing / hero image', sub: 'The big picture on the home page. Leave empty to use the built-in illustration.' },
  { slot: 'banner', title: 'Promotional banners', sub: 'Shown in a strip under the hero. Add as many as you like.' },
  { slot: 'about', title: 'About-section image', sub: 'Shown in the footer next to the About text.' },
  { slot: 'default_product', title: 'Default product image', sub: 'Used when a product has no picture of its own.' },
]

function Item({ item, onChanged }) {
  const { run } = useAdmin()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const ref = useRef(null)
  const act = async (fn, msg) => {
    setBusy(true)
    const ok = await run(fn, msg)
    setBusy(false)
    if (ok) onChanged()
    return ok
  }
  return (
    <li className={`mediaitem ${item.is_primary ? 'is-primary' : ''}`}>
      <div className="mediaitem-pic"><img src={item.url} alt={item.alt || ''} />{item.is_primary && <span className="chip chip-new">Primary</span>}</div>
      <div className="mediaitem-act">
        {!item.is_primary && <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => act(() => api.setPrimaryMedia(item), 'Primary image updated')}><Icon name="star" size={14} /> Set primary</button>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) act(() => api.replaceMedia(item, f), 'Image replaced') }} />
        <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => ref.current?.click()}><Icon name="swap" size={14} /> Replace</button>
        <button className="btn btn-sm btn-outline vcard-del" disabled={busy} onClick={() => setAsking(true)}><Icon name="trash" size={14} /> Delete</button>
      </div>
      <div style={{ padding: '0 8px 8px' }}><Toggle checked={item.is_active} onChange={(v) => act(() => api.updateMedia(item.id, { is_active: v }), v ? 'Image is live' : 'Image hidden')} label={item.is_active ? 'Shown on website' : 'Hidden'} /></div>
      {asking && (
        <ConfirmDialog title="Delete this image?" confirmLabel="Delete image" tone="danger" busy={busy} onConfirm={async () => { await act(() => api.deleteMedia(item), 'Image deleted'); setAsking(false) }} onClose={() => setAsking(false)}>
          <p>The file is removed from storage.{item.is_primary ? ' Another image in this section (if any) becomes the primary one; otherwise the website falls back to its default.' : ''}</p>
        </ConfirmDialog>
      )}
    </li>
  )
}

export default function Media() {
  const { media, reload, run } = useAdmin()
  const [busy, setBusy] = useState('')
  const refs = useRef({})
  const upload = async (slot, files) => {
    setBusy(slot)
    let n = 0
    for (const f of [...files]) if (await run(() => api.addMedia(slot, f))) n++
    setBusy('')
    if (n) { run(async () => true, `${n} image${n === 1 ? '' : 's'} uploaded`); reload() }
  }
  return (
    <>
      <PageHead title="Media" sub="Control the pictures used across the website. Changes show to customers straight away." />
      <div className="notice notice-good"><Icon name="image" size={18} /> Product images are managed on each product, and category images under <Link to="/admin/categories">Categories</Link>.</div>
      {SLOTS.map(({ slot, title, sub }) => {
        const items = media.filter((m) => m.slot === slot)
        return (
          <Card key={slot} title={title} sub={sub} actions={
            <label className={`btn btn-sm btn-primary ${busy === slot ? 'is-busy' : ''}`}>
              <Icon name="upload" size={16} /> {busy === slot ? 'Uploading...' : items.length ? 'Add image' : 'Upload'}
              <input ref={(el) => (refs.current[slot] = el)} type="file" accept="image/*" multiple={slot === 'banner'} hidden disabled={busy === slot} onChange={(e) => { upload(slot, e.target.files); e.target.value = '' }} />
            </label>
          }>
            {items.length === 0 ? <div className="dropempty"><Icon name="image" size={28} /><p>No image uploaded. The website uses its default.</p></div> : (
              <ul className="mediagrid" style={{ listStyle: 'none', padding: 0 }}>{items.map((m) => <Item key={m.id} item={m} onChanged={reload} />)}</ul>
            )}
          </Card>
        )
      })}
    </>
  )
}
