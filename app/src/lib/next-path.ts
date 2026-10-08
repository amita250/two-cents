// The `?next=` parameter carries the invite link through sign-up and email
// confirmation (D-023). Anyone can craft a link with any `next`, so only accept
// a path inside this app — never `//evil.com` or `https://evil.com` (open redirect).
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

// Builds "/sign-in?next=..." style links, omitting `next` when it is just home.
export function withNext(path: string, next: string): string {
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`
}
