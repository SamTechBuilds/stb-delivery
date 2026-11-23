/**
 * STB Delivery — routing.
 *
 * Route table (most specific first; React Router ranks static paths above /:slug):
 *   /                  → Private token delivery (reads the token from the #fragment)
 *   /reveal/:token     → Private token delivery (legacy path form)
 *   /login             → Owner sign-in (admin)
 *   /admin, /admin/*   → Owner dashboard (admin, behind RequireOwner)
 *   /logout /signup /auth /assets/* /api/* /health /status → back to home
 *   /:slug             → Public slug delivery (published deliveries only)
 *   *                  → 404
 *
 * Reserved system paths are also refused by STB Core's reserved_slugs table, so no delivery can
 * be published on them even if this table were edited.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { TokenDelivery } from "./pages/TokenDelivery";
import { SlugDelivery } from "./pages/SlugDelivery";
import { NotFound } from "./pages/NotFound";
import { adminRoutes } from "./admin/routes";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Private token delivery: the token is read from #fragment or /reveal/:token */}
        <Route path="/" element={<TokenDelivery />} />
        <Route path="/reveal/:token" element={<TokenDelivery />} />

        {/* Owner admin: sign-in, dashboard and management pages */}
        {adminRoutes()}

        {/* System paths that never belong to a client */}
        <Route path="/logout" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/assets/*" element={<Navigate to="/" replace />} />
        <Route path="/api/*" element={<Navigate to="/" replace />} />
        <Route path="/health" element={<Navigate to="/" replace />} />
        <Route path="/status" element={<Navigate to="/" replace />} />

        {/* Public slug delivery: must come after every reserved route */}
        <Route path="/:slug" element={<SlugDelivery />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
