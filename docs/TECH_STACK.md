# Proppros — Technical Architecture

> **Version:** 0.1 (draft) · **Date:** 2026-10-17
> **Reference project:** `C:\Projects\Pickzona` (FastAPI + SQLModel + PostgreSQL + React/Vite + Expo)
> **Hosting:** Vercel

## 1. Approach

Keep Pickzona's stack wherever possible so patterns and code carry over. Vercel runs FastAPI natively as Python Functions, so the backend language and framework stay the same. Only the pieces that assume a long-running server change.

## 2. Stack

| Layer | Pickzona | Proppros on Vercel |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + React Router | **Same**, deployed as Vercel static output. Add TanStack Query for data fetching |
| Backend | FastAPI + SQLModel (Pydantic v2) | **Same**, deployed as a Vercel **service** (`backend/`) routed at `/api/*` in the same project |
| Database | Self-hosted Postgres in Docker | **Neon Postgres** (Vercel Marketplace). Use the **pooled** connection string |
| Migrations | Alembic, run at container start | **Alembic**, run from GitHub Actions or a pre-deploy step, never at function startup |
| Auth | JWT in httpOnly cookie + Bearer | **Same**. Frontend and API share one domain, so no CORS needed |
| Scheduled jobs | APScheduler | **Vercel Cron Jobs** calling protected endpoints |
| Background tasks | FastAPI `BackgroundTasks` | OK for quick work (one email). Heavier work (PDFs, bank sync) goes to **Upstash QStash** or Inngest |
| Email | SMTP | **Resend** (HTTP API) |
| File storage | — | **Vercel Blob**: leases, receipts, photos, using signed URLs and direct browser uploads |
| Payments | Stripe | **Stripe Connect** (rent via ACH/card) + **Stripe Billing** (subscriptions) |
| Rate limiting | SlowAPI (in-memory) | **Upstash Redis** rate limiting (in-memory limits don't work across serverless instances) |
| Monitoring | Sentry | **Sentry** + Vercel Analytics |
| i18n | i18next / react-i18next | **Same** |
| Icons | Lucide React | **Same** |
| Mobile (later) | Expo SDK + Expo Router | **Same**, built with EAS (not Vercel), using the same API |
| Tests | Pytest + Vitest / React Testing Library | **Same** |
| Local dev | Docker Compose | `vercel dev`, or Vite + uvicorn against a Neon dev branch |

## 3. Proposed repository layout

```
Proppros/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app, routers registered here
│   │   ├── models.py     # SQLModel tables
│   │   ├── core/         # config, db, email, storage, auth, limiter
│   │   └── routers/      # one *_router.py per feature (Pickzona pattern)
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt  # runtime deps (Vercel installs these for the backend service)
│   └── requirements-dev.txt
├── frontend/             # React + Vite + TS
│   └── src/
├── mobile/               # Expo app (later phase)
├── docs/
│   ├── FEATURES.md
│   └── TECH_STACK.md
├── vercel.json           # Vercel Services: frontend at /, backend at /api/*, daily cron
└── README.md
```

## 4. Scheduled jobs (Vercel Cron)

A single cron, `GET /api/cron/daily` at 10:00 UTC (early morning in every US time zone), runs these steps for each organization using that organization's local date:

| Step | Purpose |
|---|---|
| Post rent charges | Rent + recurring charges for every due date up to today (catches up after a missed day) |
| Apply late fees | One late fee per period once the grace period has passed and a balance remains |
| Rent reminders | Upcoming (3 days before), due, and overdue emails to tenants |
| Lease expiry alerts | 90/60/30-day notices to owners and managers |
| Document expiry alerts | Documents expiring within 30 days |

One daily cron fits Vercel's Hobby plan. Owners can also trigger it from Settings → Automation.

Cron endpoints:
- Are protected with a `CRON_SECRET` bearer token (Vercel sends it automatically)
- Are **idempotent**: ledger entries carry a unique `source_key` (e.g. `rent:<lease>:2026-11`) and emails a unique `dedupe_key`, so retries never double-post or double-send

## 5. Serverless constraints to design around

- **Timeouts:** keep requests short, and move long work (PDF generation, bulk imports, bank sync) to a queue.
- **Statelessness:** no in-memory caches, sessions or rate limits.
- **DB connections:** always use Neon's pooled connection string, and use small or no SQLAlchemy pools (`NullPool` or `pool_size=1`).
- **Cold starts:** keep the Python dependency set lean, and avoid heavy imports at module load.
- **Preview environments:** use Neon branching so each Vercel preview deployment gets its own database branch.
- **File uploads:** upload directly from the browser to Vercel Blob (client upload tokens), not through the function, because of the body size limit.

## 6. Core data model (MVP draft)

| Table | Key fields |
|---|---|
| `organizations` | name, plan, stripe_customer_id |
| `users` | email, password_hash, name |
| `memberships` | user_id, organization_id, role, property scope |
| `properties` | organization_id, address, type, purchase_date, purchase_price |
| `units` | property_id, name, beds, baths, sqft, market_rent, status |
| `tenants` | organization_id, user_id (portal), contacts, emergency contact |
| `leases` | unit_id, start/end dates, rent, due_day, deposit, late_fee_rule |
| `lease_tenants` | lease_id, tenant_id |
| `recurring_charges` | lease_id, type, amount |
| `ledger_entries` | lease_id, type (charge/payment/credit/late_fee), amount, period, date |
| `payments` | lease_id, method, amount, reference, received_at |
| `expenses` | property_id, unit_id, category, amount, vendor, date, receipt_doc_id |
| `work_orders` | unit_id, created_by, category, priority, status, assigned_to |
| `work_order_comments` | work_order_id, author_id, body, attachments |
| `documents` | owner type/id, blob_url, kind, expires_at |
| `notifications` | user_id, channel, template, status |
| `audit_log` | actor_id, entity, entity_id, action, diff, at |

All tenant-scoped tables carry `organization_id`, and every query filters by it.

## 7. Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Direct connection, for Alembic migrations |
| `JWT_SECRET` | JWT signing |
| `CRON_SECRET` | Protects cron endpoints |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `RESEND_API_KEY` | Email |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payments and billing |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `SENTRY_DSN` | Error monitoring |
| `ANTHROPIC_API_KEY` | AI features (v2) |

## 8. Patterns carried over from Pickzona

- One `*_router.py` per feature, registered in `main.py`
- `get_current_user` auth dependency injected via `Depends()`
- All SQLModel tables in `app/models.py`, with a new Alembic migration for every schema change
- An `updated_at` auto-sync pattern for models
- CSS design tokens (`var(--pp-*)`), never hard-coded hex colors
- Help center and feedback features can be ported directly

## 9. As built (differences from the original plan)

| Area | Plan | As built | Why |
|---|---|---|---|
| JWT / passwords | python-jose + passlib (Pickzona) | **PyJWT + bcrypt** directly | passlib is unmaintained and breaks with current bcrypt |
| Rate limiting | Upstash Redis | **Upstash REST** fixed-window limiter (`core/limiter.py`), in-memory fallback in dev | No SlowAPI dependency; works across serverless instances |
| File uploads | Blob client uploads | **Multipart through the API** → Vercel Blob (or `backend/.uploads` locally), 4 MB cap | Every file is authorized and recorded as a `Document`; Blob URLs are unguessable but public — switch to private storage before storing sensitive IDs |
| Cron | 5 jobs | **1 daily job** running all steps | Hobby-plan friendly, simpler, idempotent |
| Datetimes | — | **Timezone-aware UTC** everywhere | Required by SQLModel ≥ 0.0.4x (`UTCDateTime`) |
| Vercel routing | `/api/*` → `api/index.py` function | **Vercel Services** (`vercel.json` → `services`): `frontend` (Vite, root `frontend/`) and `backend` (FastAPI, root `backend/`, entrypoint `app.main:app`); top-level rewrites send `/api/*` to the backend, which receives the original path | Vercel's import flow now requires a services config for frontend + Python repos; it also removes the path-restoring wrapper needed by `@vercel/python` ≥ 6.52 |
| Local DB | Neon dev branch | **SQLite file** by default (`DATABASE_URL` unset); Postgres via `docker compose up` or a Neon branch | Zero-setup local dev |
| Emails in dev | — | Logged (with links) instead of sent when `RESEND_API_KEY` is blank | Lets you click invite/reset links locally |

### Ledger model

Balance-forward: each lease has one running balance. Charges are positive, payments and credits negative. A late fee applies when the lease balance is still above zero after `due date + grace days`. Deleting an automatic charge creates a reversal entry instead, so the idempotency key stays and the cron never re-posts it. Voiding a payment removes its ledger entry and marks the payment voided.
