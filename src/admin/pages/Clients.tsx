import { useEffect, useState, type FormEvent } from "react";
import {
  addSupportPeriod, listClients, listProjects, listSupportPeriods, saveClient, saveProject,
  type ClientRecord, type ProjectRecord, type SupportPeriodRecord,
} from "../data";
import { checkClient, checkProject, checkSupportPeriod, type ClientForm, type ProjectFormInput } from "../lib/records";
import { friendlyError } from "../lib/errors";
import { Notice, PageHead, formatDate } from "../ui";

type Msg = { kind: "error" | "ok"; text: string } | null;
const errText = (e: unknown) => friendlyError(e as { code?: string; message?: string });

const EMPTY_CLIENT: ClientForm = { name: "", business_name: "", email: "", phone: "", address: "", notes: "", status: "active" };
const EMPTY_PROJECT: ProjectFormInput = {
  name: "", category: "", description: "", tech: "", status: "planned", completed_on: "", live_url: "", budget: "", currency: "CAD", internal_notes: "",
};

export function ClientsPage() {
  const [clients, setClients] = useState<ClientRecord[] | null>(null);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    listClients()
      .then((c) => { if (live) setClients(c); })
      .catch((e) => { if (live) setError(errText(e)); });
    return () => { live = false; };
  }, [version]);

  const current = clients?.find((c) => c.id === selected) ?? null;

  return (
    <div>
      <PageHead title="Clients" lead="Client and project records. Notes and budgets are for you; clients never see them." />
      {error && <Notice kind="error">{error}</Notice>}
      <div className="a-split">
        <aside className="a-panel" aria-label="Client list">
          <button type="button" className="a-btn" onClick={() => setSelected("new")}>New client</button>
          {clients === null && <p className="a-muted" role="status">Loading…</p>}
          {clients?.length === 0 && <p className="a-muted" style={{ marginTop: 12 }}>No clients yet.</p>}
          <ul className="a-list" style={{ marginTop: 12 }}>
            {(clients ?? []).map((c) => (
              <li key={c.id}>
                <button type="button" className={`a-linkbtn${selected === c.id ? " is-active" : ""}`} aria-current={selected === c.id} onClick={() => setSelected(c.id)}>
                  {c.name}{c.status === "archived" ? " (archived)" : ""}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div>
          {selected === null && <div className="a-panel"><p className="a-muted">Choose a client, or create one.</p></div>}
          {selected === "new" && <ClientForm key="new" client={null} onSaved={(id) => { setSelected(id); setVersion((v) => v + 1); }} />}
          {current && <ClientForm key={current.id} client={current} onSaved={() => setVersion((v) => v + 1)} />}
          {current && <ProjectsPanel clientId={current.id} />}
        </div>
      </div>
    </div>
  );
}

function ClientForm({ client, onSaved }: { client: ClientRecord | null; onSaved: (id: string) => void }) {
  const [form, setForm] = useState<ClientForm>(() => client
    ? { name: client.name, business_name: client.business_name ?? "", email: client.email ?? "", phone: client.phone ?? "", address: client.address ?? "", notes: client.notes ?? "", status: client.status }
    : EMPTY_CLIENT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ClientForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkClient(form);
    if (!checked.ok) { setErrors(checked.errors as Record<string, string>); return; }
    setErrors({});
    setBusy(true);
    try {
      const id = await saveClient({ ...checked.value, id: client?.id });
      setMsg({ kind: "ok", text: "Saved." });
      onSaved(id);
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="a-panel" onSubmit={submit} noValidate>
      <h2>{client ? client.name : "New client"}</h2>
      <div className="a-grid">
        <label htmlFor="c-name">Name<input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={errors.name ? true : undefined} /></label>
        {errors.name && <p className="a-error" role="alert">{errors.name}</p>}
        <label htmlFor="c-business">Business name<input id="c-business" value={form.business_name} onChange={(e) => set("business_name", e.target.value)} /></label>
        <label htmlFor="c-email">Email<input id="c-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} aria-invalid={errors.email ? true : undefined} /></label>
        {errors.email && <p className="a-error" role="alert">{errors.email}</p>}
        <label htmlFor="c-phone">Phone<input id="c-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label htmlFor="c-address">Address<input id="c-address" value={form.address} onChange={(e) => set("address", e.target.value)} /></label>
        <label htmlFor="c-status">Status
          <select id="c-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label htmlFor="c-notes">Internal notes (never shown to clients)<textarea id="c-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      </div>
      <button type="submit" className="a-btn" disabled={busy}>Save client</button>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </form>
  );
}

function ProjectsPanel({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<ProjectRecord[] | null>(null);
  const [editing, setEditing] = useState<ProjectRecord | "new" | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listProjects(clientId)
      .then((p) => { if (live) setProjects(p); })
      .catch((e) => { if (live) setError(errText(e)); });
    return () => { live = false; };
  }, [clientId, version]);

  return (
    <div className="a-panel">
      <h2>Projects</h2>
      {error && <Notice kind="error">{error}</Notice>}
      <button type="button" className="a-btn a-btn--quiet" onClick={() => setEditing("new")}>New project</button>
      <ul className="a-list" style={{ marginTop: 12 }}>
        {(projects ?? []).map((p) => (
          <li key={p.id} className="a-row">
            <div>
              <strong>{p.name}</strong> <span className="a-chip">{p.status.replace("_", " ")}</span>
              <p className="a-muted" style={{ fontSize: 13, margin: "2px 0 0" }}>
                {p.completed_on ? `Completed ${formatDate(p.completed_on)}` : "Not completed yet"}
              </p>
            </div>
            <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => setEditing(p)}>Edit</button>
          </li>
        ))}
      </ul>
      {editing && (
        <ProjectForm
          key={editing === "new" ? "new" : editing.id}
          clientId={clientId}
          project={editing === "new" ? null : editing}
          onSaved={() => { setEditing(null); setVersion((v) => v + 1); }}
        />
      )}
      {editing && editing !== "new" && <SupportPanel projectId={editing.id} />}
    </div>
  );
}

function ProjectForm({ clientId, project, onSaved }: { clientId: string; project: ProjectRecord | null; onSaved: () => void }) {
  const [form, setForm] = useState<ProjectFormInput>(() => project ? {
    name: project.name, category: project.category ?? "", description: project.description ?? "", tech: project.tech_stack.join(", "),
    status: project.status, completed_on: project.completed_on ?? "", live_url: project.live_url ?? "",
    budget: project.budget_minor !== null ? String(project.budget_minor / 100) : "", currency: project.currency ?? "CAD",
    internal_notes: project.internal_notes ?? "",
  } : EMPTY_PROJECT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const set = (k: keyof ProjectFormInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = checkProject(form);
    if (!checked.ok) { setErrors(checked.errors as Record<string, string>); return; }
    setErrors({});
    try {
      await saveProject({ ...checked.value, client_id: clientId, id: project?.id });
      onSaved();
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    }
  }

  return (
    <form className="a-panel" onSubmit={submit} noValidate style={{ marginTop: 16 }}>
      <h3>{project ? project.name : "New project"}</h3>
      <div className="a-grid">
        <label htmlFor="p-name">Project name<input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={errors.name ? true : undefined} /></label>
        {errors.name && <p className="a-error" role="alert">{errors.name}</p>}
        <label htmlFor="p-status">Status
          <select id="p-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label htmlFor="p-completed">Completed on<input id="p-completed" type="date" value={form.completed_on} onChange={(e) => set("completed_on", e.target.value)} /></label>
        {errors.completed_on && <p className="a-error" role="alert">{errors.completed_on}</p>}
        <label htmlFor="p-live">Live address<input id="p-live" value={form.live_url} onChange={(e) => set("live_url", e.target.value)} /></label>
        {errors.live_url && <p className="a-error" role="alert">{errors.live_url}</p>}
        <label htmlFor="p-tech">Technologies (comma separated)<input id="p-tech" value={form.tech} onChange={(e) => set("tech", e.target.value)} /></label>
        <label htmlFor="p-description">Description (may be used on the client page)<textarea id="p-description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label htmlFor="p-budget">Budget (internal, whole units with cents)<input id="p-budget" inputMode="decimal" value={form.budget} onChange={(e) => set("budget", e.target.value)} aria-invalid={errors.budget ? true : undefined} /></label>
        {errors.budget && <p className="a-error" role="alert">{errors.budget}</p>}
        <label htmlFor="p-currency">Currency (internal)<input id="p-currency" value={form.currency} onChange={(e) => set("currency", e.target.value)} maxLength={3} aria-invalid={errors.currency ? true : undefined} /></label>
        {errors.currency && <p className="a-error" role="alert">{errors.currency}</p>}
        <label htmlFor="p-internal">Internal notes (never shown to clients)<textarea id="p-internal" rows={3} value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} /></label>
      </div>
      <button type="submit" className="a-btn">Save project</button>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </form>
  );
}

function SupportPanel({ projectId }: { projectId: string }) {
  const [periods, setPeriods] = useState<SupportPeriodRecord[] | null>(null);
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState({ plan_name: "", starts_on: "", ends_on: "", terms: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let live = true;
    listSupportPeriods(projectId)
      .then((p) => { if (live) setPeriods(p); })
      .catch((e) => { if (live) setMsg({ kind: "error", text: errText(e) }); });
    return () => { live = false; };
  }, [projectId, version]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const checked = checkSupportPeriod(form);
    if (!checked.ok) { setErrors(checked.errors as Record<string, string>); return; }
    setErrors({});
    try {
      await addSupportPeriod({ project_id: projectId, ...checked.value });
      setForm({ plan_name: "", starts_on: "", ends_on: "", terms: "" });
      setVersion((v) => v + 1);
      setMsg({ kind: "ok", text: "Support period added." });
    } catch (err) {
      setMsg({ kind: "error", text: errText(err) });
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Support periods</h3>
      <ul className="a-list">
        {(periods ?? []).map((p) => (
          <li key={p.id} className="a-row">
            <span><strong>{p.plan_name}</strong> · {formatDate(p.starts_on)} to {formatDate(p.ends_on)}</span>
          </li>
        ))}
        {periods?.length === 0 && <li className="a-muted">No support periods yet.</li>}
      </ul>
      <form onSubmit={add} noValidate className="a-grid" style={{ marginTop: 12 }}>
        <label htmlFor="s-plan">Plan name<input id="s-plan" value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} /></label>
        {errors.plan_name && <p className="a-error" role="alert">{errors.plan_name}</p>}
        <label htmlFor="s-start">Starts<input id="s-start" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} /></label>
        {errors.starts_on && <p className="a-error" role="alert">{errors.starts_on}</p>}
        <label htmlFor="s-end">Ends<input id="s-end" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} /></label>
        {errors.ends_on && <p className="a-error" role="alert">{errors.ends_on}</p>}
        <label htmlFor="s-terms">Terms the client sees (optional)<textarea id="s-terms" rows={2} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></label>
        <div><button type="submit" className="a-btn a-btn--quiet">Add support period</button></div>
      </form>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
    </div>
  );
}
