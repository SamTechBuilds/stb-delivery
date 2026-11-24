/**
 * The root route "/" has two jobs, decided once per page load:
 *   - a private client delivery (token in #fragment, or already held in this tab): TokenDelivery
 *   - otherwise the owner entry point: /admin, which RequireOwner guards. Signed out, that sends
 *     the owner to the existing /login page; signed in, it goes straight to the dashboard.
 */
import { useState } from "react";
import { Navigate } from "react-router";
import { TokenDelivery } from "./pages/TokenDelivery";
import { hasClientToken } from "./api";

export function RootEntry() {
  const [isClientDelivery] = useState(hasClientToken);
  return isClientDelivery ? <TokenDelivery /> : <Navigate to="/admin" replace />;
}
