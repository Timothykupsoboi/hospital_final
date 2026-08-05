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

  ## supabase 
   -- =============================================================
-- MOONVIEW MEDICAL HMS — SUPABASE POSTGRESQL SCHEMA
-- Execute this script in the Supabase SQL Editor
-- =============================================================
-- 1. PROFILES (Users & Roles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    username TEXT UNIQUE,
    role TEXT CHECK (role IN ('a', 'd', 'r', 'l', 'ph', 'Admin', 'Doctor', 'Receptionist', 'Lab', 'Pharmacy')),
    usertype TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. PATIENTS
CREATE TABLE IF NOT EXISTS public.patient (
    pid SERIAL PRIMARY KEY,
    patient_display_id TEXT,
    pname TEXT NOT NULL,
    pgender TEXT,
    pdob DATE,
    ptel TEXT,
    paddress TEXT,
    pcity TEXT,
    pbloodgroup TEXT,
    pallergies TEXT,
    pconditions TEXT,
    ptemp NUMERIC,
    pbp TEXT,
    pheartrate INT,
    prespiratory INT,
    pspo2 NUMERIC,
    pweight NUMERIC,
    pheight NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 3. LEGACY ROLE TABLES
CREATE TABLE IF NOT EXISTS public.doctor (
    docid SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    docname TEXT NOT NULL,
    docemail TEXT UNIQUE NOT NULL,
    doctel TEXT,
    specialties TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.registrar (
    regid SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    regname TEXT NOT NULL,
    regemail TEXT UNIQUE NOT NULL,
    regtel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.lab_technician (
    labid SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    labname TEXT NOT NULL,
    labemail TEXT UNIQUE NOT NULL,
    labtel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.pharmacist (
    phid SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phname TEXT NOT NULL,
    phemail TEXT UNIQUE NOT NULL,
    phtel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 4. APPOINTMENTS & SCHEDULES
CREATE TABLE IF NOT EXISTS public.schedule (
    scheduleid SERIAL PRIMARY KEY,
    docid INT REFERENCES public.doctor(docid) ON DELETE CASCADE,
    scheduledate DATE NOT NULL,
    scheduletime TIME NOT NULL,
    nop INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.appointment (
    appoid SERIAL PRIMARY KEY,
    apponum INT,
    pid INT REFERENCES public.patient(pid) ON DELETE CASCADE,
    docid INT REFERENCES public.doctor(docid) ON DELETE CASCADE,
    scheduleid INT REFERENCES public.schedule(scheduleid) ON DELETE SET NULL,
    appodate DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'waiting',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 5. CLINICAL & CONSULTATIONS
CREATE TABLE IF NOT EXISTS public.consultations (
    id BIGSERIAL PRIMARY KEY,
    appointment_id INT REFERENCES public.appointment(appoid) ON DELETE CASCADE,
    pid INT REFERENCES public.patient(pid) ON DELETE CASCADE,
    docid INT REFERENCES public.doctor(docid) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft',
    hpi TEXT,
    pmh TEXT,
    ros TEXT,
    clinical_impression TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.vitals_records (
    id BIGSERIAL PRIMARY KEY,
    consultation_id BIGINT REFERENCES public.consultations(id) ON DELETE CASCADE,
    pid INT REFERENCES public.patient(pid) ON DELETE CASCADE,
    bp TEXT,
    temp NUMERIC,
    pulse INT,
    resp_rate INT,
    spo2 NUMERIC,
    weight NUMERIC,
    height NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.prescriptions (
    prescid SERIAL PRIMARY KEY,
    consultation_id BIGINT REFERENCES public.consultations(id) ON DELETE CASCADE,
    pid INT REFERENCES public.patient(pid) ON DELETE CASCADE,
    docid INT REFERENCES public.doctor(docid) ON DELETE SET NULL,
    drug_name TEXT NOT NULL,
    medicine_name TEXT,
    dose TEXT,
    frequency TEXT,
    duration TEXT,
    instructions TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 6. LABORATORY MODULE
CREATE TABLE IF NOT EXISTS public.lab_catalog (
    id SERIAL PRIMARY KEY,
    test_name TEXT NOT NULL,
    category TEXT DEFAULT 'Hematology',
    price NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    required_sample TEXT,
    turnaround_time TEXT,
    ref_ranges JSONB DEFAULT '[]'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.lab_requests (
    id BIGSERIAL PRIMARY KEY,
    appointment_id INT REFERENCES public.appointment(appoid) ON DELETE CASCADE,
    pid INT REFERENCES public.patient(pid) ON DELETE CASCADE,
    docid INT REFERENCES public.doctor(docid) ON DELETE SET NULL,
    test_id INT REFERENCES public.lab_catalog(id) ON DELETE SET NULL,
    test_name TEXT NOT NULL,
    category TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.lab_reports (
    lab_res_id SERIAL PRIMARY KEY,
    id BIGSERIAL,
    request_id BIGINT REFERENCES public.lab_requests(id) ON DELETE CASCADE,
    pid INT REFERENCES public.patient(pid) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    test_date DATE DEFAULT CURRENT_DATE,
    results JSONB DEFAULT '{}'::jsonb,
    cost NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.lab_samples (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT REFERENCES public.lab_requests(id) ON DELETE CASCADE,
    pid INT REFERENCES public.patient(pid) ON DELETE CASCADE,
    sample_type TEXT,
    barcode TEXT,
    status TEXT DEFAULT 'collected',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.lab_inventory (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    quantity INT DEFAULT 0,
    unit TEXT,
    reorder_level INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 7. PHARMACY MODULE
CREATE TABLE IF NOT EXISTS public.medicine (
    id SERIAL PRIMARY KEY,
    med_name TEXT NOT NULL,
    generic_name TEXT,
    med_type TEXT,
    stock_qty INT DEFAULT 0,
    expiry_date DATE,
    buying_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    unit TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.procurement_orders (
    id BIGSERIAL PRIMARY KEY,
    supplier_id INT REFERENCES public.suppliers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.procurement_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES public.procurement_orders(id) ON DELETE CASCADE,
    medicine_id INT REFERENCES public.medicine(id) ON DELETE CASCADE,
    quantity INT DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.sales (
    id BIGSERIAL PRIMARY KEY,
    pid INT REFERENCES public.patient(pid) ON DELETE SET NULL,
    total_amount NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'Cash',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.pharmacy_sale (
    id BIGSERIAL PRIMARY KEY,
    total_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.pharmacy_sale_item (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT REFERENCES public.pharmacy_sale(id) ON DELETE CASCADE,
    medicine_id INT REFERENCES public.medicine(id) ON DELETE SET NULL,
    quantity INT DEFAULT 0,
    buying_price NUMERIC DEFAULT 0,
    selling_price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 8. EXPENSES, NOTIFICATIONS, AUDIT & CONFIG
CREATE TABLE IF NOT EXISTS public.expenses (
    id SERIAL PRIMARY KEY,
    expense_name TEXT NOT NULL,
    category TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    expense_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    title TEXT,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    status TEXT DEFAULT 'unread',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.password_change_requests (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.system_config (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.treatment_bundles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.pricing_matrix (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT,
    price NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    user_email TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.icd10 (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL
);