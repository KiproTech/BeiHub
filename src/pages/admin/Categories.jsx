import { useState } from 'react'
import { Icon } from '../../components/Icons.jsx'
import { Modal, ProductImage } from '../../components/ui.jsx'
import { Card, Field, PageHead, Toggle, confirmDelete } from './parts.jsx'
import { useAdmin } from './AdminContext.jsx'
import { api } from '../../lib/api.js'
import { slugify } from '../../lib/format.js'

function CategoryForm({ cat, onClose }) {
  const { reload, run } = useAdmin()
  const [f, setF] = useState({ name: '', slug: '', description: '', image_url: null, image_path: null, is_active: true, ...cat })
  const [slugTouched, setSlugTouched] = useState(!!cat)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    const r = await run(() => api.uploadCategoryImage(file))
    setBusy(false)
    if (r && r.url) setF((x) => ({ ...x, image_url: r.url, image_path: r.path }))
  }
  const save = async () => {
    if (!f.name.trim()) return run(async () => { throw new Error('Enter a category name.') })
    setBusy(true)
    const payload = { id: f.id, name: f.name.trim(), slug: f.slug || slugify(f.name), description: f.description, image_url: f.image_url, image_path: f.image_path, is_active: f.is_active }
    if (!f.id) payload.sort_order = 9999
    const ok = await run(() => api.saveCategory(payload), f.id ? 'Category saved' : 'Category added')
    setBusy(false)
    if (ok) { await reload(); onClose() }
  }
  return (
    <Modal title={f.id ? 'Edit category' : 'Add category'} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>Save category</button></>}>
      <Field label="Category name"><input value={f.name} onChange={(e) => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }} placeholder="e.g. Water Tanks" /></Field>
      <Field label="Web address (slug)" hint="Used in links, e.g. /shop?category=water-tanks"><input value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} /></Field>
      <Field label="Short description (optional)"><textarea rows={2} value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
      <div className="field">
        <span>Category image</span>
        <div className="imgpick">
          <div className="imgpick-prev"><ProductImage src={f.image_url} alt="" /></div>
          <div className="imgpick-btns">
            <label className="btn btn-outline btn-sm"><Icon name="upload" size={16} /> {f.image_url ? 'Replace image' : 'Upload image'}<input type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = '' }} /></label>
            {f.image_url && <button type="button" className="btn btn-outline btn-sm" onClick={() => setF((x) => ({ ...x, image_url: null, image_path: null }))}>Remove</button>}
          </div>
        </div>
      </div>
      <Toggle checked={f.is_active} onChange={(v) => set('is_active', v)} label="Visible on the website" />
    </Modal>
  )
}

export default function Categories() {
  const { categories, products, reload, run } = useAdmin()
  const [editing, setEditing] = useState(null)
  const count = (id) => products.filter((p) => p.category_id === id).length

  const move = async (i, d) => {
    const ids = categories.map((c) => c.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    if (await run(() => api.reorderCategories(ids))) reload()
  }
  const remove = async (c) => {
    if (count(c.id)) return run(async () => { throw new Error(`"${c.name}" still has ${count(c.id)} product(s). Move or delete them first.`) })
    if (!confirmDelete(`the category "${c.name}"`)) return
    if (await run(() => api.deleteCategory(c.id), 'Category deleted')) reload()
  }
  const toggle = async (c, v) => { if (await run(() => api.saveCategory({ ...c, is_active: v }))) reload() }

  return (
    <>
      <PageHead title="Categories" sub="Shown on the homepage, in the menu and in filters. Use the arrows to change the order.">
        <button className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={18} /> Add category</button>
      </PageHead>
      <Card>
        <ul className="rowlist">
          {categories.map((c, i) => (
            <li key={c.id} className="rowitem">
              <div className="rowitem-img"><ProductImage src={c.image_url} alt="" /></div>
              <div className="rowitem-main">
                <b>{c.name}</b>
                <small className="muted">{count(c.id)} products | /{c.slug}</small>
              </div>
              <Toggle checked={c.is_active} onChange={(v) => toggle(c, v)} label={c.is_active ? 'Visible' : 'Hidden'} />
              <div className="rowitem-act">
                <button className="icon-btn" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={18} /></button>
                <button className="icon-btn" aria-label={`Move ${c.name} down`} disabled={i === categories.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={18} /></button>
                <button className="btn btn-sm btn-outline" onClick={() => setEditing(c)}><Icon name="edit" size={16} /> Edit</button>
                <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}><Icon name="trash" size={18} /></button>
              </div>
            </li>
          ))}
        </ul>
        {categories.length === 0 && <p className="muted">No categories yet. Add your first one.</p>}
      </Card>
      {editing && <CategoryForm cat={editing.id ? editing : null} onClose={() => setEditing(null)} />}
    </>
  )
}
