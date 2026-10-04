import { IS_DEMO } from './config.js'
import { supabaseBackend } from './backends/supabase.js'
import { demoBackend } from './backends/demo.js'

// One interface, two implementations: Supabase (production) or in-browser demo data.
export const api = IS_DEMO ? demoBackend : supabaseBackend
