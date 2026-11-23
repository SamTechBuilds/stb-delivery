import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultLayout, isValidLayout, moveSection, normaliseLayout, setVisible, visibleSections, SECTION_KEYS } from "../../src/admin/lib/layout";
import { randomToken, sha256Hex, privateLink, tokenHint, isWellFormedToken } from "../../src/admin/lib/tokens";
import { checkSlug, RESERVED_SLUGS, publicUrl } from "../../src/admin/lib/slugs";
import { draftFromProject, applyTemplate } from "../../src/admin/lib/prefill";
import { friendlyError } from "../../src/admin/lib/errors";
import { summarise, visibilityLabel, isActiveLink } from "../../src/admin/lib/stats";

describe("section layout", () => {
  it("starts with every section visible, in the default order", () => {
    expect(defaultLayout().map((i) => i.key)).toEqual([...SECTION_KEYS]);
    expect(defaultLayout().every((i) => i.visible)).toBe(true);
  });

  it("accepts exactly what the database accepts", () => {
    expect(isValidLayout(defaultLayout())).toBe(true);
    expect(isValidLayout([{ key: "pricing", visible: true }])).toBe(false);
    expect(isValidLayout([{ key: "card", visible: true }, { key: "card", visible: false }])).toBe(false);
    expect(isValidLayout([{ key: "card", visible: "yes" }])).toBe(false);
    expect(isValidLayout([{ key: "card", visible: true, extra: 1 }])).toBe(false);
    expect(isValidLayout([])).toBe(false);
    expect(isValidLayout(null)).toBe(false);
  });

  it("falls back to the default for malformed data, and never hides a missing section", () => {
    expect(normaliseLayout("nonsense")).toEqual(defaultLayout());
    const partial = normaliseLayout([{ key: "card", visible: false }]);
    expect(partial[0]).toEqual({ key: "card", visible: false });
    expect(partial.slice(1).every((i) => i.visible)).toBe(true);
    expect(partial.map((i) => i.key)).toEqual(["card", "walkthrough", "screens", "handover", "support"]);
  });

  it("moves sections, stopping at either end", () => {
    const l = defaultLayout();
    expect(moveSection(l, "screens", -1).map((i) => i.key)[0]).toBe("screens");
    expect(moveSection(l, "walkthrough", -1)).toBe(l);
    expect(moveSection(l, "card", 1)).toBe(l);
    expect(moveSection(l, "handover", 1).map((i) => i.key)).toEqual(["walkthrough", "screens", "support", "handover", "card"]);
  });

  it("shows clients only the visible sections, in the owner's order", () => {
    // move the card above handover (two single steps), then hide screens
    let l = moveSection(defaultLayout(), "card", -1);
    l = moveSection(l, "card", -1);
    l = setVisible(l, "screens", false);
    expect(l.map((i) => i.key)).toEqual(["walkthrough", "screens", "card", "handover", "support"]);
    expect(visibleSections(l)).toEqual(["walkthrough", "card", "handover", "support"]);
  });
});

describe("private tokens", () => {
  it("generates 43-character base64url tokens that differ every time", () => {
    const a = randomToken();
    const b = randomToken();
    expect(isWellFormedToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("hashes with SHA-256 exactly as the database expects", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("builds a fragment link, so the token never reaches a server", () => {
    const t = randomToken();
    expect(privateLink(t, "https://delivery.samtechbuilds.com/")).toBe(`https://delivery.samtechbuilds.com/#${t}`);
    expect(tokenHint(t)).toHaveLength(4);
  });
});

describe("slugs", () => {
  it("accepts valid slugs and treats blank as no public page", () => {
    expect(checkSlug("ameerproject")).toEqual({ ok: true, value: "ameerproject" });
    expect(checkSlug("  Ameer-Project ")).toEqual({ ok: true, value: "ameer-project" });
    expect(checkSlug("")).toEqual({ ok: true, value: null });
  });

  it.each([
    ["ab", "at least 3"],
    ["bad---slug", "three hyphens"],
    ["-lead", "lowercase"],
    ["trail-", "lowercase"],
    ["has_underscore", "lowercase"],
    ["x".repeat(81), "80 characters"],
  ])("rejects %s", (raw, hint) => {
    const r = checkSlug(raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain(hint.toLowerCase());
  });

  it.each(["admin", "login", "assets", "api", "stb", "robots.txt"])("refuses the reserved slug %s", (s) => {
    expect(checkSlug(s).ok).toBe(false);
  });

  it("keeps the reserved list in step with STB Core migration 0005", () => {
    const path = join(__dirname, "../../../stb-core/supabase/migrations/20261120000005_delivery_slugs.sql");
    if (!existsSync(path)) return; // only checkable where the STB Core repository sits alongside
    const sql = readFileSync(path, "utf8");
    const block = sql.slice(sql.indexOf("insert into public.reserved_slugs"), sql.indexOf(";", sql.indexOf("insert into public.reserved_slugs")));
    const fromDb = [...block.matchAll(/\('([^']+)'\)/g)].map((m) => m[1]).sort();
    expect([...RESERVED_SLUGS].sort()).toEqual(fromDb);
  });

  it("builds the public address", () => {
    expect(publicUrl("ameerproject", "https://delivery.samtechbuilds.com/")).toBe("https://delivery.samtechbuilds.com/ameerproject");
  });
});

describe("new delivery copy", () => {
  const project = {
    id: "p1", client_id: "c1", name: "Ameer site", description: "A parts shop", live_url: "https://ameer.example",
    completed_on: "2026-11-20", tech_stack: ["React", "Supabase"],
  };
  const client = { id: "c1", name: "Ameer", business_name: "S Ameer Ali Spares" };

  it("copies only client-facing facts from the project and client", () => {
    const draft = draftFromProject(project, client);
    const keys = Object.keys(draft).sort();
    expect(keys).toEqual([
      "business_display_name", "client_display_name", "closing_message", "completed_on", "live_url", "project_id",
      "project_summary", "project_title", "reveal_gift", "section_layout", "support_contact_note", "tech_list",
      "theme", "welcome_message", "welcome_title",
    ]);
  });

  it("never carries internal or contact fields, even when the source records hold them", () => {
    const leaky = {
      ...project, internal_notes: "PRIVATE NOTE", budget_minor: 4500000, currency: "INR",
    } as typeof project & Record<string, unknown>;
    const leakyClient = { ...client, notes: "CLIENT SECRET", email: "a@b.co", phone: "+91 1", address: "Street 1" } as typeof client & Record<string, unknown>;
    const json = JSON.stringify(draftFromProject(leaky, leakyClient));
    for (const secret of ["PRIVATE NOTE", "4500000", "INR", "CLIENT SECRET", "a@b.co", "+91 1", "Street 1"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("applies a template's presentation and generic copy only", () => {
    const draft = applyTemplate(draftFromProject(project, client), {
      theme: "ivory", section_layout: [{ key: "card", visible: false }], reveal_gift: false,
      welcome_title: "Welcome", welcome_message: null, support_contact_note: null, closing_message: "Thank you",
    });
    expect(draft.theme).toBe("ivory");
    expect(draft.reveal_gift).toBe(false);
    expect(draft.client_display_name).toBe("Ameer");
  });
});

describe("error messages", () => {
  it("maps known codes to plain sentences", () => {
    expect(friendlyError({ code: "23505" })).toContain("already used");
    expect(friendlyError({ code: "23514", message: 'slug "admin" is reserved' })).toContain("reserved");
    expect(friendlyError({ code: "42501" })).toContain("permission");
  });

  it("never shows a raw database message it does not recognise", () => {
    const msg = friendlyError({ code: "XX000", message: 'relation "public.staff" leaked secret_column' });
    expect(msg).not.toContain("staff");
    expect(msg).not.toContain("secret_column");
  });
});

describe("dashboard counts", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const rows = [
    { id: "1", status: "draft" as const, slug: null, delivery_tokens: [] },
    { id: "2", status: "published" as const, slug: "ameer", delivery_tokens: [{ kind: "client" as const, revoked_at: null, expires_at: null }] },
    { id: "3", status: "published" as const, slug: null, delivery_tokens: [{ kind: "client" as const, revoked_at: null, expires_at: future }] },
    { id: "4", status: "archived" as const, slug: "old", delivery_tokens: [{ kind: "client" as const, revoked_at: "2026-01-01", expires_at: null }] },
    { id: "5", status: "published" as const, slug: null, delivery_tokens: [{ kind: "client" as const, revoked_at: null, expires_at: past }] },
    { id: "6", status: "draft" as const, slug: null, delivery_tokens: [{ kind: "preview" as const, revoked_at: null, expires_at: future }] },
  ];

  it("counts each state, public pages and active private links", () => {
    expect(summarise(rows)).toEqual({ total: 6, draft: 2, published: 3, archived: 1, publicPages: 1, privateLinks: 2 });
  });

  it("does not count expired or revoked links, or previews, as private links", () => {
    expect(isActiveLink({ kind: "client", revoked_at: null, expires_at: past }, new Date())).toBe(false);
    expect(isActiveLink({ kind: "preview", revoked_at: null, expires_at: future }, new Date())).toBe(false);
  });

  it("describes visibility in plain words", () => {
    expect(visibilityLabel(rows[1])).toBe("Public page and private link");
    expect(visibilityLabel(rows[2])).toBe("Private link only");
    expect(visibilityLabel(rows[0])).toBe("Not visible to clients");
    expect(visibilityLabel(rows[4])).toBe("Published, but nobody can open it yet");
  });
});
