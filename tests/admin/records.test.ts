import { describe, it, expect } from "vitest";
import { checkClient, checkProject, checkSupportPeriod } from "../../src/admin/lib/records";

const project = {
  name: "Parts site", category: "", description: "", tech: "React, Supabase, , ", status: "in_progress",
  completed_on: "", live_url: "", budget: "", currency: "", internal_notes: "",
};

describe("client records", () => {
  it("requires a name and checks the email shape", () => {
    expect(checkClient({ name: " ", business_name: "", email: "", phone: "", address: "", notes: "", status: "active" }).ok).toBe(false);
    const bad = checkClient({ name: "Ameer", business_name: "", email: "not-an-email", phone: "", address: "", notes: "", status: "active" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.email).toBeDefined();
  });

  it("stores empty optional fields as null", () => {
    const r = checkClient({ name: "Ameer", business_name: " ", email: "", phone: "", address: "", notes: "", status: "active" });
    expect(r.ok && r.value.business_name).toBeNull();
  });
});

describe("project records", () => {
  it("converts a budget typed in whole currency into minor units and requires a currency", () => {
    const missing = checkProject({ ...project, budget: "250.50" });
    expect(missing.ok).toBe(false);
    const ok = checkProject({ ...project, budget: "250.50", currency: "cad" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.budget_minor).toBe(25050);
      expect(ok.value.currency).toBe("CAD");
    }
  });

  it("parses technologies, drops empties and caps the list", () => {
    const r = checkProject(project);
    expect(r.ok && r.value.tech_stack).toEqual(["React", "Supabase"]);
  });

  it("rejects a status outside the allowed set and an impossible date", () => {
    expect(checkProject({ ...project, status: "launched" }).ok).toBe(false);
    expect(checkProject({ ...project, completed_on: "2026-04-31" }).ok).toBe(false);
  });

  it("rejects negative budgets", () => {
    expect(checkProject({ ...project, budget: "-5", currency: "CAD" }).ok).toBe(false);
  });
});

describe("support periods", () => {
  it("requires the end date to be on or after the start date", () => {
    const r = checkSupportPeriod({ plan_name: "Care", starts_on: "2026-11-01", ends_on: "2026-10-01", terms: "" });
    expect(r.ok).toBe(false);
    const ok = checkSupportPeriod({ plan_name: "Care", starts_on: "2026-11-01", ends_on: "2027-11-01", terms: "" });
    expect(ok.ok && ok.value.terms).toBeNull();
  });
});
