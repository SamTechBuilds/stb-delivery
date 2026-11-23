/**
 * Turns the editor's form into the exact patch sent to STB Core, and back. Kept pure so the rules
 * (required fields, link schemes, slug checks, what stays out of the patch) can be tested directly.
 * The database remains the final check; these rules only give the owner an answer before saving.
 */
import type { DeliveryPatch, DeliveryRecord } from "../data";
import { normaliseLayout, type Layout } from "./layout";
import { checkSlug } from "./slugs";

export type Theme = "midnight" | "aurora" | "ivory";

export interface ChecklistLine { label: string; done: boolean }

export interface EditorForm {
  client_display_name: string;
  business_display_name: string;
  project_title: string;
  project_summary: string;
  live_url: string;
  tech_text: string;
  completed_on: string;
  video_url: string;
  checklist: ChecklistLine[];
  welcome_title: string;
  welcome_message: string;
  support_contact_note: string;
  closing_message: string;
  support_period_id: string;
  theme: Theme;
  section_layout: Layout;
  reveal_gift: boolean;
  slug: string;
}

export type FormErrors = Partial<Record<keyof EditorForm, string>>;
export type BuildResult = { ok: true; patch: DeliveryPatch } | { ok: false; errors: FormErrors };

const MAX_TECH = 12;
const MAX_CHECKLIST = 20;

export function formFromRecord(r: DeliveryRecord): EditorForm {
  return {
    client_display_name: r.client_display_name ?? "",
    business_display_name: r.business_display_name ?? "",
    project_title: r.project_title ?? "",
    project_summary: r.project_summary ?? "",
    live_url: r.live_url ?? "",
    tech_text: (r.tech_list ?? []).join(", "),
    completed_on: r.completed_on ?? "",
    video_url: r.video_url ?? "",
    checklist: (r.handover_checklist ?? []).map((c) => ({ label: c.label, done: Boolean(c.done) })),
    welcome_title: r.welcome_title ?? "",
    welcome_message: r.welcome_message ?? "",
    support_contact_note: r.support_contact_note ?? "",
    closing_message: r.closing_message ?? "",
    support_period_id: r.support_period_id ?? "",
    theme: r.theme,
    section_layout: normaliseLayout(r.section_layout),
    reveal_gift: r.reveal_gift,
    slug: r.slug ?? "",
  };
}

/** Lines typed in the checklist box. A line keeps its done flag if the same label was already there. */
export function checklistFromText(text: string, previous: ChecklistLine[]): ChecklistLine[] {
  const done = new Map(previous.map((c) => [c.label, c.done]));
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label) => ({ label, done: done.get(label) ?? false }));
}

export function checklistToText(items: ChecklistLine[]): string {
  return items.map((c) => c.label).join("\n");
}

function optional(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Accepts YYYY-MM-DD only, and rejects dates that JavaScript would silently roll over (31 Feb). */
function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function buildPatch(f: EditorForm): BuildResult {
  const errors: FormErrors = {};

  const client = f.client_display_name.trim();
  if (client === "") errors.client_display_name = "Add the client's name.";
  else if (client.length > 80) errors.client_display_name = "Use 80 characters or fewer.";

  const project = f.project_title.trim();
  if (project === "") errors.project_title = "Add a project title.";
  else if (project.length > 120) errors.project_title = "Use 120 characters or fewer.";

  if (f.live_url.trim() !== "" && !isHttpUrl(f.live_url.trim())) errors.live_url = "Use a full address starting with https://.";
  if (f.video_url.trim() !== "" && !isHttpUrl(f.video_url.trim())) errors.video_url = "Use a full address starting with https://.";
  if (f.completed_on !== "" && !isIsoDate(f.completed_on)) errors.completed_on = "Use a real date.";

  const tech = f.tech_text.split(",").map((t) => t.trim()).filter(Boolean);
  if (tech.length > MAX_TECH) errors.tech_text = `List up to ${MAX_TECH} technologies.`;

  if (f.checklist.length > MAX_CHECKLIST) errors.checklist = `Keep the checklist to ${MAX_CHECKLIST} items.`;

  const slug = checkSlug(f.slug);
  if (!slug.ok) errors.slug = slug.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    patch: {
      client_display_name: client,
      business_display_name: optional(f.business_display_name),
      project_title: project,
      project_summary: optional(f.project_summary),
      live_url: optional(f.live_url),
      tech_list: tech,
      completed_on: optional(f.completed_on),
      video_url: optional(f.video_url),
      handover_checklist: f.checklist.map((c) => ({ label: c.label, done: c.done })),
      welcome_title: optional(f.welcome_title),
      welcome_message: optional(f.welcome_message),
      support_contact_note: optional(f.support_contact_note),
      closing_message: optional(f.closing_message),
      support_period_id: optional(f.support_period_id),
      theme: f.theme,
      section_layout: f.section_layout,
      reveal_gift: f.reveal_gift,
      slug: slug.ok ? slug.value : null,
    },
  };
}

/** True when the form differs from what was last loaded or saved. Publishing is blocked while dirty. */
export function isDirty(a: EditorForm, b: EditorForm): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
