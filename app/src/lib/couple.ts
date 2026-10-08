import { supabase } from './supabase'

// Couple membership changes only through these database functions (D-003, D-013);
// the client never writes couple_id itself. Each wrapper returns a Hebrew error
// message, or null on success.

const ALREADY_IN_COUPLE = 'user is already part of a couple'
const GENERIC_ERROR = 'משהו השתבש. נסו שוב.'
const ALREADY_IN_COUPLE_ERROR = 'כבר יש לך בית משותף ב-TwoCents.'
// Any problem with an invite code (missing, used, expired, couple full) gets the
// same message, so the UI never reveals which codes exist (D-013).
const BAD_INVITE_ERROR = 'קוד ההזמנה לא תקין או שפג תוקפו. בקשו קישור חדש.'

// One tap, sensible defaults; name and currency are editable later (D-024).
export async function createCouple(): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR
  const { error } = await supabase.rpc('create_couple', {
    p_name: 'הבית שלנו',
    p_default_currency: 'ILS',
  })
  if (!error) return null
  return error.message === ALREADY_IN_COUPLE ? ALREADY_IN_COUPLE_ERROR : GENERIC_ERROR
}

export async function acceptInvite(code: string): Promise<string | null> {
  if (!supabase) return GENERIC_ERROR
  const { error } = await supabase.rpc('accept_invite', { p_code: code })
  if (!error) return null
  return error.message === ALREADY_IN_COUPLE ? ALREADY_IN_COUPLE_ERROR : BAD_INVITE_ERROR
}

export type Invite = { code: string; expires_at: string }

// The couple's live invite, if any — shown again instead of minting a new code
// every time the screen opens.
export async function fetchLiveInvite(): Promise<Invite | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('couple_invites')
    .select('code, expires_at')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// Creates a fresh code; the database expires any older unused one.
export async function createInvite(): Promise<{ invite: Invite | null; error: string | null }> {
  if (!supabase) return { invite: null, error: GENERIC_ERROR }
  const { error } = await supabase.rpc('create_invite')
  if (error) return { invite: null, error: GENERIC_ERROR }
  return { invite: await fetchLiveInvite(), error: null }
}

export type Member = { id: string; display_name: string }

// RLS returns only you and your partner (profiles_select), so no filter is needed.
export async function fetchMembers(): Promise<Member[]> {
  if (!supabase) return []
  const { data } = await supabase.from('profiles').select('id, display_name').order('created_at')
  return data ?? []
}

export function inviteLink(code: string): string {
  return `${window.location.origin}/invite/${code}`
}

// Accepts either the bare code or the whole shared link (people paste either).
export function extractInviteCode(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/invite\/([A-Za-z0-9_-]+)/)
  return match ? match[1] : trimmed
}
