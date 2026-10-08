import { useState, type FormEvent } from 'react'
import { useProfile } from '../lib/profile-context'
import { acceptInvite, createCouple, extractInviteCode } from '../lib/couple'
import { DisplayNameField } from '../components/DisplayNameField'

// Onboarding for a signed-in user with no couple: start a new home, or join the
// partner's home with an invite code (or pasted link).
export default function Welcome() {
  const { profile, refresh, saveDisplayName } = useProfile()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // On success there is no explicit navigate: once refresh() sees the new couple,
  // CoupleGate moves us to "/", where an unpaired user is prompted to invite.
  async function run(action: () => Promise<string | null>) {
    if (!name.trim()) {
      setError('נא למלא שם.')
      return
    }
    setSubmitting(true)
    setError(null)

    const actionError = (await saveDisplayName(name)) ? await action() : 'משהו השתבש. נסו שוב.'
    if (actionError) {
      setError(actionError)
      setSubmitting(false)
      return
    }

    await refresh()
  }

  function handleCreate() {
    run(createCouple)
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault()
    run(() => acceptInvite(extractInviteCode(code)))
  }

  return (
    <div className="auth-form shell">
      <h1>ברוכים הבאים ל-TwoCents</h1>
      <DisplayNameField value={name} onChange={setName} />

      <h2>מתחילים בית חדש?</h2>
      <button type="button" onClick={handleCreate} disabled={submitting}>
        יצירת הבית שלנו
      </button>

      <h2>קיבלת הזמנה?</h2>
      <form className="auth-form" onSubmit={handleJoin}>
        <label>
          קוד או קישור הזמנה
          <input
            type="text"
            dir="ltr"
            autoComplete="off"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          הצטרפות
        </button>
      </form>

      {error && <p className="warning">{error}</p>}
    </div>
  )
}
