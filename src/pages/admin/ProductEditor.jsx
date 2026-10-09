import { useRef, useState } from 'react'
import { Link, useNavigate } from '../../lib/router.jsx'
import { Icon } from '../../components/Icons.jsx'
import { Modal, ProductImage } from '../../components/ui.jsx'
import { Card, Field, KeyValueEditor, PageHead, Toggle, confirmDelete } from './parts.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'
import { PRODUCT_STATUSES, discountPercent, money, slugify } from '../../lib/format.js'

/* ------------------------------ images ------------------------------ */
function ImageManager({ product }) {
  const { reload, run } = useAdmin()
  const [busy, setBusy] = useState(false)
  const replaceRef = useRef(null)
  const [replacing, setReplacing] = useState(null)
  const imgs = product.images

  const upload = async (files) => {
    const list = [...files]
    if (!list.length) return
    setBusy(true)
    let ok = 0
    for (let i = 0; i < list.length; i++) {
      if (await run(() => api.addImage(product.id, list[i], imgs.length + i))) ok++
    }
    setBusy(false)
    if (ok) {
      await reload()
      run(async () => true, `${ok} image${ok === 1 ? '' : 's'} uploaded`)
    }
  }
  const move = async (i, d) => {
    const ids = imgs.map((m) => m.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    if (await run(() => api.reorderImages(ids))) reload()
  }
  const setMain = async (m) => { if (await run(() => api.setMainImage(m), 'Main image updated')) reload() }
  const del = async (m) => {
    if (!confirmDelete('this image')) return
    if (await run(() => api.deleteImage(m), 'Image deleted')) reload()
  }
  const replace = async (file) => {
    if (!file || !replacing) return
    setBusy(true)
    const ok = await run(() => api.replaceImage(replacing, file), 'Image replaced')
    setBusy(false)
    setReplacing(null)
    if (ok) reload()
  }

  return (
    <Card
      id="images"
      title="Images"
      sub="The main image is shown on cards and search. Add several for the gallery."
      actions={
        <label className={`btn btn-sm btn-primary ${busy ? 'is-busy' : ''}`}>
          <Icon name="upload" size={16} /> {busy ? 'Uploading...' : 'Upload images'}
          <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        </label>
      }
    >
      <input ref={replaceRef} type="file" accept="image/*" hidden onChange={(e) => { replace(e.target.files[0]); e.target.value = '' }} />
      {imgs.length === 0 ? (
        <div className="dropempty"><Icon name="image" size={30} /><p>No images yet. Upload clear photos of the product on a plain background.</p></div>
      ) : (
        <ul className="imggrid">
          {imgs.map((m, i) => (
            <li key={m.id} className={m.is_main ? 'is-main' : ''}>
              <div className="imggrid-pic"><ProductImage src={m.url} alt="" loading="eager" />{m.is_main && <span className="chip chip-new">Main image</span>}</div>
              <div className="imggrid-act">
                {!m.is_main && <button className="btn btn-sm btn-outline" onClick={() => setMain(m)}><Icon name="star" size={15} /> Set main</button>}
                <button className="icon-btn" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="left" size={18} /></button>
                <button className="icon-btn" aria-label="Move later" disabled={i === imgs.length - 1} onClick={() => move(i, 1)}><Icon name="right" size={18} /></button>
                <button className="icon-btn" aria-label="Replace image" onClick={() => { setReplacing(m); replaceRef.current?.click() }}><Icon name="swap" size={18} /></button>
                <button className="icon-btn" aria-label="Delete image" onClick={() => del(m)}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------ variants ------------------------------ */
const blank = (productId) => ({ id: null, product_id: productId, label: '', sku: '', price: '', previous_price: '', stock: '0', availability: 'in_stock', specs: {}, sort_order: 0, _key: Math.random().toString(36).slice(2) })

function VariantCard({ variant, productId, onDone, onDuplicate, count }) {
  const { reload, run } = useAdmin()
  const [f, setF] = useState({ ...variant, price: String(variant.price ?? ''), previous_price: variant.previous_price == null ? '' : String(variant.previous_price), stock: String(variant.stock ?? 0), sku: variant.sku || '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const disc = discountPercent(f.previous_price === '' ? null : Number(f.previous_price), Number(f.price))

  const save = async () => {
    if (!f.label.trim()) return run(async () => { throw new Error('Enter a variant name, for example "2,000 Litres".') })
    if (f.price === '' || !(Number(f.price) >= 0)) return run(async () => { throw new Error('Enter a valid price.') })
    setBusy(true)
    const ok = await run(
      () => api.saveVariant({ ...f, product_id: productId, price: Number(f.price), previous_price: f.previous_price === '' ? null : Number(f.previous_price), stock: parseInt(f.stock, 10) || 0, sort_order: variant.id ? variant.sort_order : count }),
      'Variant saved',
    )
    setBusy(false)
    if (ok) { await reload(); if (!variant.id) onDone() }
  }
  const del = async () => {
    if (!variant.id) return onDone()
    if (!confirmDelete(`the variant "${variant.label}"`)) return
    if (await run(() => api.deleteVariant(variant.id), 'Variant deleted')) { await reload(); onDone() }
  }

  return (
    <div className={`vcard ${variant.id ? '' : 'is-new'}`}>
      <div className="vcard-grid">
        <Field label="Variant name" className="vf-label"><input value={f.label} onChange={set('label')} placeholder="e.g. 2,000 Litres or 55 Inch" /></Field>
        <Field label="Current price (KSh)"><input type="number" inputMode="decimal" min="0" step="any" value={f.price} onChange={set('price')} /></Field>
        <Field label="Previous price (KSh)" hint={disc > 0 ? `Shows -${disc}% (save ${money(Number(f.previous_price) - Number(f.price))})` : 'Optional. Shown crossed out.'}><input type="number" inputMode="decimal" min="0" step="any" value={f.previous_price} onChange={set('previous_price')} /></Field>
        <Field label="Stock"><input type="number" inputMode="numeric" min="0" step="1" value={f.stock} onChange={set('stock')} /></Field>
        <Field label="Availability">
          <select value={f.availability} onChange={set('availability')}>
            <option value="in_stock">In stock</option>
            <option value="on_order">Available on order</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </Field>
        <Field label="SKU"><input value={f.sku} onChange={set('sku')} placeholder="Optional, must be unique" /></Field>
      </div>
      <details className="vcard-specs">
        <summary>Specifications for this variant ({Object.keys(f.specs || {}).length})</summary>
        <KeyValueEditor value={f.specs} onChange={(s) => setF((x) => ({ ...x, specs: s }))} keyPlaceholder="e.g. Capacity" valuePlaceholder="e.g. 2,000 Litres" />
      </details>
      <div className="vcard-act">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>{variant.id ? 'Save variant' : 'Add variant'}</button>
        {variant.id && <button className="btn btn-outline btn-sm" onClick={() => onDuplicate(f)}><Icon name="copy" size={15} /> Duplicate</button>}
        <button className="btn btn-outline btn-sm vcard-del" onClick={del}><Icon name="trash" size={15} /> {variant.id ? 'Delete' : 'Cancel'}</button>
      </div>
    </div>
  )
}

function BulkAdd({ productId, existing, onClose }) {
  const { reload, run } = useAdmin()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const parse = () =>
    text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [label, price, prev, stock] = line.split(/[;|\t]/).map((x) => x.trim())
      return { label, price: Number(String(price).replace(/,/g, '')), previous_price: prev ? Number(prev.replace(/,/g, '')) : null, stock: stock ? parseInt(stock, 10) : 0 }
    })
  const rows = parse()
  const invalid = rows.filter((r) => !r.label || !(r.price >= 0))
  const go = async () => {
    setBusy(true)
    let n = 0
    for (const [i, r] of rows.entries()) {
      if (await run(() => api.saveVariant({ ...r, product_id: productId, availability: r.stock > 0 ? 'in_stock' : 'on_order', specs: {}, sort_order: existing + i }))) n++
      else break
    }
    setBusy(false)
    await reload()
    if (n === rows.length) { run(async () => true, `${n} variants added`); onClose() }
  }
  return (
    <Modal title="Add many variants at once" onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !rows.length || invalid.length > 0} onClick={go}>Add {rows.length || ''} variants</button></>}>
      <p className="muted small">One variant per line, separated by semicolons: <b>name; price; previous price (optional); stock (optional)</b></p>
      <textarea className="bulk" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'2,000 Litres; 28000; 32000; 10\n2,500 Litres; 34500; ; 6\n3,000 Litres; 41000'} />
      {invalid.length > 0 && <div className="notice notice-bad">{invalid.length} line(s) need a name and a numeric price.</div>}
    </Modal>
  )
}

function VariantManager({ product }) {
  const [drafts, setDrafts] = useState([])
  const [bulk, setBulk] = useState(false)
  const addDraft = (seed) => setDrafts((d) => [...d, { ...blank(product.id), ...(seed || {}), id: null, sku: '', label: '', _key: Math.random().toString(36).slice(2) }])
  return (
    <Card
      id="variants"
      title="Variants"
      sub="Sizes, capacities or models. Each has its own price, stock and SKU. Customers choose one before adding to their Order List."
      actions={<div className="btnrow"><button className="btn btn-sm btn-outline" onClick={() => setBulk(true)}>Add many</button><button className="btn btn-sm btn-primary" onClick={() => addDraft()}><Icon name="plus" size={16} /> Add variant</button></div>}
    >
      {product.variants.length === 0 && drafts.length === 0 && <div className="dropempty"><Icon name="tag" size={30} /><p>No variants yet. A product needs at least one variant with a price to appear on the website. For items without options, add one called "Standard".</p></div>}
      <div className="vlist">
        {product.variants.map((v) => (
          <VariantCard key={v.id + String(v.updated_at)} variant={v} productId={product.id} count={product.variants.length} onDone={() => {}} onDuplicate={(f) => addDraft({ price: f.price, previous_price: f.previous_price, stock: f.stock, availability: f.availability, specs: f.specs })} />
        ))}
        {drafts.map((d) => (
          <VariantCard key={d._key} variant={d} productId={product.id} count={product.variants.length} onDone={() => setDrafts((x) => x.filter((y) => y._key !== d._key))} onDuplicate={() => {}} />
        ))}
      </div>
      {bulk && <BulkAdd productId={product.id} existing={product.variants.length} onClose={() => setBulk(false)} />}
    </Card>
  )
}

/* ------------------------------ main editor ------------------------------ */
export default function ProductEditor({ id }) {
  const { products, categories, reload, run } = useAdmin()
  const { can } = useAuth()
  const navigate = useNavigate()
  const product = id ? products.find((p) => p.id === id) : null
  const [f, setF] = useState(() => ({
    name: '', slug: '', category_id: categories[0]?.id || '', brand: '', short_description: '', description: '', specs: {},
    status: 'available',
    is_featured: false, is_popular: false, is_new: false, ...(product || {}),
  }))
  const [slugTouched, setSlugTouched] = useState(!!product)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  if (id && !product)
    return (
      <>
        <PageHead title="Product not found" />
        <Link to="/admin/products" className="btn btn-primary">Back to products</Link>
      </>
    )

  const save = async () => {
    if (!f.name.trim()) return run(async () => { throw new Error('Enter the product name.') })
    if (!f.category_id) return run(async () => { throw new Error('Choose a category. Add one under Categories if needed.') })
    setBusy(true)
    const payload = {
      id: product?.id, category_id: f.category_id, name: f.name.trim(), slug: f.slug || slugify(f.name), brand: f.brand?.trim() || null,
      short_description: f.short_description?.trim() || null, description: f.description?.trim() || null, specs: f.specs || {},
      status: f.status, is_featured: f.is_featured, is_popular: f.is_popular, is_new: f.is_new,
    }
    const saved = await run(() => api.saveProduct(payload), product ? 'Product saved' : 'Product created. Now add images and variants.')
    setBusy(false)
    if (saved && saved.id) {
      await reload()
      if (!product) navigate(`/admin/products/${saved.id}`, { replace: true })
    }
  }

  const del = async () => {
    if (!confirmDelete(`"${product.name}" with all its images and variants`)) return
    if (await run(() => api.deleteProduct(product.id), 'Product deleted')) { await reload(); navigate('/admin/products') }
  }

  return (
    <>
      {(!can('MANAGE_PRODUCTS') || !can('MANAGE_PRODUCT_PRICES') || !can('MANAGE_PRODUCT_IMAGES')) && (
        <div className="notice notice-warn" role="note">
          <span>Your account can: {[can('MANAGE_PRODUCTS') && 'edit product details and stock', can('MANAGE_PRODUCT_PRICES') && 'change prices', can('MANAGE_PRODUCT_IMAGES') && 'manage images'].filter(Boolean).join(', ') || 'view only'}. Changes outside that are refused when you save.</span>
        </div>
      )}
      <PageHead title={product ? product.name : 'Add product'} sub={product ? 'Edit details, images and variants.' : 'Start with the basics. You can add images and variants right after saving.'}>
        <Link to="/admin/products" className="btn btn-outline"><Icon name="left" size={16} /> All products</Link>
        {product && <Link to={`/product/${product.slug}`} target="_blank" className="btn btn-outline"><Icon name="eye" size={16} /> View on website</Link>}
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving...' : product ? 'Save product' : 'Create product'}</button>
      </PageHead>

      <Card title="Product details">
        <div className="aform">
          <Field label="Product name" hint='Do not include the size here, add sizes as variants. e.g. "Water Tank".'>
            <input value={f.name} onChange={(e) => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }} placeholder="e.g. Water Tank" />
          </Field>
          <Field label="Category">
            <select value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Availability status" hint="Out of stock products stay visible but cannot be ordered. Hidden and discontinued products are not shown to customers.">
            <select value={f.status} onChange={(e) => set('status', e.target.value)}>
              {PRODUCT_STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
            </select>
          </Field>
          <Field label="Brand (optional)"><input value={f.brand || ''} onChange={(e) => set('brand', e.target.value)} /></Field>
          <Field label="Web address (slug)" hint="Used in the product link."><input value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} /></Field>
          <Field label="Short description" className="span2" hint="One line shown under the product name."><input value={f.short_description || ''} onChange={(e) => set('short_description', e.target.value)} maxLength={200} /></Field>
          <Field label="Full description" className="span2"><textarea rows={6} value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
        <div className="toggles">
          <Toggle checked={f.is_featured} onChange={(v) => set('is_featured', v)} label="Featured" />
          <Toggle checked={f.is_popular} onChange={(v) => set('is_popular', v)} label="Popular" />
          <Toggle checked={f.is_new} onChange={(v) => set('is_new', v)} label="Mark as new" />
        </div>
      </Card>

      <Card title="Specifications" sub="Shared by all variants, e.g. Material, Warranty, Connectivity.">
        <KeyValueEditor value={f.specs} onChange={(s) => set('specs', s)} />
      </Card>

      {product ? (
        <>
          <ImageManager product={product} />
          <VariantManager product={product} />
          <Card title="Danger zone"><button className="btn btn-outline vcard-del" onClick={del}><Icon name="trash" size={16} /> Delete this product</button></Card>
        </>
      ) : (
        <Card title="Images and variants"><p className="muted">Click <b>Create product</b> first. Then you can upload images and add variants such as sizes, capacities and prices.</p></Card>
      )}
    </>
  )
}
