import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useProfile } from '../lib/profile-context'

// Used inside RequireAuth. "couple": the screen needs a couple, otherwise go to
// onboarding. "none": onboarding itself, which makes no sense once you have one.
export function CoupleGate({ need, children }: { need: 'couple' | 'none'; children: ReactNode }) {
  const { profile, loading } = useProfile()

  if (loading) return null
  if (!profile) return <p className="shell warning">משהו השתבש בטעינת הפרופיל. רעננו את הדף.</p>

  if (need === 'couple' && !profile.couple_id) return <Navigate to="/welcome" replace />
  if (need === 'none' && profile.couple_id) return <Navigate to="/" replace />

  return children
}