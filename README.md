# Moonview Medical — Hospital Management System

<div align="center">

![Moonview Medical](https://img.shields.io/badge/Moonview-Medical%20HMS-1a56db?style=for-the-badge&logo=heart&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

**A full-featured, role-based Hospital Management System built with React 18 and Supabase.**

[Report Bug](https://github.com/Timothykupsoboi/hospital_final/issues) · [Request Feature](https://github.com/Timothykupsoboi/hospital_final/issues)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Supabase Setup](#supabase-setup)
- [User Roles & Login](#user-roles--login)
- [Deployment](#deployment)
  - [Deploying to Vercel](#deploying-to-vercel)
  - [Environment Variables on Vercel](#environment-variables-on-vercel)
- [Performance](#performance)
- [Database Schema](#database-schema)
- [Security Notes](#security-notes)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Moonview Medical HMS is a comprehensive, production-ready Hospital Management System designed to streamline clinical operations across a full medical facility. It supports five distinct staff roles — **Admin, Doctor, Registrar, Lab Technician, and Pharmacist** — each with a fully isolated, purpose-built dashboard and real-time data updates.

All data is persisted in a managed **Supabase (PostgreSQL)** backend with real-time subscriptions for live queue and request updates. Authentication is handled entirely through Supabase Auth with role-based access control derived from a `profiles` table.

---

## Features

### 🏥 Admin
- Centralized dashboard with live KPI metrics (patients, appointments, revenue, expenses)
- Full staff management — create, update, and deactivate accounts for all roles
- Attendance tracking and leave management
- Financial reporting and expense logging
- Audit log viewer showing all system activity
- System configuration (maintenance mode, clinic name, contact details)
- Password change request approvals

### 👨‍⚕️ Doctor
- Live appointment queue with real-time Supabase subscriptions
- Full consultation module: chief complaint, history, vitals, clinical impression
- Structured diagnosis with ICD-10 code search and auto-complete
- Prescription writer with drug, dose, frequency, duration, and instructions
- Lab test ordering and result review directly in the consultation
- Patient profile with complete medical history (consultations, prescriptions, lab results)
- Doctor-level reports and analytics

### 🗂️ Registrar
- Patient registration with auto-generated display IDs (`MV-P-XXX`)
- Appointment scheduling and live queue management
- Billing gate — approve and record consultation/lab/pharmacy charges
- Printable medical records and invoices
- Revenue reports broken down by department (pharmacy, lab, consultation)

### 🔬 Laboratory
- Lab request workbench — receive, process, and complete ordered tests
- Structured result entry with printable PDF-ready report layout
- Lab catalog management (tests, categories, and pricing)
- Inventory tracking with reorder level alerts
- Analytics dashboard (volume, turnaround time, revenue)

### 💊 Pharmacy
- Prescription dispensing workbench — view pending prescriptions grouped by patient
- Point-of-sale inventory sales with barcode scanner support
- Inventory management with expiry date tracking
- Procurement and supplier management (purchase orders)
- Sales recording and revenue reports
- Medicine status monitoring (low stock, expiring soon)

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 |
| **Build Tool** | Vite 5 |
| **Routing** | React Router DOM v6 |
| **Backend / Database** | Supabase (PostgreSQL 15) |
| **Authentication** | Supabase Auth (email/password) |
| **Real-time** | Supabase Realtime (`postgres_changes`) |
| **Styling** | Vanilla CSS + Inline Styles |
| **Icons** | Lucide React |
| **Date Handling** | date-fns |
| **Select Components** | React Select |
| **HTTP Client** | Axios |
| **Deployment** | Vercel (Edge Network) |

---

## Project Structure

```
edoc-main/
├── public/
│   ├── logo.png            # App icon / PWA icon
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker (offline support)
├── src/
│   ├── components/         # Shared UI components
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx   # Sidebar + top nav wrapper
│   │   ├── pharmacy/       # Pharmacy-specific sub-components
│   │   ├── registrar/      # Registrar-specific sub-components
│   │   └── NotificationCenter.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx # Global auth state (user, role, profile, cache)
│   ├── lib/
│   │   ├── supabase.js     # Supabase client initialization
│   │   └── api.js          # Centralized data-fetching helpers
│   ├── pages/
│   │   ├── admin/          # Admin role pages
│   │   ├── doctor/         # Doctor role pages
│   │   ├── lab/            # Lab technician pages
│   │   ├── pharmacy/       # Pharmacist pages
│   │   ├── registrar/      # Registrar pages
│   │   ├── Home.jsx        # Landing / splash screen
│   │   ├── Login.jsx       # Login with email or username
│   │   └── Maintenance.jsx # Maintenance mode page
│   ├── App.jsx             # Root router + role-based protected routes
│   └── main.jsx            # React entry point
├── supabase/
│   └── migrations/         # PostgreSQL schema migrations
│       └── 20260805123547_remote_schema.sql
├── .env.example            # Environment variable template (safe to commit)
├── index.html              # HTML shell with SEO and PWA meta tags
├── vercel.json             # Vercel deployment: routing, caching, headers
└── vite.config.js          # Vite build config with manual chunk splitting
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher (`node -v`)
- **npm** v9 or higher (`npm -v`)
- A **Supabase** project — create one free at [supabase.com](https://supabase.com)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Timothykupsoboi/hospital_final.git
cd hospital_final

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Open .env and fill in your Supabase credentials (see below)

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase project values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

| Variable | Description | Where to Find |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Project → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for browser) | Project → Settings → API |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | Project → Settings → API |

> **⚠️ Security Note:** The service role key is currently used client-side because RLS policies have not yet been configured. Before exposing this app to the public internet, configure proper Row Level Security SELECT policies for `anon` on all tables and remove the service role key from client code (or move those calls to a secure server-side API route).

### Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Navigate to **SQL Editor** and run the full migration file:
   ```
   supabase/migrations/20260805123547_remote_schema.sql
   ```
3. Go to **Authentication → Users** and create your first Admin user
4. In **Table Editor → profiles**, add a row for that user:
   - `id` — the user's UUID from Auth
   - `role` — `Admin`
   - `username` — your preferred username
5. Log in to the app and the Admin dashboard will appear

---

## User Roles & Login

The system derives each user's role from the `profiles` table (keyed by Supabase Auth UID).

Login accepts either an **email address** or a **username** (stored in `profiles.username`). The username lookup resolves to the account's email, then authenticates via Supabase Auth.

| Role | Dashboard URL | profiles.role values |
|---|---|---|
| Administrator | `/admin` | `Admin`, `a` |
| Physician / Doctor | `/doctor` | `Doctor`, `d` |
| Registrar / Receptionist | `/registrar` | `registrar`, `r` |
| Lab Technician | `/lab` | `Lab`, `l` |
| Pharmacist | `/pharmacy` | `Pharmacy`, `ph` |

---

## Deployment

### Deploying to Vercel

This project is pre-configured for zero-configuration Vercel deployment via `vercel.json`.

**Option A — GitHub Integration (Recommended):**
1. Push your code to GitHub (already done if you cloned this repo)
2. Go to [vercel.com/new](https://vercel.com/new)
3. Click **"Import Git Repository"** and select `hospital_final`
4. Vercel auto-detects Vite — **no framework settings need to change**
5. Under **"Environment Variables"**, add the three variables listed below
6. Click **Deploy**

Every subsequent `git push` to `main` will trigger an automatic redeploy.

**Option B — Vercel CLI:**
```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy to production
vercel --prod
```

### Environment Variables on Vercel

In your Vercel project → **Settings → Environment Variables**, add:

| Name | Example Value | Environments |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://abcdef.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Production, Preview, Development |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Production, Preview, Development |

> Variables prefixed with `VITE_` are inlined at build time by Vite. They will be visible in the browser bundle — never put server-only secrets (e.g., Stripe secret keys) in `VITE_` variables.

The `vercel.json` configures:
- ✅ SPA client-side routing rewrite (`/*` → `/index.html`)
- ✅ Immutable asset caching (`/assets/*` — 1 year, `Cache-Control: immutable`)
- ✅ Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- ✅ HTTPS enforcement via `Strict-Transport-Security` (HSTS)
- ✅ Explicit build command, output directory, and framework hint

---

## Performance

The login flow has been profiled and optimized:

| Metric | Before | After |
|---|---|---|
| DB queries on login | 4–5 sequential | 1 (sometimes 0) |
| Total DB overhead | ~2,500 ms | ~290 ms |
| Username lookup | `ilike` (~978 ms) | `eq` (~290 ms) |
| AuthContext double-fetch | Yes (2× profiles query) | No (in-memory cache) |

**Techniques applied:**
- In-memory `profileCache` in `AuthContext` prevents double-fetch when `getSession()` and `onAuthStateChange` both fire on load
- `profileHint` passed via `sessionStorage` from `Login.jsx` to `AuthContext` skips a second DB round-trip entirely
- Exact `eq()` username lookup instead of case-insensitive `ilike()`
- Role resolved from `user_metadata` (embedded in the auth token) when available — zero additional DB cost
- Vite manual chunk splitting separates the bundle into 5 independently cached chunks:
  - `react-vendor` · `router` · `supabase` · `ui-vendor` · `data-vendor`

---

## Database Schema

The database contains **24 tables** across the following domains:

| Domain | Tables |
|---|---|
| **Patients** | `patient`, `vitals_records`, `consultations`, `prescriptions` |
| **Appointments** | `appointment`, `schedule`, `doctor` |
| **Lab** | `lab_requests`, `lab_reports`, `lab_catalog`, `lab_inventory` |
| **Pharmacy** | `medicine`, `pharmacy_sale`, `pharmacy_sale_item`, `suppliers`, `procurement_orders`, `procurement_items` |
| **Finance** | `sales`, `expenses`, `pricing_matrix` |
| **Staff** | `profiles`, `registrar`, `lab_technician`, `pharmacist` |
| **System** | `system_config`, `audit_logs`, `password_change_requests`, `icd10` |

Full schema is defined in [`supabase/migrations/20260805123547_remote_schema.sql`](supabase/migrations/20260805123547_remote_schema.sql).

---

## Security Notes

- `.env` is listed in `.gitignore` — credentials are never committed
- `VITE_SUPABASE_SERVICE_ROLE_KEY` is currently used client-side (RLS is disabled for development). **Before going public**, enable RLS and configure `SELECT` policies for the `anon` role on all tables
- `X-Frame-Options: SAMEORIGIN` allows Supabase Auth iframe flows while blocking clickjacking from external origins
- `Strict-Transport-Security` enforces HTTPS for all connections once deployed to Vercel

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is private and proprietary. All rights reserved © Moonview Medical Centre.