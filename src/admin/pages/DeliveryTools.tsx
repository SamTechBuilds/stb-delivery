import { useState } from "react";
import {
  addAsset, addGiftItem, deleteAsset, deleteGiftItem, issueLink, revokeLink, signAsset, updateAsset,
  type AssetRecord, type EventRecord, type GiftItemRecord, type TokenRecord,
} from "../data";
import { privateLink, randomToken, sha256Hex, tokenHint } from "../lib/tokens";
import { friendlyError } from "../lib/errors";
import { ConfirmButton, Notice, formatDate, formatWhen, origin } from "../ui";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const PREVIEW_MINUTES = 60;
const ZIP_TYPES = ["application/zip", "application/x-zip-compressed", "application/x-zip", "application/octet-stream"];
type Msg = { kind: "error" | "ok" | "info"; text: string } | null;
const errText = (e: unknown) => friendlyError(e as { code?: string; message?: string });

/* ——— Screens and files ——— */

export function FilesPanel({ deliveryId, assets, onChanged }: {
  deliveryId: string; assets: AssetRecord[]; onChanged: () => Promise<void>;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"screenshot" | "document">("screenshot");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [progress, setProgress] = useState("");

  const sorted = [...assets].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

  function isZipFile(f: File): boolean {
    return ZIP_TYPES.includes(f.type) || f.name.toLowerCase().endsWith(".zip");
  }

  function checkFile(f: File): string | null {
    if (f.size === 0) return `"${f.name}" is empty.`;
    if (f.size > MAX_FILE_BYTES) return `"${f.name}" exceeds 50 MB.`;
    if (kind === "screenshot" && !f.type.startsWith("image/") && !isZipFile(f)) {
      return `"${f.name}" must be an image (PNG, JPEG, WebP) or a ZIP archive.`;
    }
    return null;
  }

  async function upload() {
    if (files.length === 0) { setMsg({ kind: "error", text: "Choose one or more files to upload." }); return; }
    // For single file, title is required; for bulk, we auto-name
    if (files.length === 1 && title.trim() === "") { setMsg({ kind: "error", text: "Give the file a title." }); return; }

    // Validate all files first
    for (const f of files) {
      const problem = checkFile(f);
      if (problem) { setMsg({ kind: "error", text: problem }); return; }
    }

    setBusy(true);
    let uploaded = 0;
    const total = files.length;
    try {
      let nextOrder = sorted.length ? Math.max(...sorted.map((a) => a.sort_order)) + 1 : 0;
      for (const f of files) {
        setProgress(`Uploading ${++uploaded} of ${total}: ${f.name}`);
        const fileTitle = files.length === 1
          ? title.trim().slice(0, 120)
          : f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120) || `File ${uploaded}`;
        await addAsset(deliveryId, {
          kind,
          title: fileTitle,
          description: files.length === 1 ? (description.trim() || null) : null,
          file: f,
          sortOrder: nextOrder++,
        });
      }
      const word = total === 1 ? "file" : `${total} files`;
      setMsg({ kind: "ok", text: `Uploaded ${word}. Visible to the client once the delivery is published.` });
      setTitle(""); setDescription(""); setFiles([]); setFileKey((k) => k + 1);
      await onChanged();
    } catch (e) {
      setMsg({ kind: "error", text: `${errText(e)} (${uploaded} of ${total} uploaded before the error)` });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function togglePublished(a: AssetRecord) {
    try { await updateAsset(a.id, { is_published: !a.is_published }); await onChanged(); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  async function move(a: AssetRecord, dir: -1 | 1) {
    const i = sorted.findIndex((x) => x.id === a.id);
    const other = sorted[i + dir];
    if (!other) return;
    try {
      await updateAsset(a.id, { sort_order: other.sort_order });
      await updateAsset(other.id, { sort_order: a.sort_order });
      await onChanged();
    } catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  async function remove(a: AssetRecord) {
    try { await deleteAsset(a); await onChanged(); setMsg({ kind: "ok", text: `Deleted "${a.title}".` }); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  async function open(a: AssetRecord) {
    try {
      const url = await signAsset(a.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  const fileAccept = kind === "screenshot"
    ? "image/*,.zip,application/zip,application/x-zip-compressed"
    : undefined;

  return (
    <div>
      <div className="a-panel">
        <h2>Add screens or documents</h2>
        <p className="a-muted" style={{ fontSize: 13 }}>
          Select multiple files for bulk upload. ZIP archives are accepted for both screens and documents.
        </p>
        <div className="a-grid">
          <label htmlFor="asset-kind">Type
            <select id="asset-kind" value={kind} onChange={(e) => setKind(e.target.value as "screenshot" | "document")}>
              <option value="screenshot">Screen</option>
              <option value="document">Handover document</option>
            </select>
          </label>
          {files.length <= 1 && (
            <>
              <label htmlFor="asset-title">Title{files.length > 0 ? "" : " (auto-named for bulk uploads)"}
                <input id="asset-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </label>
              <label htmlFor="asset-desc">Description (optional)
                <input id="asset-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
              </label>
            </>
          )}
          {files.length > 1 && (
            <p className="a-muted" style={{ fontSize: 13 }}>
              {files.length} files selected — each file is titled from its filename.
            </p>
          )}
          <label htmlFor="asset-file">Files (50 MB each, select multiple)
            <input
              key={fileKey}
              id="asset-file"
              type="file"
              multiple
              accept={fileAccept}
              onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
          </label>
        </div>
        <button type="button" className="a-btn" disabled={busy} onClick={() => void upload()}>
          {busy ? progress || "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
        </button>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </div>

      <div className="a-panel">
        <h2>In this delivery</h2>
        {sorted.length === 0 && <p className="a-muted">Nothing uploaded yet.</p>}
        <ul className="a-list">
          {sorted.map((a, i) => (
            <li key={a.id} className="a-row">
              <div>
                <strong>{a.title}</strong>{" "}
                <span className="a-chip">{a.kind === "screenshot" ? "Screen" : "Document"}</span>{" "}
                {!a.is_published && <span className="a-chip a-chip--draft">Hidden from client</span>}
                <p className="a-muted" style={{ fontSize: 13, margin: "2px 0 0" }}>
                  {a.file_name} · {(a.size_bytes / 1024 / 1024).toFixed(1)} MB
                  {a.description ? ` · ${a.description}` : ""}
                </p>
              </div>
              <div className="a-actions">
                <button type="button" className="a-btn a-btn--quiet a-btn--small" aria-label={`Move ${a.title} up`} disabled={i === 0} onClick={() => void move(a, -1)}>Up</button>
                <button type="button" className="a-btn a-btn--quiet a-btn--small" aria-label={`Move ${a.title} down`} disabled={i === sorted.length - 1} onClick={() => void move(a, 1)}>Down</button>
                <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => void open(a)}>Open</button>
                <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => void togglePublished(a)}>
                  {a.is_published ? "Hide from client" : "Show to client"}
                </button>
                <ConfirmButton label="Delete" confirmLabel="Delete file" onConfirm={() => remove(a)} />
              </div>
            </li>
          ))}
        </ul>
        <p className="a-muted" style={{ fontSize: 13 }}>Open creates a short-lived link (10 minutes) for you to check the file.</p>
      </div>
    </div>
  );
}

/* ——— Private links ——— */

const EXPIRY = [
  { value: "never", label: "Never expires", days: null as number | null },
  { value: "30", label: "Expires in 30 days", days: 30 },
  { value: "90", label: "Expires in 90 days", days: 90 },
] as const;

export function LinksPanel({ deliveryId, links, status, onChanged }: {
  deliveryId: string; links: TokenRecord[]; status: "draft" | "published" | "archived"; onChanged: () => Promise<void>;
}) {
  const [now] = useState(() => Date.now());
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState<(typeof EXPIRY)[number]["value"]>("never");
  const [fresh, setFresh] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function issue() {
    setBusy(true);
    try {
      const token = randomToken();
      const hash = await sha256Hex(token);
      const days = EXPIRY.find((x) => x.value === expiry)?.days ?? null;
      const expiresAt = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
      await issueLink(deliveryId, {
        tokenHash: hash, hint: tokenHint(token), kind: "client", label: label.trim() || null, expiresAt,
      });
      setFresh(privateLink(token, origin()));
      setLabel("");
      await onChanged();
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(t: TokenRecord) {
    try { await revokeLink(t.id); await onChanged(); setMsg({ kind: "ok", text: "Link revoked. It no longer opens the delivery." }); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  const clientLinks = links.filter((l) => l.kind === "client");

  return (
    <div>
      <div className="a-panel">
        <h2>Create a private link</h2>
        <p className="a-muted" style={{ fontSize: 13 }}>
          Each link is shown once, when you create it. Only a fingerprint is stored, so copy it now.
          {status !== "published" && " Links only open a delivery while it is published."}
        </p>
        <div className="a-grid">
          <label htmlFor="link-label">Label (optional, for you)
            <input id="link-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="For Ameer, sent by email" />
          </label>
          <label htmlFor="link-expiry">Expiry
            <select id="link-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value as (typeof EXPIRY)[number]["value"])}>
              {EXPIRY.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="a-btn" disabled={busy} onClick={() => void issue()}>Create link</button>
        {fresh && (
          <div className="a-banner a-banner--ok" role="status" style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 6px" }}>Copy this link now. It will not be shown again.</p>
            <input readOnly value={fresh} aria-label="New private link" style={{ width: "100%" }} onFocus={(e) => e.currentTarget.select()} />
            <div className="a-actions" style={{ marginTop: 6 }}>
              <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => void navigator.clipboard?.writeText(fresh)}>Copy link</button>
              <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => setFresh(null)}>I have copied it</button>
            </div>
          </div>
        )}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </div>

      <div className="a-panel">
        <h2>Links</h2>
        {clientLinks.length === 0 && <p className="a-muted">No private links yet.</p>}
        <ul className="a-list">
          {clientLinks.map((t) => {
            const revoked = Boolean(t.revoked_at);
            const expired = !revoked && t.expires_at !== null && new Date(t.expires_at).getTime() <= now;
            return (
              <li key={t.id} className="a-row">
                <div>
                  <strong>{t.label ?? "Client link"}</strong>{" "}
                  <span className="a-muted">…{t.token_hint}</span>
                  <p className="a-muted" style={{ fontSize: 13, margin: "2px 0 0" }}>
                    Created {formatDate(t.created_at)} · {t.expires_at ? `expires ${formatDate(t.expires_at)}` : "no expiry"} · opened {t.use_count} {t.use_count === 1 ? "time" : "times"}
                    {t.last_used_at ? ` · last ${formatWhen(t.last_used_at)}` : ""}
                  </p>
                </div>
                <div className="a-actions">
                  {revoked && <span className="a-chip a-chip--archived">Revoked</span>}
                  {expired && <span className="a-chip a-chip--archived">Expired</span>}
                  {!revoked && !expired && <ConfirmButton label="Revoke" confirmLabel="Revoke this link" onConfirm={() => revoke(t)} />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ——— Preview ——— */

export function PreviewPanel({ deliveryId, dirty }: { deliveryId: string; dirty: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [width, setWidth] = useState<1280 | 390>(1280);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const t = randomToken();
      await issueLink(deliveryId, {
        tokenHash: await sha256Hex(t),
        hint: tokenHint(t),
        kind: "preview",
        label: "Preview",
        expiresAt: new Date(Date.now() + PREVIEW_MINUTES * 60_000).toISOString(),
      });
      setToken(t);
      setMsg(null);
    } catch (e) {
      setMsg({ kind: "error", text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="a-panel">
        <div className="a-actions" style={{ justifyContent: "space-between" }}>
          <div role="group" aria-label="Preview width" className="a-actions">
            <button type="button" className="a-btn a-btn--quiet a-btn--small" aria-pressed={width === 1280} onClick={() => setWidth(1280)}>Desktop</button>
            <button type="button" className="a-btn a-btn--quiet a-btn--small" aria-pressed={width === 390} onClick={() => setWidth(390)}>Mobile</button>
          </div>
          <button type="button" className="a-btn" disabled={busy} onClick={() => void refresh()}>
            {token ? "Save and refresh preview" : "Load preview"}
          </button>
        </div>
        {dirty && <Notice kind="info">The preview shows the last saved version. Save your changes first.</Notice>}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <p className="a-muted" style={{ fontSize: 13 }}>
          The preview uses a one-hour link that only you can open, so it also works for drafts. It is not a client link.
        </p>
      </div>
      {token && (
        <div className="a-preview-frame" style={{ maxWidth: width, margin: "0 auto" }}>
          <iframe
            key={`${token}-${width}`}
            title="Client preview"
            src={`/#${token}`}
            style={{ width: "100%", height: "74vh", border: "1px solid var(--a-line, #d6d3cc)", borderRadius: 8, background: "#fff" }}
          />
        </div>
      )}
    </div>
  );
}

/* ——— Gift items ——— */

export function GiftItemsPanel({ deliveryId, items, onChanged }: {
  deliveryId: string; items: GiftItemRecord[]; onChanged: () => Promise<void>;
}) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [progress, setProgress] = useState("");

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);

  function checkFile(f: File): string | null {
    if (f.size === 0) return `"${f.name}" is empty.`;
    if (f.size > MAX_FILE_BYTES) return `"${f.name}" exceeds 50 MB.`;
    return null; // Any file type is accepted for gift items
  }

  async function upload() {
    if (files.length === 0) { setMsg({ kind: "error", text: "Choose one or more files." }); return; }
    if (files.length === 1 && title.trim() === "") { setMsg({ kind: "error", text: "Give the gift item a title." }); return; }

    for (const f of files) {
      const problem = checkFile(f);
      if (problem) { setMsg({ kind: "error", text: problem }); return; }
    }

    setBusy(true);
    let uploaded = 0;
    const total = files.length;
    try {
      let nextOrder = sorted.length ? Math.max(...sorted.map((a) => a.sort_order)) + 1 : 0;
      for (const f of files) {
        setProgress(`Uploading ${++uploaded} of ${total}: ${f.name}`);
        const fileTitle = files.length === 1
          ? title.trim().slice(0, 120)
          : f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 120) || `Gift ${uploaded}`;
        await addGiftItem(deliveryId, {
          title: fileTitle,
          description: files.length === 1 ? (description.trim() || null) : null,
          file: f,
          sortOrder: nextOrder++,
        });
      }
      const word = total === 1 ? "gift item" : `${total} gift items`;
      setMsg({ kind: "ok", text: `Added ${word}. They appear in the gift box when gift reveal is on.` });
      setTitle(""); setDescription(""); setFiles([]); setFileKey((k) => k + 1);
      await onChanged();
    } catch (e) {
      setMsg({ kind: "error", text: `${errText(e)} (${uploaded} of ${total} uploaded before the error)` });
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function remove(item: GiftItemRecord) {
    try { await deleteGiftItem(item); await onChanged(); setMsg({ kind: "ok", text: `Removed "${item.title}".` }); }
    catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  async function openItem(item: GiftItemRecord) {
    try {
      const url = await signAsset(item.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { setMsg({ kind: "error", text: errText(e) }); }
  }

  return (
    <div>
      <div className="a-panel">
        <h2>Add gift items</h2>
        <p className="a-muted" style={{ fontSize: 13 }}>
          Gift items appear inside the gift box when the client opens it. Any file type, any number.
          Select multiple files for bulk upload. ZIP archives are accepted.
        </p>
        <div className="a-grid">
          {files.length <= 1 && (
            <>
              <label htmlFor="gift-title">Title{files.length > 0 ? "" : " (auto-named for bulk uploads)"}
                <input id="gift-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
              </label>
              <label htmlFor="gift-desc">Description (optional)
                <input id="gift-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
              </label>
            </>
          )}
          {files.length > 1 && (
            <p className="a-muted" style={{ fontSize: 13 }}>
              {files.length} files selected — each is titled from its filename.
            </p>
          )}
          <label htmlFor="gift-file">Files (50 MB each, any type)
            <input
              key={fileKey}
              id="gift-file"
              type="file"
              multiple
              onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            />
          </label>
        </div>
        <button type="button" className="a-btn" disabled={busy} onClick={() => void upload()}>
          {busy ? progress || "Uploading…" : files.length > 1 ? `Upload ${files.length} items` : "Upload gift item"}
        </button>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </div>

      <div className="a-panel">
        <h2>Gift items in this delivery</h2>
        {sorted.length === 0 && <p className="a-muted">No gift items yet. Add files that appear inside the gift box.</p>}
        <ul className="a-list">
          {sorted.map((item) => (
            <li key={item.id} className="a-row">
              <div>
                <strong>{item.title}</strong>
                <p className="a-muted" style={{ fontSize: 13, margin: "2px 0 0" }}>
                  {item.file_name} · {(item.size_bytes / 1024 / 1024).toFixed(1)} MB
                  {item.description ? ` · ${item.description}` : ""}
                </p>
              </div>
              <div className="a-actions">
                <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => void openItem(item)}>Open</button>
                <ConfirmButton label="Remove" confirmLabel="Remove item" onConfirm={() => remove(item)} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ——— Activity ——— */

export function ActivityPanel({ events }: { events: EventRecord[] }) {
  if (events.length === 0) return <div className="a-panel"><p className="a-muted">Nothing yet. Activity appears once a client opens a page or a file.</p></div>;
  return (
    <div className="a-panel">
      <ul className="a-list">
        {events.map((e) => (
          <li key={e.id} className="a-row">
            <span>{e.event === "opened" ? "Page opened" : "File download requested"}</span>
            <span className="a-muted">{formatWhen(e.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
