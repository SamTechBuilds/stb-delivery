import { NavLink, Navigate, Outlet, useLocation } from "react-router";
import { useAdminAuth } from "./auth";

/**
 * Every /admin route passes through here. Anything other than an authorized owner on an aal2
 * session goes to /login, which shows the right step (password, code, enrolment or refusal).
 * This is a UX gate; the database enforces the same rule on every read and write.
 */
export function RequireOwner() {
  const { state } = useAdminAuth();
  const location = useLocation();

  if (state.kind === "loading") {
    return (
      <main className="a-login" aria-busy="true">
        <div className="a-card"><p role="status">Checking your sign-in…</p></div>
      </main>
    );
  }
  if (state.kind !== "owner") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/deliveries", label: "Deliveries", end: false },
  { to: "/admin/clients", label: "Clients", end: false },
  { to: "/admin/templates", label: "Templates", end: false },
  { to: "/admin/settings", label: "Settings", end: false },
];

export function AdminLayout() {
  const { state, signOut } = useAdminAuth();
  const email = state.kind === "owner" ? state.email : "";
  return (
    <div className="a-app">
      <header className="a-top">
        <NavLink to="/admin" className="a-top__brand">STB Delivery</NavLink>
        <nav className="a-nav" aria-label="Admin">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `a-nav__link${isActive ? " is-active" : ""}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="a-top__account">
          <span className="a-top__email" title={email}>{email}</span>
          <button type="button" className="a-btn a-btn--quiet" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>
      <main className="a-main">
        <Outlet />
      </main>
    </div>
  );
}
