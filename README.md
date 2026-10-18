# Proppros

Proppros is an intuitive property management app for independent landlords and growing property businesses. It brings rent collection, leases, tenants, maintenance and finances into one place, and automates the routine work like rent reminders, late fees and lease renewals, so owners spend less time on admin and more time growing their portfolio.

## Documents

- [Feature requirements](docs/FEATURES.md): the full feature list with requirement IDs and phases (MVP / v2 / v3)
- [Technical architecture](docs/TECH_STACK.md): stack, Vercel hosting design, data model, cron jobs, environment variables, as-built notes
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): step-by-step iterations with checklists, status tracker and iteration log
- [Design guidelines — "Strata"](docs/DESIGN_GUIDELINES.md): colors, type, components and accessibility rules for the UI (tokens in `frontend/src/styles.css`)

## Stack

- **Frontend:** React 19 + Vite + TypeScript, React Router, TanStack Query, i18next, Lucide icons, Strata design system (`frontend/`)
- **Backend:** FastAPI + SQLModel (`backend/`, entry `app.main:app`)
- **Hosting:** one Vercel project using [Vercel Services](https://vercel.com/docs/services): `frontend` (Vite) at `/` and `backend` (FastAPI) at `/api/*`, configured in `vercel.json`
- **Data:** Neon Postgres + Alembic (SQLite for zero-setup local dev)
- **Services:** Vercel Blob, Vercel Cron, Resend, Upstash Redis, Sentry — all optional locally

Reference project: `C:\Projects\Pickzona`

## Run locally

Prerequisites: Python 3.12+ and Node 22+.

```bash
# 1. Backend (from the repo root)
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements-dev.txt     # macOS/Linux: .venv/bin/pip
cp .env.example backend/.env                                   # then set JWT_SECRET to a long random string
cd backend
../.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api to :8000)
```

- With no `DATABASE_URL`, the backend creates `backend/proppros.db` (SQLite) automatically.
- With no `RESEND_API_KEY`, emails are not sent; their links (invites, password resets) are printed in the backend log.
- API docs: http://localhost:8000/api/docs
- Run the daily automation on demand: Settings → Automation → "Run today's automation now".

### Tests

```bash
cd backend && ../.venv/Scripts/python -m pytest     # API, billing, portal, documents
cd frontend && npm test && npm run build              # unit tests + type check + production build
```

### Database migrations

```bash
cd backend
../.venv/Scripts/python -m alembic upgrade head                                  # apply
../.venv/Scripts/python -m alembic revision --autogenerate -m "describe change"  # after editing app/models.py
```

Alembic uses `DATABASE_URL_UNPOOLED` (Neon's direct URL) when it is set.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel. Vercel detects the two **services** from `vercel.json` (frontend + backend) and the daily cron. Keep the Root Directory at the repo root.
2. In Vercel → Storage, add **Neon Postgres** (sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`) and **Blob** (sets `BLOB_READ_WRITE_TOKEN`). Turn on Neon branching for preview deployments.
3. Set the environment variables: `ENVIRONMENT=production`, `JWT_SECRET`, `COOKIE_SECURE=true`, `FRONTEND_URL=https://<your domain>`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and optionally `UPSTASH_REDIS_REST_URL`/`_TOKEN` and `SENTRY_DSN`. See [.env.example](.env.example).
4. Run the migrations against Neon once: `DATABASE_URL_UNPOOLED=... alembic upgrade head`. After that, the `migrate` job in `.github/workflows/ci.yml` does it on every merge to `main` (add `DATABASE_URL_UNPOOLED` as a GitHub secret in a `production` environment).
5. Open `https://<deployment>/api/health`. It should return `{"status":"ok","db":"ok"}`.

### Optional: online rent payments (Stripe)

Online payments stay hidden until these are set.

1. Create a Stripe account (test mode needs no business verification) and enable **Connect** (Express accounts).
2. In Vercel, add `STRIPE_SECRET_KEY` (`sk_test_…` while testing).
3. In Stripe → Developers → Webhooks, add the endpoint `https://<your-domain>/api/stripe/webhook` with these events: `payment_intent.processing`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `checkout.session.completed`, `account.updated`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`, then redeploy.
4. In Proppros, go to **Settings → Payments → Connect with Stripe**, finish onboarding, and turn on **Accept online payments**. Test with card `4242 4242 4242 4242` or Stripe's test bank account.

### Tenant screening

Credit, criminal and eviction reports come from a consumer reporting agency such as TransUnion SmartMove (applicant-pay, no business API needed). Put your SmartMove (or other provider) link in each listing's **Screening provider link**; Proppros emails it to applicants and you record the report's results on the application. An automatic feed requires a partner agreement with the provider (e.g. TransUnion ShareAble API) — the data model is ready for it.

### Platform admin

Set `SUPERADMIN_EMAILS=you@example.com` (comma-separated) and redeploy. Those users see **Admin** in the sidebar: usage overview, organizations (change plan, comp), users (sign in as a user for support — 60 minutes, written to that organization's audit log) and in-app feedback. Set `FEEDBACK_NOTIFY_EMAIL` to get new feedback by email.

### Optional: Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
2. Authorized redirect URI: `https://<your-domain>/api/auth/google/callback` (and `http://localhost:5173/api/auth/google/callback` for local dev).
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel and redeploy. The "Continue with Google" button appears on sign-in and sign-up. A Google account is linked to an existing Proppros user only when the verified email matches.

### Optional: paid plans (Stripe Billing)

Plans: **Free** (3 units, 2 team members), **Pro** ($2/unit/month, 10 members), **Business** ($3/unit/month, unlimited). Limits apply only when billing is on.

1. In Stripe → Products, create *Proppros Pro* and *Proppros Business*, each with a **recurring monthly, per-unit** price. Put the price IDs in `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS`.
2. Add these events to the same webhook endpoint: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Turn on the customer portal (Stripe → Settings → Billing → Customer portal).
4. Set `BILLING_ENABLED=true` and redeploy. Owners upgrade from **Settings → Plan & billing**; the daily job keeps the subscription quantity equal to the number of units. Comp an organization from **Admin → Organizations**.
