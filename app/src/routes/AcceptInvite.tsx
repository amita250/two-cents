import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { useProfile } from '../lib/profile-context'
import { acceptInvite } from '../lib/couple'
import { withNext } from '../lib/next-path'
import { DisplayNameField } from '../components/DisplayNameField'

// Landing screen for the shared invite link (D-013, D-021). Reachable signed out:
// the partner may not have an account yet, so `next` carries them back here
// through sign-up and email confirmation (D-023).
export default function AcceptInvite() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const { profile, loading: profileLoading, refresh, saveDisplayName } = useProfile()
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Set once joined: the refreshed profile now has a couple, and without this the
  // "you already have a couple" screen would flash before we navigate home.
  const [joined, setJoined] = useState(false)

  if (joined || authLoading || (session && profileLoading)) return null

  const here = `/invite/${code}`

  if (!session) {
    return (
      <div className="auth-form shell">
        <h1>הוזמנת ל-TwoCents</h1>
        <p>בן או בת הזוג שלך מזמינים אותך לנהל יחד את ההוצאות המשותפות.</p>
        <Link className="button-link" to={withNext('/sign-up', here)}>
          הרשמה
        </Link>
        <p>
          יש לך כבר חשבון? <Link to={withNext('/sign-in', here)}>התחברות</Link>
        </p>
      </div>
    )
  }

  if (profile?.couple_id) {
    return (
      <div className="auth-form shell">
        <h1>כבר יש לך בית משותף</h1>
        <p>החשבון שלך כבר מחובר לבית ב-TwoCents, ולכן אי אפשר להצטרף להזמנה הזו.</p>
        <Link to="/">למסך הבית</Link>
      </div>
    )
  }

  const nameValue = name ?? profile?.display_name ?? ''

  async function handleJoin() {
    if (!nameValue.trim()) {
      setError('נא למלא שם.')
      return
    }
    setSubmitting(true)
    setError(null)

    const joinError = (await saveDisplayName(nameValue)) ? await acceptInvite(code) : 'משהו השתבש. נסו שוב.'
    if (joinError) {
      setError(joinError)
      setSubmitting(false)
      return
    }

    setJoined(true)
    await refresh()
    navigate('/', { replace: true })
  }

  return (
    <div className="auth-form shell">
      <h1>הצטרפות לבית המשותף</h1>
      <DisplayNameField value={nameValue} onChange={setName} />
      {error && <p className="warning">{error}</p>}
      <button type="button" onClick={handleJoin} disabled={submitting}>
        {submitting ? 'מצטרפים...' : 'הצטרפות'}
      </button>
    </div>
  )
}
