import { describe, it, expect } from "vitest";
import { resolveAdminState, type AuthClient } from "../../src/admin/auth";

const session = { user: { id: "11111111-1111-4111-8111-111111111111", email: "owner@example.com" } };

/** A fake client whose MFA level and staff_role answer are set per test. */
function fake(opts: { current?: string | null; next?: string | null; role?: unknown; aalError?: boolean; roleError?: boolean }) {
  const calls: string[] = [];
  const client: AuthClient = {
    auth: {
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          calls.push("aal");
          if (opts.aalError) return { data: null, error: { message: "boom" } };
          return { data: { currentLevel: opts.current ?? "aal1", nextLevel: opts.next ?? "aal1" }, error: null };
        },
      },
    },
    rpc: async (fn) => {
      calls.push(`rpc:${fn}`);
      if (opts.roleError) return { data: null, error: { message: "boom" } };
      return { data: opts.role ?? null, error: null };
    },
  };
  return { client, calls };
}

describe("resolveAdminState", () => {
  it("is signed out with no session, and never asks the database", async () => {
    const f = fake({});
    expect(await resolveAdminState(null, f.client)).toEqual({ kind: "signed_out" });
    expect(f.calls).toEqual([]);
  });

  it("asks for a code when a verified factor exists and the session is aal1", async () => {
    const f = fake({ current: "aal1", next: "aal2" });
    expect(await resolveAdminState(session, f.client)).toEqual({ kind: "mfa_verify", email: "owner@example.com" });
    expect(f.calls).not.toContain("rpc:staff_role");
  });

  it("lets an owner with no verified factor in on the password alone: two-step sign-in is optional", async () => {
    const f = fake({ current: "aal1", next: "aal1", role: "owner" });
    expect(await resolveAdminState(session, f.client)).toEqual({
      kind: "owner", userId: session.user.id, email: "owner@example.com",
    });
    expect(f.calls).toContain("rpc:staff_role");
  });

  it("grants owner access only on aal2 with the owner role", async () => {
    const f = fake({ current: "aal2", next: "aal2", role: "owner" });
    expect(await resolveAdminState(session, f.client)).toEqual({
      kind: "owner", userId: session.user.id, email: "owner@example.com",
    });
  });

  it.each([
    ["staff", "staff"],
    ["viewer", "viewer"],
    ["no staff row or inactive (null)", null],
  ])("refuses a %s account on aal2", async (_label, role) => {
    const f = fake({ current: "aal2", next: "aal2", role });
    expect(await resolveAdminState(session, f.client)).toEqual({ kind: "unauthorized", email: "owner@example.com" });
  });

  it("reports an error, never access, when the level check fails", async () => {
    const f = fake({ aalError: true });
    const s = await resolveAdminState(session, f.client);
    expect(s.kind).toBe("error");
  });

  it("reports an error, never access, when the role check fails", async () => {
    const f = fake({ current: "aal2", next: "aal2", roleError: true });
    const s = await resolveAdminState(session, f.client);
    expect(s.kind).toBe("error");
  });
});
