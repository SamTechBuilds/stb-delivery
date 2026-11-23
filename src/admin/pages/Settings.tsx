import { useEffect, useState, type FormEvent } from "react";
import { useAdminAuth } from "../auth";
import { MfaPanel } from "../MfaPanel";
import { getBusinessProfile, saveBusinessProfile, type BusinessProfileRecord } from "../data";
import { friendlyError } from "../lib/errors";
import { Notice, PageHead } from "../ui";

type Msg = { kind: "error" | "ok"; text: string } | null;
const errText = (e: unknown) => friendlyError(e as { code?: string; message?: string });

export function SettingsPage() {
  const { state, signOut } = useAdminAuth();
  const email = state.kind === "owner" ? state.email : "";
  return (
    <div>
      <PageHead title="Settings" lead="Your account and the details shown on the visiting card." />
      <AccountPanel email={email} onSignOut={signOut} />
      <ProfilePanel />
    </div>
  );
}

function AccountPanel({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  return (
    <div className="a-panel">
      <h2>Account</h2>
      <p><span className="a-muted">Signed in as</span> <strong>{email || "unknown"}</strong></p>
      <button type="button" className="a-btn a-btn--quiet" onClick={() => void onSignOut()}>Sign out</button>
      <div style={{ marginTop: 20 }}>
        <MfaPanel />
      </div>
    </div>
  );
}

function ProfilePanel() {
  const [form, setForm] = useState<BusinessProfileRecord | null>(null);
  const [servicesText, setServicesText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getBusinessProfile()
      .then((p) => { if (live) { setForm(p); setServicesText(p.services.join(", ")); } })
      .catch((e) => { if (live) setMsg({ kind: "error", text: errText(e) }); });
    return () => { live = false; };
  }, []);

  if (!form) return <div className="a-panel">{msg ? <Notice kind="error">{msg.text}</Notice> : <p className="a-muted" role="status">Loading…</p>}</div>;

  const set = (k: keyof BusinessProfileRecord, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const brand = form.brand_name.trim();
    if (brand === "" || brand.length > 80) { setErrors({ brand_name: "Add a brand name, using 80 characters or fewer." }); return; }
    if (form.email && form.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErrors({ email: "Use an email address like hello@example.com." }); return;
    }
    setErrors({});
    const opt = (v: string | null) => (v && v.trim() !== "" ? v.trim() : null);
    setBusy(true);
    try {
      await saveBusinessProfile({
        brand_name: brand,
        tagline: opt(form.tagline), person_name: opt(form.person_name), role_title: opt(form.role_title),
        phone: opt(form.phone), whatsapp: opt(form.whatsapp), email: opt(form.email), website: opt(form.website),
        location: opt(form.location), services: servicesText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
        support_hours: opt(form.support_hours),
      });
      setMsg({ kind: "ok", text: "Saved. The visiting card on client pages now shows these details." });
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  const field = (id: keyof BusinessProfileRecord, label: string) => (
    <label className="a-field" htmlFor={`bp-${id}`}><span>{label}</span>
      <input id={`bp-${id}`} value={(form[id] as string | null) ?? ""} onChange={(e) => set(id, e.target.value)} aria-invalid={errors[id] ? true : undefined} />
      {errors[id] && <span className="a-error" role="alert" style={{ display: "block" }}>{errors[id]}</span>}
    </label>
  );

  return (
    <form className="a-panel" onSubmit={submit} noValidate style={{ marginTop: 16 }}>
      <h2>Visiting card details</h2>
      <p className="a-muted" style={{ fontSize: 13 }}>Shown to clients on the visiting card and in support sections. Nothing else from this page is shown.</p>
      <div className="a-grid">
        {field("brand_name", "Brand name")}
        {field("tagline", "Tagline")}
        {field("person_name", "Your name")}
        {field("role_title", "Your role")}
        {field("email", "Support email")}
        {field("phone", "Phone")}
        {field("whatsapp", "WhatsApp number or link")}
        {field("website", "Website")}
        {field("location", "Location")}
        {field("support_hours", "Support hours")}
        <label className="a-field" htmlFor="bp-services"><span>Services (comma separated)</span><input id="bp-services" value={servicesText} onChange={(e) => setServicesText(e.target.value)} /></label>
      </div>
      <button type="submit" className="a-btn" disabled={busy}>Save details</button>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </form>
  );
}
