# FairShare Roadmap

Built from [PRODUCT.md](PRODUCT.md). The goal is one loop that works perfectly:
**add an expense → see who owes whom → settle with UPI → everyone at ₹0.**

**Rule for every item:** does it make that loop faster, clearer or more trustworthy? If not, it waits until real users ask for it.

**Start:** Stage 1 (the foundation, already done).
**End:** Stage 4. The app is live, real people have used it for a real trip or flat, and the resume bullets below are filled in with measured numbers.

---

## Stage 1 — Foundation  ✅ *done (local branch `phase-1-3`)*

The engineering the product depends on. Kept as-is.

- [x] Exact money math in paise; splits must add up to the total; remainders distributed fairly
- [x] Debt simplification (at most *n − 1* payments per group)
- [x] Security: required JWT secret, rate limiting, hashed one-time tokens, enumeration-safe login, security headers, strict CORS
- [x] Email verification and password reset with real delivery (Brevo)
- [x] Two-sided settlements (receiver confirms) and a per-entry History / audit log
- [x] Soft delete; atomic writes; one rule for what counts toward balances
- [x] Faster dashboard queries (recent activity 5.6 s → 63 ms)
- [x] Per-user browser cache (no data leaks between accounts)
- [x] Local development on the Firestore emulator with demo data
- [x] 95 unit and API tests; GitHub Actions CI

## Stage 2 — Make the core loop effortless  ✅ *done locally (uncommitted)*

Fix everything that gets in the way of adding, understanding and settling expenses.

**Remove what blocks or confuses the core**
- [x] Removed the admin requirement: any member can add expenses from the moment a group is created
- [x] Removed admin elections / polls, "mark as wrong", "delete from me", the personal tracker and bulk delete (routes, UI, tests)
- [x] Simple permissions: the payer or the person who added an expense can edit/delete it; the group creator can delete the group and reset its invite link
- [x] Leaving or deleting a group requires settled balances; member list no longer exposes emails

**Add expense (one screen)**
- [x] **Paid by** any member (default: you), changeable when editing
- [x] Split **equally**, by **amounts** or by **percent**, saved as **one** expense; shares always add up to the paisa
- [x] Expense date (defaults to today)

**Joining a group**
- [x] **Invite link** (`/join/<code>`): share on WhatsApp, copy, or native share; survives sign-up + email verification; creator can reset it; join attempts rate-limited

**Screens rebuilt around balances** (see PRODUCT.md section 4)
- [x] Home: total balance, payments waiting for confirmation, people (with per-group breakdown and Settle up), groups; one `/overview` request
- [x] Group: your balance and suggested payments first, then activity grouped by month
- [x] Settle up: pay with UPI (deep link + QR) → "I've paid" → waiting for confirmation; receiver sees Confirm / Not received
- [x] "Waiting for confirmation" section at the top of Home and of each Group, oldest first, so a late payment never gets buried in the activity list; it disappears once confirmed or rejected (History keeps the record)
- [x] Frontend rebuilt from scratch: `api/`, `auth/`, `hooks/`, `components/`, `pages/`, `utils/`; one stylesheet with light/dark tokens; mobile-first; old 1,300-line `GroupView.jsx` gone
- [x] Old endpoints removed (`/summary`, `/recent`); Home and Group use the same balance calculation, so they always agree

**Tests:** 70 backend unit + 61 API tests, 16 frontend tests (split math, formatting, UPI link), all in CI. Every screen checked in headless Edge (light and dark) with no JavaScript errors.

**Done when:** a new user can create a group, invite 2 friends by link, add 3 expenses paid by different people, and settle up, without help and without errors.
✅ Verified end to end against the running app (API scenario + screenshots). Still to do: your own click-through in the browser.

## Stage 3 — Launch

- [x] Pre-launch checks: no Firestore query needs a composite index; Vercel SPA rewrite in place; removed the unused `/api/users/search` endpoint (it let any user list other people's emails); server refuses to start in production with the emulator variable set or a short `JWT_SECRET`
- [x] Test on a real phone over Wi-Fi (Vite proxies `/api` and Socket.io to the backend); UPI button opens the payment app
- [ ] Deploy: `JWT_SECRET`, `NODE_ENV=production`, Brevo settings on Render; no emulator variable in production; frontend and backend deployed together
- [ ] Verify rate limiting sees real client IPs on Render
- [ ] Demo account with sample data for recruiters
- [ ] README: live link, demo login, screenshots or a short GIF, architecture diagram, key design decisions (paise math, debt simplification, settlement confirmation)
- [ ] Error monitoring (Sentry) so production problems are visible

**Done when:** the live site runs the Stage 2 app, and a stranger can try it from the README in under a minute.

## Stage 4 — Real users and results

- [ ] Use it for a real trip, flat or hostel group (3+ people, at least a month)
- [ ] Collect feedback: what was confusing, what was missing
- [ ] Measure: time to add an expense, number of users/groups/expenses, amount settled
- [ ] Fix the top issues users report

**Done when:** the resume bullets below have real numbers in them. **This is the end of the roadmap.**

---

## Later: only if real users ask for it

Not planned until Stage 4 feedback shows they're needed:
- Expense categories and simple spending charts
- Receipt photos
- Recurring expenses (rent, subscriptions)
- Payment reminders ("nudge")
- Export to CSV / PDF
- Installable app (PWA) with push notifications
- Multiple currencies for trips abroad
- httpOnly-cookie login (needs the API served from the frontend's domain first)

## Dropped

Removed because they don't serve the core loop (see PRODUCT.md section 5):
admin elections and polls, admin "mark as wrong", expense disputes / voting, "delete from me", personal expense tracker.

---

## Resume bullets (fill in the numbers in Stage 4)

- Built and launched **FairShare**, an expense-splitting app (React, Node/Express, Firestore, Socket.io) used by **N** people to split **₹X** across **Y** groups.
- Built one-tap settlement with UPI deep links and a two-party confirmation flow, so debts are only cleared when the receiver confirms, with every change recorded in an audit log.
- Eliminated rounding errors by doing all money math in integer paise with fair remainder distribution; debt simplification settles a group of *n* people in at most *n − 1* payments.
- Cut the dashboard's recent-activity API from 5.6 s to 63 ms (89× faster) and its database reads by 65% by replacing N+1 lookups with batched reads. *(Re-measure the new `/overview` endpoint in Stage 3.)*
- Hardened authentication with rate limiting, hashed one-time tokens, enumeration-safe login, security headers and strict CORS.
- Maintained 145+ backend and frontend tests (API tests against the Firestore emulator), run in GitHub Actions CI on every pull request.
