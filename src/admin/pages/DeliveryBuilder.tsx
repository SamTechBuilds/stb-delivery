import { useState } from "react";
import { saveTemplate } from "../data";
import { checklistFromText, checklistToText, type EditorForm, type FormErrors, type Theme } from "../lib/editor";
import { SECTION_LABELS, moveSection, setVisible } from "../lib/layout";
import { friendlyError } from "../lib/errors";
import { Notice } from "../ui";

type Update = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;

const THEMES: { value: Theme; label: string; note: string }[] = [
  { value: "midnight", label: "Midnight", note: "Dark, for technical projects" },
  { value: "aurora", label: "Aurora", note: "Cool gradient, for launches" },
  { value: "ivory", label: "Ivory", note: "Light and paper-like, for print-minded clients" },
];

export function BuilderPanel({ form, errors, update }: {
  form: EditorForm; errors: FormErrors; update: Update;
}) {
  return (
    <div className="a-builder">
      <SectionsEditor form={form} update={update} />

      <div className="a-panel">
        <h2>Theme</h2>
        <fieldset className="a-theme-group">
          <legend className="a-sr">Theme</legend>
          {THEMES.map((t) => (
            <label key={t.value} className={`a-theme${form.theme === t.value ? " is-selected" : ""}`}>
              <input type="radio" name="theme" value={t.value} checked={form.theme === t.value} onChange={() => update("theme", t.value)} />
              <span className={`a-swatch a-swatch--${t.value}`} aria-hidden="true" />
              <strong>{t.label}</strong>
              <span className="a-muted">{t.note}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="a-panel">
        <h2>Gift and reveal</h2>
        <label className="a-check">
          <input type="checkbox" checked={form.reveal_gift} onChange={(e) => update("reveal_gift", e.target.checked)} />
          Show the gift box before the project
        </label>
        <p className="a-muted" style={{ fontSize: 13 }}>When off, the client opens straight onto the project.</p>
      </div>

      <div className="a-panel">
        <h2>Text the client sees</h2>
        <div className="a-grid">
          <label htmlFor="f-welcome_title">Welcome title
            <input id="f-welcome_title" value={form.welcome_title} onChange={(e) => update("welcome_title", e.target.value)} />
          </label>
          <label htmlFor="f-welcome_message">Welcome message
            <textarea id="f-welcome_message" rows={3} value={form.welcome_message} onChange={(e) => update("welcome_message", e.target.value)} />
          </label>
          <label htmlFor="f-video_url">Walkthrough video link
            <input id="f-video_url" inputMode="url" value={form.video_url} onChange={(e) => update("video_url", e.target.value)} aria-invalid={errors.video_url ? true : undefined} />
          </label>
          {errors.video_url && <p className="a-error" role="alert">{errors.video_url}</p>}
          <label htmlFor="f-checklist">Handover checklist (one item per line)
            <textarea
              id="f-checklist"
              rows={4}
              value={checklistToText(form.checklist)}
              onChange={(e) => update("checklist", checklistFromText(e.target.value, form.checklist))}
              aria-invalid={errors.checklist ? true : undefined}
            />
          </label>
          {errors.checklist && <p className="a-error" role="alert">{errors.checklist}</p>}
          <label htmlFor="f-support_contact_note">Support note
            <textarea id="f-support_contact_note" rows={2} value={form.support_contact_note} onChange={(e) => update("support_contact_note", e.target.value)} />
          </label>
          <label htmlFor="f-closing_message">Closing message
            <textarea id="f-closing_message" rows={2} value={form.closing_message} onChange={(e) => update("closing_message", e.target.value)} />
          </label>
        </div>
      </div>

      <TemplateSaver form={form} />
      <p className="a-muted" style={{ fontSize: 13, marginTop: 16 }}>
        The preview on the Preview tab shows the last saved version. Save your changes, then refresh the preview.
      </p>
    </div>
  );
}

function SectionsEditor({ form, update }: { form: EditorForm; update: Update }) {
  const layout = form.section_layout;
  const setLayout = (next: EditorForm["section_layout"]) => update("section_layout", next);

  return (
    <div className="a-panel">
      <h2>Sections</h2>
      <p className="a-muted" style={{ fontSize: 13 }}>
        Hidden sections are left out of the client page entirely. Order is the order the client scrolls.
      </p>
      <ol className="a-sections" aria-label="Section order">
        {layout.map((item, index) => {
          const label = SECTION_LABELS[item.key].title;
          return (
            <li key={item.key} className="a-section-row">
              <label className="a-check">
                <input
                  type="checkbox"
                  checked={item.visible}
                  onChange={(e) => setLayout(setVisible(layout, item.key, e.target.checked))}
                  aria-label={`Show ${label}`}
                />
                <strong>{label}</strong>
              </label>
              <span className="a-muted" style={{ fontSize: 13 }}>{SECTION_LABELS[item.key].hint}</span>
              <span className="a-actions">
                <button type="button" className="a-btn a-btn--quiet a-btn--small" disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => setLayout(moveSection(layout, item.key, -1))}>Up</button>
                <button type="button" className="a-btn a-btn--quiet a-btn--small" disabled={index === layout.length - 1} aria-label={`Move ${label} down`} onClick={() => setLayout(moveSection(layout, item.key, 1))}>Down</button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TemplateSaver({ form }: { form: EditorForm }) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed.length > 80) {
      setNotice({ kind: "error", text: "Name the template, using 80 characters or fewer." });
      return;
    }
    setSaving(true);
    try {
      await saveTemplate({
        name: trimmed,
        description: null,
        theme: form.theme,
        section_layout: form.section_layout,
        reveal_gift: form.reveal_gift,
        welcome_title: form.welcome_title.trim() || null,
        welcome_message: form.welcome_message.trim() || null,
        support_contact_note: form.support_contact_note.trim() || null,
        closing_message: form.closing_message.trim() || null,
      });
      setNotice({ kind: "ok", text: `Saved "${trimmed}" as a template. Templates hold no client details.` });
      setName("");
    } catch (e) {
      setNotice({ kind: "error", text: friendlyError(e as { code?: string; message?: string }) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="a-panel">
      <h2>Save as template</h2>
      <p className="a-muted" style={{ fontSize: 13 }}>Keeps the theme, section order, gift setting and the text above. Client and project details are left out.</p>
      <div className="a-actions">
        <label htmlFor="tpl-name" className="a-sr">Template name</label>
        <input id="tpl-name" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="a-btn a-btn--quiet" disabled={saving} onClick={() => void save()}>Save template</button>
      </div>
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
    </div>
  );
}
