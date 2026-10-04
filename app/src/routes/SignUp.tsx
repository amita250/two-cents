import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { translateAuthError } from '../lib/auth-errors'

export default function SignUp() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    // "Already registered" must look identical to a fresh signup (D-022): otherwise
    // this screen tells an attacker which emails have accounts.
    if (error && error.message !== 'User already registered') {
      setError(translateAuthError(error.message))
      setSubmitting(false)
      return
    }

    if (data.session) {
      navigate('/', { replace: true })
      return
    }

    setConfirmationSent(true)
    setSubmitting(false)
  }

  if (confirmationSent) {
    return (
      <div className="auth-form shell">
        <h1>בדקו את תיבת הדואר</h1>
        <p>שלחנו אימייל אישור לכתובת {email}. לחצו על הקישור שבו כדי להשלים את ההרשמה.</p>
      </div>
    )
  }

  return (
    <form className="auth-form shell" onSubmit={handleSubmit}>
      <h1>הרשמה</h1>
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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        אימות סיסמה
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>
      {error && <p className="warning">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'נרשם...' : 'הרשמה'}
      </button>
      <p>
        יש לך כבר חשבון? <Link to="/sign-in">התחברות</Link>
      </p>
    </form>
  )
}