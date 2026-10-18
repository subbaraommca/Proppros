import gettingStarted from "./getting-started.md?raw";
import rentAndPayments from "./rent-and-payments.md?raw";
import maintenance from "./maintenance.md?raw";
import teamAndAccess from "./team-and-access.md?raw";
import tenantPortal from "./tenant-portal.md?raw";
import leasing from "./leasing.md?raw";
import security from "./security.md?raw";
import plansAndBilling from "./plans-and-billing.md?raw";

/** Help center articles (English Markdown). Titles/summaries are translated via `help.articles.<slug>.*`. */
export const HELP_ARTICLES: { slug: string; content: string }[] = [
  { slug: "getting-started", content: gettingStarted },
  { slug: "rent-and-payments", content: rentAndPayments },
  { slug: "maintenance", content: maintenance },
  { slug: "team-and-access", content: teamAndAccess },
  { slug: "leasing", content: leasing },
  { slug: "tenant-portal", content: tenantPortal },
  { slug: "security", content: security },
  { slug: "plans-and-billing", content: plansAndBilling },
];
