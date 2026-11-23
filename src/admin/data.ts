/**
 * Every admin read and write goes through this file, so the columns and RPCs in use are visible in
 * one place. None of it is a security boundary: STB Core's RLS and SECURITY DEFINER functions decide
 * what the owner may touch. Columns are chosen explicitly, never `select *` on the client tables.
 */
import { supabase } from "./supabase";
import type { Layout } from "./lib/layout";
import type { NewDeliveryDraft } from "./lib/prefill";

export const BUCKET = "delivery-files";

export interface TokenRecord {
  id: string;
  delivery_id: string;
  kind: "client" | "preview";
  label: string | null;
  token_hint: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
}

export interface DeliveryListRow {
  id: string;
  slug: string | null;
  status: "draft" | "published" | "archived";
  theme: "midnight" | "aurora" | "ivory";
  project_id: string;
  project_title: string;
  client_display_name: string;
  business_display_name: string | null;
  published_at: string | null;
  updated_at: string;
  open_count: number;
  last_opened_at: string | null;
  delivery_tokens: { kind: "client" | "preview"; revoked_at: string | null; expires_at: string | null }[];
}

export type DeliveryRecord = Omit<DeliveryListRow, "delivery_tokens"> & {
  client_display_name: string;
  welcome_title: string | null;
  welcome_message: string | null;
  project_summary: string | null;
  live_url: string | null;
  tech_list: string[];
  completed_on: string | null;
  video_url: string | null;
  handover_checklist: { label: string; done?: boolean }[];
  support_period_id: string | null;
  support_contact_note: string | null;
  closing_message: string | null;
  section_layout: Layout;
  reveal_gift: boolean;
  created_at: string;
};

export interface AssetRecord {
  id: string;
  delivery_id: string;
  kind: "screenshot" | "document";
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
  is_published: boolean;
}

export interface ClientRecord {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: "active" | "archived";
}

export interface ProjectRecord {
  id: string;
  client_id: string;
  name: string;
  category: string | null;
  description: string | null;
  tech_stack: string[];
  status: "planned" | "in_progress" | "on_hold" | "completed" | "cancelled";
  start_date: string | null;
  due_date: string | null;
  completed_on: string | null;
  live_url: string | null;
  budget_minor: number | null;
  currency: string | null;
  internal_notes: string | null;
}

export interface SupportPeriodRecord {
  id: string;
  project_id: string;
  plan_name: string;
  starts_on: string;
  ends_on: string;
  terms: string | null;
}

export interface TemplateRecord {
  id: string;
  name: string;
  description: string | null;
  theme: "midnight" | "aurora" | "ivory";
  section_layout: Layout;
  reveal_gift: boolean;
  welcome_title: string | null;
  welcome_message: string | null;
  support_contact_note: string | null;
  closing_message: string | null;
}

export interface EventRecord {
  id: number;
  delivery_id: string;
  asset_id: string | null;
  event: "opened" | "file_requested";
  created_at: string;
}

export interface BusinessProfileRecord {
  brand_name: string;
  tagline: string | null;
  person_name: string | null;
  role_title: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  services: string[];
  support_hours: string | null;
}

const DELIVERY_LIST_COLUMNS =
  "id, slug, status, theme, project_id, project_title, client_display_name, business_display_name, published_at, updated_at, open_count, last_opened_at, delivery_tokens(kind, revoked_at, expires_at)";

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data as T;
}

/* ——— Deliveries ——— */

export async function listDeliveries(): Promise<DeliveryListRow[]> {
  const res = await supabase.from("deliveries").select(DELIVERY_LIST_COLUMNS).order("updated_at", { ascending: false });
  return must(res) as unknown as DeliveryListRow[];
}

export async function getDelivery(id: string): Promise<DeliveryRecord> {
  return must(await supabase.from("deliveries").select("*").eq("id", id).single()) as unknown as DeliveryRecord;
}

export async function createDelivery(draft: NewDeliveryDraft): Promise<string> {
  const row = must(await supabase.from("deliveries").insert(draft).select("id").single()) as { id: string };
  return row.id;
}

export interface DeliveryPatch {
  client_display_name: string;
  business_display_name: string | null;
  project_title: string;
  project_summary: string | null;
  live_url: string | null;
  tech_list: string[];
  completed_on: string | null;
  video_url: string | null;
  handover_checklist: { label: string; done: boolean }[];
  welcome_title: string | null;
  welcome_message: string | null;
  support_contact_note: string | null;
  closing_message: string | null;
  support_period_id: string | null;
  theme: "midnight" | "aurora" | "ivory";
  section_layout: Layout;
  reveal_gift: boolean;
  slug: string | null;
}

export async function updateDelivery(id: string, patch: DeliveryPatch): Promise<void> {
  must(await supabase.from("deliveries").update(patch).eq("id", id).select("id").single());
}

/** Status changes go through the database function, which enforces the allowed transitions. */
export async function setStatus(id: string, status: "draft" | "published" | "archived"): Promise<void> {
  const res = await supabase.rpc("set_delivery_status", { p_delivery_id: id, p_status: status });
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
}

/* ——— Assets ——— */

export async function listAssets(deliveryId: string): Promise<AssetRecord[]> {
  return must(await supabase.from("delivery_assets")
    .select("id, delivery_id, kind, title, description, storage_path, file_name, mime_type, size_bytes, sort_order, is_published")
    .eq("delivery_id", deliveryId)
    .order("kind").order("sort_order").order("created_at")) as AssetRecord[];
}

export async function signAsset(path: string): Promise<string> {
  const res = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (res.error || !res.data) throw new Error("preview unavailable");
  return res.data.signedUrl;
}

/** Upload the file first, then record it. If recording fails, the orphaned file is removed. */
export async function addAsset(deliveryId: string, input: {
  kind: "screenshot" | "document"; title: string; description: string | null; file: File; sortOrder: number;
}): Promise<void> {
  const safe = input.file.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(0, 120) || "file";
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const path = `${deliveryId}/${random}-${safe}`;
  const up = await supabase.storage.from(BUCKET).upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (up.error) throw new Error("upload");
  const row = await supabase.from("delivery_assets").insert({
    delivery_id: deliveryId,
    kind: input.kind,
    title: input.title,
    description: input.description,
    storage_path: path,
    file_name: input.file.name.slice(0, 200),
    mime_type: input.file.type,
    size_bytes: input.file.size,
    sort_order: input.sortOrder,
    is_published: true,
  });
  if (row.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw Object.assign(new Error(row.error.message), { code: row.error.code });
  }
}

export async function updateAsset(id: string, patch: Partial<Pick<AssetRecord, "title" | "description" | "sort_order" | "is_published">>): Promise<void> {
  must(await supabase.from("delivery_assets").update(patch).eq("id", id).select("id").single());
}

/** Remove the row first (it is the audited record), then the stored file. */
export async function deleteAsset(asset: AssetRecord): Promise<void> {
  must(await supabase.from("delivery_assets").delete().eq("id", asset.id).select("id").single());
  await supabase.storage.from(BUCKET).remove([asset.storage_path]);
}

/* ——— Private links ——— */

export async function listLinks(deliveryId: string): Promise<TokenRecord[]> {
  return must(await supabase.from("delivery_tokens")
    .select("id, delivery_id, kind, label, token_hint, expires_at, revoked_at, created_at, last_used_at, use_count")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: false })) as TokenRecord[];
}

export async function issueLink(deliveryId: string, args: {
  tokenHash: string; hint: string; kind: "client" | "preview"; label: string | null; expiresAt: string | null;
}): Promise<string> {
  const res = await supabase.rpc("issue_delivery_token", {
    p_delivery_id: deliveryId,
    p_token_hash: args.tokenHash,
    p_token_hint: args.hint,
    p_kind: args.kind,
    p_label: args.label,
    p_expires_at: args.expiresAt,
  });
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data as string;
}

export async function revokeLink(tokenId: string): Promise<void> {
  const res = await supabase.rpc("revoke_delivery_token", { p_token_id: tokenId });
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
}

/* ——— Activity ——— */

export async function recentEvents(deliveryId?: string, limit = 12): Promise<EventRecord[]> {
  let q = supabase.from("delivery_events").select("id, delivery_id, asset_id, event, created_at")
    .order("created_at", { ascending: false }).limit(limit);
  if (deliveryId) q = q.eq("delivery_id", deliveryId);
  return must(await q) as EventRecord[];
}

/* ——— Clients and projects ——— */

export async function listClients(): Promise<ClientRecord[]> {
  return must(await supabase.from("clients")
    .select("id, name, business_name, email, phone, address, notes, status")
    .order("name")) as ClientRecord[];
}

export interface ClientInput {
  id?: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: ClientRecord["status"];
}

export async function saveClient(c: ClientInput): Promise<string> {
  const fields = { name: c.name, business_name: c.business_name, email: c.email, phone: c.phone, address: c.address, notes: c.notes, status: c.status };
  if (c.id) {
    must(await supabase.from("clients").update(fields).eq("id", c.id).select("id").single());
    return c.id;
  }
  return (must(await supabase.from("clients").insert(fields).select("id").single()) as { id: string }).id;
}

export async function listProjects(clientId: string): Promise<ProjectRecord[]> {
  return must(await supabase.from("projects")
    .select("id, client_id, name, category, description, tech_stack, status, start_date, due_date, completed_on, live_url, budget_minor, currency, internal_notes")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })) as ProjectRecord[];
}

export interface ProjectInput {
  id?: string;
  client_id: string;
  name: string;
  category: string | null;
  description: string | null;
  tech_stack: string[];
  status: ProjectRecord["status"];
  completed_on: string | null;
  live_url: string | null;
  budget_minor: number | null;
  currency: string | null;
  internal_notes: string | null;
}

export async function saveProject(p: ProjectInput): Promise<string> {
  const { id, ...fields } = p;
  if (id) {
    must(await supabase.from("projects").update(fields).eq("id", id).select("id").single());
    return id;
  }
  return (must(await supabase.from("projects").insert(fields).select("id").single()) as { id: string }).id;
}

export async function listSupportPeriods(projectId: string): Promise<SupportPeriodRecord[]> {
  return must(await supabase.from("support_periods")
    .select("id, project_id, plan_name, starts_on, ends_on, terms")
    .eq("project_id", projectId)
    .order("starts_on", { ascending: false })) as SupportPeriodRecord[];
}

export async function addSupportPeriod(p: Omit<SupportPeriodRecord, "id">): Promise<void> {
  must(await supabase.from("support_periods").insert(p).select("id").single());
}

/** Projects with their client name, for choosing a project when creating a delivery. */
export async function listProjectsWithClients(): Promise<(ProjectRecord & { clients: { name: string; business_name: string | null } | null })[]> {
  return must(await supabase.from("projects")
    .select("id, client_id, name, description, tech_stack, live_url, completed_on, status, clients(name, business_name)")
    .order("name")) as unknown as (ProjectRecord & { clients: { name: string; business_name: string | null } | null })[];
}

export async function getProjectForCopy(projectId: string) {
  return must(await supabase.from("projects")
    .select("id, client_id, name, description, live_url, completed_on, tech_stack, clients(id, name, business_name)")
    .eq("id", projectId).single()) as unknown as {
      id: string; client_id: string; name: string; description: string | null; live_url: string | null;
      completed_on: string | null; tech_stack: string[]; clients: { id: string; name: string; business_name: string | null } | null;
    };
}

/* ——— Templates ——— */

export async function listTemplates(): Promise<TemplateRecord[]> {
  return must(await supabase.from("delivery_templates")
    .select("id, name, description, theme, section_layout, reveal_gift, welcome_title, welcome_message, support_contact_note, closing_message")
    .order("name")) as TemplateRecord[];
}

export async function saveTemplate(t: Omit<TemplateRecord, "id"> & { id?: string }): Promise<string> {
  const { id, ...rest } = t;
  if (id) {
    must(await supabase.from("delivery_templates").update(rest).eq("id", id).select("id").single());
    return id;
  }
  return (must(await supabase.from("delivery_templates").insert(rest).select("id").single()) as { id: string }).id;
}

export async function deleteTemplate(id: string): Promise<void> {
  must(await supabase.from("delivery_templates").delete().eq("id", id).select("id").single());
}

/* ——— Business profile (the visiting card) ——— */

export async function getBusinessProfile(): Promise<BusinessProfileRecord> {
  return must(await supabase.from("business_profile")
    .select("brand_name, tagline, person_name, role_title, phone, whatsapp, email, website, location, services, support_hours")
    .eq("id", 1).single()) as BusinessProfileRecord;
}

export async function saveBusinessProfile(p: BusinessProfileRecord): Promise<void> {
  must(await supabase.from("business_profile").update(p).eq("id", 1).select("id").single());
}
