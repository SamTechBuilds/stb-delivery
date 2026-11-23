import type { DeliveryInfo, SectionKey } from "./types";

export const DEFAULT_SECTIONS: readonly SectionKey[] = ["walkthrough", "screens", "handover", "support", "card"];
const KNOWN = new Set<string>(DEFAULT_SECTIONS);

/**
 * The client-facing order and visibility. STB Core already blanks the data of hidden sections, so
 * this only decides layout. A missing or malformed list falls back to the default, all visible.
 */
export function sectionOrder(raw: unknown): SectionKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SECTIONS];
  const seen = new Set<string>();
  const out: SectionKey[] = [];
  for (const k of raw) {
    if (typeof k === "string" && KNOWN.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k as SectionKey);
    }
  }
  return out;
}

/** The gift box is shown unless the owner has switched it off. */
export function showsGift(delivery: Pick<DeliveryInfo, "reveal_gift">): boolean {
  return delivery.reveal_gift !== false;
}
