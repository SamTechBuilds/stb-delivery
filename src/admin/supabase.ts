import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The same STB Core project, auth system and staff account as STB App.
 * Only the publishable/anon key is used here. The service-role key never appears in this app.
 *
 * detectSessionInUrl is off: public links keep their token in the URL fragment (/#<token>),
 * and Supabase must never read that fragment as a sign-in.
 */
export const supabase: SupabaseClient = createClient(url ?? "http://localhost:54321", anonKey ?? "missing", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "stb-delivery-auth",
  },
});

/** Read at render time, so a build without config shows a clear message instead of failing silently. */
export function supabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/**
 * Checks a password without touching the signed-in session. The check client never persists a
 * session. Its temporary session is ended locally; the server-side session it created expires on
 * its own, and no other session is revoked. Returns the user id, or null when the password is wrong.
 */
export async function checkPassword(email: string, password: string): Promise<string | null> {
  const check = createClient(url ?? "http://localhost:54321", anonKey ?? "missing", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await check.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  await check.auth.signOut({ scope: "local" });
  return data.user.id;
}
