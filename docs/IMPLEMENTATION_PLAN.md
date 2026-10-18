# Proppros — Implementation Plan

> **Version:** 0.1 · **Date:** 2026-10-17
> **Companion docs:** [FEATURES.md](FEATURES.md) (what to build) · [TECH_STACK.md](TECH_STACK.md) (how to build it) · [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) (how it should look — "Strata")

This is the step-by-step execution plan. Work is split into **iterations**. Each one is small enough to finish, test and deploy on its own.

---

## How to use this file

1. **Work top to bottom.** Iterations are ordered by dependency, so don't start one until the one before it is ✅.
2. **One iteration at a time.** Each has a goal, tasks, requirement IDs (from FEATURES.md) and a **Done when** checklist.
3. **Tick boxes as you go** (`- [ ]` → `- [x]`), and update the status table below when an iteration finishes.
4. **Deploy at the end of every iteration.** `main` should always be deployable to Vercel.
5. **Starting an AI session:** say *"Continue Proppros: read docs/IMPLEMENTATION_PLAN.md, work on the first unchecked task in the current iteration."*
6. **At the end of each iteration:** add notes to the [Iteration log](#iteration-log) (what changed, decisions, deferred items).
7. **Scope changes:** add or edit requirements in FEATURES.md first, then add tasks here.
8. **UI work:** follow [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md). New colors, fonts or components go into the guideline and `styles.css` tokens first, then into pages.

### Status

| # | Iteration | Phase | Status |
|---|---|---|---|
| 0 | Project setup & infrastructure | MVP | 🟨 Live at proppros.vercel.app — Resend, Sentry, Upstash, preview DB branches still open |
| 1 | Auth, organizations & roles | MVP | ✅ |
| 2 | Properties & units | MVP | 🟦 Code done — enter your properties |
| 3 | Tenants & leases | MVP | 🟦 Code done — enter your leases |
| 4 | Rent ledger & payments | MVP | 🟦 Code done — run a real rent cycle |
| 5 | Expenses, reports & dashboard | MVP | 🟦 Code done — enter this year's expenses |
| 6 | Maintenance & work orders | MVP | ✅ |
| 7 | Tenant portal | MVP | 🟦 Code done — invite a real tenant |
| 8 | Notifications, documents & audit | MVP | 🟦 Code done — real email needs a verified sending domain |
| 9 | Hardening & go-live with own 3 properties | MVP | 🟨 Code hardening done — custom domain, backups check, 1-month trial left |
| 10 | Online payments (Stripe Connect) | v2 | 🟦 Code done (hidden until Stripe keys are set) — create a Stripe account to test |
| 11 | SaaS: subscriptions, onboarding, admin | v2 | 🟦 Code done — billing & Google sign-in dormant until configured |
| 12 | Leasing workflows (templates, e-sign, renewals) | v2 | 🟦 Code done — try it on one of your leases |
| 13 | Vendors & preventive maintenance | v2 | 🟦 Code done — add your vendors, appliances and recurring tasks |
| 14 | Vacancy, listings & screening | v2 | 🟦 Code done — screening reports entered from your provider; automatic feed needs a provider partnership |
| 15 | Communication (messaging, SMS, notices) | v2 | 🟦 Code done — SMS logged until Twilio is configured |
| 16 | Advanced finance (Plaid, tax, exports) | v2 | ⏸ Paused (owner's decision, 2026-10-18) — back after 18 |
| 17 | AI features | v2 | ⏸ Paused (owner's decision, 2026-10-18) — back after 18 |
| 18 | Mobile app (Expo) | v3 | 🟦 App built (`mobile/`) — EAS builds and store submission are your part |
| 19 | Scale features | v3 | ⬜ |

Legend: ⬜ Not started · 🟨 In progress · 🟦 Code complete, waiting on a go-live step only you can do · ✅ Done

---

## Definition of Done (applies to every task)

- [ ] Backend endpoint(s) have Pytest tests (happy path + permission/tenant-isolation check)
- [ ] Frontend screen works at phone width and desktop, in Basalt (dark) and Limestone (light) themes
- [ ] UI follows [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md): only `--pp-*` tokens (no hard-coded colors), status badges use the mineral mapping, text contrast ≥ 4.5:1, any new chart colors run through the palette validator
- [ ] All queries filter by `organization_id`
- [ ] Alembic migration created for any schema change, and applied to the Neon dev branch
- [ ] No secrets in code; new env vars added to TECH_STACK.md §7 and to Vercel
- [ ] Deployed to a Vercel preview, smoke-tested, then merged to `main`

---

# Phase 1 — MVP (run your own 3 properties)

## Iteration 0 — Project setup & infrastructure

**Goal:** an empty app that deploys to Vercel, has a working database connection, and passes CI.

**Accounts / services**
- [x] Create a GitHub repo `proppros`, then `git init` locally and push
- [x] Create a Vercel project linked to the repo
- [x] Add Neon Postgres from the Vercel Marketplace (creates `DATABASE_URL` + unpooled URL)
- [x] Create a Vercel Blob store
- [ ] Create a Resend account and verify the sending domain
- [ ] Create a Sentry project (backend + frontend)
- [ ] Create an Upstash Redis database

**Backend**
- [x] Scaffold `backend/app` (`main.py`, `core/config.py` with pydantic-settings, `core/db.py`)
- [x] Configure the SQLAlchemy engine for serverless (`NullPool`, pooled URL)
- [x] Set up Alembic using `DATABASE_URL_UNPOOLED`, plus an initial empty migration
- [x] Expose the FastAPI app to Vercel — *now a Vercel Service (`backend/`, entrypoint `app.main:app`); `api/index.py` removed*
- [x] Add a `GET /api/health` endpoint that checks the DB connection
- [x] Add Sentry init and structured logging

**Frontend**
- [x] Scaffold Vite + React + TS + React Router + TanStack Query + i18next + Lucide
- [x] Set up design tokens in `styles.css` (`--pp-*`), with light/dark theme toggle — *replaced by the Strata system (dark-first; see DESIGN_GUIDELINES.md)*
- [x] Add an API client (`src/services/api.ts`, same pattern as Pickzona)
- [x] Build a placeholder landing page that calls `/api/health`

**DevOps**
- [x] Add `vercel.json`: Vercel Services (frontend at `/`, backend at `/api/*`) plus the daily cron
- [x] Add a GitHub Actions workflow: lint → pytest → vitest → `alembic upgrade head` on merge to main
- [ ] Add a Neon branch per preview deployment (Vercel–Neon integration)
- [x] Document local dev in README (`vercel dev` or uvicorn + vite)

**Done when:**
- [x] The production URL shows the landing page, and `/api/health` returns `{"db": "ok"}`
- [ ] A PR creates a preview deployment with its own DB branch
- [x] CI is green

---

## Iteration 1 — Auth, organizations & roles

**Requirements:** ACC-01, ACC-02, ACC-03

- [x] Models: `users`, `organizations`, `memberships` (role enum: owner, manager, accountant, maintenance, tenant, vendor)
- [x] `POST /auth/register` creates the user and their first organization (as owner)
- [x] `POST /auth/login` / `logout`, JWT in an httpOnly secure cookie
- [x] `GET /auth/me` returns the user, memberships and current org
- [x] Email verification and password reset via Resend (token tables + expiry)
- [x] `get_current_user` + `require_role(...)` + `get_current_org` dependencies
- [x] Rate limiting on auth endpoints (Upstash)
- [x] Frontend: login, register, forgot/reset password, verify email pages
- [x] Frontend: app shell (sidebar + topbar + outlet), org switcher, logout

**Done when:**
- [x] You can register, verify your email, log in, and see an empty dashboard
- [x] Tests prove a user cannot read another organization's data

---

## Iteration 2 — Properties & units

**Requirements:** PRP-01, PRP-02, PRP-03 (document upload is covered fully in Iteration 8; basic photo upload here)

- [x] Models: `properties`, `units`
- [x] CRUD endpoints for properties and for units nested under a property
- [x] ~~Vercel Blob client-upload token endpoint~~ → uploads go through the API (multipart, 4 MB cap) so every file is authorized and recorded; switch to client uploads if larger files are needed
- [x] Frontend: properties list (cards with photo, address, unit count, occupancy)
- [x] Frontend: property detail page with a units tab, and add/edit unit forms
- [x] Unit status (occupied / vacant / maintenance), derived later from leases

**Done when:**
- [ ] All 3 of your real properties and their units are entered in production

---

## Iteration 3 — Tenants & leases

**Requirements:** LSE-01, LSE-02, LSE-03, LSE-04 (alerts wired in Iteration 8)

- [x] Models: `tenants`, `leases`, `lease_tenants`, `recurring_charges`
- [x] Tenant CRUD (contacts, emergency contact, vehicles, pets as JSON)
- [x] Lease CRUD: unit, tenants, dates, rent, due day, deposit, late-fee rule, recurring charges
- [x] Validation: no overlapping active leases on one unit
- [x] Upload a lease PDF to Blob and attach it to the lease
- [x] Unit status auto-updates from the active lease
- [x] Frontend: tenants list and detail; lease create wizard; lease detail page

**Done when:**
- [ ] Your current tenants and leases (with PDFs) are entered in production

---

## Iteration 4 — Rent ledger & payments

**Requirements:** PAY-01, PAY-02, PAY-03, PAY-04

- [x] Models: `ledger_entries`, `payments` (unique constraint on lease + charge type + period)
- [x] Service: `post_rent_charges(date)`, idempotent, creates rent + recurring charges for leases due today
- [x] Service: `apply_late_fees(date)` after the grace period (flat or %)
- [x] One cron endpoint `/api/cron/daily` (runs every step per org in its time zone), protected by `CRON_SECRET`, in `vercel.json` — a single daily cron fits the Vercel Hobby plan
- [x] Record manual payment (cash, check, Zelle, Venmo) and apply it to the oldest open charges
- [x] Payment receipt PDF + email to the tenant
- [x] Ledger view with running balance, plus manual credit/adjustment entries
- [x] Backfill: a one-time "opening balance" entry per lease
- [x] Tests: running cron twice never duplicates charges; late fee is applied only after the grace period

**Done when:**
- [ ] Rent posts automatically on the 1st (or due day), and you record this month's real payments

---

## Iteration 5 — Expenses, reports & dashboard

**Requirements:** FIN-01, FIN-02, FIN-03

- [x] Model: `expenses` (categories seeded to match Schedule E lines for later)
- [x] Expense CRUD with receipt photo upload
- [x] Report endpoints: P&L by property / unit / month, rent roll, outstanding balances
- [x] Dashboard: cash flow chart (12 months), occupancy %, collected vs. outstanding, upcoming lease expiries
- [x] CSV export for each report

**Done when:**
- [ ] This year's expenses are entered, and the dashboard matches your own records

---

## Iteration 6 — Maintenance & work orders

**Requirements:** MNT-01, MNT-02, MNT-03

- [x] Models: `work_orders`, `work_order_comments`
- [x] Status state machine: New → Assigned → Scheduled → In progress → Completed → Closed
- [x] Photo/video attachments via Blob
- [x] Assign to a user with the maintenance role (vendors come in Iteration 13)
- [x] Optional link to an expense when the work is completed
- [x] Frontend: work order board (by status) + detail page with comments timeline

**Done when:**
- [x] A work order goes through its full lifecycle, with photos and comments

---

## Iteration 7 — Tenant portal

**Requirements:** TPT-01, TPT-02

- [x] Invite a tenant to the portal (creates a user + tenant membership, linked to the tenant record)
- [x] Separate tenant layout and routes (`/portal/*`)
- [x] Portal pages: home (balance + next due), lease and documents, payment history + receipts
- [x] Portal maintenance: submit a request with photos, track status, add comments
- [x] Permission tests: a tenant sees only their own lease, ledger and work orders

**Done when:**
- [ ] One of your real tenants logs in, sees the correct balance, and submits a request

---

## Iteration 8 — Notifications, documents & audit

**Requirements:** COM-01, LSE-04, DOC-01, PLT-01, PLT-02

- [x] Model: `notifications` + email templates (rent due, receipt, maintenance update, lease expiry)
- [x] Cron: rent reminders (before due / due / overdue), lease expiry (90/60/30)
- [x] Model: `documents` (polymorphic owner, kind, expires_at) + document vault UI
- [x] Cron: document-expiry alerts (run daily, deduplicated — one email per document per expiry date)
- [x] Audit log service called from every create/update/delete + audit viewer (Settings → Audit log)
- [x] i18n pass: extract all UI strings to `locales/` — *done: ~665 keys in `frontend/src/locales/en.json` (plurals, enum labels, locale-aware money/dates); a test fails if code uses a missing key. Still English: server-generated messages (API errors, emails, PDF receipts, work-order system notes) and the legal pages*
- [x] Notification preferences per user

**Done when:**
- [ ] Reminders and alerts arrive by email on schedule, and every change appears in the audit log

---

## Iteration 9 — Hardening & go-live

- [x] Security review: auth flows, org isolation, upload access, rate limits — *fixed CSV formula injection, non-ASCII download names; added CSP/X-Frame-Options/Permissions-Policy; uploads are private Blob streamed after permission checks. Open: rate limits are per-instance until Upstash is configured*
- [ ] Backups: confirm Neon point-in-time restore; test a restore to a branch
- [x] Error handling and empty/loading states on every screen — *ErrorBoundary recovery screen, offline message, network retries*
- [x] Performance: DB indexes on `organization_id` + foreign keys; check cold start time — *route code-splitting cut initial JS 498 → 259 kB; live `/api/health` ≈ 0.6–0.9 s*
- [ ] Accessibility pass (keyboard, contrast, labels) *(done: contrast ≥ 4.5:1, CVD-safe chart, modal focus trap/restore, skip link, labelled icon buttons. Open: a screen-reader walkthrough)*
- [ ] Custom domain on Vercel + SSL
- [x] Privacy policy and terms pages — *drafts at /privacy and /terms; set `CONTACT_EMAIL` in `frontend/src/pages/LegalPages.tsx` and have them reviewed before onboarding other landlords*
- [ ] Use it for one full month for all 3 properties, and log issues found

**Done when:**
- [ ] One full rent cycle is run entirely in Proppros, with no spreadsheet backup needed

---

# Phase 2 — v2 (open to other landlords)

## Iteration 10 — Online payments (Stripe Connect)

**Requirements:** PAY-05, PAY-06, PAY-07, TPT-03

- [x] Stripe Connect onboarding for owners (Express accounts) — *Settings → Payments; status synced via `account.updated`*
- [x] Tenant pays via ACH / card (Stripe Checkout); fee pass-through option — *destination charges to the owner's account; optional 2.9% + 30¢ card fee*
- [x] Stripe webhooks → ledger payment entries (idempotent on event ID) — *`stripe_events` table + ledger `source_key`; ACH shows "processing" until it clears*
- [x] Autopay (saved payment method + cron charge on the due date) — *Stripe idempotency key per lease+period*
- [x] Partial-payment rules and the block-payments flag
- [x] Handle failed/returned ACH (reverse the entry + fee + notify)
- [ ] **Your part:** create a Stripe account, add `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, register the webhook (README → "Optional: online rent payments"), and run one test payment

## Iteration 11 — SaaS: subscriptions, onboarding & admin

**Requirements:** PLT-03, PLT-04, PLT-05, ACC-04, ACC-05

- [x] Plans + Stripe Billing (per-unit pricing), with limits enforced by plan — *Free 3 units / Pro $2 / Business $3 per unit; limits only when `BILLING_ENABLED`*
- [x] Onboarding wizard for new landlords (org → first property → first lease) — *`/welcome`, shown after sign-up*
- [x] Team invites with property-scoped access — *per-member property list; scoped members see only those properties*
- [x] 2FA (TOTP) + Google sign-in — *recovery codes; Google hidden until `GOOGLE_CLIENT_ID` is set*
- [x] Super-admin console (orgs, plans, usage, impersonation with audit) — *`/admin` for `SUPERADMIN_EMAILS`*
- [x] Port Pickzona's help center and feedback features — *7 Markdown articles, search, feedback inbox in Admin*
- [x] Marketing landing page + pricing page — *`/` and `/pricing` when signed out*
- [ ] **Your part:** set `SUPERADMIN_EMAILS`; optionally Google OAuth credentials and Stripe Billing prices (README)

## Iteration 12 — Leasing workflows

**Requirements:** LSE-05, LSE-06, LSE-07, LSE-08

- [x] Lease templates with merge fields → PDF generation — *Settings → Lease templates; 16 merge fields; starter template. PDFs are generated in the request (a few pages, well inside the function limit), so no queue was needed*
- [x] E-signature integration — *built in, no third-party account: personal single-use links (30 days), typed + drawn signature, consent, IP/device/time per signer, SHA-256 of the text, signing certificate page; signed PDF saved to the lease and emailed*
- [x] Renewal workflow (offer → accept/decline → new lease) — *tenant answers in the portal or staff records it; acceptance creates the new lease (tenants, charges, rules copied) and the old one hands over billing on its end date; offers expire after their deadline*
- [x] Move-in/move-out inspections with photos + deposit disposition letter — *room-by-room checklist from the unit's beds/baths, photos per item, move-out compares to move-in; PDF report; itemized deposit statement with suggested deductions and a ledger credit for unpaid rent*
- [ ] **Your part:** create a lease template and send one real lease for signature

## Iteration 13 — Vendors & preventive maintenance

**Requirements:** MNT-04, MNT-05, MNT-06, PRP-04, PRP-05

- [x] Vendor directory (trades, rates, W-9, insurance expiry, ratings) — *Vendors page; W-9/insurance files as vendor documents (full-access members only); 30-day insurance reminder; per-job 1–5 rating*
- [x] Quotes → approval → invoice → automatic expense — *approving one quote declines the rest and assigns the vendor; recording an invoice creates the expense (deleting it removes both); optional "email job details to vendor"*
- [x] Recurring maintenance schedules (cron creates work orders) — *daily job opens the work order `lead_days` before each due date and advances the schedule; overdue schedules create one work order, not a backlog; "Create now", pause*
- [x] Appliance/asset tracking with warranty reminders; key and access-code tracking — *property tabs "Appliances & systems" (warranty reminder 30 days before, manuals as asset documents) and "Keys & codes" (codes hidden from accountants and never written to the audit log)*
- [ ] **Your part:** add your vendors, the main appliances/systems per property, and recurring tasks (HVAC filters, smoke detectors)

## Iteration 14 — Vacancy, listings & screening

**Requirements:** VAC-01 – VAC-04

- [x] Listing builder + public listing page (SEO-friendly) — *Vacancies; photos, criteria, fair-housing notice; `/listings/<slug>` page plus `/l/<slug>` server-rendered share page with Open Graph tags and JSON-LD*
- [x] Online application form + application fee (Stripe) — *no account needed, no SSN collected, honeypot + rate limits, applicant status page with document upload; fee via Stripe Checkout to the owner's connected account when online payments are on, otherwise mark paid/waived*
- [~] Screening integration — *structured screening report per applicant: credit (score, debt, collections, bankruptcies), criminal records, eviction records, provider PDF; owners/managers only; "Request screening" emails the provider link; FCRA adverse action notice letter. **Not yet:** an automatic feed from a screening provider (TransUnion ShareAble/SmartMove API needs a partner agreement)*
- [x] Applicant pipeline → convert to tenant + lease — *side-by-side comparison (income ÷ rent, credit, records, rating), approve/decline emails, convert creates tenants + lease, closes the listing, invites to the portal*
- [ ] **Your part:** open a screening account (e.g. TransUnion SmartMove) and put its link on your listing

## Iteration 15 — Communication

**Requirements:** COM-02 – COM-05, TPT-04, TPT-05

- [x] In-app message threads (by property / work order) — *staff ↔ tenant conversations tagged with the tenant's property; unread counts; email + SMS notifications; work orders keep their own comment thread*
- [x] Property-wide announcements — *one property or all; email and/or SMS; shown on the portal home for 90 days*
- [x] Twilio SMS channel — *REST API without SDK; tenant opt-in with consent text; STOP/START handled; inbound texts become messages (signature-verified webhook); logged until configured*
- [x] Notice templates (rent increase, entry, violation, pay-or-quit) — *plus a general notice; fill fields → preview → PDF saved to the lease, emailed with attachment, optional text; portal "opened" tracking*
- [x] Tenant: upload renter's insurance, give move-out notice — *insurance with expiry (status on the lease page, tenant reminder 14 days before); move-out notice with forwarding address → landlord acknowledges and can set the lease end date*
- [ ] **Your part (optional):** Twilio account + number for real texts (README → "Optional: text messages")

## Iteration 16 — Advanced finance

**Requirements:** FIN-04 – FIN-07, DOC-02, DOC-03

- [ ] Plaid bank feeds + categorization rules + match transactions to ledger entries
- [ ] Mortgage/loan tracking
- [ ] Schedule E report, depreciation schedule, 1099-NEC export
- [ ] Excel/PDF exports; QuickBooks/Xero sync
- [ ] Insurance/tax/license reminders; inspection scheduling

## Iteration 17 — AI features

**Requirements:** AI-01 – AI-03

- [ ] Receipt/invoice extraction → prefilled expense (Claude API, with user confirmation)
- [ ] Lease PDF abstraction → prefilled lease form
- [ ] Maintenance triage suggestions
- [ ] Cost controls: per-org usage limits, logging

---

# Phase 3 — v3 (scale)

## Iteration 18 — Mobile app (Expo)

**Requirements:** PLT-07, COM-04 (push)

- [x] Expo app reusing Pickzona's mobile patterns (Expo Router, secure-store JWT), with a `tokens.ts` mirroring the Strata tokens — *Expo SDK 57; `POST /auth/token` (+ `/auth/token/mfa`) issues bearer tokens; design rules in DESIGN_GUIDELINES §10*
- [x] Owner: dashboard, work orders, record payment, receipt capture — *Home, Repairs (status, notes, photos), Messages, Money (record payment, expense with receipt photo), More*
- [x] Tenant: pay rent, submit maintenance with camera — *Stripe Checkout in the in-app browser; camera/library photos downscaled to 1600px*
- [x] Push notifications — *`push_devices` + Expo push service: new requests, status changes, messages, announcements, notices; deep links on tap*
- [ ] **Your part:** Expo account + `eas init`, EAS builds, Apple Developer ($99/yr) and Google Play ($25) accounts, store listings and submission (`mobile/README.md`)

## Iteration 19 — Scale features

**Requirements:** ACC-06, PRP-06, PAY-08, FIN-08, FIN-09, MNT-07, MNT-08, VAC-05, VAC-06, LSE-09, DOC-04, AI-04, AI-05, PLT-06

Break into separate iterations when this phase begins, prioritized by customer demand.

---

## Iteration log

Record notes when each iteration closes.

| Date | Iteration | Notes / decisions / deferred items |
|---|---|---|
| 2026-10-17 | — | Requirements, tech stack and plan drafted |
| 2026-10-17 | 0–8 | MVP code built: FastAPI backend (44 Pytest tests), React frontend (Vitest + build), Alembic `0001`, Vercel config, CI. Smoke-tested end to end locally (owner → lease → rent/late fee → payment/receipt → tenant portal → work order). Decisions: money in integer cents; balance-forward ledger with idempotent `source_key`; one daily cron; uploads through the API; `api/index.py` restores the original path because `@vercel/python` ≥ 6.52 passes the rewrite destination. Deferred: full i18n extraction, prorated first-month rent (add as a manual charge), ~~private Blob storage~~ (done 2026-10-17). Not yet verified on a real Vercel/Neon deployment. |
| 2026-10-17 | UI | Adopted the "Strata" design system ([DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md)), adapted from the principles in HEX_DESIGN_SYSTEM.md: dark-first Basalt + Limestone themes, mineral accents with one job each, Archivo/DM Sans/JetBrains Mono, sharp radii, borders over shadows, noise texture. All text pairs ≥ 4.5:1; chart pair validated for colorblind safety. Checked by screenshots at 1440px and 390px in both themes. |
| 2026-10-17 | 0 | Switched hosting config to **Vercel Services** after the first import built only the frontend (Root Directory was `frontend`). `vercel.json` now defines `frontend` (Vite) and `backend` (FastAPI) services; runtime deps moved to `backend/requirements.txt`; `api/index.py` removed (services pass the original path). Cron with services to be confirmed after the first deploy. |
| 2026-10-17 | 0 | **Deployed** to https://proppros.vercel.app (Vercel Services: Vite frontend + FastAPI backend), Neon Postgres (migration 0001 applied, `alembic check` clean on Postgres), private Vercel Blob. Fixes made during setup: no crash on startup without a DB, private-Blob support, `POSTGRES_URL` fallback, setup diagnostics in `/api/health`. Neon password rotated after it was shared in chat. |
| 2026-10-17 | 7, 9 | Shareable invite links (copy button) so tenants/team can join without email. Iteration 9 hardening: CSV formula-injection fix, RFC 6266 filenames, CSP + security headers, ErrorBoundary/offline handling, route code-splitting, modal focus management + skip link, draft Privacy/Terms. Verified on production: headers present, no CSP violations on public pages. |
| 2026-10-17 | 8 | Full UI string extraction to `en.json` (~665 keys across 23 sections), i18next plurals (fixes “1 properties”-style grammar), language-aware ordinals/money/dates, central enum labels, language picker (shown once a 2nd locale exists), and a Vitest guard for missing keys. Checked 23 screens + modals in a browser for raw keys. |
| 2026-10-17 | 10 | Online payments via Stripe Connect Express (destination charges): owner onboarding, Checkout (ACH/card, optional card-fee pass-through), webhook-driven ledger with processing/succeeded/failed/reversed states, returned-payment fee, autopay with idempotent off-session charges, partial-payment and per-lease block rules. Migration `0002` (server defaults so existing rows migrate). 15 new tests with a faked Stripe gateway; feature hidden until `STRIPE_SECRET_KEY` is set. Not yet tested against real Stripe. |
| 2026-10-17 | 11 | SaaS layer: plans + Stripe Billing (per-unit, quantity synced daily, limits only when billing is on), property-scoped memberships enforced in every list/detail route, TOTP 2FA with hashed recovery codes and a short-lived `mfa` token, Google OIDC sign-in, super-admin console with audited impersonation, help center (Markdown) + feedback, onboarding wizard, landing and pricing pages. Migration `0003` (server defaults). 13 new tests (83 total). Checked in a browser: landing/pricing/help signed out, onboarding, admin, team access, 2FA setup and the 2FA sign-in step. |
| 2026-10-18 | 12 | Leasing workflows: lease templates with merge fields, built-in e-signature (signing links work without an account; portal signing for tenants with accounts; landlord signs in-app), renewal offers with portal accept/decline and automatic successor lease, move-in/move-out inspections with photos and PDF reports, itemized security-deposit statements. Decision: built-in e-signature instead of Dropbox Sign/DocuSign (no cost or account; records consent, IP, device, time and a SHA-256 fingerprint of the text). Migration `0004` (new tables + one nullable column). 10 new tests (93 total). Checked in a browser: template editor, send → public link signing → landlord signing → signed PDF, renewal offer → tenant portal card, inspection checklist (desktop + phone). |
| 2026-10-18 | 13 | Vendors & preventive maintenance: vendor directory with insurance/W-9 tracking and ratings, vendor assignment with job-details email, quotes with approve/decline, vendor invoices that create expenses automatically, preventive schedules run by the daily job, appliance/system register with warranty reminders, keys & access codes per property/unit. Migration `0005` (new tables + nullable work-order columns). 7 new tests (100 total). Checked in a browser: add vendor, quotes → approve → invoice → expense, schedule from a preset, assets and keys tabs, phone width. |
| 2026-10-18 | 14 | Vacancy & screening: listings with public page + share page (OG/JSON-LD), public application form with status page and uploads, application fee via Stripe (reusing Connect), screening reports with credit/criminal/eviction sections (user request: landlords must see these histories), FCRA adverse action notice PDF, applicant comparison, approve/decline, convert to tenants + lease. Decisions: no SSNs or report pulls inside Proppros — reports come from a consumer reporting agency and are entered (or later fed) into a structured report; applicant files and reports are owners/managers only and excluded from the documents library; HUD criminal-history guidance shown next to reports. Also fixed: `/properties` list now includes units (schedule/listing unit pickers were empty). Migration `0006`. 6 new tests (106 total). |
| 2026-10-18 | 15 | Communication: message threads (staff ↔ tenant, portal and email/SMS notifications, unread badge), announcements, notice templates with PDF + email + portal, Twilio SMS (opt-in, STOP/START, inbound webhook with signature check), renter's insurance uploads with reminders, tenant move-out notices with acknowledge. Found and fixed: an effect that returned `scrollIntoView()`'s result crashed the chat in current Chrome (it now returns a Promise). Migration `0007` (server default for `tenants.sms_opt_in`). 7 new tests (113 total). |
| 2026-10-18 | 16–17 | Paused at the owner's request; Iteration 18 done first. |
| 2026-10-18 | 18 | Mobile app (`mobile/`, Expo SDK 57 + Expo Router): owner/manager/maintenance tabs (Home, Repairs, Messages, Money, More) and tenant tabs (Home + pay rent, Repairs with camera, Messages, More). Backend: bearer-token sign-in (`/auth/token`, `/auth/token/mfa`), push device registration and Expo push hooks, opt-in `CORS_ORIGINS` for the web preview. DESIGN_GUIDELINES gained §10 (mobile): 44pt targets, 16pt body, bottom tabs with labels, safe areas, permissions in context, push copy rules, offline banner, Dynamic Type up to 1.3×. Generated icon/splash. Verified: `tsc`, `expo install --check`, Android bundle export, and the web preview in a browser (dark and light) with real submissions — tenant request → owner Repairs, owner records a payment. Migration `0008`. 3 new tests (116 total). |
| 2026-10-18 | 18 | Upgraded the app from Expo SDK 54 to **SDK 57** (React Native 0.86, React 19.2, Expo Router 57, TypeScript 6): the store version of Expo Go only opens projects on the current SDK. Removed the obsolete `newArchEnabled` flag (the new architecture is always on). Re-verified: `tsc`, `expo-doctor` 21/21, Android bundle export, and both browser walkthroughs. |
| 2026-10-18 | 18 | Styling review after the owner saw the app on an iPhone: it looked unlike the web because it followed the phone's light mode, used normal-width Archivo and had no brand bar. Now dark-first like the web (Appearance: Dark/Light/Match phone under More), dark brand bar + tab bar in both themes, Archivo bundled at the web's 112% width (generated from the web's variable font), web-style page titles and wording, dashboard stat cards with icons, stronger input edges, soft glow on the balance card, web sign-in copy. DESIGN_GUIDELINES §10 → v1.2 with a 'compare to the web at 390px' rule. |
