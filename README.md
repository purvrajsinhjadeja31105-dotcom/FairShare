# 💸 FairShare – Expense Sharing Web Application

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://fair-share-sage.vercel.app/)

A full-stack, real-time expense sharing application inspired by Splitwise, designed to simplify group expense management, debt tracking, and settlements.

---

## 🚀 Features

### 🔐 Authentication & Security
- Secure user authentication using JWT
- Password hashing with bcrypt
- Email verification using Nodemailer
- Protected routes and secure API access

### 👥 Group Management
- Create and manage expense groups
- Add and invite members
- Group activity tracking
- Admin selection using real-time polling

### 💸 Expense Management
- Add and split expenses (Equal, Unequal, Percentage)
- Real-time balance calculation
- Track who owes whom
- Settlement workflow for clearing debts

### ⚡ Real-Time Updates
- Instant updates using Socket.io
- Live notifications for user activities
- No manual refresh required
- Private socket rooms for secure communication

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

### Backend
- Modular route structure (Auth, Groups, Expenses, Users)
- Middleware for authentication
- Services for email and socket handling

### Frontend
- Context API for global state management
- Centralized API handling
- Socket integration for real-time features

---

## 📊 Database Design

The application uses Cloud Firestore with the following collections:

- `users` – User details and authentication data
- `groups` – Group information, member IDs and the elected admin
- `expenses` – Expense records with their per-member splits embedded
- `notifications` – User activity alerts
- `polls` / `votes` – Admin elections

---

## 🔒 Security Features

- Encrypted passwords using bcrypt
- JWT-based authentication for APIs
- Email verification with secure tokens
- Authenticated Socket.io connections

---

## 💻 Run Locally

Local development uses the **Firestore emulator**, so nothing you do on your machine touches production data.

**Prerequisites:** Node.js 22+, Java 11+ (required by the Firestore emulator)

```bash
npm run setup                               # install root, backend and frontend dependencies
cp backend/.env.example backend/.env        # then set JWT_SECRET to any long random string
cp frontend/.env.example frontend/.env
npm run dev                                 # emulator + seeded demo data + backend + frontend
```

| What | URL |
|---|---|
| App | http://localhost:5173 |
| API | http://localhost:5000/api |
| Emulator UI (browse the database) | http://localhost:4000 |

Demo logins (reset on every `npm run dev`): `asha@example.com`, `bala@example.com`, `chen@example.com`, all with password `password123`.

With `EMAIL_MODE=console`, verification and password-reset links are printed in the terminal instead of being emailed.

**Tests:** `npm test` (backend unit tests) · `npm --prefix backend run test:api` (API tests on the emulator) · `npm run lint` (frontend)

---

## 🚀 Deployment

- Frontend deployed on Vercel
- Backend powered by Node.js & Express
- Real-time communication using Socket.io

---

## 📈 Future Improvements

- Social login (Google, Facebook)
- Push notifications
- Expense analytics & charts
- Multi-currency support

---

## 📌 Project Highlights

- Full-stack application using React, Node.js, and MySQL
- Real-time synchronization across users
- Scalable and modular backend architecture
- Secure authentication and authorization system

---

## 👨‍💻 Author

**Purvrajsinh Jadeja**
