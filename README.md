# 💸 FairShare – Expense Sharing Web Application



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
- MySQL

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

The application uses a relational database with the following tables:

- `users` – User details and authentication data  
- `expense_groups` – Group information  
- `group_members` – User-group relationships  
- `expenses` – Expense records  
- `expense_splits` – Expense distribution logic  
- `notifications` – User activity tracking  

---

## 🔒 Security Features

- Encrypted passwords using bcrypt
- JWT-based authentication for APIs
- Email verification with secure tokens
- Authenticated Socket.io connections

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
