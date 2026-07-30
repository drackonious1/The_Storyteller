import { createClient } from '@supabase/supabase-js'

// These are public keys by design. Row Level Security in the database protects
// the data, so they are safe to ship in the browser bundle.
const SUPABASE_URL = 'https://opdvhisryhntumbcmsnq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZHZoaXNyeWhudHVtYmNtc25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTE4MzgsImV4cCI6MjA5NTk2NzgzOH0.VkKK4GUDFqJ-fXtiH2wFDFeFXyHEh8MXSaRybQpkM3s'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export function todayISO() { return new Date().toISOString().slice(0, 10) }

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('users').select('username, tier').eq('id', userId).maybeSingle()
  if (error) return null
  return data
}

export async function fetchTodayUsage(userId) {
  const out = { kids: 0, older: 0, family: 0 }
  const { data, error } = await supabase.from('usage').select('mode, count').eq('user_id', userId).eq('usage_date', todayISO())
  if (error || !data) return out
  for (const row of data) { if (row.mode in out) out[row.mode] = row.count || 0 }
  return out
}

export async function bumpUsage(mode) {
  const { data, error } = await supabase.rpc('bump_usage', { p_mode: mode })
  if (error) return null
  return data
}

export async function redeemPromo(code) {
  const { data, error } = await supabase.rpc('redeem_promo', { p_code: code })
  if (error) return null
  return data
}

export async function fetchStories(userId) {
  const { data, error } = await supabase.from('stories')
    .select('id, title, preview, content, mode, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  if (error || !data) return []
  return data.map(r => ({
    id: r.id, title: r.title, preview: r.preview, text: r.content, mode: r.mode,
    savedAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }))
}

export async function upsertStory(userId, entry) {
  const row = { user_id: userId, title: entry.title, preview: entry.preview, content: entry.text, mode: entry.mode }
  const isUuid = typeof entry.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id)
  if (isUuid) {
    const r = await supabase.from('stories').update(row).eq('id', entry.id).eq('user_id', userId).select('id').maybeSingle()
    if (!r.error && r.data) return r.data.id
  }
  const { data, error } = await supabase.from('stories').insert(row).select('id').maybeSingle()
  if (error) return null
  return data ? data.id : null
}

export async function deleteStoryRow(userId, storyId) {
  await supabase.from('stories').delete().eq('id', storyId).eq('user_id', userId)
}

export function guestCount() {
  try { return parseInt(localStorage.getItem('guest_total') || '0', 10) || 0 } catch (e) { return 0 }
}
export function setGuestCount(n) {
  try { localStorage.setItem('guest_total', String(n)) } catch (e) {}
}