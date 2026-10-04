const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'אימייל או סיסמה שגויים.',
  'Email not confirmed': 'יש לאשר את כתובת האימייל לפני ההתחברות. בדקו את תיבת הדואר.',
  'Password should be at least 6 characters': 'הסיסמה חייבת להיות באורך 6 תווים לפחות.',
}

// Supabase error messages come back in English; never show them raw in a Hebrew UI.
export function translateAuthError(message: string): string {
  return KNOWN_MESSAGES[message] ?? 'משהו השתבש. נסו שוב.'
}