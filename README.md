# TwoCents

Shared expense tracking for couples — built for two, private by design.

Two partners share one space: every expense, who paid and with which card or cash,
monthly reports by category, and (soon) trips in other currencies.
No bank connection: entry is manual, fast, and defaults do most of the work.

> Side project, built for real daily use and as a showcase of secure design and test automation.

## Status

🚧 Early development — data model and security layer in place.

## Stack

| Layer | Choice |
| --- | --- |
| Backend | [Supabase](https://supabase.com) — Postgres, auth, Row Level Security |
| Frontend | PWA (planned) |
| Tests | Database security tests, API tests, Playwright E2E (planned) |
| CI | GitHub Actions — secret scanning on every push |

## Security model

- **Couple isolation is enforced in the database**, not in the UI. Every table is protected by
  Row Level Security: you can only see rows that belong to your couple.
- **You can see everything in your couple, but edit only what you entered.**
- **Server-owned fields:** who created an expense, which couple it belongs to, and its converted
  amount are set by the database, never trusted from the client.
- **Joining a couple** happens only through a single-use, 48-hour invite code.
- **No secrets in git:** pre-commit hook + CI scan + GitHub push protection.

## How this project is built

TwoCents is built in collaboration with [Claude](https://claude.ai) (Anthropic's AI model).
**Amit** owns the product, the architecture decisions and the test strategy; **Claude** writes
the code. Every decision and its reasoning is recorded in the decision log, and every commit
shows who wrote it: commits written by Claude are authored by Claude, with Amit as co-author.

## Design decisions

Every significant decision — and its trade-offs — is recorded in
[`docs/decisions.md`](docs/decisions.md).

## Project structure

```
supabase/migrations/   database schema, RLS policies, functions
docs/decisions.md      decision log
.github/workflows/     CI
```
