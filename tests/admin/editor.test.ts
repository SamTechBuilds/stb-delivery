import { describe, it, expect } from "vitest";
import { buildPatch, checklistFromText, checklistToText, formFromRecord, isDirty, type EditorForm } from "../../src/admin/lib/editor";
import { defaultLayout } from "../../src/admin/lib/layout";
import type { DeliveryRecord } from "../../src/admin/data";

function form(over: Partial<EditorForm> = {}): EditorForm {
  return {
    client_display_name: "Ameer",
    business_display_name: "S Ameer Ali Spares",
    project_title: "Parts site",
    project_summary: "",
    live_url: "https://ameer.example",
    tech_text: "React, Supabase",
    completed_on: "2026-11-20",
    video_url: "",
    checklist: [{ label: "Domain handed over", done: true }],
    welcome_title: "",
    welcome_message: "",
    support_contact_note: "",
    closing_message: "",
    support_period_id: "",
    theme: "midnight",
    section_layout: defaultLayout(),
    reveal_gift: true,
    slug: "ameer-parts",
    ...over,
  };
}

describe("buildPatch", () => {
  it("builds a patch with trimmed values, empty optionals as null and the checked slug", () => {
    const r = buildPatch(form({ tech_text: " React ,, Supabase ", welcome_title: "  " }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.tech_list).toEqual(["React", "Supabase"]);
    expect(r.patch.welcome_title).toBeNull();
    expect(r.patch.slug).toBe("ameer-parts");
    expect(r.patch.handover_checklist).toEqual([{ label: "Domain handed over", done: true }]);
  });

  it("sends a null slug when the field is empty, so the delivery stays token-only", () => {
    const r = buildPatch(form({ slug: "  " }));
    expect(r.ok && r.patch.slug).toBeNull();
  });

  it("requires a client name and a project title", () => {
    const r = buildPatch(form({ client_display_name: " ", project_title: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.client_display_name).toBeDefined();
    expect(r.errors.project_title).toBeDefined();
  });

  it("refuses links that are not http or https", () => {
    const r = buildPatch(form({ live_url: "javascript:alert(1)", video_url: "ftp://x" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.live_url).toBeDefined();
    expect(r.errors.video_url).toBeDefined();
  });

  it("refuses reserved and malformed slugs with the reason", () => {
    const reserved = buildPatch(form({ slug: "admin" }));
    expect(reserved.ok).toBe(false);
    if (!reserved.ok) expect(reserved.errors.slug).toContain("reserved");
    const bad = buildPatch(form({ slug: "Bad Slug!" }));
    expect(bad.ok).toBe(false);
  });

  it("refuses an impossible completion date", () => {
    const r = buildPatch(form({ completed_on: "2026-02-31" }));
    expect(r.ok).toBe(false);
  });

  it("never includes internal or client-contact fields in the patch", () => {
    const r = buildPatch(form());
    if (!r.ok) throw new Error("expected ok");
    const keys = Object.keys(r.patch);
    for (const k of ["internal_notes", "budget_minor", "email", "phone", "address", "notes"]) {
      expect(keys).not.toContain(k);
    }
  });
});

describe("checklist text", () => {
  it("keeps the done flag for labels that already existed", () => {
    const before = [{ label: "A", done: true }, { label: "B", done: false }];
    const after = checklistFromText("B\nA\nNew item", before);
    expect(after).toEqual([
      { label: "B", done: false },
      { label: "A", done: true },
      { label: "New item", done: false },
    ]);
    expect(checklistToText(after)).toBe("B\nA\nNew item");
  });
});

describe("formFromRecord and dirty state", () => {
  const record = {
    client_display_name: "Ameer", business_display_name: null, project_title: "Parts site", project_summary: null,
    live_url: null, tech_list: ["React"], completed_on: null, video_url: null,
    handover_checklist: [], welcome_title: null, welcome_message: null, support_contact_note: null,
    closing_message: null, support_period_id: null, theme: "ivory", section_layout: defaultLayout(),
    reveal_gift: false, slug: null,
  } as unknown as DeliveryRecord;

  it("loads the saved values and reports not dirty until something changes", () => {
    const a = formFromRecord(record);
    const b = formFromRecord(record);
    expect(isDirty(a, b)).toBe(false);
    expect(a.reveal_gift).toBe(false);
    expect(a.tech_text).toBe("React");
    expect(isDirty(a, { ...a, theme: "midnight" })).toBe(true);
  });
});
