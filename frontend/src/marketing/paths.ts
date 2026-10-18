/**
 * Public pages that are prerendered to static HTML at build time (scripts/prerender.mjs).
 * While the session check is loading, these render the signed-out tree so the browser
 * hydrates the server HTML instead of replacing it with a spinner.
 */
export function isPrerenderedPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === "/" || p === "/pricing" || p === "/features" || p.startsWith("/features/") || p === "/help" || p.startsWith("/help/");
}
