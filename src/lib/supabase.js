// Minimal Supabase client built on fetch (PostgREST, GoTrue auth, Storage).
// Only the public ANON key is used here. Never put the service-role key in the frontend.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js'

const SESSION_KEY = 'beihub.auth'
const listeners = new Set()
let session = null
try {
  session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
} catch {
  session = null
}

function saveSession(s) {
  session = s
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn(session))
}

export const getSession = () => session
export const onAuthChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function parse(res) {
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.msg || data.error_description || data.error)) || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.code = data && data.code
    throw err
  }
  return data
}

function toSession(d) {
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user: d.user,
  }
}

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const d = await parse(res)
  saveSession(toSession(d))
  return session
}

async function refreshSession() {
  if (!session?.refresh_token) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
    saveSession(toSession(await parse(res)))
  } catch {
    saveSession(null)
  }
  return session
}

export async function signOut() {
  const token = session?.access_token
  saveSession(null)
  if (token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } })
    } catch {
      /* ignore */
    }
  }
}

async function token() {
  if (session && session.expires_at - 30 < Math.floor(Date.now() / 1000)) await refreshSession()
  return session?.access_token || null
}

async function headers(extra = {}) {
  const t = await token()
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t || SUPABASE_ANON_KEY}`, ...extra }
}

const qs = (obj = {}) => {
  const p = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => v !== undefined && v !== null && p.append(k, v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const db = {
  // select('products', { select: '*,product_images(*)', filters: { is_active: 'eq.true' }, order: 'created_at.desc' })
  async select(table, { select = '*', filters = {}, order, limit } = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs({ select, ...filters, order, limit })}`, { headers: await headers() })
    return parse(res)
  },
  async insert(table, rows, { onConflict } = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs({ on_conflict: onConflict })}`, {
      method: 'POST',
      headers: await headers({ 'Content-Type': 'application/json', Prefer: `return=representation${onConflict ? ',resolution=merge-duplicates' : ''}` }),
      body: JSON.stringify(rows),
    })
    return parse(res)
  },
  async update(table, filters, patch) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs(filters)}`, {
      method: 'PATCH',
      headers: await headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(patch),
    })
    return parse(res)
  },
  async remove(table, filters) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${qs(filters)}`, {
      method: 'DELETE',
      headers: await headers({ Prefer: 'return=representation' }),
    })
    return parse(res)
  },
  async rpc(fn, args = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: await headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(args),
    })
    return parse(res)
  },
}

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/')

export const storage = {
  async upload(bucket, path, file) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encPath(path)}`, {
      method: 'POST',
      headers: await headers({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false', 'cache-control': 'max-age=31536000' }),
      body: file,
    })
    await parse(res)
    return storage.publicUrl(bucket, path)
  },
  publicUrl: (bucket, path) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encPath(path)}`,
  async remove(bucket, paths) {
    if (!paths.length) return
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: await headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: paths }),
    })
    return parse(res)
  },
}
