# Proppros

Proppros is an intuitive property management app for independent landlords and growing property businesses. It brings rent collection, leases, tenants, maintenance and finances into one place, and automates the routine work like rent reminders, late fees and lease renewals, so owners spend less time on admin and more time growing their portfolio.

## Documents

- [Feature requirements](docs/FEATURES.md): the full feature list with requirement IDs and phases (MVP / v2 / v3)
- [Technical architecture](docs/TECH_STACK.md): stack, Vercel hosting design, data model, cron jobs, environment variables, as-built notes
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): step-by-step iterations with checklists, status tracker and iteration log
- [Design guidelines — "Strata"](docs/DESIGN_GUIDELINES.md): colors, type, components and accessibility rules for the UI (tokens in `frontend/src/styles.css`)

## Stack

- **Frontend:** React 19 + Vite + TypeScript, React Router, TanStack Query, i18next, Lucide icons, Strata design system (`frontend/`)
- **Backend:** FastAPI + SQLModel, served as a Vercel Python Function (`backend/`, entry `api/index.py`)
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

1. Push this repo to GitHub and import it in Vercel. `vercel.json` already sets the build, `/api/*` routing and the daily cron.
2. In Vercel → Storage, add **Neon Postgres** (sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`) and **Blob** (sets `BLOB_READ_WRITE_TOKEN`). Turn on Neon branching for preview deployments.
3. Set the environment variables: `ENVIRONMENT=production`, `JWT_SECRET`, `COOKIE_SECURE=true`, `FRONTEND_URL=https://<your domain>`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and optionally `UPSTASH_REDIS_REST_URL`/`_TOKEN` and `SENTRY_DSN`. See [.env.example](.env.example).
4. Run the migrations against Neon once: `DATABASE_URL_UNPOOLED=... alembic upgrade head`. After that, the `migrate` job in `.github/workflows/ci.yml` does it on every merge to `main` (add `DATABASE_URL_UNPOOLED` as a GitHub secret in a `production` environment).
5. Open `https://<deployment>/api/health`. It should return `{"status":"ok","db":"ok"}`.
