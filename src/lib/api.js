import { supabaseBackend } from './backends/supabase.js'

// The single data layer: every read and write goes to Supabase.
export const api = supabaseBackend
