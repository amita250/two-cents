import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { isConfigured } from './lib/supabase'
import { AuthProvider } from './lib/auth-context'
import { RequireAuth } from './routes/RequireAuth'
import { RedirectIfAuthed } from './routes/RedirectIfAuthed'
import SignIn from './routes/SignIn'
import SignUp from './routes/SignUp'
import AuthCallback from './routes/AuthCallback'
import Home from './routes/Home'
import { ProfileProvider } from './lib/profile-context'
import { CoupleGate } from './routes/CoupleGate'
import Welcome from './routes/Welcome'
import AcceptInvite from './routes/AcceptInvite'
import InvitePartner from './routes/InvitePartner'

export default function App() {
  if (!isConfigured) {
    return (
      <main className="shell">
        <h1>TwoCents</h1>
        <p className="warning">
          חסרות הגדרות חיבור ל-Supabase. העתיקו את <code>.env.example</code> לקובץ{' '}
          <code>.env.local</code> ומלאו את הערכים.
        </p>
      </main>
    )
  }

  return (
    <AuthProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/sign-in"
              element={
                <RedirectIfAuthed>
                  <SignIn />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/sign-up"
              element={
                <RedirectIfAuthed>
                  <SignUp />
                </RedirectIfAuthed>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Not behind RequireAuth: the partner may open it before having an account. */}
            <Route path="/invite/:code" element={<AcceptInvite />} />
            <Route
              path="/welcome"
              element={
                <RequireAuth>
                  <CoupleGate need="none">
                    <Welcome />
                  </CoupleGate>
                </RequireAuth>
              }
            />
            <Route
              path="/partner"
              element={
                <RequireAuth>
                  <CoupleGate need="couple">
                    <InvitePartner />
                  </CoupleGate>
                </RequireAuth>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <CoupleGate need="couple">
                    <Home />
                  </CoupleGate>
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  )
}