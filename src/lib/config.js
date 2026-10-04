export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
// Demo mode runs the whole shop in the browser (no Supabase needed) - handy for previews.
// It switches on automatically when the Supabase variables are missing.
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true' || !SUPABASE_URL || !SUPABASE_ANON_KEY
export const STORAGE_BUCKET = 'product-images'
export const DEMO_ADMIN = { email: 'admin@beihub.co.ke', password: 'admin123' }
