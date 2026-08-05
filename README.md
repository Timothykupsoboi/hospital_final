# Moonview Medical — Hospital Management System

<div align="center">

![Moonview Medical](https://img.shields.io/badge/Moonview-Medical%20HMS-f97316?style=for-the-badge&logo=heart&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

**A full-featured, role-based Hospital Management System built with React 18 and Supabase.**

[Live Demo](#) · [Report Bug](https://github.com/Timothykupsoboi/hospital_final/issues) · [Request Feature](https://github.com/Timothykupsoboi/hospital_final/issues)

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
- [User Roles](#user-roles)
- [Deployment](#deployment)
  - [Deploying to Vercel](#deploying-to-vercel)
  - [Environment Variables on Vercel](#environment-variables-on-vercel)
- [Performance](#performance)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Moonview Medical HMS is a comprehensive, production-ready Hospital Management System designed to streamline clinical operations. It supports five distinct staff roles — Admin, Doctor, Registrar, Lab Technician, and Pharmacist — each with a fully isolated, purpose-built dashboard.

All data is persisted in a managed **Supabase (PostgreSQL)** backend, with real-time subscriptions for live queue and request updates. Authentication is handled entirely through Supabase Auth with role-based access control.

---

## Features

### 🏥 Admin
- Centralized dashboard with live KPI metrics (patients, appointments, revenue, expenses)
- Full staff management (create, update, deactivate accounts)
- Attendance tracking and leave management
- Financial reporting and expense logging
- Audit log viewer (all system activity)
- System configuration (maintenance mode, clinic name, contact info)
- Password change request approvals

### 👨‍⚕️ Doctor
- Live appointment queue with real-time Supabase subscriptions
- Full consultation module: history, vitals, clinical impression, diagnosis (ICD-10), prescriptions
- Patient profile viewer with complete medical history
- Lab test ordering and result review
- Prescription management
- Reports and analytics

### 🗂 Registrar
- Patient registration with auto-generated display IDs
- Appointment scheduling and queue management
- Billing and invoice generation
- Printable medical records
- Revenue reports (pharmacy, lab, consultation)

### 🔬 Laboratory
- Lab request workbench (receive, process, complete tests)
- Result entry with printable reports
- Lab catalog management (tests + pricing)
- Inventory tracking with reorder alerts
- Analytics dashboard

### 💊 Pharmacy
- Prescription dispensing workbench
- Inventory management with expiry tracking
- Procurement and supplier management
- Sales recording and revenue reports
- Medicine status monitoring (low stock, expired)

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 |
| **Build Tool** | Vite 5 |
| **Routing** | React Router DOM v6 |
| **Backend / Database** | Supabase (PostgreSQL) |
| **Authentication** | Supabase Auth |
| **Real-time** | Supabase Realtime (postgres_changes) |
| **Styling** | Vanilla CSS + Inline Styles |
| **Icons** | Lucide React |
| **Date Handling** | date-fns |
| **Select Components** | React Select |
| **HTTP Client** | Axios |
| **Deployment** | Vercel |

---

## Project Structure

```
edoc-main/
├── public/                 # Static assets
├── src/
│   ├── components/         # Shared UI components
│   │   ├── layouts/        # MainLayout (sidebar + nav)
│   │   └── ...
│   ├── contexts/
│   │   └── AuthContext.jsx # Global auth state (user, role, profile)
│   ├── lib/
│   │   ├── supabase.js     # Supabase client + query logger
│   │   └── api.js          # Centralized data-fetching functions
│   ├── pages/
│   │   ├── admin/          # Admin role pages
│   │   ├── doctor/         # Doctor role pages
│   │   ├── lab/            # Lab technician pages
│   │   ├── pharmacy/       # Pharmacist pages
│   │   └── registrar/      # Registrar pages
│   ├── App.jsx             # Root router + protected routes
│   └── main.jsx            # Entry point
├── supabase/
│   └── migrations/         # Database schema migrations
├── .env.example            # Environment variable template
├── vercel.json             # Vercel deployment config
└── vite.config.js          # Vite build config with chunk splitting
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- A **Supabase** project ([supabase.com](https://supabase.com))

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Timothykupsoboi/hospital_final.git
cd hospital_final

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials (see below)

# 4. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

| Variable | Description | Where to Find |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Public anon key | Project Settings → API |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | Project Settings → API |

> **Security Note:** The service role key is currently used client-side to bypass RLS while development RLS policies are not yet configured. Before going live, configure proper RLS SELECT policies for `anon` on all tables and remove the service role key from client code.

### Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Navigate to **SQL Editor** and run the migration file:
   ```
   supabase/migrations/20260805123547_remote_schema.sql
   ```
3. To allow the anon key to read data without the service role, also run:
   ```
   supabase/migrations/20260805140000_disable_rls_and_policies.sql
   ```
4. Go to **Authentication → Users** and create your first admin user with email containing `admin`
5. In **Table Editor → profiles**, add a row for the new user with `role = 'Admin'`

---

## User Roles

The system uses role codes stored in the `profiles` table:

| Role Code | Role | Dashboard |
|---|---|---|
| `a` / `Admin` | Administrator | `/admin` |
| `d` / `Doctor` | Physician | `/doctor` |
| `r` / `registrar` | Registrar / Receptionist | `/registrar` |
| `l` / `Lab` | Lab Technician | `/lab` |
| `ph` / `Pharmacy` | Pharmacist | `/pharmacy` |

Login supports both **email address** and **username** (stored in `profiles.username`).

---

## Deployment

### Deploying to Vercel

This project is pre-configured for zero-configuration Vercel deployment.

**Option A — Vercel CLI:**
```bash
npm install -g vercel
vercel --prod
```

**Option B — Vercel Dashboard:**
1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the `hospital_final` repository
4. Vercel auto-detects Vite — no framework settings needed
5. Add the three environment variables (see below)
6. Click **Deploy**

### Environment Variables on Vercel

In your Vercel project → **Settings → Environment Variables**, add:

| Name | Value | Environments |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview, Development |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Production, Preview, Development |

The `vercel.json` in this repo configures:
- ✅ SPA client-side routing rewrite (`/*` → `/index.html`)
- ✅ Immutable asset caching (`/assets/*` — 1 year)
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, XSS Protection)
- ✅ Explicit build command, output directory, and framework

---

## Performance

The login flow has been profiled and optimized:

| Metric | Before | After |
|---|---|---|
| DB queries on login | 4–5 sequential | 1 (sometimes 0) |
| Total DB overhead | ~2,500ms | ~290ms |
| Username lookup | `ilike` (~978ms) | `eq` (~290ms) |
| AuthContext double-fetch | Yes (2× profiles query) | No (in-memory cache) |

**Techniques used:**
- In-memory `profileCache` in AuthContext prevents double-fetch when `getSession()` and `onAuthStateChange` fire together
- `profileHint` passed via `sessionStorage` from Login.jsx to AuthContext skips a second DB round-trip
- Exact `eq()` username lookup instead of case-insensitive `ilike()`
- Role resolved from `user_metadata` (already embedded in auth response) when available — zero DB cost
- Vite manual chunk splitting splits the 1.2MB bundle into 5 separately cached chunks

---

## Database Schema

The database contains 31 tables across the following domains:

| Domain | Tables |
|---|---|
| **Patients** | `patient`, `vitals_records`, `consultations`, `prescriptions` |
| **Appointments** | `appointment`, `schedule`, `doctor` |
| **Lab** | `lab_requests`, `lab_reports`, `lab_catalog`, `lab_inventory` |
| **Pharmacy** | `medicine`, `pharmacy_sale`, `pharmacy_sale_item`, `suppliers`, `procurement_orders`, `procurement_items` |
| **Finance** | `sales`, `expenses`, `pricing_matrix`, `treatment_bundles` |
| **Staff** | `profiles`, `registrar`, `lab_technician`, `pharmacist` |
| **System** | `system_config`, `audit_logs`, `password_change_requests`, `icd10` |

Full schema is defined in [`supabase/migrations/20260805123547_remote_schema.sql`](supabase/migrations/20260805123547_remote_schema.sql).

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is private and proprietary. All rights reserved © Moonview Medical.