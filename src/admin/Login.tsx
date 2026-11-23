import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { useAdminAuth } from "./auth";
import { supabase, supabaseConfigured } from "./supabase";

/** Sign-in for the owner. Password first; a six-digit code only if two-step sign-in is on. */
export function Login() {
  const { state, refresh, signOut } = useAdminAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  if (!supabaseConfigured()) {
    return <Shell title="Admin isn't configured" body="VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for this build." />;
  }
  if (state.kind === "loading") return <Shell title="Checking your sign-in…" busy />;
  if (state.kind === "owner") return <Navigate to={from} replace />;

  if (state.kind === "unauthorized") {
    return (
      <Shell title="No owner access" body={`${state.email} isn't set up as an owner for Sam Tech Builds. Sign in with the account that manages STB Delivery.`}>
        <button type="button" className="a-btn" onClick={signOut}>Sign out</button>
      </Shell>
    );
  }
  if (state.kind === "error") {
    return (
      <Shell title="Couldn't sign you in" body={state.message}>
        <button type="button" className="a-btn a-btn--primary" onClick={() => refresh()}>Try again</button>
        <button type="button" className="a-btn" onClick={signOut}>Sign out</button>
      </Shell>
    );
  }
  if (state.kind === "signed_out") return <PasswordStep />;
  return <CodeStep email={state.email} onDone={refresh} onCancel={signOut} />;
}

function PasswordStep() {
  const { refresh } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (err) {
      setError("That email or password isn't right.");
      return;
    }
    setPassword("");
    await refresh();
  };

  return (
    <Shell title="Sign in" body="Owner access to STB Delivery.">
      <form className="a-form" onSubmit={submit}>
        <label className="a-field">
          <span>Email</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="a-field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="a-error" role="alert">{error}</p>}
        <button type="submit" className="a-btn a-btn--primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </Shell>
  );
}

function CodeStep({ email, onDone, onCancel }: { email: string; onDone: () => Promise<void>; onCancel: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const factors = await supabase.auth.mfa.listFactors();
    const totp = factors.data?.totp.find((f) => f.status === "verified");
    if (factors.error || !totp) {
      setBusy(false);
      setError("Couldn't find your authenticator. Sign out and try again.");
      return;
    }
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (err) {
      setError("That code didn't work. Enter the current six-digit code from your app.");
      return;
    }
    await onDone();
  };

  return (
    <Shell title="Enter your code" body={`Signed in as ${email}. Enter the six-digit code from your authenticator app.`}>
      <form className="a-form" onSubmit={verify}>
        <label className="a-field">
          <span>Six-digit code</span>
          <input inputMode="numeric" autoComplete="one-time-code" required value={code} maxLength={7} onChange={(e) => setCode(e.target.value)} />
        </label>
        {error && <p className="a-error" role="alert">{error}</p>}
        <button type="submit" className="a-btn a-btn--primary" disabled={busy || code.replace(/\s/g, "").length !== 6}>
          {busy ? "Checking…" : "Continue"}
        </button>
        <button type="button" className="a-btn a-btn--quiet" onClick={onCancel}>Sign out</button>
      </form>
    </Shell>
  );
}

function Shell({ title, body, busy, children }: { title: string; body?: string; busy?: boolean; children?: React.ReactNode }) {
  return (
    <main className="a-login" aria-busy={busy || undefined}>
      <div className="a-card">
        <p className="a-brand">Sam Tech Builds</p>
        <h1>{title}</h1>
        {body && <p className="a-lead">{body}</p>}
        {children}
      </div>
    </main>
  );
}
