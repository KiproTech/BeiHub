// BeiHub has ONE source of truth: your Supabase project.
// There is no "demo mode" and no browser-only copy of shop data: if the two variables below are
// missing, the app shows a setup screen instead of silently running on private, per-device data.
const clean = (v) => String(v || '').trim()

export const SUPABASE_URL = clean(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '')
export const SUPABASE_ANON_KEY = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)
export const STORAGE_BUCKET = 'product-images'

const PLACEHOLDER = /your[-_ ]?(project|public|anon)|your-project-ref|^xxx|changeme|example\.supabase/i

// '' when the configuration is usable, otherwise a short description of what is wrong.
export const CONFIG_PROBLEM = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.'
  if (PLACEHOLDER.test(SUPABASE_URL) || PLACEHOLDER.test(SUPABASE_ANON_KEY)) return 'The Supabase values still contain the placeholder text from .env.example.'
  if (!/^https?:\/\/[^/\s]+/i.test(SUPABASE_URL)) return 'VITE_SUPABASE_URL must start with https:// (copy the Project URL from Supabase).'
  if (/service_role/i.test(SUPABASE_ANON_KEY)) return 'Do not use the service_role key in the website. Use the anon (public) key.'
  return ''
})()
