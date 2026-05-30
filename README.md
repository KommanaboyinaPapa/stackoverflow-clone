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
- [Submission Evidence](#submission-evidence)
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

Save exact evidence screenshots in `./screenshots/` and update the file names below.

| # | Screenshot | Expected content | File name |
|---|---|---|---|
| 1 | Social page loaded | Social feed page fully loaded and visible | `social-page-loaded.png` |
| 2 | 0-friend posting restriction | Social page shows post restriction for 0 friends | `social-posting-0-friends.png` |
| 3 | 1-friend post success | First post created successfully with 1 friend | `social-posting-1-friend.png` |
| 4 | Like/comment/share working | Post shows updated like, comment, and share counts | `social-like-comment-share.png` |
| 5 | Image/video upload | Social post created with uploaded photo/video | `social-media-upload.png` |
| 6 | Forgot password page | Forgot password screen visible | `forgot-password-page.png` |
| 7 | Email OTP request | Email reset flow requested, OTP prompt shown | `forgot-password-email-otp.png` |
| 8 | Phone OTP request | Phone reset flow requested, OTP prompt shown | `forgot-password-phone-otp.png` |
| 9 | Second request blocked | Second forgot-password attempt shows daily limit warning | `forgot-password-second-request-blocked.png` |
| 10 | Letters-only generated password | Generated temporary password displayed using letters only | `forgot-password-generated-password.png` |
| 11 | Subscription plans page | Subscription plan grid with Free/Bronze/Silver/Gold visible | `subscription-plans-page.png` |
| 12 | Razorpay checkout | Razorpay checkout modal displayed for plan payment | `subscription-razorpay-checkout.png` |
| 13 | Payment success | Subscription payment success panel shown | `subscription-payment-success.png` |
| 14 | Invoice email proof | Invoice receipt panel or email confirmation shown | `subscription-invoice-proof.png` |
| 15 | Payment window blocked | Subscription blocked outside 10–11 AM IST | `subscription-payment-window-blocked.png` |
| 16 | Answer +5 points | Posting an answer awards +5 points | `reward-answer-plus5.png` |
| 17 | 5 upvotes bonus | Answer reaches 5 upvotes and bonus points awarded | `reward-5-upvotes-bonus.png` |
| 18 | Points transfer success | Points transfer completed successfully | `reward-transfer-success.png` |
| 19 | Transfer blocked <=10 | Transfer blocked when sender has 10 or fewer points | `reward-transfer-blocked.png` |
| 20 | Language selector | Language selector visible in navigation or header | `language-selector.png` |
| 21 | French email OTP | French language change uses email OTP flow | `language-french-email-otp.png` |
| 22 | Other language mobile OTP | Spanish/Hindi/Portuguese/Chinese uses mobile OTP flow | `language-mobile-otp.png` |
| 23 | Chrome OTP login | Chrome login triggers email OTP verification flow | `login-chrome-otp.png` |
| 24 | Edge login no OTP | Microsoft Edge login completes without OTP | `login-edge-no-otp.png` |
| 25 | Mobile time restriction | Mobile login outside allowed window blocked | `login-mobile-time-restriction.png` |
| 26 | Profile login history | Profile page shows login history records | `profile-login-history.png` |
| 27 | Browser/OS/device/IP visible | Login history item shows browser, OS, device, and IP | `profile-login-details.png` |

---

## Submission Evidence

This repository includes internship submission evidence for the StackOverflow Clone project.

- GitHub repository: `https://github.com/KommanaboyinaPapa/stackoverflow-clone`
- Live demo: `https://stackoverflow-clone-khaki-tau.vercel.app`
- QA audit result: **37/37 test cases passed**
- Screenshot evidence: see `report/qa-screenshots-checklist.md`
- Screenshot evidence: see `qa-screenshots-checklist.md`
- Internship evidence report: see `internship-evidence-report.md`
  - `screenshots/`
  - `report/`
  - `README` screenshot asset placeholders

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
