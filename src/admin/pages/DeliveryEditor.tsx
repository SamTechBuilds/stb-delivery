import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  getDelivery, listAssets, listLinks, listSupportPeriods, recentEvents, setStatus, updateDelivery,
  type AssetRecord, type DeliveryRecord, type EventRecord, type SupportPeriodRecord, type TokenRecord,
} from "../data";
import { buildPatch, formFromRecord, isDirty, type EditorForm, type FormErrors } from "../lib/editor";
import { visibilityLabel } from "../lib/stats";
import { friendlyError } from "../lib/errors";
import { ConfirmButton, Notice, PageHead, StatusChip, formatDate } from "../ui";
import { BuilderPanel } from "./DeliveryBuilder";
import { ActivityPanel, FilesPanel, LinksPanel, PreviewPanel } from "./DeliveryTools";

type Tab = "details" | "builder" | "files" | "links" | "preview" | "activity";
const TABS: { id: Tab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "builder", label: "Builder" },
  { id: "files", label: "Screens and files" },
  { id: "links", label: "Private links" },
  { id: "preview", label: "Preview" },
  { id: "activity", label: "Activity" },
];

interface Loaded {
  record: DeliveryRecord;
  saved: EditorForm;
  assets: AssetRecord[];
  links: TokenRecord[];
  events: EventRecord[];
  periods: SupportPeriodRecord[];
}

export function DeliveryEditor() {
  const { id = "" } = useParams();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<EditorForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [tab, setTab] = useState<Tab>("details");
  const [notice, setNotice] = useState<{ kind: "error" | "ok" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = useCallback(async (): Promise<Loaded> => {
    const record = await getDelivery(id);
    const [assets, links, events, periods] = await Promise.all([
      listAssets(id), listLinks(id), recentEvents(id), listSupportPeriods(record.project_id),
    ]);
    return { record, saved: formFromRecord(record), assets, links, events, periods };
  }, [id]);

  const apply = useCallback((l: Loaded) => {
    setLoaded(l);
    setForm(l.saved);
    setLoadError(null);
  }, []);

  const reload = useCallback(
    () => fetchAll().then(apply).catch((e) => setLoadError(friendlyError(e as { code?: string; message?: string }))),
    [fetchAll, apply],
  );

  useEffect(() => {
    let live = true;
    fetchAll()
      .then((l) => { if (live) apply(l); })
      .catch((e) => { if (live) setLoadError(friendlyError(e as { code?: string; message?: string })); });
    return () => { live = false; };
  }, [fetchAll, apply]);

  const dirty = useMemo(() => (loaded && form ? isDirty(loaded.saved, form) : false), [loaded, form]);

  if (loadError) return <Notice kind="error">{loadError} <Link to="/admin/deliveries">Back to deliveries</Link></Notice>;
  if (!loaded || !form) return <p className="a-muted" role="status">Loading delivery…</p>;

  const { record } = loaded;
  const update = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function save(): Promise<boolean> {
    if (!form) return false;
    const built = buildPatch(form);
    if (!built.ok) {
      setErrors(built.errors);
      setNotice({ kind: "error", text: "Fix the highlighted fields, then save again." });
      return false;
    }
    setBusy(true);
    try {
      await updateDelivery(id, built.patch);
      setNotice({ kind: "ok", text: "Saved." });
      await reload();
      return true;
    } catch (e) {
      setNotice({ kind: "error", text: friendlyError(e as { code?: string; message?: string }) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: "draft" | "published" | "archived") {
    setBusy(true);
    try {
      await setStatus(id, next);
      const words = { draft: "Moved to drafts. The public page is closed.", published: "Published. The public page is live.", archived: "Archived. The public page is closed. Private links are kept and work again once restored and published." };
      setNotice({ kind: "ok", text: words[next] });
      await reload();
    } catch (e) {
      setNotice({ kind: "error", text: friendlyError(e as { code?: string; message?: string }) });
    } finally {
      setBusy(false);
    }
  }

  const publishBlocked = dirty || busy || record.status === "archived" || !buildPatch(form).ok;
  const visibility = visibilityLabel({
    id: record.id,
    status: record.status,
    slug: record.slug,
    delivery_tokens: loaded.links.map((l) => ({ kind: l.kind, revoked_at: l.revoked_at, expires_at: l.expires_at })),
  });

  return (
    <div>
      <PageHead
        title={record.project_title}
        lead={`${record.client_display_name} · ${visibility}`}
        actions={
          <>
            <StatusChip status={record.status} />
            <button type="button" className="a-btn a-btn--quiet" disabled={!dirty || busy} onClick={() => void save()}>Save changes</button>
            {record.status === "draft" && (
              <button type="button" className="a-btn" disabled={publishBlocked} title={dirty ? "Save your changes before publishing." : undefined} onClick={() => void changeStatus("published")}>Publish</button>
            )}
            {record.status === "published" && (
              <button type="button" className="a-btn" disabled={busy} onClick={() => void changeStatus("draft")}>Unpublish</button>
            )}
            {record.status === "archived" && (
              <button type="button" className="a-btn" disabled={busy} onClick={() => void changeStatus("draft")}>Restore to drafts</button>
            )}
            {record.status !== "archived" && (
              <ConfirmButton label="Archive" confirmLabel="Archive (links are kept)" disabled={busy} onConfirm={() => changeStatus("archived")} />
            )}
          </>
        }
      />

      {dirty && <Notice kind="info">You have unsaved changes. Publishing is available after you save.</Notice>}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <div role="tablist" aria-label="Delivery sections" className="a-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`a-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "details" && (
          <DetailsPanel form={form} errors={errors} periods={loaded.periods} update={update} />
        )}
        {tab === "builder" && (
          <BuilderPanel form={form} errors={errors} update={update} />
        )}
        {tab === "files" && <FilesPanel deliveryId={id} assets={loaded.assets} onChanged={reload} />}
        {tab === "links" && <LinksPanel deliveryId={id} links={loaded.links} status={record.status} onChanged={reload} />}
        {tab === "preview" && <PreviewPanel deliveryId={id} dirty={dirty} />}
        {tab === "activity" && <ActivityPanel events={loaded.events} />}
      </div>

      <p className="a-muted" style={{ marginTop: 24, fontSize: 13 }}>
        Last updated {formatDate(record.updated_at)}.
      </p>
    </div>
  );
}

function DetailsPanel({ form, errors, periods, update }: {
  form: EditorForm; errors: FormErrors; periods: SupportPeriodRecord[];
  update: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
}) {
  const field = (key: keyof EditorForm) => ({
    id: `f-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `e-${key}` : undefined,
  });
  const err = (key: keyof EditorForm) => errors[key] && <p className="a-error" id={`e-${key}`} role="alert">{errors[key]}</p>;

  return (
    <div className="a-panel">
      <h2>Client and project</h2>
      <div className="a-grid">
        <label htmlFor="f-client_display_name">Client name
          <input {...field("client_display_name")} value={form.client_display_name} onChange={(e) => update("client_display_name", e.target.value)} />
        </label>
        {err("client_display_name")}
        <label htmlFor="f-business_display_name">Business name (optional)
          <input {...field("business_display_name")} value={form.business_display_name} onChange={(e) => update("business_display_name", e.target.value)} />
        </label>
        <label htmlFor="f-project_title">Project title
          <input {...field("project_title")} value={form.project_title} onChange={(e) => update("project_title", e.target.value)} />
        </label>
        {err("project_title")}
        <label htmlFor="f-project_summary">Summary shown to the client
          <textarea {...field("project_summary")} rows={4} value={form.project_summary} onChange={(e) => update("project_summary", e.target.value)} />
        </label>
        <label htmlFor="f-live_url">Live address
          <input {...field("live_url")} inputMode="url" value={form.live_url} onChange={(e) => update("live_url", e.target.value)} />
        </label>
        {err("live_url")}
        <label htmlFor="f-tech_text">Technologies (comma separated)
          <input {...field("tech_text")} value={form.tech_text} onChange={(e) => update("tech_text", e.target.value)} />
        </label>
        {err("tech_text")}
        <label htmlFor="f-completed_on">Completed on
          <input {...field("completed_on")} type="date" value={form.completed_on} onChange={(e) => update("completed_on", e.target.value)} />
        </label>
        {err("completed_on")}
        <label htmlFor="f-support_period_id">Support plan
          <select {...field("support_period_id")} value={form.support_period_id} onChange={(e) => update("support_period_id", e.target.value)}>
            <option value="">No support plan</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.plan_name} ({formatDate(p.starts_on)} to {formatDate(p.ends_on)})</option>
            ))}
          </select>
        </label>
      </div>
      <p className="a-muted" style={{ fontSize: 13 }}>
        Only these fields reach the client page. Internal notes, budgets and contact details live on the client and project records and are never sent.
      </p>
      <h2>Slug</h2>
      <label htmlFor="f-slug">Public address (leave empty for a private link only)
        <input {...field("slug")} value={form.slug} onChange={(e) => update("slug", e.target.value)} />
      </label>
      {err("slug")}
      <p className="a-muted" style={{ fontSize: 13 }}>
        Public pages sit at your site address followed by this slug. Reserved words such as admin are refused.
      </p>
    </div>
  );
}
