# StackOverflow Clone (MERN)

A recruiter-friendly, full‑stack **StackOverflow-inspired Q&A platform** built with the **MERN** stack. In addition to core Q&A workflows (questions, answers, voting), the project includes production-oriented backend modules such as **device-aware authentication**, **points/gamification**, **social feed + connections**, and **subscription payments**.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Internship Task Features (6)](#internship-task-features-6)
- [Tech Stack](#tech-stack)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Screenshots](#screenshots)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## Project Overview

This project replicates the core experience of StackOverflow:

- Ask questions with tags, browse and search content
- Post answers and vote on helpful content
- Build trust and engagement through authentication, points, and community features

The backend is designed as a modular REST API with clear separation of concerns (routes, controllers, middleware, models, and utilities), making it easy to extend and maintain.

---

## Features

### Core Q&A
- Create, edit, and delete questions (with tag parsing and limits)
- Search questions (title/description/tags) and sort by newest or votes
- Post answers for questions
- Voting on questions and answers (upvote/downvote) with per-user vote state

### User & Security
- JWT authentication with hashed passwords (bcrypt)
- Device-aware login flow (OTP verification + trusted devices)
- Login history tracking
- Forgot password flow with daily limits (email-enabled, dev fallback)

### Engagement & Community
- Points system with rewards/penalties (e.g., answering and vote milestones)
- Point transfers between users + transfer history
- Social feed (posts with images/videos), likes, comments, and shares
- Friend requests and connections
- Dynamic posting limits based on friend count

### Monetization / Subscription
- Subscription plans and quota enforcement (e.g., daily question limits)
- Razorpay order creation + payment verification flow
- Receipt endpoint and invoice payload generation
- Optional invoice email support via Nodemailer (dev-friendly fallback)

---

## Internship Task Features (6)

These six features represent the primary internship-style deliverables implemented in this project:

1. **Authentication & Authorization**
   - JWT-based auth, protected routes, password hashing, and request validation.
2. **Device Verification (OTP) + Trusted Devices**
   - OTP-based device login verification, trusted device approvals, and login history.
3. **Questions Module (CRUD + Search/Sort + Tags)**
   - Full question lifecycle, tag normalization, search, and sorting.
4. **Answers + Voting + Gamification**
   - Answer posting, vote tracking, and automated points rewards/penalties.
5. **Community Layer (Social Feed + Friends)**
   - Posts with media, engagement actions (like/comment/share), and friend request workflows.
6. **Subscriptions & Payments**
   - Plans, daily quota enforcement, Razorpay integration, and receipt/invoice generation.

---

## Tech Stack

**Frontend**
- React (Create React App)
- React Router
- Axios

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT (jsonwebtoken) + bcryptjs
- Multer (file uploads)
- Nodemailer (email/OTP/invoices)
- Razorpay (payments)
- dotenv, cors

---

## Installation & Setup

### Prerequisites
- Node.js (LTS recommended)
- MongoDB (local or cloud MongoDB URI)

### 1) Install dependencies

In two terminals:

**Backend**
```bash
cd server
npm install
```

**Frontend**
```bash
cd client
npm install
```

### 2) Configure environment variables

Create `server/.env` from the sample:
```bash
cd server
copy .env.example .env
```

Then update values as needed (see [Environment Variables](#environment-variables)).

### 3) Run the app (development)

**Start backend**
```bash
cd server
npm run dev
```

**Start frontend**
```bash
cd client
npm start
```

Default URLs:
- Client: `http://localhost:3000`
- Server: `http://localhost:5000`

---

## Environment Variables

The backend loads environment variables from `server/.env` (see `server/.env.example`).

### Server (`server/.env`)

| Variable | Required | Purpose |
|---|---:|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Token expiry (default: `7d`) |
| `NODE_ENV` | No | `development` / `production` |
| `SMTP_HOST` | No | SMTP host for Nodemailer |
| `SMTP_PORT` | No | SMTP port |
| `SMTP_SECURE` | No | `true/false` for TLS |
| `SMTP_USER` / `SMTP_PASS` | Optional | SMTP credentials |
| `EMAIL_USER` / `EMAIL_PASS` | Optional | Alternative email credentials (e.g., Gmail app password) |
| `EMAIL_FROM` | Optional | From address for emails |
| `RAZORPAY_KEY_ID` | Optional | Razorpay key id (test keys start with `rzp_test_`) |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay key secret |
| `PAYMENT_WINDOW_OVERRIDE` | No | Dev-only override for payment time windows |
| `MOBILE_LOGIN_OVERRIDE` | No | Dev-only override for device login windows |

### Optional SMS Provider (OTP)

This project supports OTP delivery via providers when configured:

- Twilio:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER`
- MSG91:
  - `MSG91_AUTH_KEY`
  - `MSG91_SENDER_ID`
  - `MSG91_TEMPLATE_ID`

> Note: Some OTP flows support development-friendly “demo OTP” behavior when providers are not configured.

---

## Project Structure

```text
.
├─ client/                      # React frontend (CRA)
│  ├─ public/
│  └─ src/
│     ├─ App.js
│     └─ ...
└─ server/                      # Node.js + Express API
   ├─ config/                   # Subscription plans, app configs
   ├─ controllers/              # Route handlers (business logic)
   ├─ middleware/               # Auth, optional auth, uploads
   ├─ models/                   # Mongoose schemas/models
   ├─ routes/                   # API routes
   ├─ uploads/                  # Uploaded media (served statically)
   ├─ utils/                    # Helpers (JWT, OTP, points, subscription, etc.)
   ├─ .env.example
   └─ server.js                 # Server entry point
```

---

## Screenshots

Add your screenshots under a folder such as `./screenshots/` and update the paths below.

1. Home / Questions List  
   `![Home](./screenshots/home.png)`

2. Question Details + Answers  
   `![Question Details](./screenshots/question-details.png)`

3. Authentication (Login/Register/OTP)  
   `![Auth](./screenshots/auth.png)`

4. Points & Transfers  
   `![Points](./screenshots/points.png)`

5. Social Feed + Friends  
   `![Social Feed](./screenshots/social-feed.png)`

6. Subscription / Payments  
   `![Subscription](./screenshots/subscription.png)`

---

## Future Improvements

- Add automated tests (unit + integration) and API contract tests
- Add Docker setup (client + server + MongoDB) for one-command local spin-up
- Improve UI/UX to closely match StackOverflow (tags, rich editor, pagination)
- Add role-based moderation (admin/mod tools, reports, content review)
- Add real-time notifications (Socket.IO) for answers, votes, and friend requests
- Implement caching/rate-limiting and stronger security hardening for production

---

## Author

- GitHub: **https://github.com/your-username** (replace with your profile)

