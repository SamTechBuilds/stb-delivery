import { Suspense, lazy, type ComponentType } from "react";
import { Route } from "react-router";

/*
 * Admin route table. Only this small module ships in the public bundle; every admin page is a
 * lazy chunk, so public delivery pages never load Supabase. Paths are absolute and listed
 * explicitly. /admin and /login are reserved slugs in STB Core, so no client page can take them.
 */

const AdminFrame = lazy(() => import("./AdminFrame").then((m) => ({ default: m.AdminFrame as ComponentType })));
const Login = lazy(() => import("./Login").then((m) => ({ default: m.Login as ComponentType })));
const RequireOwner = lazy(() => import("./AdminShell").then((m) => ({ default: m.RequireOwner as ComponentType })));
const AdminLayout = lazy(() => import("./AdminShell").then((m) => ({ default: m.AdminLayout as ComponentType })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard as ComponentType })));
const DeliveryList = lazy(() => import("./pages/DeliveryList").then((m) => ({ default: m.DeliveryList as ComponentType })));
const NewDelivery = lazy(() => import("./pages/NewDelivery").then((m) => ({ default: m.NewDelivery as ComponentType })));
const DeliveryEditor = lazy(() => import("./pages/DeliveryEditor").then((m) => ({ default: m.DeliveryEditor as ComponentType })));
const ClientsPage = lazy(() => import("./pages/Clients").then((m) => ({ default: m.ClientsPage as ComponentType })));
const TemplatesPage = lazy(() => import("./pages/Templates").then((m) => ({ default: m.TemplatesPage as ComponentType })));
const SettingsPage = lazy(() => import("./pages/Settings").then((m) => ({ default: m.SettingsPage as ComponentType })));

const fallback = <p className="a-muted" role="status" style={{ padding: 24 }}>Loading…</p>;
const at = (el: React.ReactNode) => <Suspense fallback={fallback}>{el}</Suspense>;

export function adminRoutes() {
  return (
    <Route element={at(<AdminFrame />)}>
      <Route path="/login" element={at(<Login />)} />
      <Route element={at(<RequireOwner />)}>
        <Route element={at(<AdminLayout />)}>
          <Route path="/admin" element={at(<Dashboard />)} />
          <Route path="/admin/deliveries" element={at(<DeliveryList />)} />
          <Route path="/admin/deliveries/new" element={at(<NewDelivery />)} />
          <Route path="/admin/deliveries/:id" element={at(<DeliveryEditor />)} />
          <Route path="/admin/clients" element={at(<ClientsPage />)} />
          <Route path="/admin/templates" element={at(<TemplatesPage />)} />
          <Route path="/admin/settings" element={at(<SettingsPage />)} />
        </Route>
      </Route>
    </Route>
  );
}
