import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";

function renderAt(path: string, meResponse: { status: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(meResponse.body), { status: meResponse.status, headers: { "Content-Type": "application/json" } })),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

it("shows sign-in when not authenticated", async () => {
  renderAt("/properties", { status: 401, body: { detail: "Not authenticated" } });
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
});

it("sends tenants to the portal", async () => {
  renderAt("/", {
    status: 200,
    body: {
      id: "u1",
      email: "t@example.com",
      name: "Tina",
      phone: null,
      email_verified: true,
      is_superadmin: false,
      organizations: [{ id: "o1", name: "Oak Rentals", role: "tenant", timezone: "America/New_York", currency: "USD" }],
    },
  });
  expect(await screen.findByRole("navigation", { name: "Portal navigation" })).toBeInTheDocument();
});
