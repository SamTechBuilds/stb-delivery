import { useEffect, useState } from "react";
import { Link } from "react-router";
import { listDeliveries, recentEvents, type DeliveryListRow, type EventRecord } from "../data";
import { summarise, visibilityLabel } from "../lib/stats";
import { publicUrl } from "../lib/slugs";
import { friendlyError } from "../lib/errors";
import { PageHead, StatusChip, formatWhen, origin } from "../ui";

export function Dashboard() {
  const [rows, setRows] = useState<DeliveryListRow[] | null>(null);
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([listDeliveries(), recentEvents(undefined, 8)])
      .then(([d, e]) => { if (live) { setRows(d); setEvents(e); } })
      .catch((e) => { if (live) setError(friendlyError(e)); });
    return () => { live = false; };
  }, []);

  const summary = rows ? summarise(rows) : null;
  const titleFor = new Map((rows ?? []).map((r) => [r.id, `${r.client_display_name}, ${r.project_title}`]));

  return (
    <>
      <PageHead
        title="Dashboard"
        lead="Every client delivery, its visibility, and what clients have opened."
        actions={<Link className="a-btn a-btn--primary" to="/admin/deliveries/new">New delivery</Link>}
      />
      {error && <p className="a-error" role="alert">{error}</p>}

      <section className="a-stats" aria-label="Delivery totals">
        <Stat label="Total deliveries" value={summary?.total} />
        <Stat label="Drafts" value={summary?.draft} />
        <Stat label="Published" value={summary?.published} />
        <Stat label="Private links active" value={summary?.privateLinks} />
        <Stat label="Archived" value={summary?.archived} />
      </section>

      {rows && rows.length === 0 && (
        <div className="a-panel">
          <h2>Start your first delivery</h2>
          <p className="a-muted">A delivery is a client's project page, prepared as a draft. Nothing is public until you publish it.</p>
          <Link className="a-btn a-btn--primary" to="/admin/deliveries/new">Create a delivery</Link>
        </div>
      )}

      <div className="a-grid a-grid--2">
        <section className="a-panel" aria-labelledby="recent-h">
          <h2 id="recent-h">Recent deliveries</h2>
          {rows === null && !error && <p className="a-muted" role="status">Loading…</p>}
          {rows && rows.length > 0 && (
            <ul className="a-list">
              {rows.slice(0, 8).map((r) => (
                <li key={r.id}>
                  <div className="a-actions" style={{ justifyContent: "space-between" }}>
                    <Link to={`/admin/deliveries/${r.id}`}><strong>{r.project_title}</strong></Link>
                    <StatusChip status={r.status} />
                  </div>
                  <p className="a-muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
                    {r.client_display_name} · {visibilityLabel(r)}
                    {r.slug && r.status === "published" && (
                      <> · <a href={publicUrl(r.slug, origin())} target="_blank" rel="noopener noreferrer">{`/${r.slug}`}</a></>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="a-panel" aria-labelledby="activity-h">
          <h2 id="activity-h">Recent activity</h2>
          {events === null && !error && <p className="a-muted" role="status">Loading…</p>}
          {events && events.length === 0 && <p className="a-muted">Nothing yet. Activity appears once a client opens a page or a file.</p>}
          {events && events.length > 0 && (
            <ul className="a-list">
              {events.map((e) => (
                <li key={e.id}>
                  <span>{e.event === "opened" ? "Page opened" : "File download requested"}</span>
                  <span className="a-muted"> · {titleFor.get(e.delivery_id) ?? "A delivery"} · {formatWhen(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="a-stat">
      <strong>{value ?? "–"}</strong>
      <span>{label}</span>
    </div>
  );
}
