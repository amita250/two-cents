import { isConfigured } from './lib/supabase'

export default function App() {
  return (
    <main className="shell">
      <h1>TwoCents</h1>
      <p>מעקב הוצאות משותף לזוגות.</p>
      {!isConfigured && (
        <p className="warning">
          חסרות הגדרות חיבור ל-Supabase. העתיקו את <code>.env.example</code> לקובץ{' '}
          <code>.env.local</code> ומלאו את הערכים.
        </p>
      )}
    </main>
  )
}
