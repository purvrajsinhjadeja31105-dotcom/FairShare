# 💸 FairShare

**Split bills with friends in seconds, and settle up with one UPI tap.**

<p>
  <a href="https://fair-share-seven-weld.vercel.app/"><img alt="Open the live app" src="https://img.shields.io/badge/▶%20Open%20Live%20App-fair--share--seven--weld.vercel.app-22c55e?style=for-the-badge&logo=vercel&logoColor=white"></a>
</p>

[![CI](https://github.com/purvrajsinhjadeja31105-dotcom/FairShare/actions/workflows/ci.yml/badge.svg)](https://github.com/purvrajsinhjadeja31105-dotcom/FairShare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![Firestore](https://img.shields.io/badge/Cloud%20Firestore-FFCA28?logo=firebase&logoColor=black)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?logo=socketdotio&logoColor=white)

For trips, flatmates and nights out: anyone in the group adds what they paid, everyone sees who owes whom in real time, and debts are settled with a UPI payment that the receiver confirms.

**🔗 Live app:** https://fair-share-seven-weld.vercel.app/

> The backend runs on Render's free plan and sleeps when idle, so the first request after a while can take up to a minute.

---

## 🔁 How it works

1. **Create a group** and share the invite link on WhatsApp.
2. **Add an expense**: who paid, how much, and how to split it.
3. **See who owes whom**: FairShare works out the fewest payments that settle everyone.
4. **Settle up with UPI**: one tap opens your UPI app with the amount filled in. The receiver confirms, and the balance goes to ₹0.

---

## 🚀 Features

- **Groups with invite links:** share a link; friends join after signing in (the link survives sign-up and email verification)
- **One-screen expenses:** anyone can be the payer; split equally, by exact amounts or by percent; shares always add up to the paisa
- **Balances first:** Home shows your total and each person you owe or who owes you, across all groups
- **Fewest payments:** debt simplification settles a group of *n* people in at most *n − 1* payments
- **Settle with UPI:** opens Google Pay, PhonePe or Paytm with the amount filled in (QR code on desktop)
- **Trusted payments:** "I've paid" stays pending until the receiver confirms, so nobody can clear a debt on their own; duplicate payments are blocked
- **Waiting for confirmation:** pending payments stay at the top of Home and the group until confirmed, however old they are
- **History on every entry:** who added, edited or deleted it, and what changed
- **Live updates:** changes appear instantly for everyone in the group
- **Secure accounts:** email verification, password reset, rate limiting
- **Mobile-first**, with light and dark themes

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Context API, lucide-react, qrcode.react |
| Backend | Node.js 22, Express 5, Zod validation |
| Database | Cloud Firestore (Firebase Admin SDK); Firestore Emulator for local development |
| Real-time | Socket.io |
| Auth & security | JWT, bcrypt, helmet, express-rate-limit |
| Email | Brevo HTTP API (SMTP via Nodemailer as a fallback) |
| Testing & CI | Jest, Supertest, Vitest, GitHub Actions |
| Hosting | Vercel (frontend), Render (backend) |

---

## 🏗️ Architecture

```
Browser (React on Vercel) ──HTTPS / WebSocket──▶ Express + Socket.io (Render) ──▶ Cloud Firestore
```

### Backend (`backend/`)
- `routes/`: auth, groups (with invite links), expenses (settlements, history, `/overview`), users, notifications
- `services/`: business logic, unit-tested without a database: `balances`, `debtSimplifier`, `ledger` (what counts toward balances), `expenseRules`, `auditLog`, `emailService`
- `utils/money.js`: all money math in integer paise
- `middleware/`: auth, group membership, validation, rate limiting, errors
- `config/`: environment checks, CORS, site addresses, database

### Frontend (`frontend/src/`)
- `pages/`: Home, Group, ExpenseForm, Join, Activity, Account, auth pages, Landing
- `components/`: settle-up sheet (UPI), waiting-for-confirmation list, invite sheet, expense rows and details, shared UI
- `api/`: one function per endpoint; `auth/`: session state; `hooks/useApiData`: cached loading and live refresh
- `utils/`: split math, formatting, UPI link

---

## 📊 Database Design

| Collection | Holds |
|---|---|
| `users` | Account details, hashed password, UPI ID |
| `groups` | Name, creator, member IDs, invite code |
| `expenses` | Expenses and payments with per-member splits and date; payments carry a status (pending / confirmed / rejected); deleted entries are kept with `deleted_at` |
| `audit_logs` | Append-only history of every change to an expense or payment |
| `notifications` | Activity alerts per user |

---

## 🔒 Security

- Passwords hashed with bcrypt; JWT sessions that end when the account no longer exists
- Verification and reset tokens stored as SHA-256 hashes, with expiry
- Rate limiting on login, sign-up, password reset and invite joins
- Security headers (helmet); strict CORS for the API and Socket.io
- Login and password reset don't reveal whether an email is registered; member lists don't expose emails
- The server refuses to start in production with a missing or short `JWT_SECRET`, missing site addresses, or the emulator variable set
- No secrets in the repository: keys live only in local `.env` files (git-ignored) and in Render/Vercel settings

---

## 💻 Run Locally

Local development uses the **Firestore emulator**, so nothing on your machine touches production data.

**Prerequisites:** Node.js 22+, Java 11+ (for the Firestore emulator)

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

Demo logins (local only, reset on every `npm run dev`): `asha@example.com`, `bala@example.com`, `chen@example.com`, password `password123`. No groups are created, so start by making one.

With `EMAIL_MODE=console`, verification and password-reset links are printed in the terminal instead of being emailed.

**Test on your phone:** connect it to the same Wi-Fi and open `http://<your-laptop-ip>:5173`. The dev server forwards API calls to the backend.

**Tests:** `npm test` (backend unit) · `npm --prefix backend run test:api` (API tests on the emulator) · `npm --prefix frontend test` · `npm run lint`

---

## 🚀 Deployment

Both apps deploy from `main` on GitHub.

**Backend on Render** (Web Service, root directory `backend`, build `npm ci`, start `npm start`, health check `/api/health`). Environment:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `JWT_SECRET` | 32+ random characters |
| `FRONTEND_URL` | the Vercel site address (CORS and email links) |
| `FIREBASE_SERVICE_ACCOUNT` | the Firebase service account JSON |
| `EMAIL_MODE` / `BREVO_API_KEY` / `EMAIL_FROM` | `brevo`, your Brevo API key, a Brevo-verified sender |

Render provides the backend's own address (`RENDER_EXTERNAL_URL`); set `BACKEND_URL` to override it. Never set `FIRESTORE_EMULATOR_HOST` in production.

**Frontend on Vercel** (root directory `frontend`, framework Vite). Environment: `VITE_API_BASE_URL` = `https://<your-api>.onrender.com/api` (type Config). The build fails without it.

---

## 📌 Project Highlights

- Exact money math in integer paise: splits always add up, with fair remainder distribution
- Debt simplification: a group of *n* people settles in at most *n − 1* payments
- Two-party payment confirmation with an append-only audit log
- Real-time sync across users with Socket.io
- 150+ tests (backend unit, API tests against the Firestore emulator, frontend), run in GitHub Actions CI on every push

See [PRODUCT.md](PRODUCT.md) for the product definition and [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) for what's next.

---

## 📄 License

[MIT](LICENSE) © 2026 Purvrajsinh Jadeja

## 👨‍💻 Author

**Purvrajsinh Jadeja**
