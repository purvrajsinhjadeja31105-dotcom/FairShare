# 💸 FairShare – Expense Sharing Web Application

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://fair-share-sage.vercel.app/)

**Split bills with friends in seconds, and settle with one UPI scan.**

For trips, flatmates and nights out: anyone in the group adds what they paid, everyone sees who owes whom in real time, and debts are settled with a UPI payment that the receiver confirms. See [PRODUCT.md](PRODUCT.md) for the product definition and [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) for the plan.

---

## 🚀 Features

- **Groups with invite links:** create a group and share a link on WhatsApp; friends join after signing in
- **Add an expense in one screen:** anyone can be the payer; split equally, by exact amounts or by percent; shares always add up to the paisa
- **Balances first:** Home shows your total and each person you owe or who owes you; the group screen suggests the fewest payments to settle everyone
- **Settle with UPI:** one tap opens Google Pay, PhonePe or Paytm with the amount filled in (QR code on desktop)
- **Trusted payments:** "I've paid" stays pending until the receiver confirms, so nobody can wipe out a debt on their own
- **History on every entry:** who added, edited or deleted it, and what changed
- **Live updates:** changes appear instantly for everyone in the group (Socket.io)
- **Secure accounts:** email verification, password reset, rate limiting, hashed one-time tokens

---

## 🛠️ Tech Stack

**Frontend**
- React.js (Vite)
- React Router
- Context API

**Backend**
- Node.js
- Express.js

**Database**
- Cloud Firestore (Firebase Admin SDK)
- Firestore Emulator for local development

**Real-Time**
- Socket.io

**Authentication & Security**
- JWT (JSON Web Tokens)
- bcrypt

**Other Tools**
- Nodemailer (Email Service)
- Vanilla CSS (Custom UI Design)

---

## 🏗️ Architecture

### Backend (`backend/`)
- `routes/`: auth, groups (incl. invite links), expenses (incl. settlements, history, `/overview`), users, notifications
- `services/`: pure business logic, unit-tested without a database: `balances` (group balances and the Home overview), `debtSimplifier`, `ledger` (what counts toward balances), `expenseRules`, `auditLog`, `emailService`
- `utils/money.js`: all money math in integer paise
- `middleware/`: auth, group membership, validation (Zod), rate limiting, errors

### Frontend (`frontend/src/`)
- `pages/`: Home, Group, ExpenseForm, Join, Activity, Account, auth pages, Landing
- `components/`: settle-up sheet (UPI), invite sheet, expense rows and details, shared UI
- `api/`: one function per endpoint; `auth/`: session state; `hooks/useApiData`: cached loading + live refresh
- `utils/`: split math, formatting, UPI link (unit-tested with Vitest)

---

## 📊 Database Design

The application uses Cloud Firestore with the following collections:

- `users` – User details and authentication data
- `groups` – Name, creator, member IDs and invite code
- `expenses` – Expenses and payments (settlements) with per-member splits, date, and status for payments (pending / confirmed / rejected); deleted entries are kept with `deleted_at`
- `audit_logs` – Append-only history of every change to an expense or payment
- `notifications` – User activity alerts

---

## 🔒 Security Features

- Passwords hashed with bcrypt; JWT sessions; the server refuses to start without a JWT secret
- Verification and reset tokens stored as SHA-256 hashes, with expiry
- Rate limiting on login, sign-up, password reset and invite joins
- Security headers (helmet), strict CORS for the API and Socket.io
- Enumeration-safe login and password reset

---

## 💻 Run Locally

Local development uses the **Firestore emulator**, so nothing you do on your machine touches production data.

**Prerequisites:** Node.js 22+, Java 11+ (required by the Firestore emulator)

```bash
npm run setup                               # install root, backend and frontend dependencies
cp backend/.env.example backend/.env        # then set JWT_SECRET to any long random string
cp frontend/.env.example frontend/.env
npm run dev                                 # emulator + demo users + backend + frontend
```

| What | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:5000/api |
| Emulator UI (browse the database) | http://localhost:4000 |

Demo logins (reset on every `npm run dev`; no groups are created, so start by making one): `asha@example.com`, `bala@example.com`, `chen@example.com`, all with password `password123`.

With `EMAIL_MODE=console`, verification and password-reset links are printed in the terminal instead of being emailed.

**Tests:** `npm test` (backend unit) · `npm --prefix backend run test:api` (API tests on the emulator) · `npm --prefix frontend test` · `npm run lint`

---

## 🚀 Deployment

- Frontend deployed on Vercel
- Backend powered by Node.js & Express
- Real-time communication using Socket.io

---

## 📈 Future Improvements

See [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md): launch, then real users, then only the features they ask for.

---

## 📌 Project Highlights

- Exact money math in integer paise: splits always add up, with fair remainder distribution
- Debt simplification: a group of *n* people settles in at most *n − 1* payments
- Two-party payment confirmation and an append-only audit log
- Real-time sync across users with Socket.io
- 145+ tests (backend unit, API tests against the Firestore emulator, frontend), run in GitHub Actions CI

---

## 👨‍💻 Author

**Purvrajsinh Jadeja**
