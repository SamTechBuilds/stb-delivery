// STUBBED BACKEND. An in-memory stand-in for the Supabase endpoints the STB Delivery admin calls, so
// the admin can be driven in a real browser. It imitates the shapes and the MFA rules of Supabase Auth
// and the staff_role() check, but it is NOT Supabase: RLS, grants, token signing and TOTP maths are
// tested elsewhere (stb-core DB tests, and manually against a real project; see the Phase 5 report).
import type { Page, Route } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const SUPA = "https://mockref.supabase.co";
export const OWNER = { id: "11111111-1111-4111-8111-111111111111", email: "owner@samtechbuilds.example" };
export const PASSWORD = "stub-password-1";
/** The only code the stub accepts. Real TOTP codes change every 30 seconds and are not simulated. */
export const STUB_CODE = "424242";

type Row = Record<string, unknown>;
interface Factor { id: string; friendly_name: string | null; factor_type: "totp"; status: "verified" | "unverified"; created_at: string; secret: string }
export interface AdminDb {
  tables: Record<string, Row[]>;
  factors: Factor[];
  rpcCalls: { fn: string; args: Row }[];
  authCalls: { method: string; path: string }[];
  requests: { method: string; url: string }[];
}

const now = () => new Date().toISOString();
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(payload: Row) { return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.stub`; }
const readJwt = (token: string): Row => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

export function seed(): AdminDb {
  return {
    factors: [],
    rpcCalls: [],
    authCalls: [],
    requests: [],
    tables: {
      staff: [{ user_id: OWNER.id, email: OWNER.email, role: "owner", is_active: true, display_name: "Asif" }],
      business_profile: [{ id: 1, brand_name: "Sam Tech Builds", tagline: null, person_name: "Asif", role_title: null, phone: null, whatsapp: null,
        email: OWNER.email, website: "https://samtechbuilds.netlify.app", location: null, services: [], socials: [], support_hours: null }],
      clients: [{ id: "c1", name: "Priya Raman", business_name: "Priya's Bakehouse", email: "priya@example.com", phone: null, address: null,
        notes: null, status: "active", created_at: now(), updated_at: now() }],
      projects: [{ id: "p1", client_id: "c1", name: "Bakehouse website", category: null, description: null, tech_stack: ["React"],
        live_url: "https://priyasbakehouse.example", internal_notes: "Budget 45k", status: "in_progress", start_date: null, due_date: null,
        completed_on: null, created_at: now(), updated_at: now() }],
      support_periods: [], deliveries: [], delivery_assets: [], delivery_tokens: [], delivery_events: [], delivery_templates: [],
    },
  };
}

/** Mirrors STB Core's staff_role(): owners only, and only at AAL2 once a verified factor exists. */
function staffRole(db: AdminDb, userId: string, aal: string): string | null {
  const staff = db.tables.staff.find((s) => s.user_id === userId && s.is_active);
  if (!staff) return null;
  const hasVerified = db.factors.some((f) => f.status === "verified");
  if (hasVerified && aal !== "aal2") return null;
  return String(staff.role);
}

function sessionFor(db: AdminDb, aal: "aal1" | "aal2") {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = userJson(db);
  const access = jwt({ sub: OWNER.id, email: OWNER.email, role: "authenticated", aud: "authenticated", aal, exp, session_id: randomUUID(),
    amr: [{ method: "password", timestamp: exp - 100 }, ...(aal === "aal2" ? [{ method: "totp", timestamp: exp - 10 }] : [])] });
  return { access_token: access, refresh_token: "stub-refresh", token_type: "bearer", expires_in: 3600, expires_at: exp, user };
}

function userJson(db: AdminDb) {
  return {
    id: OWNER.id, email: OWNER.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {},
    created_at: now(), updated_at: now(),
    factors: db.factors.map((f) => ({ id: f.id, friendly_name: f.friendly_name, factor_type: "totp", status: f.status, created_at: f.created_at, updated_at: now() })),
  };
}

function withEmbeds(db: AdminDb, table: string, rows: Row[]): Row[] {
  const client = (id: unknown) => db.tables.clients.find((c) => c.id === id) ?? null;
  const project = (id: unknown) => db.tables.projects.find((p) => p.id === id) ?? null;
  if (table === "projects") return rows.map((r) => ({ ...r, clients: client(r.client_id) }));
  if (table === "deliveries") return rows.map((r) => { const p = project(r.project_id); return { ...r, projects: p ? { ...p, clients: client(p.client_id) } : null }; });
  return rows;
}

function filterRows(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  for (const [k, v] of params) if (v.startsWith("eq.") && !["select", "order", "limit", "offset"].includes(k)) out = out.filter((r) => String(r[k]) === v.slice(3));
  const order = params.get("order");
  if (order) {
    const [col, dir] = order.split(",")[0].split(".");
    out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1));
  }
  return out;
}

function respond(route: Route, accept: string, data: Row[] | Row | null, status = 200) {
  const single = accept.includes("vnd.pgrst.object");
  const body = single ? (Array.isArray(data) ? data[0] ?? null : data) : data;
  if (single && !body) return route.fulfill({ status: 406, json: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } });
  return route.fulfill({ status, json: body, headers: { "content-range": "0-0/*" } });
}

const DEFAULTS: Record<string, () => Row> = {
  deliveries: () => ({ status: "draft", open_count: 0, published_at: null, archived_at: null, first_opened_at: null, last_opened_at: null, handover_checklist: [], theme: "ivory" }),
  delivery_assets: () => ({ is_published: true, description: null, sort_order: 0 }),
  delivery_templates: () => ({ description: null, created_at: now() }),
};

/** Wires the stub into a page. Pass a session in advance with signedIn: true to skip the password step. */
export async function installAdminMock(page: Page, db: AdminDb, opts: { signedIn?: boolean; aal?: "aal1" | "aal2" } = {}) {
  if (opts.signedIn) {
    // Seed once per tab. Without the flag, every navigation would restore the session a test just removed.
    await page.addInitScript((s) => {
      if (sessionStorage.getItem("stub-seeded")) return;
      sessionStorage.setItem("stub-seeded", "1");
      localStorage.setItem("stb-delivery-auth", s);
    }, JSON.stringify(sessionFor(db, opts.aal ?? "aal1")));
  }

  page.on("request", (req) => db.requests.push({ method: req.method(), url: req.url() }));

  await page.route(`${SUPA}/auth/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/auth/v1", "");
    db.authCalls.push({ method: req.method(), path });
    const body = req.postData() ? JSON.parse(req.postData()!) : {};

    if (path === "/token" && url.searchParams.get("grant_type") === "password") {
      if (body.email !== OWNER.email || body.password !== PASSWORD) return route.fulfill({ status: 400, json: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" } });
      return route.fulfill({ json: sessionFor(db, "aal1") });
    }
    if (path === "/logout") return route.fulfill({ status: 204, body: "" });
    if (path === "/user") return route.fulfill({ json: userJson(db) });
    if (path === "/factors" && req.method() === "POST") {
      const id = randomUUID();
      const secret = "JBSWY3DPEHPK3PXP";
      const f: Factor = { id, friendly_name: body.friendly_name ?? null, factor_type: "totp", status: "unverified", created_at: now(), secret };
      db.factors.push(f);
      const qr = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/><rect x="5" y="5" width="2" height="2"/></svg>`;
      // Supabase returns raw SVG here; supabase-js adds the data-URI prefix itself without encoding it.
      const dataUri = qr;
      return route.fulfill({ json: { id, type: "totp", friendly_name: f.friendly_name, totp: { qr_code: dataUri, secret, uri: `otpauth://totp/STB%20Delivery:${OWNER.email}?secret=${secret}` } } });
    }
    const m = path.match(/^\/factors\/([^/]+)(\/(challenge|verify))?$/);
    if (m) {
      const factor = db.factors.find((f) => f.id === m[1]);
      if (!factor) return route.fulfill({ status: 404, json: { code: 404, msg: "Factor not found" } });
      if (req.method() === "DELETE") { db.factors = db.factors.filter((f) => f.id !== factor.id); return route.fulfill({ json: { id: factor.id } }); }
      if (m[3] === "challenge") return route.fulfill({ json: { id: `chal-${factor.id}`, expires_at: Math.floor(Date.now() / 1000) + 300 } });
      if (m[3] === "verify") {
        if (body.code !== STUB_CODE) return route.fulfill({ status: 400, json: { code: 400, error_code: "mfa_verification_failed", msg: "Invalid TOTP code entered" } });
        factor.status = "verified";
        return route.fulfill({ json: sessionFor(db, "aal2") });
      }
    }
    return route.fulfill({ status: 404, json: { code: 404, msg: `stub has no ${req.method()} ${path}` } });
  });

  await page.route(`${SUPA}/rest/v1/rpc/**`, (route) => {
    const fn = new URL(route.request().url()).pathname.split("/").pop()!;
    const args = JSON.parse(route.request().postData() ?? "{}");
    db.rpcCalls.push({ fn, args });
    const auth = route.request().headers()["authorization"] ?? "";
    const aal = auth.startsWith("Bearer ") ? String(readJwt(auth.slice(7)).aal ?? "aal1") : "aal1";
    if (fn === "staff_role") return route.fulfill({ json: staffRole(db, OWNER.id, aal) });
    if (fn === "set_delivery_status") {
      const d = db.tables.deliveries.find((x) => x.id === args.p_delivery_id)!;
      d.status = args.p_status;
      if (args.p_status === "published") d.published_at = now();
      d.archived_at = args.p_status === "archived" ? now() : null;
      return route.fulfill({ json: args.p_status });
    }
    if (fn === "issue_delivery_token") {
      const id = randomUUID();
      db.tables.delivery_tokens.push({ id, delivery_id: args.p_delivery_id, kind: args.p_kind, label: args.p_label, token_hint: args.p_token_hint,
        expires_at: args.p_expires_at, revoked_at: null, created_at: now(), last_used_at: null, use_count: 0 });
      return route.fulfill({ json: id });
    }
    if (fn === "revoke_delivery_token") {
      const t = db.tables.delivery_tokens.find((x) => x.id === args.p_token_id)!;
      t.revoked_at = now();
      return route.fulfill({ json: null });
    }
    return route.fulfill({ status: 404, json: { message: `stub has no rpc ${fn}` } });
  });

  await page.route(`${SUPA}/rest/v1/*`, (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const table = url.pathname.split("/").pop()!;
    const accept = req.headers()["accept"] ?? "";
    const rows = db.tables[table];
    if (!rows) return route.fulfill({ status: 404, json: { message: `stub has no table ${table}` } });
    const method = req.method();
    if (method === "GET") return respond(route, accept, withEmbeds(db, table, filterRows(rows, url.searchParams)));
    if (method === "POST") {
      const body = JSON.parse(req.postData() ?? "{}");
      const created = (Array.isArray(body) ? body : [body]).map((b) => {
        const row = { id: randomUUID(), created_at: now(), updated_at: now(), ...(DEFAULTS[table]?.() ?? {}), ...b };
        rows.push(row);
        return row;
      });
      return respond(route, accept, withEmbeds(db, table, created), 201);
    }
    if (method === "PATCH") {
      const body = JSON.parse(req.postData() ?? "{}");
      const hit = filterRows(rows, url.searchParams);
      hit.forEach((r) => Object.assign(r, body, { updated_at: now() }));
      return respond(route, accept, withEmbeds(db, table, hit));
    }
    if (method === "DELETE") {
      const hit = new Set(filterRows(rows, url.searchParams));
      db.tables[table] = rows.filter((r) => !hit.has(r));
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 405, body: "" });
  });

  await page.route(`${SUPA}/storage/v1/**`, (route) => route.fulfill({ json: { Key: "stub", Id: randomUUID() } }));

}
