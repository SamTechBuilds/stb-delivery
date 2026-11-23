import { useState, type ReactNode } from "react";

export function PageHead({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <div className="a-page-head">
      <div>
        <h1>{title}</h1>
        {lead && <p className="a-muted">{lead}</p>}
      </div>
      {actions && <div className="a-actions">{actions}</div>}
    </div>
  );
}

export function StatusChip({ status }: { status: "draft" | "published" | "archived" }) {
  const map = {
    draft: { label: "Draft", cls: "a-chip--draft" },
    published: { label: "Published", cls: "a-chip--live" },
    archived: { label: "Archived", cls: "a-chip--archived" },
  } as const;
  return <span className={`a-chip ${map[status].cls}`}>{map[status].label}</span>;
}

/** A two-step button for anything that removes or revokes something. No browser dialogs. */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled }: {
  label: string; confirmLabel: string; onConfirm: () => void | Promise<void>; disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return <button type="button" className="a-btn a-btn--danger a-btn--small" disabled={disabled} onClick={() => setArmed(true)}>{label}</button>;
  }
  return (
    <span className="a-actions">
      <button type="button" className="a-btn a-btn--danger a-btn--small" onClick={() => { setArmed(false); void onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="a-btn a-btn--quiet a-btn--small" onClick={() => setArmed(false)}>Keep it</button>
    </span>
  );
}

export function Notice({ kind, children }: { kind: "error" | "ok" | "info"; children: ReactNode }) {
  if (kind === "error") return <p className="a-error" role="alert">{children}</p>;
  if (kind === "ok") return <p className="a-banner a-banner--ok" role="status">{children}</p>;
  return <p className="a-banner" role="status">{children}</p>;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function origin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}
