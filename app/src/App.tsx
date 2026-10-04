import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { isConfigured } from './lib/supabase'
import { AuthProvider } from './lib/auth-context'
import { RequireAuth } from './routes/RequireAuth'
import { RedirectIfAuthed } from './routes/RedirectIfAuthed'
import SignIn from './routes/SignIn'
import SignUp from './routes/SignUp'
import AuthCallback from './routes/AuthCallback'
import Home from './routes/Home'

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
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}