/** The client-facing sections, in the default order. Mirrors delivery_layout_valid() in STB Core 0007. */
export const SECTION_KEYS = ["walkthrough", "screens", "handover", "support", "card"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, { title: string; hint: string }> = {
  walkthrough: { title: "Walkthrough video", hint: "A YouTube or Vimeo link, or a plain link to a recording." },
  screens: { title: "Screens", hint: "Screenshots of the finished site or app." },
  handover: { title: "Handover files and checklist", hint: "Documents the client can download, and the handover checklist." },
  support: { title: "Support", hint: "The support plan, its dates and how to get help." },
  card: { title: "Visiting card", hint: "Your contact card, with a QR code to save it." },
};

export interface LayoutItem { key: SectionKey; visible: boolean }
export type Layout = LayoutItem[];

export function defaultLayout(): Layout {
  return SECTION_KEYS.map((key) => ({ key, visible: true }));
}

/** The same rules the database enforces: every key once, each with a boolean flag, 1 to 12 items. */
export function isValidLayout(raw: unknown): raw is Layout {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 12) return false;
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keys = Object.keys(item);
    if (keys.some((k) => k !== "key" && k !== "visible")) return false;
    const { key, visible } = item as { key: unknown; visible: unknown };
    if (typeof key !== "string" || !(SECTION_KEYS as readonly string[]).includes(key)) return false;
    if (typeof visible !== "boolean") return false;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/**
 * Turn whatever the database returned into a layout the editor can edit. Anything missing or
 * malformed falls back to the default, and any section the stored layout did not mention is added
 * at the end, visible. Nothing is silently hidden.
 */
export function normaliseLayout(raw: unknown): Layout {
  if (!isValidLayout(raw)) return defaultLayout();
  const present = new Set(raw.map((i) => i.key));
  const extra = SECTION_KEYS.filter((k) => !present.has(k)).map((key) => ({ key, visible: true }));
  return [...raw.map((i) => ({ key: i.key, visible: i.visible })), ...extra];
}

export function setVisible(layout: Layout, key: SectionKey, visible: boolean): Layout {
  return layout.map((i) => (i.key === key ? { ...i, visible } : i));
}

/** Move one section up or down. Moving past either end does nothing. */
export function moveSection(layout: Layout, key: SectionKey, direction: -1 | 1): Layout {
  const from = layout.findIndex((i) => i.key === key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= layout.length) return layout;
  const next = layout.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** The order a client sees: visible sections only, in the owner's order. */
export function visibleSections(layout: Layout): SectionKey[] {
  return layout.filter((i) => i.visible).map((i) => i.key);
}
