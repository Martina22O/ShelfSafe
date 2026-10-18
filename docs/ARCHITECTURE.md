# ShelfSafe Architecture

This document describes the high-level system architecture and how the web dashboard, mobile application, and database connect.

---

## 1. System Overview

ShelfSafe is an inventory management platform designed for small retail stores. It consists of three primary components:

1. **Web Dashboard (`apps/web`)**: Next.js application used by store owners and managers to monitor inventory levels, view sales analytics, and manage products and categories.
2. **Mobile App (`apps/mobile`)**: React Native / Expo application used by store staff on Android devices for barcode scanning (adding deliveries and recording sales deductions).
3. **Backend & Database (`supabase/`)**: Managed PostgreSQL instance via Supabase providing authentication, relational data storage, Row-Level Security (RLS), and database functions (such as atomic FEFO deduction and undo).

---

## 2. Connection Topology

```
+-----------------------------------+        +-----------------------------------+
|         Web Dashboard             |        |             Mobile App            |
|          (`apps/web`)             |        |          (`apps/mobile`)          |
|    Next.js + Tailwind CSS         |        |         Expo (React Native)       |
+-----------------+-----------------+        +-----------------+-----------------+
                  |                                            |
                  | HTTPS / WSS                                | HTTPS / WSS
                  | (Supabase JS Client)                       | (Supabase JS Client)
                  v                                            v
+--------------------------------------------------------------------------------+
|                                 Supabase                                       |
|                                                                                |
|  +---------------------------+             +--------------------------------+  |
|  |       Supabase Auth       |             |           PostgreSQL           |  |
|  | (JWT Tokens & Sessions)   |             |  - products, batches           |  |
|  +---------------------------+             |  - sales_scans, deductions     |  |
|                                            |  - atomic FEFO function        |  |
|  +---------------------------+             |  - atomic Undo function        |  |
|  |     Row-Level Security    |             |  - RLS access policies         |  |
|  +---------------------------+             +--------------------------------+  |
+--------------------------------------------------------------------------------+
```

---

## 3. How Components Connect

### Web Dashboard (`apps/web`) &rarr; Supabase
- Communicates directly with Supabase via `@supabase/supabase-js` and `@supabase/ssr`.
- Authentication uses browser cookies / local storage managed by Supabase Auth helpers.
- Reads and updates products, batch details, and alert views.
- Server-side rendering (SSR) fetches initial state securely using environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

### Mobile App (`apps/mobile`) &rarr; Supabase
- Communicates directly with Supabase via `@supabase/supabase-js` and Expo SecureStore for persistent session storage.
- Uses `expo-camera` (`CameraView`) to scan EAN-13, EAN-8, UPC-A, and Code 128 barcodes.
- Calls PostgreSQL RPC functions for stock deduction to execute the FEFO algorithm atomically on the server.

### Database Layer (`supabase/`)
- Acts as the single source of truth for both web and mobile clients.
- **FEFO (First-Expired, First-Out)**: Implemented as a database function (RPC). When a sale is scanned, the database deducts from the earliest-expiring batch first without risk of race conditions or partial updates.
- **Undo Operation**: Implemented as a paired database function that restores deducted quantities back into the exact batches recorded in the `deductions` table.
- **Security**: Supabase Row-Level Security (RLS) ensures users can only access their store's inventory data.
