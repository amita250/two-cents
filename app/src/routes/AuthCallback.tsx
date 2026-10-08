import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { safeNextPath, withNext } from '../lib/next-path'

// Supabase redirects here after email confirmation; the session is already
// picked up from the URL by the client (detectSessionInUrl), we just route onward
// — to `next` if sign-up started from an invite link (D-023).
export default function AuthCallback() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))

  useEffect(() => {
    if (loading) return
    navigate(session ? next : withNext('/sign-in', next), { replace: true })
  }, [session, loading, navigate, next])

  return <p className="shell">מתחברים...</p>
}