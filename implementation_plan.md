# Splitwise Clone Implementation

This plan outlines the architecture and implementation steps for building a full-stack Splitwise clone using **React** for the frontend, Node.js + Express for the backend, and MySQL for the database.

## User Review Required

> [!IMPORTANT]
> The plan has been updated to use React for the frontend project. Please review the updated architecture below.

## Proposed Changes

### Database Setup
Yes, **I will write all the MySQL queries, schema creation, and interaction code for you!** We will use the `mysql2` package in Node.js to communicate with your locally installed MySQL database. You will just need your MySQL username (usually `root`) and password.

The database `splitwise_clone` will have the following tables:
- `users`: id, username, email, password_hash
- `expense_groups`: id, name, created_by
- `group_members`: group_id, user_id
- `expenses`: id, group_id, paid_by, amount, description, created_at
- `expense_splits`: expense_id, user_id, amount_owed

### Backend Architecture (Node.js & Express)
A RESTful API that handles business logic and security:
- **Security**: Passwords hashed using `bcrypt` and JWT (JSON Web Tokens) for authenticated API calls.
- **Structure**:
  - `backend/server.js` - Main entry point
  - `backend/config/db.js` - MySQL connection setup using your credentials
  - `backend/controllers/` - Logic for auth, groups, and expenses
  - `backend/routes/` - API endpoints
  - `backend/middleware/` - JWT auth validation

#### [NEW] backend/package.json
#### [NEW] backend/server.js
#### [NEW] backend/config/db.js

---

### Frontend Architecture (React)
A premium, responsive, and highly interactive user interface using React. We will use Vite to initialize the app for optimal performance, and Vanilla CSS with modern aesthetics.
- **Structure**:
  - `frontend/src/App.jsx` - Main application routing.
  - `frontend/src/components/` - Reusable UI elements (Modals, Buttons, Expense Cards).
  - `frontend/src/pages/` - Views like `Dashboard`, `Login`, `Register`, and `GroupDetails`.
  - `frontend/src/services/api.js` - Axel request helper to handle JWT injection.
  - `frontend/src/index.css` - Global modern styling focusing on animations.

#### [NEW] frontend/package.json
#### [NEW] frontend/src/App.jsx

## Open Questions

> [!TIP]
> What Else Do You Need?
> - **Nothing much!** Since you have MySQL and I just checked that you have Node.js (v22.17.0), you are fully ready. 
> - Once you approve this plan, I'll set everything up. I will configure the MySQL database using standard credentials (user `root`, password empty, port `3306`). If your MySQL password is not empty, I will let you know where you can type it in (inside a `.env` file).

## Verification Plan

### Automated tests 
- Start the Node.js backend (`npm start`) and the Vite React app (`npm run dev`).
- Run initial backend migration scripts to create tables.

### Manual Verification
- We will view the frontend UI at `localhost:5173`.
- Test flows: Register User -> Login -> Create Group -> Add Mock Expenses -> Verify "Who owes Whom" calculates correctly.
