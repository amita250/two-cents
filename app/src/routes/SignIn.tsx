import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { supabase } from '../lib/supabase'
import { translateAuthError } from '../lib/auth-errors'
import { safeNextPath, withNext } from '../lib/next-path'

export default function SignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = safeNextPath(searchParams.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return

    setSubmitting(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(translateAuthError(error.message))
      setSubmitting(false)
      return
    }

    navigate(next, { replace: true })
  }

  return (
    <form className="auth-form shell" onSubmit={handleSubmit}>
      <h1>התחברות</h1>
      <label>
        אימייל
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        סיסמה
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && <p className="warning">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'מתחבר...' : 'התחברות'}
      </button>
      <p>
        אין לך חשבון? <Link to={withNext('/sign-up', next)}>הרשמה</Link>
      </p>
    </form>
  )
}