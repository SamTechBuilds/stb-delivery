export interface TokenRow {
  kind: "client" | "preview";
  revoked_at: string | null;
  expires_at: string | null;
}

export interface DeliveryRow {
  id: string;
  status: "draft" | "published" | "archived";
  slug: string | null;
  delivery_tokens?: TokenRow[] | null;
}

export interface Summary {
  total: number;
  draft: number;
  published: number;
  archived: number;
  /** Published with a public slug page. */
  publicPages: number;
  /** Deliveries with at least one active private client link. */
  privateLinks: number;
}

/** A client link is active when it is not revoked and not past its expiry. Previews are not counted. */
export function isActiveLink(t: TokenRow, now: Date): boolean {
  if (t.kind !== "client" || t.revoked_at) return false;
  return !t.expires_at || new Date(t.expires_at).getTime() > now.getTime();
}

export function summarise(rows: DeliveryRow[], now = new Date()): Summary {
  const s: Summary = { total: rows.length, draft: 0, published: 0, archived: 0, publicPages: 0, privateLinks: 0 };
  for (const r of rows) {
    if (r.status === "draft") s.draft++;
    if (r.status === "published") s.published++;
    if (r.status === "archived") s.archived++;
    if (r.status === "published" && r.slug) s.publicPages++;
    if ((r.delivery_tokens ?? []).some((t) => isActiveLink(t, now))) s.privateLinks++;
  }
  return s;
}

/** Plain-language visibility for a delivery, used in lists and the editor. */
export function visibilityLabel(r: DeliveryRow, now = new Date()): string {
  const link = (r.delivery_tokens ?? []).some((t) => isActiveLink(t, now));
  if (r.status !== "published") return "Not visible to clients";
  if (r.slug && link) return "Public page and private link";
  if (r.slug) return "Public page";
  if (link) return "Private link only";
  return "Published, but nobody can open it yet";
}
