# Arkivo — System Architecture (Plain English)

> A no-jargon walkthrough of how Arkivo is built, how the pieces talk to each other, and what to watch out for.

---

## What is Arkivo?

Arkivo is an **LGU (Local Government Unit) document management system** — a secure web app where government offices can store, review, approve, and retrieve official documents. Think of it as a digital filing cabinet with locks, an approval stamp machine, and a full activity log.

---

## The Big Picture: Three Layers

Every request in Arkivo passes through three layers, like floors in a building:

```
┌──────────────────────────────────────────────────────────────────┐
│  FLOOR 1 — The Browser (React SPA)                               │
│  What the user sees and interacts with.                           │
│  Built with React + react-router v7 + Tailwind CSS.              │
│  All pages load without a full browser refresh (Single Page App). │
└─────────────────────────┬────────────────────────────────────────┘
                          │  HTTPS request + X-Session-Token header
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  FLOOR 2 — The Edge Function (Deno/Hono)                         │
│  The brain / security guard. Checks who you are,                 │
│  what you're allowed to do, then fetches or saves data.          │
│  URL: /make-server-c5b85875/*                                    │
│  Runtime: Deno on Supabase Edge Functions.                       │
│  Framework: Hono (a tiny, fast HTTP router).                     │
└─────────────────────────┬────────────────────────────────────────┘
                          │  SQL queries
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  FLOOR 3 — The Database (Postgres on Supabase)                   │
│  The filing cabinet. Stores users, documents, approvals,         │
│  sessions, and the full audit trail.                             │
└──────────────────────────────────────────────────────────────────┘
```

---

## How Authentication Works (Step by Step)

Authentication = "proving who you are before the system lets you in."

Arkivo uses a **custom session-token system** — not Supabase Auth.

```
1. User types email + password → clicks Login

2. Browser sends:  POST /login  { email, password }

3. Server looks up the email in the `users` table in Postgres.

4. Server hashes the submitted password with SHA-256
   and compares it to the stored hash.
   ✓ match  → continue
   ✗ no match → return 401 Unauthorized

5. Server generates a random UUID token, e.g.:
   "a3f8c2d1-7b4e-4f9a-b123-0e8d6c5a2b1f"
   and saves it to the `sessions` table with an expiry time.

6. Server returns the token to the browser.
   Browser saves it:  localStorage.setItem("lgu_session_token", token)

7. Every future API call includes:
   X-Session-Token: a3f8c2d1-7b4e-4f9a-b123-0e8d6c5a2b1f

8. Server checks the token on every request. If it's expired or
   not found → return 401 → browser clears the token → redirect to Login.
```

**Analogy:** Think of the session token as a wristband you get at an event. You show it at the door (login), and then flash it every time you want to enter a restricted area.

---

## How Documents Work

### Upload Flow

```
1. User selects a file in the UploadDocument page.
2. File type is auto-detected (PDF, DOCX, etc.) and the title is pre-filled.
3. The file is converted to a base64 string in the browser.
4. A SHA-256 hash of the file is computed (the document's "fingerprint").
5. Both the base64 content and the hash are sent to the server.
6. Server saves them to the `documents` table.
```

### Document States (Lifecycle)

```
DRAFT ──► SUBMITTED ──► UNDER REVIEW ──► APPROVED ──► ARCHIVED
                                    └──► REJECTED ──► (revise) ──► DRAFT
```

| State | Meaning |
|-------|---------|
| **Draft** | Created but not yet sent for review |
| **Submitted** | In the approval queue |
| **Under Review** | An approver is actively looking at it |
| **Approved** | All approvals collected. Document is locked — cannot be edited or deleted |
| **Rejected** | Approver said no. Author can revise and resubmit |
| **Archived** | Approved doc moved to long-term storage. Still readable forever |

### SHA-256 Integrity Verification

Every file has a "fingerprint" (SHA-256 hash). When someone downloads a file, the system re-hashes it and checks it matches the stored fingerprint. If it doesn't match, the file was tampered with.

**Analogy:** It's like a wax seal on an envelope. If the seal is broken, you know someone opened it.

---

## Roles and Clearance

Access is decided by **three checks in order**:

```
1. Role       — what job title does the user have?
2. Clearance  — what security level (0–4) does the user hold?
3. Document   — what access level is the document tagged with?
```

All three must pass. If any one fails, access is denied.

### Role Hierarchy (highest → lowest)

| Role | Clearance | What they can do |
|------|-----------|-----------------|
| **Super Admin** | 4 | Everything. Full system control. |
| **LGU Head / Admin** | 3 | Approve all docs, view all reports, manage users. |
| **Department Admin** | 2 | Manage their department's users and documents. |
| **Records Officer** | 2 | Validate, organize, and archive documents. |
| **Staff** | 1 | Upload and submit their own documents. |
| **Public User** | 0 | View approved public documents only. No login required. |

### Document Access Levels (matching clearance)

| Access Level | Required Clearance |
|-------------|-------------------|
| Public | 0 (anyone) |
| Restricted | 1+ |
| Confidential | 2+ |
| Highly Confidential | 3+ |

---

## Pages at a Glance

| Page | Who can access |
|------|---------------|
| **Dashboard** | All logged-in users |
| **Documents** | All logged-in users (filtered by clearance) |
| **Document Viewer** | All logged-in users (if clearance allows) |
| **Upload Document** | Staff and above |
| **Analytics** | Admin and above |
| **Reports** | Admin and above |
| **Admin Panel** | Admin and above |
| **Audit Logs** | Admin and above |
| **Profile Settings** | All logged-in users |
| **Public Portal** | Anyone (no login needed) |
| **Login / Signup** | Unauthenticated users |

---

## Database Tables

```
users          — email, hashed password, role, clearance, department
sessions       — token (UUID), user_id, expires_at
documents      — title, file (base64), sha256_hash, status, access_level, uploader_id
approvals      — document_id, approver_id, decision, comment, timestamp
audit_logs     — user_id, action, target_id, ip_address, timestamp
departments    — name, head_user_id
```

---

## API Endpoints

All routes live under `/make-server-c5b85875/` on the Supabase Edge Function.

### Auth
| Method | Path | What it does |
|--------|------|-------------|
| POST | /login | Check credentials, return session token |
| POST | /register | Create user account + initial session |
| GET | /me | Validate session, return current user info |
| POST | /logout | Delete session from database |

### Documents
| Method | Path | What it does |
|--------|------|-------------|
| GET | /documents | List documents (RBAC filtered) |
| POST | /documents | Upload new document |
| GET | /documents/:id | Get single document with base64 content |
| PUT | /documents/:id | Update metadata |
| POST | /approve | Submit approval decision |
| POST | /reject | Submit rejection decision |

### Admin
| Method | Path | What it does |
|--------|------|-------------|
| GET | /users | List all users (admin only) |
| PUT | /users/:id | Update user role/clearance |
| GET | /audit-logs | Fetch activity logs (admin only) |

---

## Known Issues

These are confirmed problems that don't break the demo but need fixing before production.

### 1. Dual Password Systems (HIGH)

**What:** Arkivo has its own SHA-256 password hashing in the `users` table. But the project also runs on Supabase, which has its own separate Auth system with bcrypt. Both exist side by side.

**Problem:** A user created through Supabase Auth might not exist in the custom `users` table, so they can't log in through Arkivo's `/login` route. And vice versa.

**Fix:** Pick one system. Either:
- Drop Supabase Auth, use only the custom SQL session system, OR
- Migrate everything to Supabase Auth and use its JWT tokens instead of custom sessions.

---

### 2. Missing DELETE /users/:id Backend Route (MEDIUM)

**What:** The Admin Panel shows a "Delete User" button, but the Hono edge function has no route handler for `DELETE /users/:id`. The button sends a request that returns 404.

**Problem:** Admins cannot delete accounts through the UI.

**Fix:** Add a `DELETE /users/:id` handler in the Hono router. Recommended: soft-delete by setting `is_active = false` rather than actually removing the row (to preserve audit history).

---

### 3. Base64 File Storage Doesn't Scale (HIGH)

**What:** Uploaded files are base64-encoded and stored directly in the Postgres `documents` table as text. Base64 adds ~33% overhead (a 1 MB PDF becomes 1.3 MB of text in the database).

**Problem:** Postgres is not designed to store large binary files. As uploads grow, the database bloats, queries slow down, and API responses become huge.

**Fix:** Move files to **Supabase Storage** (S3-compatible). Store only the file URL and SHA-256 hash in Postgres. This is the standard pattern for file-heavy apps.

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 |
| Routing | react-router v7 |
| Styling | Tailwind CSS v4 |
| Build tool | Vite |
| Title font | JetBrains Mono |
| Body font | Google Sans / Roboto |
| Backend runtime | Deno |
| Backend framework | Hono |
| Hosting | Supabase Edge Functions |
| Database | PostgreSQL (Supabase managed) |
| Auth | Custom SQL session tokens |
| File storage | Base64 in Postgres (needs migration) |
| Integrity | SHA-256 hashing |

---

*Generated by Arkivo architecture review · August 2026*
