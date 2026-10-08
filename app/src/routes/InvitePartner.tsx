import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { createInvite, fetchLiveInvite, fetchMembers, inviteLink, type Invite } from '../lib/couple'

// Shows the couple's invite link for sharing (WhatsApp via the phone's share
// sheet, or copy). Single use, 48 hours (D-013).
export default function InvitePartner() {
  const [invite, setInvite] = useState<Invite | null>(null)
  const [coupleFull, setCoupleFull] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([fetchLiveInvite(), fetchMembers()]).then(([live, members]) => {
      setInvite(live)
      setCoupleFull(members.length >= 2)
      setLoading(false)
    })
  }, [])

  async function handleCreate() {
    setLoading(true)
    setError(null)
    setCopied(false)
    const result = await createInvite()
    setInvite(result.invite)
    setError(result.error)
    setLoading(false)
  }

  async function handleShare(link: string) {
    if (navigator.share) {
      // The user closing the share sheet rejects the promise; nothing to report.
      await navigator.share({ title: 'TwoCents', text: 'הצטרפו אליי ל-TwoCents:', url: link }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(link)
    setCopied(true)
  }

  if (loading) return null

  if (coupleFull) {
    return (
      <div className="auth-form shell">
        <h1>הבית המשותף מלא</h1>
        <p>בן או בת הזוג כבר הצטרפו, אין צורך בהזמנה.</p>
        <Link to="/">חזרה למסך הבית</Link>
      </div>
    )
  }

  const link = invite ? inviteLink(invite.code) : null
  const expires = invite
    ? new Date(invite.expires_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <div className="auth-form shell">
      <h1>הזמנת בן/בת הזוג</h1>
      {link ? (
        <>
          <p>שלחו את הקישור הזה. אפשר להשתמש בו פעם אחת בלבד, עד {expires}.</p>
          <code className="invite-link">{link}</code>
          <button type="button" onClick={() => handleShare(link)}>
            שיתוף
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}
          >
            {copied ? 'הועתק ✓' : 'העתקה'}
          </button>
          <button type="button" className="secondary" onClick={handleCreate}>
            יצירת קישור חדש (הקודם יבוטל)
          </button>
        </>
      ) : (
        <>
          <p>צרו קישור הזמנה ושלחו אותו לבן או בת הזוג.</p>
          <button type="button" onClick={handleCreate}>
            יצירת קישור הזמנה
          </button>
        </>
      )}
      {error && <p className="warning">{error}</p>}
      <Link to="/">חזרה למסך הבית</Link>
    </div>
  )
}
