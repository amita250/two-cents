# Decision log

Every significant decision in TwoCents, why it was made, and what it costs.
Newest decisions are appended at the bottom. A decision is never edited after the
fact — if it changes, a new entry supersedes it.

Format: **Decision** · **Why** · **Trade-off**

---

## D-001 · Build in code, not a no-code builder (2026-10-04)

**Decision:** Write the app in code instead of using a no-code platform (e.g. Base44).
**Why:** The project has two goals: an app we actually use, and technical growth in
architecture, security and test automation. A no-code builder gives little control over
the data model and permissions and is hard to cover with real automated tests.
**Trade-off:** Slower to a first working version (~1 extra week, accepted).

## D-002 · Supabase as the backend (2026-10-04)

**Decision:** Supabase (managed Postgres + auth + auto-generated API). Considered: Firebase/Firestore.
**Why:**
- The data is relational (expenses → category, payment method → owner → couple), and the
  core MVP output is a monthly report by category: one `GROUP BY` in SQL, manual
  aggregation in a document store.
- Couple isolation is enforced *inside the database* with Row Level Security, which can be
  tested directly.
- Low lock-in: it is plain Postgres; SQL skills transfer everywhere, including QA work.
**Trade-off:** Firestore has excellent built-in offline sync. Offline entry while travelling
will need to be built (a local queue) when we get to trip mode.

## D-003 · A "couple" is the unit that owns all data (2026-10-04)

**Decision:** All shared data (payment methods, categories, expenses) belongs to a `couple`,
not to a user. The default currency is a property of the couple.
**Why:** Both partners see the same data and the same reports, so they must agree on one
reporting currency.

## D-004 · Max two users per couple, one couple per user (2026-10-04)

**Decision:** Enforced in the database (a trigger), not only in the UI.
**Why:** It is the product's definition, and enforcing it at the lowest layer means no
code path (UI bug, direct API call, race condition) can break it.
**Trade-off:** "Leaving a couple" / switching couples is out of scope for now.

## D-005 · `couple_id` on every table + composite foreign keys (2026-10-04)

**Decision:** Every table carries `couple_id`, even where it could be derived through a join.
References use composite keys, e.g. `(payment_method_id, couple_id)`.
**Why:**
- The security rule becomes identical and trivial for every table:
  *"you may see a row only if its `couple_id` is your couple."* Simple rules are easy to
  review and hard to get wrong.
- Composite FKs make it impossible, at the database level, for an expense in couple A to
  point at a category or card of couple B.
- `created_by` and `couple_id` on expenses are set by the server from the logged-in user;
  whatever the client sends is ignored.
**Trade-off:** Some redundancy (deliberate denormalisation).

## D-006 · "Who paid" is derived from the payment method (2026-10-04)

**Decision:** No separate "paid by" field. Each payment method has an owner (or none = shared).
Cash is modelled as a payment method per person ("Cash – Amit").
**Why:** Two fields could contradict each other ("paid by partner" + "Amit's Visa"). One field
also means one less tap on the entry screen — entry speed is our main success metric.
Supports any number of cards per person, cash, and joint accounts with no schema change.

## D-007 · Money is `numeric`, never floating point (2026-10-04)

**Decision:** Amounts are `numeric(12,2)`.
**Why:** Floating point cannot represent most decimal amounts exactly (0.1 + 0.2 ≠ 0.3).
Unacceptable for money.

## D-008 · Store original amount, rate, and converted amount (2026-10-04)

**Decision:** Each expense stores `amount` + `currency` as entered, the `exchange_rate` on the
day of entry, and `amount_in_default` (computed by the database: `round(amount × rate, 2)`).
When the currency equals the couple's default, the rate is forced to 1.
**Why:** Rates change daily. Converting at report time would make past trip expenses
"move" every time you look. Computing the converted amount server-side means the client
cannot store an inconsistent value. Trip mode can be added later with no migration.
**Open:** Where the rate comes from (manual entry vs. an exchange-rate API) — decided when
we build trip mode.
**Known limitation:** Changing the couple's default currency later does not recompute old
expenses. To be addressed (block it, or recompute) before it matters.

## D-009 · Payment methods and categories are archived, never deleted (2026-10-04)

**Decision:** `is_archived` flag; delete permission is not granted at all.
**Why:** A cancelled card still has history. Archived items disappear from pickers but old
expenses keep pointing at them.

## D-010 · Personal default payment method (2026-10-04)

**Decision:** Each profile has a `default_payment_method_id`.
**Why:** Both partners are expected to enter expenses (shared responsibility). When each opens
the entry screen, *their own* card is pre-selected, so most entries are: amount + category.

## D-011 · Per-couple categories, seeded with Hebrew defaults (2026-10-04)

**Decision:** Each couple gets its own editable list, seeded with 12 defaults
(supermarket, eating out, public transport, …).
**Why:** Couples categorise differently; a shared global list could not be edited safely.

## D-012 · Expense date separate from record date (2026-10-04)

**Decision:** `expense_date` (when the money was spent) vs. `created_at` (when it was entered).
The UI defaults `expense_date` to *today in the user's local time zone*.
**Why:** Expenses are often entered a day or two later; monthly reports must use the
spending date. The default is set by the client because the database runs in UTC — near
midnight in Israel, the server's "today" would be wrong.

## D-013 · Partner joins with a single-use, expiring invite link (2026-10-04)

**Decision:** A random code (72 bits, URL-safe) embedded in a link, shareable via WhatsApp,
also typeable as text. Valid 48 hours, single use, one live invite per couple.
Considered: email invites (needs outbound email setup — not worth it for the MVP), QR code
(a link already covers it).
**Why / security:**
- Unguessable code; useless once the partner has joined, even if the link leaks.
- Any bad code (non-existent, used, expired) returns the *same* error, so responses don't
  reveal which codes exist.
- Row lock on the invite: two people racing for the same code → only one succeeds.
**Follow-up:** rate-limit `accept_invite` attempts.

## D-014 · Read everything in the couple, edit only what you entered (2026-10-04)

**Decision:** Both partners see all expenses; only the person who entered an expense can
edit or delete it. Enforced by RLS policies, not the UI.
**Why:** Tracking is a shared responsibility — both partners enter expenses and each owns
their entries.

## D-015 · Public repository, secrets protected from day one (2026-10-04)

**Decision:** The repo is public (portfolio). No secret ever enters git.
**How:** `.env*` files are git-ignored with a committed `app/.env.example`; a gitleaks pre-commit hook
blocks secrets locally; a gitleaks CI job scans every push and PR; GitHub secret scanning
with push protection is enabled on the repo.
**Why:** A secret committed once stays in git history even after deletion. Prevention is the
only reliable control. Note: the Supabase *anon* key is designed to be public (RLS is what
protects data); the *service role* key bypasses RLS and must never leave the server.

## D-016 · Supabase project security settings (2026-10-04)

**Decision:** Data API enabled; *automatically expose new tables* **off**; *automatic RLS*
**on**. Project hosted in West EU (Ireland). GitHub integration not connected for now.
**Why:**
- Auto-expose grants API access to every new table by default. Our migrations follow least
  privilege: revoke everything, then grant only the operations and columns needed.
- Automatic RLS is a safety net: our migrations already enable RLS explicitly on every table,
  but a future table can never be created without it.
- Europe is the closest region to Israel (lower latency).
- The GitHub integration would auto-deploy schema changes from the repo and gives Supabase
  access to it — to be decided together with the migration workflow.

## D-017 · Frontend: React + TypeScript + Vite, as a browser-only PWA (2026-10-04)

**Decision:** A single-page app (no server of our own), installed on phones as a PWA.
Considered: Next.js.
**Why:**
- Next.js's main advantage is server-side code. All our security and sensitive logic already
  lives in the database (RLS, triggers, functions), so there is nothing to run on a server.
- Smaller, simpler project; free static hosting; a good target for Playwright.
- TypeScript types can be generated from the database schema: if a column changes, the app
  stops compiling until it is updated — bugs caught before any test runs.
**Note:** The app is built and type-checked in CI on every push.

## D-018 · Tests are written in Python (2026-10-04)

**Decision:** E2E (Playwright for Python), API/security tests (supabase-py) and database tests
are written in Python with pytest. Only unit tests of frontend code stay in TypeScript.
**Why:** Tests exercise the system from the outside, like a user or an attacker, so they do not
need to share the app's language. Python is the test owner's strongest language.
**Trade-off:** Two toolchains in the repo and in CI (Node + Python) — common in real teams.

## D-019 · Sign-in with email + password for the MVP (2026-10-04)

**Decision:** Email + password via Supabase Auth. Google sign-in may be added later.
Considered: magic links, Google OAuth.
**Why:**
- Simplest flow; works the same in the browser and in the installed PWA.
- Magic links: the built-in email service on the free plan is heavily rate-limited, and the
  link opens in the browser instead of the installed app.
- Google OAuth: needs a Google Cloud project and more secrets to manage.
- Testability: automated tests must sign in as several users (both partners, an attacker
  from another couple). With passwords that is one line of code; with links or OAuth the
  tests must work around the sign-in flow.

## D-020 · Hosting on Vercel (2026-10-04)

**Decision:** Vercel (Hobby plan), deploying from GitHub; project root is `app/`.
Considered: Netlify, Cloudflare.
**Why:**
- Free for personal, non-commercial use (our case), with no limit on the number of deployments.
- Automatic preview deployment for every branch / pull request: E2E tests can run against
  a change before it reaches the version we use daily.
- Netlify's free plan (credit-based since 2025) allows roughly 20 production deploys a month
  and pauses the site when credits run out. Cloudflare Pages is in maintenance mode, and
  Workers needs manual setup for previews.
**Trade-off:** If TwoCents ever becomes commercial, it must move to a paid plan or another
host. The app is static, so moving is cheap.
**Config:** Supabase URL and public key are set as Vercel environment variables, never in git.
`app/vercel.json` routes every path to the SPA.

## D-021 · Client-side routing with react-router (2026-10-04)

**Decision:** Add `react-router` and give every top-level screen a real URL from the start
(e.g. `/sign-in`, `/sign-up`, `/invite/:code`, `/auth/callback`), instead of switching
screens with conditional rendering over app state. Considered: no router, just React state.
**Why:**
- The partner invite (D-013) is a link that must open a specific screen directly — a deep
  link, not reachable by navigating the UI from scratch.
- Supabase Auth email-confirmation redirects to a URL; that URL needs a route to land on.
- Mobile back button/gesture should move between app screens, not exit the installed PWA —
  real browser history entries give this for free.
- E2E tests (Playwright, D-018) can open any screen directly by URL instead of driving the
  UI through every prior step first.
**Trade-off:** More upfront setup than conditional rendering, and routes/guards (e.g.
"redirect to `/sign-in` if signed out") must be kept in sync as screens are added.
**Note:** `app/vercel.json` already rewrites every path to `index.html` (D-020), which is
required for client-side routes to survive a refresh or a direct deep link.

## D-022 · Sign-up never reveals whether an email is already registered (2026-10-04)

**Decision:** The sign-up screen shows the identical "check your email" message whether
the email is brand new or already has an account — the "User already registered" error
from Supabase Auth is caught and treated the same as a successful signup, never shown to
the user.
**Why:** Same principle as the invite codes in D-013: a response that differs based on
whether an email exists lets an attacker enumerate registered users. The error message
Supabase returns by default does exactly that, so the app must not surface it.
**Requires:** Supabase project setting *Confirm email* must stay **on** (Authentication →
Providers → Email). Without it, a brand-new signup gets an instant session and redirects
immediately, while an "already registered" attempt does not — that difference in behavior
would itself leak the same information the hidden error message was supposed to hide.
**Trade-off:** A user who already has an account and tries to sign up again sees "check
your email" instead of a direct "you already have an account, sign in" hint — slightly
less helpful UX, accepted for the security property.

## D-023 · The invite code travels through sign-up inside the confirmation link (2026-10-08)

**Decision:** A partner who opens `/invite/:code` without an account is sent to
`/sign-up?next=/invite/:code`. Sign-up puts `next` into the email-confirmation redirect
(`/auth/callback?next=...`), and the callback routes there after confirming. Sign-in honours
the same `next`. Considered: keeping the code in browser storage only.
**Why:**
- The confirmation email often opens in a different browser than the one that signed up
  (WhatsApp's in-app browser → mail app → default browser); browser storage would be lost
  there, a URL is not.
- `next` is attacker-controllable, so `safeNextPath` accepts only in-app paths (`/...`, not
  `//host` or `/\host`) — otherwise it is an open redirect.
- Fallback if `next` is lost anyway: `/welcome` accepts a pasted code *or* the full link.
**Requires:** Supabase Auth → URL Configuration → Redirect URLs must include
`https://two-cents-alpha.vercel.app/**` (and `http://localhost:5173/**` for local dev).
Supabase silently falls back to the Site URL root for a non-allowed redirect, which would
drop `next` without any error.
**Trade-off:** The invite code ends up in the confirmation email and Supabase's auth logs.
Accepted: codes are single use and expire in 48 hours (D-013).

## D-024 · One-tap couple creation; display name asked once during onboarding (2026-10-08)

**Decision:** "Create our home" calls `create_couple` with fixed defaults (name "הבית שלנו",
currency ILS) — no form. Both onboarding screens (`/welcome`, `/invite/:code`) ask for a
display name, prefilled with the current value (the email prefix by default), saved through
the existing `profiles` update grant. Couple membership screens are guarded by `CoupleGate`
(signed in + no couple → `/welcome`; signed in + couple → app).
**Why:** Couple name and currency are rarely changed and can live in settings later; the
display name, however, is what the partner sees as "who paid" (D-006), and an email prefix
is a poor label. Invite errors other than "you're already in a couple" — including "couple is
full" — show one generic message (D-013).
**Trade-off:** One extra field on onboarding; currency must be changed later in settings for
non-ILS couples.

## D-025 · Feature branches and pull requests; merged with a merge commit (2026-10-08)

**Decision:** `main` is production (Vercel deploys it) and changes only through pull requests.
Each feature gets its own branch (`feature/<name>`, `fix/<name>`, `docs/<name>`), pushed to
GitHub, opened as a PR, and merged by Amit on GitHub with a **merge commit**.
Considered: committing straight to `main` (the setup until now); merging branches locally
without a PR; squash and rebase merges.
**Why:**
- Nothing reaches production without a review point — CI (build + gitleaks) and a Vercel
  preview deployment run on the PR before merge.
- One PR per feature keeps the history readable and is the workflow a portfolio reviewer
  expects.
- Merge commits keep each commit exactly as authored, so Claude stays the author and Amit
  the co-author (see CLAUDE.md). A squash merge would re-author everything to the PR opener.
**Trade-off:** A few more steps per feature than pushing to `main`, and the history is not
linear. Preview deployments need the preview Redirect URL in Supabase before auth flows work
there.
