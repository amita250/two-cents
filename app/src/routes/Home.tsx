import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/profile-context'
import { fetchMembers, type Member } from '../lib/couple'

// Landing screen for a user with a couple. Will become the expense entry screen;
// until the partner joins it prompts to invite them.
export default function Home() {
  const { profile } = useProfile()
  const [members, setMembers] = useState<Member[] | null>(null)

  useEffect(() => {
    fetchMembers().then(setMembers)
  }, [])

  if (!members) return null

  const partner = members.find((member) => member.id !== profile?.id)

  return (
    <div className="auth-form shell">
      <h1>TwoCents</h1>
      <p>שלום {profile?.display_name}</p>
      {partner ? (
        <p>הבית המשותף שלך עם {partner.display_name}.</p>
      ) : (
        <Link className="button-link" to="/partner">
          הזמנת בן/בת הזוג
        </Link>
      )}
      <button type="button" className="secondary" onClick={() => supabase?.auth.signOut()}>
        התנתקות
      </button>
    </div>
  )
}
