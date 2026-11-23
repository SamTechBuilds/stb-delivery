import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext, type AdminState, type AuthValue } from "../../src/admin/auth";
import { RequireOwner } from "../../src/admin/AdminShell";
import { Login } from "../../src/admin/Login";

function withState(state: AdminState) {
  const value: AuthValue = { state, refresh: async () => {}, signOut: async () => {} };
  return value;
}

/** Renders /admin behind the guard, with /login as the only other destination. */
function renderAdmin(state: AdminState) {
  return render(
    <AuthContext.Provider value={withState(state)}>
      <MemoryRouter initialEntries={["/admin/deliveries"]}>
        <Routes>
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
          <Route element={<RequireOwner />}>
            <Route path="/admin/deliveries" element={<p>SECRET DELIVERY LIST</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => cleanup());

describe("protected admin routes", () => {
  it("shows the admin page to an authorized owner", () => {
    renderAdmin({ kind: "owner", userId: "u", email: "owner@example.com" });
    expect(screen.getByText("SECRET DELIVERY LIST")).toBeInTheDocument();
  });

  it.each([
    ["signed out", { kind: "signed_out" } as AdminState],
    ["waiting for a code", { kind: "mfa_verify", email: "o@x.co" } as AdminState],
    ["not an owner", { kind: "unauthorized", email: "o@x.co" } as AdminState],
    ["in an error state", { kind: "error", message: "boom" } as AdminState],
  ])("sends %s visitors to /login and never renders the page", (_label, state) => {
    renderAdmin(state);
    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
    expect(screen.queryByText("SECRET DELIVERY LIST")).toBeNull();
  });

  it("shows a neutral loading state while the session is being checked, not the page", () => {
    renderAdmin({ kind: "loading" });
    expect(screen.getByText("Checking your sign-in…")).toBeInTheDocument();
    expect(screen.queryByText("SECRET DELIVERY LIST")).toBeNull();
  });
});

describe("login screen", () => {
  it("shows the no-access message to a signed-in person who is not an owner, with no admin content", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-test-key");
    render(
      <AuthContext.Provider value={withState({ kind: "unauthorized", email: "staff@example.com" })}>
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByText("No owner access")).toBeInTheDocument();
    expect(screen.queryByText(/Dashboard/)).toBeNull();
  });
});
