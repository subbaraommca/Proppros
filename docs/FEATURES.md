# Proppros — Feature Requirements

> **Version:** 0.1 (draft) · **Date:** 2026-10-17
> **Product:** Property management SaaS for individual landlords and small-to-mid property businesses.
> **Origin:** Built first for the owner's own 3 rental properties, then opened to other landlords.

## Purpose

Proppros is an intuitive property management app for independent landlords and growing property businesses. It brings rent collection, leases, tenants, maintenance and finances into one place, and automates the routine work like rent reminders, late fees and lease renewals, so owners spend less time on admin and more time growing their portfolio.

## Phase legend

| Tag | Meaning |
|---|---|
| **[MVP]** | Required to run the owner's own 3 properties |
| **[v2]** | Required to onboard other landlords / grow |
| **[v3]** | Scale features for larger portfolios and businesses |

> **Assumption:** Payments, screening and tax features assume the United States (ACH, Schedule E, 1099). Revisit for other regions.

---

## 1. Accounts, Organizations & Roles

| ID | Phase | Requirement |
|---|---|---|
| ACC-01 | MVP | Email/password sign-up and login, password reset, email verification |
| ACC-02 | MVP | Multi-tenant organizations — one account can hold one or more portfolios (individual, LLC, property manager) |
| ACC-03 | MVP | Roles: Owner, Manager, Accountant (read-only finance), Maintenance staff, Tenant, Vendor |
| ACC-04 | v2 | Invite co-owners / team members with access scoped to specific properties |
| ACC-05 | v2 | 2FA (TOTP), Google sign-in, session and device management |
| ACC-06 | v3 | White-label for property management companies (logo, colors, custom domain) |

## 2. Properties & Units

| ID | Phase | Requirement |
|---|---|---|
| PRP-01 | MVP | Property records: address, type (single-family, multi-family, condo, commercial), purchase date/price, photos |
| PRP-02 | MVP | Units under each property: beds, baths, sq ft, market rent, amenities, status (occupied / vacant / under maintenance) |
| PRP-03 | MVP | Property documents: deed, insurance policy, HOA documents, inspection reports |
| PRP-04 | v2 | Asset/appliance tracking (make, model, install date, warranty expiry) with reminders |
| PRP-05 | v2 | Key, lock and access-code tracking per unit |
| PRP-06 | v3 | Property groups and tags (e.g. by region or LLC) |

## 3. Tenants & Leases

| ID | Phase | Requirement |
|---|---|---|
| LSE-01 | MVP | Tenant profiles: contacts, emergency contact, co-tenants, vehicles, pets |
| LSE-02 | MVP | Lease records: start/end dates, rent, due day, deposit, late-fee rules, recurring charges (parking, pets, utilities) |
| LSE-03 | MVP | Upload lease PDFs and attach them to the lease |
| LSE-04 | MVP | Lease expiry alerts at 90 / 60 / 30 days |
| LSE-05 | v2 | Lease templates with merge fields that generate the lease PDF |
| LSE-06 | v2 | E-signature (built in, or Dropbox Sign / DocuSign) |
| LSE-07 | v2 | Renewal workflow: offer renewal with rent increase → tenant accepts/declines → new lease created |
| LSE-08 | v2 | Move-in / move-out checklists with photos; security deposit disposition letter |
| LSE-09 | v3 | Jurisdiction compliance rules: notice periods, deposit limits, rent-control flags |

## 4. Rent Collection & Payments

| ID | Phase | Requirement |
|---|---|---|
| PAY-01 | MVP | Automatic monthly rent charges posted to each lease |
| PAY-02 | MVP | Record manual payments (cash, check, Zelle, Venmo) and issue receipts |
| PAY-03 | MVP | Automatic late fees (flat or percentage, with grace period) |
| PAY-04 | MVP | Per-tenant ledger: charges, payments, credits, running balance |
| PAY-05 | v2 | Online payments via ACH and card through Stripe Connect, paid directly to the owner's bank; option to pass fees to tenant |
| PAY-06 | v2 | Tenant autopay, partial-payment rules, "block payments after eviction notice" flag |
| PAY-07 | v2 | Rent reminders by email/SMS before due date, on due date, and when overdue |
| PAY-08 | v3 | Owner distributions and management-fee deductions (for managers handling other owners' money) |

## 5. Accounting & Finances

| ID | Phase | Requirement |
|---|---|---|
| FIN-01 | MVP | Expense tracking by category (repairs, utilities, insurance, taxes, mortgage interest, HOA) with receipt photos |
| FIN-02 | MVP | Income and expense reports per property, unit and month |
| FIN-03 | MVP | Dashboard: monthly cash flow, occupancy, rent collected vs. outstanding |
| FIN-04 | v2 | Bank feed sync via Plaid with auto-categorization rules |
| FIN-05 | v2 | Mortgage/loan tracking (principal vs. interest split, escrow) |
| FIN-06 | v2 | Tax reports: Schedule E line mapping, depreciation schedule, 1099-NEC for vendors |
| FIN-07 | v2 | Export to CSV / Excel / PDF; QuickBooks or Xero sync |
| FIN-08 | v3 | Full double-entry general ledger, trust accounting, bank reconciliation |
| FIN-09 | v3 | Investment metrics: cap rate, cash-on-cash return, NOI, ROI, equity growth |

## 6. Maintenance & Work Orders

| ID | Phase | Requirement |
|---|---|---|
| MNT-01 | MVP | Tenants submit requests with photos/video, category and priority |
| MNT-02 | MVP | Work order lifecycle: New → Assigned → Scheduled → In progress → Completed → Closed |
| MNT-03 | MVP | Comments and status updates visible to the tenant |
| MNT-04 | v2 | Vendor directory: trades, rates, insurance and W-9 on file, ratings |
| MNT-05 | v2 | Assign to vendors, collect and approve quotes; vendor invoice auto-becomes an expense |
| MNT-06 | v2 | Recurring preventive maintenance (HVAC filters, gutters, smoke detectors) |
| MNT-07 | v3 | Vendor portal / mobile app to accept jobs and upload photos and invoices |
| MNT-08 | v3 | After-hours emergency triage and routing to on-call staff |

## 7. Vacancy, Marketing & Screening

| ID | Phase | Requirement |
|---|---|---|
| VAC-01 | v2 | Listing builder (photos, description, amenities) with a public listing page per unit |
| VAC-02 | v2 | Online rental application with application fee |
| VAC-03 | v2 | Tenant screening — credit, criminal, eviction (TransUnion SmartMove or similar) |
| VAC-04 | v2 | Applicant tracking and comparison; approve → convert to tenant and lease |
| VAC-05 | v3 | Listing syndication to Zillow, Apartments.com, etc. |
| VAC-06 | v3 | Showing scheduler with self-booking |

## 8. Communication

| ID | Phase | Requirement |
|---|---|---|
| COM-01 | MVP | Email notifications: rent due, receipts, maintenance updates, lease expiry |
| COM-02 | v2 | In-app messaging between owner, tenant and vendor, threaded by property or work order |
| COM-03 | v2 | Announcements to all tenants of a property (e.g. water shutoff) |
| COM-04 | v2 | SMS via Twilio; push notifications on mobile |
| COM-05 | v2 | Notice templates: rent increase, entry notice, lease violation, pay-or-quit |

## 9. Tenant Portal

| ID | Phase | Requirement |
|---|---|---|
| TPT-01 | MVP | View lease, balance and payment history; download receipts |
| TPT-02 | MVP | Submit and track maintenance requests |
| TPT-03 | v2 | Pay rent online and set up autopay |
| TPT-04 | v2 | Upload renter's insurance proof, view documents, message the landlord |
| TPT-05 | v2 | Submit move-out notice |

## 10. Documents, Compliance & Insurance

| ID | Phase | Requirement |
|---|---|---|
| DOC-01 | MVP | Document vault per property / unit / tenant / vendor, with expiry dates |
| DOC-02 | v2 | Reminders for insurance renewals, property tax due dates, license/permit renewals |
| DOC-03 | v2 | Inspection scheduling and reports |
| DOC-04 | v3 | Eviction case tracking (notices served, court dates, outcomes) |

## 11. AI Features (optional, Claude API)

| ID | Phase | Requirement |
|---|---|---|
| AI-01 | v2 | Receipt and invoice extraction: vendor, amount, category auto-filled |
| AI-02 | v2 | Lease abstraction: upload PDF → key terms auto-filled into the lease record |
| AI-03 | v2 | Maintenance triage from description and photo: suggested category, urgency, likely fix |
| AI-04 | v3 | Natural-language portfolio questions ("What did I spend on repairs at Oak St last year?") |
| AI-05 | v3 | Rent pricing suggestions based on comparable listings |

## 12. Platform & SaaS

| ID | Phase | Requirement |
|---|---|---|
| PLT-01 | MVP | Audit log: who changed what and when |
| PLT-02 | MVP | Light/dark themes, responsive web app, i18n |
| PLT-03 | v2 | Subscription plans via Stripe Billing (e.g. Free up to 3 units, then Pro / Business priced per unit) |
| PLT-04 | v2 | Help center and feedback (reuse Pickzona's implementation) |
| PLT-05 | v2 | Super-admin console: organizations, plans, usage, impersonation |
| PLT-06 | v3 | Public API, API keys, webhooks |
| PLT-07 | v3 | Mobile apps (Expo) for owners, tenants and vendors |

---

## MVP scope summary

The MVP covers every **[MVP]** item in sections 1–6, 8, 9, 10 and 12. That is enough to run the owner's own 3 properties end to end:

1. Create the organization, properties and units
2. Add tenants and leases (with PDFs)
3. Rent posts automatically each month; payments recorded manually; late fees applied
4. Expenses tracked with receipts; per-property P&L and dashboard
5. Tenants log in to see their balance and submit maintenance requests
6. Email notifications for rent, receipts, maintenance and lease expiry

After the MVP is stable, onboard a few other landlords before starting v2.
