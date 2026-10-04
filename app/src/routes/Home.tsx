import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

// Placeholder landing screen for signed-in users.
// Will be replaced by the create/join-couple flow.
export default function Home() {
  const { session } = useAuth()

  return (
    <div className="shell">
      <h1>TwoCents</h1>
      <p>מחוברים בתור {session?.user.email}</p>
      <button onClick={() => supabase?.auth.signOut()}>התנתקות</button>
    </div>
  )
}