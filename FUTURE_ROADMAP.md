# FairShare Roadmap

Goal: turn FairShare from a working demo into a production-grade app that real people use,
with the correctness, security, testing and operations a reviewer expects from a professional codebase.

**Where it starts:** make the money math trustworthy (Phase 1).
**Where it ends:** a live app with real users, green CI, monitoring, and measured results you can put on a resume (Phase 5).

Work top to bottom. Each phase is shippable on its own; don't start features (Phase 4) before the foundations (Phases 1–2) are done.

---

## Phase 1 — Correct money & core security  *(in progress)*

Money bugs are the one thing a finance app can't have.

- [x] Do all money math in integer paise; round every stored amount to 2 decimals
- [x] Equal splits distribute the leftover paisa (₹100 / 3 = 33.34 + 33.33 + 33.33, not 99.99)
- [x] Reject expenses whose splits don't add up to the total, or contain duplicate / negative entries
- [x] Payer and every split participant must be members of the group
- [x] Settlements: both parties must be members, can't pay yourself, and you can only record a payment you sent or received
- [x] Debt simplifier works in paise (no float drift)
- [x] Server refuses to start without `JWT_SECRET` (no `'secret'` fallback)
- [x] Fix custom-split bug (`parseInt` on Firestore string IDs made custom splits unusable)
- [x] Fix validation errors returning 500 instead of 400 (Zod 4 renamed `error.errors` to `error.issues`)
- [x] Fix expense edit wiping splits / writing `NaN` when a field is omitted
- [x] Jest test suite for money utils, split rules, validation schemas and the debt simplifier
- [x] Fix broken ESLint config and clear lint errors
- [x] GitHub Actions CI: backend tests + frontend lint + build on every push / PR

## Phase 2 — Security hardening & performance  *(done locally; deploy steps pending)*

- [x] Real email delivery via the Brevo HTTP API (Render's free tier blocks outbound SMTP); `console` mode for local dev
- [x] Local development on the Firestore emulator with seeded demo data (`npm run dev`) — local work never touches production
- [x] Rate limiting: failed logins per IP+email, email-sending routes per IP, and a broad per-IP API limit
- [x] Verification / reset tokens stored as SHA-256 hashes; verification links expire after 24 h (old emailed links still work)
- [x] Login checks the password before verification status (no account enumeration)
- [x] Socket.io CORS restricted to the allowed origins; `helmet` security headers; 100 kB JSON body limit
- [x] Error handler returns readable messages and hides internal errors in production; malformed JSON → 400
- [x] `/expenses/recent`: pick the 5 newest first, then batch-load names — **5,600 ms → 63 ms (89×), 65% fewer reads** on 200 expenses
- [x] `/expenses/summary`: batched lookups (**4.3× faster**); fixed balances merging people with the same username; now returns `userId` (fixes Settle on the Owed Summary page)
- [x] `app.js` / `server.js` split; 26 Supertest API tests against the emulator (isolated test project), run in CI
- [x] Frontend no longer logs request bodies (passwords) to the browser console
- [x] Repo cleanup: removed dead MySQL scripts/schema and ad-hoc test scripts; docs updated to Firestore
- [ ] **Deploy:** set `JWT_SECRET`, `EMAIL_MODE=brevo`, `BREVO_API_KEY`, `EMAIL_FROM` on Render and confirm emails arrive in production
- [ ] Move JWT from `localStorage` to an httpOnly cookie — needs the API served from the frontend's domain first (Vercel rewrite/proxy), otherwise Safari blocks the cross-site cookie
- [ ] `/expenses/recent` with an indexed `orderBy + limit(5)` query (needs a Firestore composite index in production)
- [ ] Structured logging with `pino`

## Phase 3 — Trust & auditability  *(core done locally)*

- [x] Two-sided settlements: "I paid you" stays *pending* (no effect on balances) until the receiver confirms or rejects it; a receiver recording "you paid me" counts immediately
- [x] Confirm/reject runs in a Firestore transaction, so double clicks or two devices can't change the status twice
- [x] Soft-delete expenses (`deleted_at` / `deleted_by`) instead of erasing them
- [x] Append-only audit log (`audit_logs`): created / edited (with field-level before → after) / deleted / marked wrong / settlement recorded, confirmed, rejected
- [x] Per-entry History shown in the expanded expense row
- [x] Expense + notifications + audit entry written in one atomic batch
- [x] One rule for what counts toward balances (`services/ledger.js`), used by every balance calculation; legacy settlements keep counting
- [x] UPI QR link URL-encodes the UPI ID
- [ ] Expense disputes: any member can dispute; resolved by group vote (reuses the poll system)

## Phase 4 — Product features  *(pick 3–4, do them well)*

- [ ] UPI deep link + QR on "Settle up" (receiver's `upi_id` + exact amount)
- [ ] Expense categories + analytics page (monthly trend, category split) with Recharts
- [ ] Invite by shareable link instead of username search only
- [ ] Receipt photo upload (Firebase Storage)
- [ ] Recurring expenses (rent, subscriptions) via a scheduled job
- [ ] CSV / PDF export of group history
- [ ] Multi-currency for trip groups

## Phase 5 — Polish, launch & measure

- [ ] Break `GroupView.jsx` (1,300+ lines) into components and hooks
- [ ] TypeScript on the backend (types generated from the Zod schemas)
- [ ] Sentry error monitoring on frontend and backend
- [ ] OpenAPI / Swagger docs at `/api/docs`
- [ ] PWA (installable) + push notifications
- [ ] Handle Render cold starts (keep-alive ping or a "waking server" UI state)
- [ ] Playwright end-to-end tests for signup → group → expense → settle
- [ ] README: live demo link, demo account, screenshots/GIF, architecture diagram, design decisions
- [ ] Get real users (friends, hostel, trip group) and track usage for a month

**Definition of done:** CI green, test coverage reported, app live with a demo account, real users,
and the numbers below filled in with measured values.

---

## Resume bullets (fill in real numbers as you finish each phase)

- Built and deployed a real-time expense-splitting app (React, Node/Express, Firestore, Socket.io) used by **N** users to track **₹X** in shared expenses.
- Eliminated rounding errors in shared-expense math by moving all calculations to integer minor units with deterministic remainder distribution, backed by **N** unit tests.
- Implemented a greedy debt-simplification algorithm that settles a group of *n* members in at most *n − 1* transactions.
- Designed a two-party settlement confirmation flow with transactional state changes and an append-only audit log, so no user can unilaterally erase a debt and every ledger change is traceable.
- Cut the recent-activity API from 5.6 s to 63 ms (89× faster) and its database reads by 65% by replacing N+1 lookups with batched reads, measured with a before/after benchmark.
- Hardened authentication with rate limiting, SHA-256-hashed one-time tokens with expiry, enumeration-safe login, security headers and strict CORS.
- Set up GitHub Actions CI running 95 unit and API tests (API tests against the Firestore emulator), lint and production builds on every pull request.
