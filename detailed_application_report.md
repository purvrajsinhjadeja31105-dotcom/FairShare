# SplitWise Application - Comprehensive Technical Report

This report provides a detailed overview of the Architecture, Features, and Technology Stack of the SplitWise application as of April 13, 2026.

---

## 🚀 1. Technology Stack

The application is built using a modern full-stack architecture designed for performance, security, and real-time collaboration.

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React (Vite), React Router, Lucide Icons, Context API |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL (with `mysql2` promise wrapper) |
| **Real-time** | Socket.io (Bi-directional communication) |
| **Auth & Security** | JWT (JSON Web Tokens), bcrypt (Password Hashing), Crypto |
| **Email** | Nodemailer (SMTP/Gmail integration) |
| **Styling** | Vanilla CSS (Custom Glassmorphism Design System) |

---

## 🛠️ 2. Core Features & Functionality

### 🔐 Authentication System
The authentication flow has been modernized to prioritize security and user verification.
- **Signup with Verification**: New accounts are created in a "Pending" state. A unique verification token is generated and sent via **Nodemailer**.
- **Email Confirmation**: Users cannot log in until they verify their email address via the link sent to their inbox.
- **Secure Login**: Implements bcrypt for safe password storage and JWT for stateful session management.
- **Premium UI**: The auth pages feature a glassmorphism design, real-time input validation, and password visibility toggles.

### 👥 Group Management
- **Collaboration**: Users can create naming groups and invite members via a real-time search interface.
- **Admin Governance**: Groups can elect an admin through a built-in polling system. Socket.io ensures that votes and poll results are broadcasted instantly.
- **Member Activity**: A group-specific activity feed tracks every action taken within the group.

### 💸 Expense & Debt Management
- **Smart Splitting**: Supports multiple splitting methods (Equal, Unequal, Percentage).
- **Financial Summary**: Aggregates balances to show exactly who owes what at a glance.
- **Settlement Workflow**: A guided "Pay-only" workflow that simplifies clearing debts between members.
- **History Tracking**: Comprehensive personal and group history for financial transparency.

### ⚡ Real-time Synchronization
The application implements a custom **Socket.io Service** to eliminate the need for manual page refreshes:
- **Instant Reflect**: When User A adds an expense, User B's dashboard updates immediately.
- **Global Notifications**: A real-time notification badge in the navbar alerts users to new activity.
- **Private Rooms**: Each user is assigned to a private socket room for secure, targeted event delivery.

---

## 🏗️ 3. Architecture Overview

### Backend Structure
- **`server.js`**: Entry point that integrates the HTTP server with Socket.io.
- **`services/`**: Contains core logic like `emailService` for SMTP and `socketService` for real-time events.
- **`routes/`**: Distinct modules for Auth, Expenses, Groups, Notifications, and Users.
- **`middleware/`**: JWT-based authentication middleware protecting private endpoints.

### Frontend Structure
- **`SocketContext.jsx`**: Manages the socket lifecycle and ensures the connection is synchronized with the user's login state.
- **`api.js`**: A centralized fetch wrapper that injects auth headers and handles error responses gracefully.
- **`context/`**: Uses React Context for global state management (Authentication, Theme).

---

## 📊 4. Database Schema

The relational database consists of 6 primary tables:
1.  **`users`**: Stores user profiles, hashed passwords, and verification status.
2.  **`expense_groups`**: Records group details and creators.
3.  **`group_members`**: Mapping table for many-to-many relationships between users and groups.
4.  **`expenses`**: Tracks primary expense data (payer, amount, description).
5.  **`expense_splits`**: Granular breakdown of how each expense is divided among members.
6.  **`notifications`**: Persistent storage for user activity alerts.

---

## 🔒 5. Security Implementations

- **Password Hashing**: Uses `bcrypt` with 10 salt rounds.
- **JWT Protection**: All sensitive routes require a Bearer token in the request header.
- **Email Verification Tokens**: One-time-use tokens for activating accounts.
- **Handshake Auth**: Socket.io connections are authenticated using JWT during the handshake phase to prevent unauthorized connections.

---

## 🔮 6. Future Roadmap

- **Social Login**: Integration with Google/Facebook OAuth.
- **Push Notifications**: Browser-level push notifications for mobile users.
- **Charts & Reports**: Interactive data visualization for spending patterns.
- **Currency Support**: Dynamic conversion for multi-currency group tracking.
