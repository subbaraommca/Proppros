/**
 * Copy for the public marketing site (English only). Every claim here must be live in the product
 * (docs/growth/PROJECT-BRIEF.md §3). Do not add online rent payment, SMS, store apps or AI claims.
 * Audience wording never states a unit count (owner decision 7, docs/growth/DECISIONS.md).
 */

export const HERO = {
  eyebrow: "Property management for independent landlords",
  title: "Leases, rent and repairs in one place.",
  lead: "Proppros helps you run every rental and fill every vacancy. Track rent, sign leases online, handle repairs and share listings. Your tenants get their own portal.",
  note: "Start free. No card needed.",
  founder: "Built by a landlord.",
  founderNote: "The founder runs three rental homes with Proppros.",
};

export const MONTH = {
  eyebrow: "How it works",
  title: "One calm month with Proppros.",
  lead: "This is a normal month for a small landlord. Proppros keeps each step in one place.",
  steps: [
    { day: "1st", title: "Rent charges post", body: "Monthly rent posts to each lease on its own.", tag: "Automatic", tone: "jade" },
    { day: "3rd", title: "A new lease is signed", body: "Your tenant signs online. The signed copy is saved to the lease.", tag: "E-signature", tone: "jade" },
    { day: "6th", title: "You see who is behind", body: "The dashboard shows each balance due, so you can follow up.", tag: "Balance due", tone: "garnet" },
    { day: "12th", title: "A tenant reports a leak", body: "The request arrives with photos. You assign a vendor and track the cost.", tag: "Work order", tone: "citrine" },
    { day: "20th", title: "A vacancy is shared", body: "Post the ready-made ad, print the flyer and take applications online.", tag: "Vacancy", tone: "lapis" },
    { day: "31st", title: "Your books are ready", body: "Profit and loss and the rent roll are ready to export for your accountant.", tag: "Reports", tone: "jade" },
  ],
} as const;

export interface Feature {
  slug: string;
  icon: "lease" | "rent" | "repair" | "vacancy" | "portal" | "report";
  name: string;
  summary: string;
  title: string;
  lead: string;
  points: { title: string; body: string }[];
  screen: string;
  screenAlt: string;
  help: string;
  description: string;
  /** Extra real outputs shown under the main screen (files in public/screens). */
  gallery?: { src: string; alt: string; width: number; height: number; caption: string }[];
}

export const FEATURES: Feature[] = [
  {
    slug: "leases-and-e-signature",
    icon: "lease",
    name: "Leases with e-signature",
    summary: "Lease templates, online signing, renewals and move-in inspections. Every term and date in one place.",
    title: "Leases that sign, renew and remember.",
    lead: "Write the lease from a template, send it for signature and keep every term, date and document with the lease.",
    points: [
      { title: "Templates", body: "Start from a lease template. Proppros fills in the names, the address, the rent and the dates." },
      { title: "Built-in e-signature", body: "Tenants sign online with a secure link. You get a signed PDF with a signing certificate." },
      { title: "Renewals", body: "Send a renewal offer before the lease ends. The tenant accepts it online." },
      { title: "Move-in and move-out", body: "Record inspections room by room with photos, and prepare the deposit letter when a tenant leaves." },
    ],
    screen: "lease",
    screenAlt: "A lease in Proppros with the balance, monthly rent, term, deposit and the rent ledger",
    help: "leasing",
    description: "Lease templates, built-in e-signature, renewals, inspections and deposit letters for independent landlords.",
  },
  {
    slug: "rent-tracking",
    icon: "rent",
    name: "Rent ledger",
    summary: "Charges post every month. Record payments in seconds and see who is behind at a glance.",
    title: "Know who has paid and who is behind.",
    lead: "Each lease has a running ledger. Rent charges post on their own, and every payment reduces the balance.",
    points: [
      { title: "Automatic charges", body: "Monthly rent and recurring charges post on the due date. You do not type them each month." },
      { title: "Record any payment", body: "Record Zelle, check, cash or other payments. Proppros creates a receipt for each one." },
      { title: "Late fees", body: "Set a late fee and a grace period for each lease." },
      { title: "Balances at a glance", body: "The dashboard and the rent roll show every open balance." },
    ],
    screen: "payments",
    screenAlt: "The payments list in Proppros with dates, tenants, methods and amounts",
    help: "rent-and-payments",
    description: "A rent ledger for each lease: automatic monthly charges, recorded payments with receipts, late fees and balances due.",
  },
  {
    slug: "maintenance",
    icon: "repair",
    name: "Maintenance and vendors",
    summary: "Requests with photos, work orders, vendors, quotes and preventive schedules.",
    title: "Run the property, not just the payments.",
    lead: "Repairs are where small landlords lose the most time. Proppros tracks each one from request to invoice.",
    points: [
      { title: "Requests with photos", body: "Tenants report a problem from their portal and add photos." },
      { title: "Work orders and vendors", body: "Assign a vendor, collect quotes, record the invoice and rate the work." },
      { title: "Preventive maintenance", body: "Schedule recurring tasks such as filter changes. Proppros opens the work order when it is due." },
      { title: "Appliance records", body: "Keep model numbers, warranties and manuals with the property." },
    ],
    screen: "workorder",
    screenAlt: "A work order in Proppros with its status, priority, vendor and history",
    help: "maintenance",
    description: "Maintenance requests with photos, work orders, vendors, quotes, invoices and preventive schedules for rental properties.",
  },
  {
    slug: "vacancies",
    icon: "vacancy",
    name: "Fill your vacancy",
    summary: "A listing page, ready-to-post ads, a share image, a flyer with a QR code and online applications.",
    title: "Fill your vacancy with less work.",
    lead: "Create one listing. Proppros gives you a public page, ready-to-post ads and a printable flyer, and it collects applications for you.",
    points: [
      { title: "A listing page you can share", body: "Each listing gets its own page with photos, rent, details and a link preview for social media." },
      { title: "Ready-to-post ads", body: "Copy ad text for listing sites, social media and text messages. It describes the home, not the people." },
      { title: "Share image and flyer", body: "Download a share image, or print a flyer with a QR code that opens the listing." },
      { title: "Online applications", body: "Applicants apply online and upload documents. You record the screening report from your provider and turn the best applicant into a lease." },
    ],
    screen: "listing-manage",
    screenAlt: "A listing in Proppros with its share link, ready-to-post ad text and buttons for the flyer and share image",
    gallery: [
      { src: "/screens/kit-share-image.webp", alt: "A share image for a listing: the home photo, the rent, beds and baths, the title and an Apply online button", width: 1080, height: 1350, caption: "Share image, 1080 × 1350" },
      { src: "/screens/kit-flyer.webp", alt: "A printable flyer for a listing with the photo, the rent, the details and a QR code to apply online", width: 1275, height: 1650, caption: "Printable flyer with QR code" },
    ],
    help: "vacancies",
    description: "Advertise vacant rentals: a shareable listing page, ready-to-post ad text, a share image, a QR flyer and online rental applications.",
  },
  {
    slug: "tenant-portal",
    icon: "portal",
    name: "Tenant portal",
    summary: "Tenants see their lease, balance and documents, send requests and messages. No app to install.",
    title: "A portal your tenants can use today.",
    lead: "Tenants sign in from any browser. They see what they owe, find their documents and reach you in one place.",
    points: [
      { title: "Lease and balance", body: "Tenants see their lease, their current balance and their payment history." },
      { title: "Requests and messages", body: "Tenants report repairs with photos and send you messages." },
      { title: "Documents and signing", body: "Tenants find their documents and sign leases and renewals online." },
      { title: "Nothing to install", body: "The portal works in the browser on a phone or a computer." },
    ],
    screen: "portal-phone",
    screenAlt: "The Proppros tenant portal on a phone showing the current balance",
    help: "tenant-portal",
    description: "A browser-based tenant portal: lease, balance, documents, maintenance requests, messages and online signing.",
  },
  {
    slug: "reports",
    icon: "report",
    name: "Reports",
    summary: "Profit and loss, rent roll and expenses by property, ready to export at tax time.",
    title: "Reports your accountant will like.",
    lead: "Every payment and expense is already in Proppros, so the reports are ready when you need them.",
    points: [
      { title: "Profit and loss", body: "See income and expenses by property and by month." },
      { title: "Rent roll", body: "See each unit, its tenant, its rent and its balance on one page." },
      { title: "Expenses with receipts", body: "Add expenses with a photo of the receipt." },
      { title: "CSV export", body: "Export your data for your accountant or your own spreadsheet." },
    ],
    screen: "reports",
    screenAlt: "The reports page in Proppros with profit and loss by property",
    help: "getting-started",
    description: "Profit and loss, rent roll and expense reports by property, with receipt photos and CSV export.",
  },
];

export const VACANCY = {
  eyebrow: "Fill your vacancy",
  title: "Find your next tenant from the same place.",
  lead: "Create one listing and Proppros does the rest of the paperwork. Share it, print it and review applications in one list.",
  points: [
    "A public listing page with photos and a link preview",
    "Ready-to-post ad text for listing sites and social media",
    "A share image and a printable flyer with a QR code",
    "Online applications with document upload",
    "Screening reports from your provider, kept with the application",
    "Turn the approved applicant into a lease",
  ],
  cta: "See how it works",
};

export const FOUNDER = {
  eyebrow: "Why Proppros",
  title: "Built by a landlord who needed it.",
  body: "Proppros started as the tool its founder needed to run three rental homes. Leases, rent, repairs and tenants were spread across spreadsheets, texts and paper. Now they are in one place, and the founder still runs those homes with Proppros every month.",
};

export const PLANS = [
  { id: "free", name: "Free", price: "$0", unit: "", lines: ["Up to 3 units", "Up to 2 team members", "Leases, rent ledger, maintenance and vacancies", "Tenant portal and reports"], soon: false },
  { id: "pro", name: "Pro", price: "$2", unit: "per unit per month", lines: ["Unlimited units", "Up to 10 team members", "Everything in Free", "Team access by property"], soon: true },
  { id: "business", name: "Business", price: "$3", unit: "per unit per month", lines: ["Unlimited units", "Unlimited team members", "Everything in Pro", "Priority support"], soon: true },
] as const;

export const FAQ = [
  { q: "Is Proppros free?", a: "Yes. The Free plan covers up to 3 units and 2 team members, with all the main features. You do not need a card to start." },
  { q: "What happens when I have more units?", a: "Paid plans are priced per unit per month and are coming soon. Until then, the Free plan covers up to 3 units." },
  { q: "Can tenants pay rent online?", a: "Not yet. You record each payment in Proppros (Zelle, check, cash or other), and Proppros creates a receipt and updates the balance." },
  { q: "Can I sign leases online?", a: "Yes. Proppros has built-in e-signature for leases and renewals. You get a signed PDF with a signing certificate." },
  { q: "Do my tenants need to install an app?", a: "No. Tenants use their portal in a web browser on a phone or a computer." },
  { q: "Can Proppros help me find tenants?", a: "Yes. Each listing gets a public page, ready-to-post ad text, a share image and a printable flyer with a QR code. Applicants apply online, and you review them in one list." },
  { q: "Can I get a profit and loss report for taxes?", a: "Yes. Proppros has profit and loss, rent roll and expense reports by property, and you can export them as CSV." },
  { q: "Can my property manager or accountant use it?", a: "Yes. Invite a manager, an accountant or a maintenance person, and limit each one to the properties they look after." },
  { q: "Who built Proppros?", a: "A landlord who owns three rental homes and runs them with Proppros." },
];

export const CLOSING = {
  title: "Start with your first property today.",
  lead: "Add a property, a lease and a tenant in a few minutes.",
};
