/**
 * Validation for the records the owner keeps about clients, projects and support plans. These run
 * before a save so the owner sees a plain reason; STB Core constraints remain the final check.
 * Internal fields (notes, budgets) are validated here but never copied into a client delivery.
 */

export type RecordErrors<T> = Partial<Record<keyof T, string>>;
export type Checked<T> = { ok: true; value: T } | { ok: false; errors: RecordErrors<Record<string, unknown>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function realDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function optionalText(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function httpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export interface ClientForm {
  name: string; business_name: string; email: string; phone: string; address: string; notes: string;
  status: "active" | "archived";
}

export function checkClient(f: ClientForm): Checked<{
  name: string; business_name: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null; status: "active" | "archived";
}> {
  const errors: Record<string, string> = {};
  const name = f.name.trim();
  if (name === "") errors.name = "Add the client's name.";
  else if (name.length > 80) errors.name = "Use 80 characters or fewer.";
  if (f.email.trim() !== "" && !EMAIL_RE.test(f.email.trim())) errors.email = "Use an email address like name@example.com.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      business_name: optionalText(f.business_name),
      email: optionalText(f.email),
      phone: optionalText(f.phone),
      address: optionalText(f.address),
      notes: optionalText(f.notes),
      status: f.status,
    },
  };
}

export interface ProjectFormInput {
  name: string; category: string; description: string; tech: string; status: string;
  completed_on: string; live_url: string; budget: string; currency: string; internal_notes: string;
}

const PROJECT_STATUSES = ["planned", "in_progress", "on_hold", "completed", "cancelled"] as const;

export function checkProject(f: ProjectFormInput): Checked<{
  name: string; category: string | null; description: string | null; tech_stack: string[];
  status: (typeof PROJECT_STATUSES)[number]; completed_on: string | null; live_url: string | null;
  budget_minor: number | null; currency: string | null; internal_notes: string | null;
}> {
  const errors: Record<string, string> = {};
  const name = f.name.trim();
  if (name === "") errors.name = "Add a project name.";
  else if (name.length > 120) errors.name = "Use 120 characters or fewer.";
  if (!(PROJECT_STATUSES as readonly string[]).includes(f.status)) errors.status = "Choose a status.";
  if (f.completed_on !== "" && !realDate(f.completed_on)) errors.completed_on = "Use a real date.";
  if (f.live_url.trim() !== "" && !httpUrl(f.live_url.trim())) errors.live_url = "Use a full address starting with https://.";
  let budget: number | null = null;
  if (f.budget.trim() !== "") {
    const n = Number(f.budget.trim());
    if (!Number.isFinite(n) || n < 0) errors.budget = "Enter an amount of zero or more.";
    else budget = Math.round(n * 100); // stored in minor units; the owner types whole currency with cents
  }
  const currency = f.currency.trim().toUpperCase();
  if (budget !== null && !/^[A-Z]{3}$/.test(currency)) errors.currency = "Use a three-letter currency code, such as CAD.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      category: optionalText(f.category),
      description: optionalText(f.description),
      tech_stack: f.tech.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
      status: f.status as (typeof PROJECT_STATUSES)[number],
      completed_on: optionalText(f.completed_on),
      live_url: optionalText(f.live_url),
      budget_minor: budget,
      currency: budget !== null ? currency : null,
      internal_notes: optionalText(f.internal_notes),
    },
  };
}

export function checkSupportPeriod(f: { plan_name: string; starts_on: string; ends_on: string; terms: string }):
  Checked<{ plan_name: string; starts_on: string; ends_on: string; terms: string | null }> {
  const errors: Record<string, string> = {};
  const plan = f.plan_name.trim();
  if (plan === "") errors.plan_name = "Name the plan, such as Care plan.";
  if (!realDate(f.starts_on)) errors.starts_on = "Use a real start date.";
  if (!realDate(f.ends_on)) errors.ends_on = "Use a real end date.";
  if (!errors.starts_on && !errors.ends_on && f.ends_on < f.starts_on) errors.ends_on = "The end date must be on or after the start date.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { plan_name: plan, starts_on: f.starts_on, ends_on: f.ends_on, terms: optionalText(f.terms) } };
}
