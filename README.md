# 🍕 Pizza Man — Pizza Delivery Application

A full-stack MERN pizza delivery app: server-priced cart & checkout, Razorpay payments, a step-by-step pizza builder, customer accounts (addresses, favorites, receipts) and a full **admin panel** (analytics dashboard, products & categories, inventory with stock logging, order pipeline, customer management, store settings).

---

## ✨ Features

### Customers
- **Menu** with preset pizzas grouped by category, cold drinks, live server prices, **search** and category tabs
- **Favorites** — heart any pizza; manage them from your profile
- **Persistent cart** (React Context + localStorage) — identical configurations merge quantities; survives refresh/navigation/re-login
- **7-step pizza builder**: base → sauce → cheese → veggies → meats → size & add-ons → review
- **Pizza sizes** (Small / Medium / Large) priced via server-side multipliers (`SIZE_MULTIPLIERS`)
- **Checkout** with delivery details, server-calculated price breakdown (subtotal, delivery fee, free-delivery threshold, tax), store open/closed + minimum-order enforcement, Razorpay payment
- **My Orders** with order numbers, per-item customizations, charges, payment status, live timeline, **cancel** (stock restored) and **reorder**
- **Printable receipt** (print / save-as-PDF) per order
- **Profile**: edit name/phone, saved addresses (max 8, one default), change password, favorites
- Email verification, forgot/reset password, resend verification

### Admin (`/admin/*`, admin role required)
- **Dashboard** — date-range analytics computed on the server: revenue, orders, customers, pending/completed/cancelled counts, low-stock alerts, daily revenue line chart, daily orders bar chart, popular pizzas & toppings
- **Orders** — search (order #, customer, phone, email), status/payment/date filters, pagination, full order detail, **validated status transitions** (server-enforced), terminal states shown honestly
- **Inventory** — paginated/searchable list, category & stock-status filters, restock with audit **stock log**, availability toggle (hidden items can't be ordered), low/out-of-stock counters
- **Products** — pizza CRUD with composition (base/sauce/cheese/toppings used for stock checks), price, availability, image; **category manager**
- **Users** — search customers, view details (stats, addresses, recent orders), enable/disable accounts, promote/demote admins (last-admin protected)
- **Settings** — store open/closed, delivery enabled, store name & contact, tax %, delivery fee, free-delivery threshold, minimum order amount, low-stock threshold — all applied to pricing and checkout immediately

### Security & reliability
- All prices, stock checks and charge calculations happen **on the server** (the client never sends amounts)
- JWT auth + role guards; admin routes double-checked server-side; no secrets in the client bundle
- Rate limiting (global + auth/payment specific), `helmet`, `express-mongo-sanitize`, CORS locked to configured origins
- Timing-safe Razorpay signature verification; payment records created before charging (retries are safe)
- Inventory never goes negative; every stock change is logged (`StockLog`)
- Shared loading/error/empty states, skeleton loaders, global error boundary, skip-link + focus styles

---

## 🛠 Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite, React Router v7, Axios, React Toastify, vanilla CSS (SVG charts, no chart lib) |
| Backend | Node.js, Express 4, Mongoose 8, JWT, bcryptjs |
| Email | Nodemailer (SMTP) |
| Payments | Razorpay (test/live keys) |
| Database | MongoDB (local or Atlas) |
| Testing | `node:test` + Supertest (API), Vitest + Testing Library (client) |
| Linting | ESLint (flat config) + Prettier |

---

## 🚀 Run Locally

### Prerequisites
- Node.js 18+ (20+ recommended)
- MongoDB running locally **or** an Atlas connection string

### 1. Server

```bash
cd server
npm install
copy .env.example .env      # Windows (cp .env.example .env on macOS/Linux)
```

Edit `.env` (see the table below), then:

```bash
npm run dev                 # node --watch server.js   (or: npm start)
```

The server listens on **`http://localhost:5001`**. On startup it:
- verifies `JWT_SECRET` and `MONGO_URI` are set (fails fast otherwise),
- **auto-seeds** 56 catalogue items (only inserts missing ones — admin edits are never overwritten), 4 preset products and a "Signature Pizzas" category,
- creates the admin account if `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set.

Manual seed: `npm run seed`

### 2. Client

```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api -> :5001)
```

### 3. Sign in
- Admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env` → `/admin`
- Customer: register at `/register`, verify via the emailed link (or set `isVerified: true` in the DB for local testing)

---

## ⚙️ Environment Variables

### `server/.env` (see `server/.env.example`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | no | API port (default 5001) |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | 32+ char signing secret |
| `JWT_EXPIRE` | no | token lifetime (default 7d) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for bootstrap | admin created on first start |
| `CLIENT_URL` | ✅ (prod) | origin for CORS + email links |
| `CORS_ORIGINS` | no | extra allowed origins (comma separated) |
| `TRUST_PROXY` | behind proxy | set `1` so rate limiting sees real IPs |
| `EMAIL_HOST/PORT/USER/PASS` | for emails | SMTP (Gmail app password works) |
| `RAZORPAY_KEY_ID/KEY_SECRET` | for checkout | Razorpay keys |
| `DELIVERY_FEE`, `FREE_DELIVERY_ABOVE`, `TAX_RATE_PERCENT` | no | env defaults (DB settings override) |
| `STOCK_THRESHOLD` | no | low-stock alert level (default 20) |
| `SIZE_MULTIPLIERS` | no | e.g. `small:0.85,medium:1,large:1.3` |

> Store settings are now read from the **database** (`settings` collection) with these env vars as fallbacks — change them at runtime from **Admin → Settings**.

### `client/.env` (see `client/.env.example`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base URL; leave empty in dev (Vite proxy), set in production |
| `VITE_RAZORPAY_KEY_ID` | publishable key (secret never goes here) |

---

## ✅ Scripts

| Where | Command | What it does |
| --- | --- | --- |
| `server/` | `npm start` / `npm run dev` | run API (plain / watch) |
| `server/` | `npm run seed` | seed catalogue, products, category, admin |
| `server/` | `npm test` | **27 API tests** (`node:test` + Supertest against `pizzaDB_test`) |
| `server/` | `npm run db:review` | indexes + data-integrity review |
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run build` | production build (route-level code splitting) |
| `client/` | `npm test` | **25 Vitest tests** (utils + components) |
| `client/` | `npm run lint` | ESLint (flat config) |
| `client/` | `npm run format` | Prettier write |

---

## 📡 API Overview

All routes are prefixed with `/api`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `GET /auth/verify-email/:token`, `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password/:token`, `GET /auth/me` |
| Profile | `GET/PUT /auth/profile`, `PUT /auth/addresses`, `PUT /auth/change-password`, `GET /auth/favorites`, `POST /auth/favorites/:productId` |
| Menu | `GET /pizza/menu` (products + categories + ingredients + sizes, authenticated) |
| Cart pricing | `POST /payment/quote`, `POST /payment/create-order`, `POST /payment/verify` |
| Orders | `GET /orders/my-orders`, `POST /orders/:id/cancel`, `GET /orders` (admin), `PUT /orders/:id/status` (admin, transition-checked) |
| Products | `GET/POST/PUT/DELETE /products`, `GET/POST/PUT/DELETE /products/categories` (admin) |
| Inventory | `GET /inventory` (paginated + filters), `GET /inventory/stats`, `GET /inventory/log`, `POST /inventory/:id/restock`, `POST/PUT/DELETE /inventory` (admin) |
| Users | `GET /users`, `GET /users/:id`, `GET /users/:id/orders`, `PUT /users/:id` (admin) |
| Analytics | `GET /analytics?from&to` (admin, max 366-day range) |
| Settings | `GET /settings` (public), `PUT /settings` (admin) |

**Order status flow** (server-enforced):

```
Order Placed → Order Received → In the Kitchen → Sent to Delivery → Delivered
     └───────────── Cancelled (terminal) ──────────────┘
```

---

## 🧪 Testing & Quality Gates

```bash
# API tests — uses a separate database (pizzaDB_test), dropped after the run
cd server && npm test

# Client tests + lint + build
cd client && npm test && npm run lint && npm run build

# Data integrity / index review against the real database
cd server && npm run db:review
```

Current status:
- Server API tests: **27/27 passing**
- Client tests: **25/25 passing**
- ESLint: **0 errors / 0 warnings**
- Production build: ✅ (code-split per route)
- DB review: ✅ (no orphans, no negative stock, all expected indexes present)

The API test suite covers: settings validation + admin-only rules, menu/auth/roles, register→verify→login flow, profile & addresses & password change, favorites, server-side quoting (valid + invalid input), store-closed and minimum-order enforcement, product/category/inventory CRUD + restock log, analytics ranges, user management, order status transitions and pagination.

---

## 🌐 Deployment

### Frontend + API on Vercel (single project)
The repo root contains a `vercel.json` that:
- builds `client/` → `client/dist` (static)
- serves the API from `/api/*` via `api/index.js` (a serverless wrapper that connects to Mongo on first request)

Set all **server** env vars in the Vercel project (Production + Preview), plus:
- `CLIENT_URL=https://your-app.vercel.app`
- `MONGO_URI` (Atlas)
- `CORS_ORIGINS=https://your-app.vercel.app`

### Client-only deploy
Deploy `client/` as its own Vercel project (a `client/vercel.json` provides the SPA rewrite) and host the API anywhere Node runs (Render, Railway, a VM) with `npm start`.

### Checklist before going live
1. Strong `JWT_SECRET` (32+ chars) and real Razorpay keys
2. Atlas IP allow-list + `TRUST_PROXY=1` behind a proxy
3. `CLIENT_URL`/`CORS_ORIGINS` set to the real domain
4. SMTP credentials for verification/reset emails
5. Run `npm test` (server), `npm test && npm run lint && npm run build` (client)
6. `npm run db:review` on the production database

---

## 📁 Project Structure

```
├── api/index.js              # Vercel serverless wrapper around the Express app
├── vercel.json               # monorepo deploy config
├── client/
│   ├── src/
│   │   ├── components/       # Navbar, Modal/ConfirmDialog, Charts, Receipt, StateViews…
│   │   ├── context/          # Auth, Cart (reducer + localStorage), Theme
│   │   ├── pages/
│   │   │   ├── auth/         # login, register, verify, forgot/reset
│   │   │   ├── user/         # Dashboard, BuildPizza, Cart, Checkout, MyOrders, Profile
│   │   │   └── admin/        # AdminDashboard, Orders, Inventory, Products, Users, Settings
│   │   ├── services/api.js   # axios instance + typed endpoint helpers
│   │   └── utils/            # normalizeOrder (v2 + legacy), validation
│   └── vitest.config.js
└── server/
    ├── config/               # db connection, size multipliers
    ├── middleware/           # auth, admin, rate limiters
    ├── models/               # User, Order (v2), Product, ProductCategory, Inventory,
    │                         # Payment, Setting, StockLog
    ├── routes/               # auth, pizza, orders, payment, inventory, products,
    │                         # users, analytics, settings
    ├── seed/seed.js          # idempotent seeding (catalogue, products, admin)
    ├── scripts/db-review.js
    ├── tests/api.test.js     # 27-test API suite
    └── utils/pricing.js      # single source of truth for prices/stock
```

---

## 🚧 Not included (by design)

- **Reviews/ratings** — out of scope for this build
- Real Razorpay webhook handling (signature verification on `/payment/verify` covers the checkout flow)

---

## 📜 License

Private / all rights reserved unless stated otherwise.
