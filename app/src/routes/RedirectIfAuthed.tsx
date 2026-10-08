import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { safeNextPath } from '../lib/next-path'

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) return null
  if (session) return <Navigate to={safeNextPath(searchParams.get('next'))} replace />

  return children
}