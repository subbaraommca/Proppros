import en from "../locales/en.json";
import { HELP_ARTICLES } from "../help";
import { FAQ, FEATURES } from "./content";

/** Public marketing pages: one entry per prerendered URL (see scripts/prerender.mjs). */
export const SITE_URL = "https://proppros.vercel.app";
export const SITE_NAME = "Proppros";

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  /** Output file in dist/, served through a rewrite in vercel.json. */
  file: string;
  jsonLd: object[];
}

const helpArticles = (en as { help: { articles: Record<string, { title: string; summary: string }> } }).help.articles;

const organization = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#org`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
};

export const software = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Property management software",
  operatingSystem: "Web browser",
  url: SITE_URL,
  description: "Property management software for independent landlords: leases with e-signature, rent tracking, maintenance, vacancies, tenant portal and reports.",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", description: "Up to 3 units and 2 team members." },
  ],
  publisher: { "@id": `${SITE_URL}/#org` },
};

const breadcrumb = (items: [string, string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${path}` })),
});

const graph = (...nodes: object[]) => [{ "@context": "https://schema.org", "@graph": nodes }];

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

/** Extra JSON-LD per path, registered by page modules (for example the home FAQ). */
const extras: Record<string, object[]> = {};
export function addJsonLd(path: string, ...nodes: object[]) {
  extras[path] = [...(extras[path] ?? []), ...nodes];
}

export function marketingPages(): PageMeta[] {
  const pages: Omit<PageMeta, "jsonLd">[] = [
    {
      path: "/",
      file: "index.html",
      title: "Proppros — Property management software for independent landlords",
      description: "Property management software for independent landlords: leases with e-signature, rent tracking, repairs, vacancy marketing and a tenant portal. Start free.",
    },
    {
      path: "/features",
      file: "features.html",
      title: "Features — Proppros",
      description: "Leases with e-signature, a rent ledger, maintenance and vendors, vacancy marketing, a tenant portal and reports, in one place.",
    },
    ...FEATURES.map((f) => ({
      path: `/features/${f.slug}`,
      file: `features/${f.slug}.html`,
      title: `${f.name} — Proppros`,
      description: f.description,
    })),
    {
      path: "/pricing",
      file: "pricing.html",
      title: "Pricing — Proppros",
      description: "Start free for up to 3 units. Pay per unit only when your portfolio grows. No card needed to start.",
    },
    {
      path: "/help",
      file: "help.html",
      title: "Help center — Proppros",
      description: "Guides for landlords and tenants: getting started, rent and payments, leases, maintenance, vacancies and more.",
    },
    ...HELP_ARTICLES.map(({ slug }) => ({
      path: `/help/${slug}`,
      file: `help/${slug}.html`,
      title: `${helpArticles[slug]?.title ?? slug} — Proppros help`,
      description: helpArticles[slug]?.summary ?? "",
    })),
  ];
  return pages.map((p) => {
    const crumbs: [string, string][] = [["Home", "/"]];
    if (p.path.startsWith("/help")) crumbs.push(["Help", "/help"]);
    if (p.path.startsWith("/help/")) crumbs.push([p.title.replace(" — Proppros help", ""), p.path]);
    if (p.path === "/pricing") crumbs.push(["Pricing", "/pricing"]);
    if (p.path.startsWith("/features")) crumbs.push(["Features", "/features"]);
    if (p.path.startsWith("/features/")) crumbs.push([p.title.replace(" — Proppros", ""), p.path]);
    const nodes: object[] = [organization];
    if (p.path === "/" || p.path === "/pricing") nodes.push(software);
    if (p.path === "/") nodes.push(faqJsonLd(FAQ));
    if (p.path === "/pricing") nodes.push(faqJsonLd(FAQ.slice(0, 3)));
    if (p.path !== "/") nodes.push(breadcrumb(crumbs));
    nodes.push(...(extras[p.path] ?? []));
    return { ...p, jsonLd: graph(...nodes) };
  });
}

export function metaFor(path: string): PageMeta | undefined {
  const clean = path.replace(/\/+$/, "") || "/";
  return marketingPages().find((p) => p.path === clean);
}
