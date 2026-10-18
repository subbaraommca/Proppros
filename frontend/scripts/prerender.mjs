// Build step: renders the public marketing pages to static HTML so search engines,
// link previews and AI tools see real content without running JavaScript.
// Runs after `vite build` (client) and `vite build --ssr src/entry-server.tsx`.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const ssr = join(root, "dist-ssr");
const { render, marketingPages, SITE_URL, SITE_NAME, HELP_ARTICLES } = await import(pathToFileURL(join(ssr, "entry-server.js")).href);

// The untouched Vite shell keeps serving every app route (see the catch-all rewrite in vercel.json).
const template = readFileSync(join(dist, "index.html"), "utf8");
copyFileSync(join(dist, "index.html"), join(dist, "app.html"));

// Preload the fonts used above the fold (headline + body) so the hero paints sooner.
const fontPreloads = readdirSync(join(dist, "assets"))
  .filter((f) => /^(archivo-latin-wdth-normal|dm-sans-latin-wght-normal)-.*\.woff2$/.test(f))
  .map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin />`);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ogImage = `${SITE_URL}/og.png`;

function head(page) {
  const url = `${SITE_URL}${page.path === "/" ? "/" : page.path}`;
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
    ...fontPreloads,
    ...page.jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`),
  ].join("\n    ");
}

const pages = marketingPages();
for (const page of pages) {
  const body = await render(page.path);
  if (!body.includes("<h1")) throw new Error(`Prerender of ${page.path} produced no <h1> — is the page still loading?`);
  const html = template
    .replace(/<title>.*?<\/title>/s, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace("</head>", `    ${head(page)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  const out = join(dist, page.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`prerendered ${page.path} -> ${page.file} (${Math.round(html.length / 1024)} KB)`);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`,
);
writeFileSync(
  join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /portal\nDisallow: /settings\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);

// llms.txt: a plain summary for AI assistants (https://llmstxt.org).
const home = pages.find((p) => p.path === "/");
writeFileSync(
  join(dist, "llms.txt"),
  [
    `# ${SITE_NAME}`,
    "",
    `> ${home.description}`,
    "",
    "Proppros is web-based property management software for independent landlords. It covers properties and units, tenants and leases (templates and built-in e-signature), a rent ledger with recorded payments and receipts, expenses and reports (profit and loss, rent roll, CSV export), maintenance requests with photos, vendors and preventive maintenance, vacancy listings with online applications, tenant messaging and notices, and a browser-based tenant portal.",
    "",
    "Pricing: Free for up to 3 units and 2 team members. Paid plans (Pro and Business, priced per unit per month) are coming soon.",
    "",
    "## Pages",
    ...pages.filter((p) => !p.path.startsWith("/help/")).map((p) => `- [${p.title}](${SITE_URL}${p.path}): ${p.description}`),
    "",
    "## Help articles",
    ...pages.filter((p) => p.path.startsWith("/help/")).map((p) => `- [${p.title}](${SITE_URL}${p.path}): ${p.description}`),
    "",
  ].join("\n"),
);
console.log(`sitemap.xml, robots.txt, llms.txt written (${pages.length} pages, ${HELP_ARTICLES.length} help articles)`);
rmSync(ssr, { recursive: true, force: true });
