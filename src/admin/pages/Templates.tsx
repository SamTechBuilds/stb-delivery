import { useEffect, useState } from "react";
import { deleteTemplate, listTemplates, saveTemplate, type TemplateRecord } from "../data";
import { friendlyError } from "../lib/errors";
import { ConfirmButton, Notice, PageHead } from "../ui";

type Msg = { kind: "error" | "ok"; text: string } | null;

/**
 * Templates hold layout and wording only. They are copied into a new delivery as a draft, and
 * they never hold client, project or contact details. Editing a template does not change deliveries
 * that were already created from it.
 */
export function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRecord[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<TemplateRecord | "new" | null>(null);

  useEffect(() => {
    let live = true;
    listTemplates()
      .then((t) => { if (live) setTemplates(t); })
      .catch((e) => { if (live) setMsg({ kind: "error", text: friendlyError(e as { code?: string; message?: string }) }); });
    return () => { live = false; };
  }, [version]);

  async function remove(t: TemplateRecord) {
    try {
      await deleteTemplate(t.id);
      setMsg({ kind: "ok", text: `Deleted "${t.name}". Deliveries made from it are unchanged.` });
      setVersion((v) => v + 1);
    } catch (e) {
      setMsg({ kind: "error", text: friendlyError(e as { code?: string; message?: string }) });
    }
  }

  return (
    <div>
      <PageHead
        title="Templates"
        lead="Reusable wording, theme and section order for new deliveries. Templates never hold client details."
        actions={<button type="button" className="a-btn" onClick={() => setEditing("new")}>New template</button>}
      />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="a-panel">
        {templates?.length === 0 && <p className="a-muted">No templates yet. Create one here, or use Save as template in a delivery's Builder.</p>}
        <ul className="a-list">
          {(templates ?? []).map((t) => (
            <li key={t.id} className="a-row">
              <div>
                <strong>{t.name}</strong>
                <p className="a-muted" style={{ fontSize: 13, margin: "2px 0 0" }}>
                  {t.theme} theme · {t.reveal_gift ? "gift box on" : "gift box off"} · {t.section_layout.filter((s) => s.visible).length} sections shown
                </p>
              </div>
              <div className="a-actions">
                <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => setEditing(t)}>Edit</button>
                <ConfirmButton label="Delete" confirmLabel="Delete template" onConfirm={() => remove(t)} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      {editing && (
        <TemplateEditor
          key={editing === "new" ? "new" : editing.id}
          template={editing === "new" ? null : editing}
          onDone={(text) => { setEditing(null); setMsg({ kind: "ok", text }); setVersion((v) => v + 1); }}
          onError={(text) => setMsg({ kind: "error", text })}
        />
      )}
    </div>
  );
}

function TemplateEditor({ template, onDone, onError }: {
  template: TemplateRecord | null;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [theme, setTheme] = useState<TemplateRecord["theme"]>(template?.theme ?? "midnight");
  const [reveal, setReveal] = useState(template?.reveal_gift ?? true);
  const [welcomeTitle, setWelcomeTitle] = useState(template?.welcome_title ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(template?.welcome_message ?? "");
  const [supportNote, setSupportNote] = useState(template?.support_contact_note ?? "");
  const [closing, setClosing] = useState(template?.closing_message ?? "");
  const [layout] = useState(template?.section_layout ?? [
    { key: "walkthrough" as const, visible: true }, { key: "screens" as const, visible: true },
    { key: "handover" as const, visible: true }, { key: "support" as const, visible: true }, { key: "card" as const, visible: true },
  ]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed.length > 80) { onError("Name the template, using 80 characters or fewer."); return; }
    setSaving(true);
    try {
      await saveTemplate({
        id: template?.id,
        name: trimmed,
        description: null,
        theme,
        section_layout: layout,
        reveal_gift: reveal,
        welcome_title: welcomeTitle.trim() || null,
        welcome_message: welcomeMessage.trim() || null,
        support_contact_note: supportNote.trim() || null,
        closing_message: closing.trim() || null,
      });
      onDone(`Saved "${trimmed}".`);
    } catch (e) {
      onError(friendlyError(e as { code?: string; message?: string }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="a-panel" style={{ marginTop: 16 }}>
      <h2>{template ? `Edit ${template.name}` : "New template"}</h2>
      <p className="a-muted" style={{ fontSize: 13 }}>
        Section order and visibility can be set in a delivery's Builder, then saved as a template there.
        Here you set the wording, theme and gift setting.
      </p>
      <div className="a-grid">
        <label htmlFor="t-name">Name<input id="t-name" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label htmlFor="t-theme">Theme
          <select id="t-theme" value={theme} onChange={(e) => setTheme(e.target.value as TemplateRecord["theme"])}>
            <option value="midnight">Midnight</option>
            <option value="aurora">Aurora</option>
            <option value="ivory">Ivory</option>
          </select>
        </label>
        <label className="a-check"><input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Show the gift box</label>
        <label htmlFor="t-wt">Welcome title<input id="t-wt" value={welcomeTitle} onChange={(e) => setWelcomeTitle(e.target.value)} /></label>
        <label htmlFor="t-wm">Welcome message<textarea id="t-wm" rows={3} value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} /></label>
        <label htmlFor="t-sn">Support note<textarea id="t-sn" rows={2} value={supportNote} onChange={(e) => setSupportNote(e.target.value)} /></label>
        <label htmlFor="t-cm">Closing message<textarea id="t-cm" rows={2} value={closing} onChange={(e) => setClosing(e.target.value)} /></label>
      </div>
      <button type="button" className="a-btn" disabled={saving} onClick={() => void save()}>Save template</button>
    </div>
  );
}
