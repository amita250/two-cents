import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../lib/auth-context'

// Supabase redirects here after email confirmation; the session is already
// picked up from the URL by the client (detectSessionInUrl), we just route onward.
export default function AuthCallback() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    navigate(session ? '/' : '/sign-in', { replace: true })
  }, [session, loading, navigate])

  return <p className="shell">מתחברים...</p>
}