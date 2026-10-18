/**
 * Server entry used only at build time: renders public pages to HTML (scripts/prerender.mjs).
 * It renders the real <App/> as a signed-out visitor so the browser can hydrate it.
 */
import { prerenderToNodeStream } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./i18n";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";

export { marketingPages, SITE_URL, SITE_NAME } from "./marketing/seo";
export { HELP_ARTICLES } from "./help";

export async function render(url: string): Promise<string> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  queryClient.setQueryData(["me"], null);
  const { prelude } = await prerenderToNodeStream(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={url}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StaticRouter>
    </QueryClientProvider>,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
