import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { createDelivery, getProjectForCopy, listProjectsWithClients, listTemplates, type TemplateRecord } from "../data";
import { draftFromProject, applyTemplate, type NewDeliveryDraft } from "../lib/prefill";
import { friendlyError, type DbErrorLike } from "../lib/errors";
import { PageHead, Notice } from "../ui";

/**
 * Creates a draft. The database starts every new delivery as a draft regardless of what is sent,
 * so this screen cannot publish anything.
 */
export function NewDelivery() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<{ id: string; name: string; clientName: string }[] | null>(null);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [projectId, setProjectId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState<NewDeliveryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([listProjectsWithClients(), listTemplates()])
      .then(([p, t]) => {
        if (!live) return;
        setProjects(p.map((x) => ({ id: x.id, name: x.name, clientName: x.clients?.name ?? "Unknown client" })));
        setTemplates(t);
      })
      .catch((e) => { if (live) setError(friendlyError(e as DbErrorLike)); });
    return () => { live = false; };
  }, []);

  const buildDraft = async (pid: string, tid: string): Promise<NewDeliveryDraft | null> => {
    if (!pid) return null;
    const project = await getProjectForCopy(pid);
    if (!project.clients) return null;
    let draft = draftFromProject(project, project.clients);
    const t = templates.find((x) => x.id === tid);
    if (t) draft = applyTemplate(draft, t);
    return draft;
  };

  const choose = async (pid: string, tid: string) => {
    setError(null);
    try {
      setPreview(await buildDraft(pid, tid));
    } catch (e) {
      setError(friendlyError(e as DbErrorLike));
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const draft = await buildDraft(projectId, templateId);
      if (!draft) throw new Error("no project");
      const id = await createDelivery(draft);
      navigate(`/admin/deliveries/${id}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e as DbErrorLike));
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="New delivery" lead="Choose the project. Its client-facing details are copied in as a draft. Nothing internal is copied." />
      {error && <Notice kind="error">{error}</Notice>}

      {projects && projects.length === 0 && (
        <div className="a-panel">
          <p>You need a project before you can create a delivery.</p>
          <Link className="a-btn a-btn--primary" to="/admin/clients">Add a client and project</Link>
        </div>
      )}

      {projects && projects.length > 0 && (
        <form className="a-form a-form--wide" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <label className="a-field">
            <span>Project</span>
            <select required value={projectId} onChange={(e) => { setProjectId(e.target.value); void choose(e.target.value, templateId); }}>
              <option value="">Choose a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.clientName}: {p.name}</option>)}
            </select>
          </label>

          <label className="a-field">
            <span>Start from a template</span>
            <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); void choose(projectId, e.target.value); }}>
              <option value="">No template: default sections and theme</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <small>Templates set the layout, theme and general wording. They never add client details.</small>
          </label>

          {preview && (
            <section className="a-panel" aria-label="What the draft will contain">
              <h2>The draft will start with</h2>
              <ul className="a-list">
                <li>Client: {preview.client_display_name}{preview.business_display_name ? `, ${preview.business_display_name}` : ""}</li>
                <li>Project: {preview.project_title}</li>
                <li>Live address: {preview.live_url ?? "none yet"}</li>
                <li>Built with: {preview.tech_list.length ? preview.tech_list.join(", ") : "none listed"}</li>
              </ul>
              <p className="a-muted">You can change everything before publishing.</p>
            </section>
          )}

          <div className="a-actions">
            <button type="submit" className="a-btn a-btn--primary" disabled={busy || !projectId}>
              {busy ? "Creating…" : "Create draft"}
            </button>
            <Link className="a-btn a-btn--quiet" to="/admin/deliveries">Cancel</Link>
          </div>
        </form>
      )}
    </>
  );
}
