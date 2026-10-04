import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly and clearly on missing config instead of failing later with a cryptic error.
export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured ? createClient(url, anonKey) : null
