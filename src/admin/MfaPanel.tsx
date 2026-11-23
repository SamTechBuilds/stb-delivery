import { useEffect, useState, type FormEvent } from "react";
import { supabase, checkPassword } from "./supabase";
import { useAdminAuth } from "./auth";
import {
  MfaError, beginSetup, cancelSetup, confirmSetup, disableMfa, getMfaStatus, normaliseCode,
  type MfaApi, type MfaStatus,
} from "./mfa";
import { Notice, formatDate } from "./ui";

const api = supabase.auth.mfa as unknown as MfaApi;
const APP = "STB Delivery";

type Setup = { factorId: string; qrCode: string; secret: string } | null;

/** Optional two-factor sign-in for the owner. Off by default, and never required to use the admin. */
export function MfaPanel() {
  const { refresh } = useAdminAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<Setup>(null);
  const [mode, setMode] = useState<"idle" | "setup" | "disable">("idle");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const load = async () => {
    try {
      setStatus(await getMfaStatus(api));
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    }
  };

  useEffect(() => {
    let live = true;
    getMfaStatus(api)
      .then((st) => { if (live) setStatus(st); })
      .catch((e) => { if (live) setNotice({ kind: "error", text: (e as Error).message }); });
    return () => { live = false; };
  }, []);

  const fail = (e: unknown) => setNotice({ kind: "error", text: e instanceof MfaError ? e.message : "Something went wrong. Try again." });

  async function start() {
    setBusy(true);
    setNotice(null);
    try {
      const s = await beginSetup(api, APP);
      setSetup(s);
      setMode("setup");
      setCode("");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    if (!setup) return;
    setBusy(true);
    try {
      await confirmSetup(api, setup.factorId, code);
      setSetup(null);
      setMode("idle");
      setCode("");
      setNotice({ kind: "ok", text: "Two-step sign-in is on. Sign-in will ask for a code from your app." });
      await load();
      await refresh();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function cancel() {
    if (setup) {
      try { await cancelSetup(api, setup.factorId); } catch { /* the next setup removes it anyway */ }
    }
    setSetup(null);
    setMode("idle");
    setCode("");
    await load();
  }

  async function turnOff(e: FormEvent) {
    e.preventDefault();
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) { setNotice({ kind: "error", text: "Your session has ended. Sign in again." }); return; }
    setBusy(true);
    try {
      await disableMfa(api, checkPassword, { email: session.user.email ?? "", userId: session.user.id, password, code });
      setMode("idle");
      setPassword("");
      setCode("");
      setNotice({ kind: "ok", text: "Two-step sign-in is off. Your password is enough to sign in." });
      await load();
      await refresh();
    } catch (err) { fail(err); } finally { setBusy(false); setPassword(""); }
  }

  if (!status) return <p className="a-muted" role="status">Checking two-step sign-in…</p>;

  return (
    <section aria-labelledby="mfa-h">
      <h2 id="mfa-h">Two-step sign-in</h2>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      {status.state === "on" && mode !== "disable" && (
        <>
          <p><span className="a-muted">Status</span> <strong>On</strong>{status.since ? `, since ${formatDate(status.since)}` : ""}. Sign-in asks for a six-digit code from your authenticator app.</p>
          <button type="button" className="a-btn a-btn--quiet" onClick={() => { setMode("disable"); setNotice(null); }}>Turn off two-step sign-in</button>
        </>
      )}

      {status.state === "on" && mode === "disable" && (
        <form className="a-form" onSubmit={turnOff} noValidate>
          <p>To turn it off, confirm your password and a current code from your app.</p>
          <label className="a-field"><span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="a-field"><span>Six-digit code</span>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={7} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div className="a-actions">
            <button type="submit" className="a-btn" disabled={busy || password === "" || normaliseCode(code).length !== 6}>Turn off</button>
            <button type="button" className="a-btn a-btn--quiet" onClick={() => { setMode("idle"); setPassword(""); setCode(""); }}>Keep it on</button>
          </div>
        </form>
      )}

      {status.state === "off" && mode !== "setup" && (
        <>
          <p>Two-step sign-in is optional. Your password is enough until you turn it on. Once it is on, sign-in also asks for a six-digit code from an authenticator app such as Google Authenticator.</p>
          <button type="button" className="a-btn" disabled={busy} onClick={() => void start()}>Set up two-step sign-in</button>
        </>
      )}

      {status.state === "off" && mode === "setup" && setup && (
        <form className="a-form a-form--mfa" onSubmit={confirm} noValidate>
          <p>Add this account to your authenticator app. Two-step sign-in turns on only after you enter a code that works.</p>
          <img src={setup.qrCode} alt="QR code to add STB Delivery to your authenticator app" width={180} height={180} />
          <p>Or enter this key by hand: <code>{setup.secret}</code></p>
          <label className="a-field"><span>Six-digit code from the app</span>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={7} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div className="a-actions">
            <button type="submit" className="a-btn a-btn--primary" disabled={busy || normaliseCode(code).length !== 6}>Turn on</button>
            <button type="button" className="a-btn a-btn--quiet" onClick={() => void cancel()}>Cancel setup</button>
          </div>
        </form>
      )}

      <p className="a-muted" style={{ fontSize: 13, marginTop: 12 }}>
        Recovery: if you lose your authenticator, a code can't be entered. There are no recovery codes in this app.
        Removing the factor is then done by someone with access to the Supabase project. Confirm that step against
        the current Supabase documentation before you rely on it, and keep the setup key somewhere safe.
      </p>
    </section>
  );
}
