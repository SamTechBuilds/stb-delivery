import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

/**
 * What the signed-in person may do in the admin.
 *
 * Two-step sign-in is optional. When an owner has turned it on, the session must reach aal2 (a
 * TOTP code) first. Role comes from the database function staff_role(), which requires aal2 only
 * once a verified factor exists. Every table and RPC re-checks that in Postgres: this state
 * decides what the screens show, not what the data layer allows.
 */
export type AdminState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "mfa_verify"; email: string }
  | { kind: "unauthorized"; email: string }
  | { kind: "error"; message: string }
  | { kind: "owner"; userId: string; email: string };

/** The slice of the Supabase client that the resolver needs. Injected so tests can fake it. */
export interface AuthClient {
  auth: {
    mfa: {
      getAuthenticatorAssuranceLevel(): Promise<{
        data: { currentLevel: string | null; nextLevel: string | null } | null;
        error: { message: string } | null;
      }>;
    };
  };
  rpc(fn: "staff_role"): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

interface Resolvable { user: { id: string; email?: string | null } }

export async function resolveAdminState(session: Resolvable | null, client: AuthClient = supabase as unknown as AuthClient): Promise<AdminState> {
  if (!session) return { kind: "signed_out" };
  const email = session.user.email ?? "";

  const aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error || !aal.data) return { kind: "error", message: "Couldn't check your sign-in security level. Reload to try again." };

  // Two-step sign-in is optional. Only a verified factor (nextLevel aal2) asks for a code.
  // An owner without one signs in with the password alone; the database allows that session.
  if (aal.data.currentLevel !== "aal2" && aal.data.nextLevel === "aal2") {
    return { kind: "mfa_verify", email };
  }

  const role = await client.rpc("staff_role");
  if (role.error) return { kind: "error", message: "Couldn't verify your account. Check your connection and reload." };
  if (role.data !== "owner") return { kind: "unauthorized", email };
  return { kind: "owner", userId: session.user.id, email };
}

export interface AuthValue {
  state: AdminState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAdminAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>({ kind: "loading" });

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setState(await resolveAdminState(data.session));
  }, []);

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => resolveAdminState(data.session)).then((s) => { if (live) setState(s); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!live || event === "INITIAL_SESSION") return;
      // Defer: never await Supabase calls inside the auth callback itself.
      setTimeout(() => {
        resolveAdminState(session).then((s) => { if (live) setState(s); });
      }, 0);
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ kind: "signed_out" });
  }, []);

  const value = useMemo(() => ({ state, refresh, signOut }), [state, refresh, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
