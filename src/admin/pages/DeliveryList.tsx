import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { listDeliveries, type DeliveryListRow } from "../data";
import { visibilityLabel } from "../lib/stats";
import { publicUrl } from "../lib/slugs";
import { friendlyError } from "../lib/errors";
import { PageHead, StatusChip, formatDate, origin } from "../ui";

type Filter = "all" | "draft" | "published" | "archived";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function DeliveryList() {
  const [rows, setRows] = useState<DeliveryListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    listDeliveries()
      .then((d) => { if (live) setRows(d); })
      .catch((e) => { if (live) setError(friendlyError(e)); });
    return () => { live = false; };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => (filter === "all" || r.status === filter)
      && (!q || `${r.client_display_name} ${r.business_display_name ?? ""} ${r.project_title} ${r.slug ?? ""}`.toLowerCase().includes(q)));
  }, [rows, filter, query]);

  return (
    <>
      <PageHead
        title="Deliveries"
        lead="Each delivery is one client's project page. Drafts stay private until you publish them."
        actions={<Link className="a-btn a-btn--primary" to="/admin/deliveries/new">New delivery</Link>}
      />
      <div className="a-actions" style={{ marginBottom: 12 }}>
        <div className="a-tabs" role="tablist" aria-label="Filter by status" style={{ border: 0, margin: 0 }}>
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} className="a-tab"
              onClick={() => setFilter(f.value)}>{f.label}</button>
          ))}
        </div>
        <label className="a-field" style={{ minWidth: 220 }}>
          <span className="sr-only">Search deliveries</span>
          <input type="search" placeholder="Search client, project or link" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <p className="a-error" role="alert">{error}</p>}
      {rows === null && !error && <p className="a-muted" role="status">Loading…</p>}
      {rows && shown.length === 0 && <p className="a-muted">No deliveries match. {rows.length === 0 ? "Create your first one to get started." : "Try another filter."}</p>}

      {shown.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="a-table">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Project</th>
                <th scope="col">Status</th>
                <th scope="col">Visibility</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>{r.client_display_name}</td>
                  <td><Link to={`/admin/deliveries/${r.id}`}>{r.project_title}</Link></td>
                  <td><StatusChip status={r.status} /></td>
                  <td>
                    {visibilityLabel(r)}
                    {r.slug && r.status === "published" && (
                      <div><a href={publicUrl(r.slug, origin())} target="_blank" rel="noopener noreferrer">{`/${r.slug}`}</a></div>
                    )}
                  </td>
                  <td>{formatDate(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
