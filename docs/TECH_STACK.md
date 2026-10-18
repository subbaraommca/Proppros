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
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Online rent payments (Stripe Connect). Optional — the feature is hidden until set |
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
| File uploads | Blob client uploads | **Multipart through the API** → **private** Vercel Blob store (or `backend/.uploads` locally), 4 MB cap; downloads stream through the API after its permission checks | Every file is authorized and recorded as a `Document`; private storage keeps leases and IDs unreachable without the app (`BLOB_ACCESS=public` is still supported) |
| Cron | 5 jobs | **1 daily job** running all steps | Hobby-plan friendly, simpler, idempotent |
| Datetimes | — | **Timezone-aware UTC** everywhere | Required by SQLModel ≥ 0.0.4x (`UTCDateTime`) |
| Vercel routing | `/api/*` → `api/index.py` function | **Vercel Services** (`vercel.json` → `services`): `frontend` (Vite, root `frontend/`) and `backend` (FastAPI, root `backend/`, entrypoint `app.main:app`); top-level rewrites send `/api/*` to the backend, which receives the original path | Vercel's import flow now requires a services config for frontend + Python repos; it also removes the path-restoring wrapper needed by `@vercel/python` ≥ 6.52 |
| Local DB | Neon dev branch | **SQLite file** by default (`DATABASE_URL` unset); Postgres via `docker compose up` or a Neon branch | Zero-setup local dev |
| Emails in dev | — | Logged (with links) instead of sent when `RESEND_API_KEY` is blank | Lets you click invite/reset links locally |

### Online payments (Iteration 10)

Stripe Connect **Express** with **destination charges**: each owner onboards their own Express account from Settings → Payments; tenant payments are created on the platform with `transfer_data.destination` = the owner's account, so money lands with the owner and all events arrive at one webhook (`POST /api/stripe/webhook`, signature-verified). All Stripe calls live in `app/services/stripe_gateway.py`; business rules in `app/services/online_payments.py`.

- **Checkout:** Stripe-hosted Checkout (ACH via `us_bank_account`, or card). Optional card fee pass-through (2.9% + 30¢, configurable via `STRIPE_CARD_FEE_BPS` / `STRIPE_CARD_FEE_FIXED_CENTS`).
- **Ledger:** payments are `processing` until `payment_intent.succeeded`; only then credited (ledger `source_key = stripe:<pi>`). `payment_intent.payment_failed`, `charge.refunded` and `charge.dispute.created` reverse a succeeded payment (`payment_reversal`) and add the owner's returned-payment fee. Each event is applied once (`stripe_events` table).
- **Autopay:** Checkout in `setup` mode saves a payment method (`AutopayEnrollment`); the daily cron charges the balance on the due date with Stripe idempotency key `autopay:<lease>:<period>`.
- **Rules:** owner toggles for accepting online payments, partial payments and card-fee pass-through; per-lease `block_online_payments`.

### SaaS features (Iteration 11)

- **Plans** (`app/services/plans.py`): Free / Pro / Business with unit and seat limits. Limits are enforced (HTTP 402) only when `BILLING_ENABLED=true` and Stripe price IDs are set; otherwise everyone has unlimited use. Effective plan = comped → chosen plan; active/trialing subscription → its plan; else Free.
- **Stripe Billing:** per-unit subscription (quantity = units), Stripe Checkout to subscribe and the Stripe customer portal to manage. `customer.subscription.*` events arrive at the same webhook and update the organization; the daily cron syncs quantity.
- **Property-scoped access:** `memberships.property_ids` (null = all properties). `Ctx.scope` filters every list endpoint and `get_owned()` 404s objects outside the scope; organization-wide actions (team, settings, new properties, audit log) need an unscoped owner/manager (`admin_writer`).
- **2FA (TOTP):** `pyotp` + QR via `segno`. 10 one-time recovery codes stored as SHA-256 hashes. Sign-in with 2FA returns a 5-minute `mfa` token instead of a session; tokens with a `purpose` claim are never accepted as sessions.
- **Google sign-in:** OAuth authorization-code flow, ID token verified against Google's JWKS, `state` cookie for CSRF. Linked to an existing user only on a verified matching email; 2FA still applies.
- **Super admin:** `SUPERADMIN_EMAILS`; `/api/admin/*`. Impersonation issues a 60-minute session carrying `impersonated_by`, keeps the admin's session in a `pp_admin` cookie to switch back, and writes an audit entry.
- **Help & feedback:** help articles are Markdown files in `frontend/src/help/` rendered by a small built-in renderer; feedback goes to the `feedback` table (optionally emailed).
- **Public pages:** `/` (landing), `/pricing`, `/help` when signed out; `/welcome` onboarding wizard after sign-up.

### Leasing workflows (Iteration 12)

- **Templates** (`lease_templates`): Markdown-style text with `{{merge_fields}}` (`app/services/leasing.py → MERGE_FIELDS`). Unknown fields are rejected on save. Rendering is plain string substitution — no template engine, so template text can't run code.
- **E-signature** (`signature_requests`, `signers`): the rendered text is frozen on the request with its SHA-256. Tenants sign through `/sign/<token>` (token stored hashed, single-use, 30-day expiry, rate-limited) or in the portal; the landlord signs in-app. Each signature stores typed name, optional drawn PNG, time, IP and user agent. When the last signer signs, `fpdf2` builds the signed PDF (document + signatures + signing certificate), saves it as a lease document visible to tenants and emails it.
- **Renewals** (`renewal_offers`): accepting creates a lease with `renewal_of_id` pointing at the old one; the daily job ends the old lease after its end date and expires unanswered offers.
- **Inspections** (`inspections`): items are JSON `{id, area, item, condition, notes, photo_ids}`; photos are lease documents of kind `inspection` (only added through the upload endpoint). Completing renders a PDF report with photos.
- **Deposit statement** (`deposit_dispositions`, one per lease): deductions + deposit applied to the unpaid balance (posted once as a ledger credit, `source_key deposit:<lease>`); sending renders a letter PDF and emails it.

### Vendors & preventive maintenance (Iteration 13)

- **Vendors** (`vendors`): org-wide, so `get_owned` isn't used (it would 404 for property-scoped members); vendor documents fall outside every property scope, so only full-access members see W-9s. Rating = average of `work_orders.vendor_rating`.
- **Quotes / invoices** (`quotes`, `vendor_invoices`): an invoice creates an `Expense` (with `work_order_id`, vendor name and the invoice document as receipt) in the same transaction and keeps its `expense_id`.
- **Schedules** (`maintenance_schedules`): `routers/vendors.py → daily_maintenance` (called from the daily job) opens a work order when `next_due_on − lead_days ≤ today`, then advances `next_due_on` by `interval_months` until it's in the future — idempotent across reruns.
- **Assets / access items** (`assets`, `access_items`): property-scoped like units. Access codes are masked for accountants and changes are audited without the code value.

### Vacancy, applications & screening (Iteration 14)

- **Listings** (`listings`): unique `slug`; photos are listing documents. Public JSON at `/api/public/listings/<slug>` (published only) and photos at `/api/public/listings/<slug>/photos/<id>`. `/l/<slug>` is rewritten to the backend (`vercel.json`) and returns a tiny HTML page with Open Graph/Twitter tags and schema.org JSON-LD, then redirects to the SPA page — so link previews and crawlers see the title, price and photo.
- **Applications** (`applications`): created without an account (rate-limited, honeypot field). The applicant's private status link is a random token stored as a SHA-256 hash. No SSN or date of birth is collected.
- **Screening report**: `credit_score`, `credit_summary` (JSON), `criminal_records` / `eviction_records` (JSON lists), provider PDF. Entered from the consumer reporting agency's report today; a provider adapter can fill the same fields later. Access: `owner`/`manager` only (`require_roles`), property scope via the listing; application documents are hidden from other roles and from the general documents library; the audit log records *that* a report was saved, never its contents.
- **Adverse action**: `POST /applications/{id}/adverse-action` renders an FCRA notice PDF (reasons, agency contact, rights, optional credit score) with fpdf2, stores it on the application and emails it.
- **Application fee**: `stripe_gateway.checkout_application_fee` (destination charge to the owner's Connect account); `checkout.session.completed` with `metadata.purpose = application_fee` marks it paid. Rent handlers ignore it (`source` ≠ online/autopay).

### Translations (i18n)

All UI text lives in `frontend/src/locales/en.json`, grouped by area (`nav`, `leases`, `portal`, …); API enum values (statuses, categories, roles) are labelled in the `enums` section and rendered through `label()`. Use `t("section.key")` in components, i18next plural keys (`_one` / `_other`) for counts, and `<Trans>` for sentences with links or bold text. To add a language: copy `en.json` to `<code>.json`, translate the values, register it in `LANGUAGES` in `src/i18n.ts`. `src/locales/locales.test.ts` fails if code uses a missing key or a locale is missing keys. Server-generated text (API error details, emails, PDF receipts) is still English.

### Ledger model

Balance-forward: each lease has one running balance. Charges are positive, payments and credits negative. A late fee applies when the lease balance is still above zero after `due date + grace days`. Deleting an automatic charge creates a reversal entry instead, so the idempotency key stays and the cron never re-posts it. Voiding a payment removes its ledger entry and marks the payment voided.
