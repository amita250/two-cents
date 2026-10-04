# TwoCents — working agreement for Claude

Shared expense tracking for couples. Built first for Amit and her partner; also a public
portfolio project showing secure design and test automation.

## How we work together

- **Amit leads; Claude implements.** Amit owns product, architecture decisions and test
  strategy. Claude writes the code.
- **Every significant decision is discussed before it is made, and explained.** Propose
  options with trade-offs and a recommendation, then wait for Amit's choice. Small,
  conventional choices don't need a discussion, but mention them.
- **Every decision is recorded** in `docs/decisions.md` (append-only, numbered `D-xxx`,
  format: Decision · Why · Trade-off). Reference decision numbers in code comments where
  the code embodies one.
- **Talk to Amit in Hebrew, addressing her in the feminine.** Code, comments, commits and
  docs are in English (public portfolio). Hebrew replies: avoid starting lines with
  English words, code or symbols — it breaks right-to-left display.
- Amit is a QA automation engineer (Python is her strongest language). She wants to
  understand code she did not write: explain what changed and why, at the level of the
  decision, not line by line.

## Git

- Commits written by Claude are **authored by Claude**, with Amit as co-author:
  ```
  git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit ...
  ```
  and end the message with `Co-Authored-By: Amit Amitay <amitamitay95@gmail.com>`.
  The goal is honest attribution: the history must show Claude wrote the code.
- Never commit secrets. `.env*` is ignored; only `app/.env.example` is committed.
  gitleaks runs in pre-commit and CI.

## Architecture (see docs/decisions.md for the reasoning)

- `supabase/migrations/` — Postgres schema. **Security lives in the database:** RLS on every
  table, server-set ownership fields, couple membership only via RPC functions
  (`create_couple`, `create_invite`, `accept_invite`). The client is never trusted.
- `app/` — React + TypeScript + Vite SPA, installed as a PWA, Hebrew RTL UI.
  Talks to Supabase directly with the public anon/publishable key only.
  **Never** use the service_role / secret key in the app.
- Hosting: Vercel, root directory `app/`. Production: https://two-cents-alpha.vercel.app.
  Env vars `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` are set in Vercel, never in git.
- Tests (planned): Python + pytest — database, API/security (supabase-py), E2E
  (Playwright for Python). Frontend unit tests in TypeScript. Tests never run against the
  production database.

## Rules for code

- Money is `numeric` in the database and handled as exact decimals in the app; never do
  money math with floats.
- Expense dates default to *today in the user's local time zone*, set by the client (the DB
  runs in UTC).
- Schema changes: a new migration file, never edit an applied one. The first migration
  (`20261004000001_initial_schema.sql`) was applied manually via the Supabase SQL editor.
- Keep the entry screen fast: amount + category should be the only required taps.

## Status (2026-10-04)

Done: schema + RLS (applied to Supabase), decision log D-001…D-020, secret scanning, app
skeleton, build CI, Vercel deployment, Supabase Auth Site URL set to the production URL.
Pending setup: add Redirect URLs in Supabase (previews `https://two-cents-*-amitamitay.vercel.app/**`,
local `http://localhost:5173/**`) when needed; confirm GitHub push protection is enabled
(Amit, repo Settings) before any real secret is handled.
Next: sign-up / sign-in screens (email + password, D-019) →
create couple / invite partner → expense entry screen → monthly list.
