import type { CardInfo } from "./types";

/** "2026-11-23" -> "23 November 2026", formatted as a calendar date (no time-zone shift). */
export function formatDate(iso: string | null | undefined, locale = navigator.language || "en-IN"): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

/** Whole days from today (local) until the end of `iso` (inclusive). Negative once it has passed. */
export function daysUntil(iso: string, today = new Date()): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const end = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - now) / 86_400_000);
}

export function supportProgress(startIso: string, endIso: string, today = new Date()): number {
  const total = daysUntil(endIso, new Date(startIso + "T12:00:00")) || 1;
  const left = daysUntil(endIso, today);
  return Math.min(1, Math.max(0, left / total));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only http(s) links are ever rendered as hrefs. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const vEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** vCard 3.0 for the STB visiting card. */
export function buildVCard(card: CardInfo): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  const name = card.person_name?.trim() || card.brand_name;
  const parts = name.split(/\s+/);
  const family = parts.length > 1 ? parts.slice(-1)[0] : "";
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : name;
  lines.push(`N:${vEscape(family)};${vEscape(given)};;;`);
  lines.push(`FN:${vEscape(name)}`);
  lines.push(`ORG:${vEscape(card.brand_name)}`);
  if (card.role_title) lines.push(`TITLE:${vEscape(card.role_title)}`);
  if (card.phone) lines.push(`TEL;TYPE=WORK,VOICE:${vEscape(card.phone)}`);
  if (card.whatsapp && card.whatsapp !== card.phone) lines.push(`TEL;TYPE=CELL:${vEscape(card.whatsapp)}`);
  if (card.email) lines.push(`EMAIL;TYPE=WORK:${vEscape(card.email)}`);
  const site = safeUrl(card.website);
  if (site) lines.push(`URL:${vEscape(site)}`);
  if (card.location) lines.push(`ADR;TYPE=WORK:;;${vEscape(card.location)};;;;`);
  const note = [card.tagline, card.services.length ? card.services.join(", ") : null].filter(Boolean).join(" — ");
  if (note) lines.push(`NOTE:${vEscape(note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

export function whatsappLink(number: string | null | undefined, text?: string): string | null {
  if (!number) return null;
  const digits = number.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** YouTube and Vimeo become privacy-friendly embeds; anything else stays a plain link. */
export function videoEmbed(url: string | null | undefined): string | null {
  const safe = safeUrl(url);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "m.youtube.com") id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]{6,})/)?.[1] ?? null;
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  if (host === "vimeo.com") {
    const v = u.pathname.match(/^\/(\d{6,12})/)?.[1];
    if (v) return `https://player.vimeo.com/video/${v}?dnt=1`;
  }
  return null;
}
