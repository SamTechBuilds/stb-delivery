import { Outlet } from "react-router";
import { AuthProvider } from "./auth";
import "./admin.css";

/** Wraps every /login and /admin route. Loaded lazily, so public delivery pages never load Supabase. */
export function AdminFrame() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
