import { describe, it, expect } from "vitest";
import {
  MfaError, beginSetup, cancelSetup, confirmSetup, disableMfa, getMfaStatus, qrImageSrc, type FactorInfo, type MfaApi, type PasswordCheck,
} from "../../src/admin/mfa";

describe("QR image source", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#fff"/></svg>';
  it("encodes raw SVG so a '#' inside it cannot cut the image short", () => {
    const src = qrImageSrc(svg);
    expect(src.startsWith("data:image/svg+xml;utf-8,")).toBe(true);
    expect(src.slice(src.indexOf(",") + 1)).not.toContain("#");
    expect(decodeURIComponent(src.slice(src.indexOf(",") + 1))).toBe(svg);
  });
  it("does not double the prefix when the value already has one", () => {
    const once = qrImageSrc(svg);
    expect(qrImageSrc(`data:image/svg+xml;utf-8,${once.slice(once.indexOf(",") + 1)}`)).toBe(once);
    expect(qrImageSrc(`data:image/svg+xml;utf-8,${svg}`)).toBe(once);
  });
});

const USER = "11111111-1111-4111-8111-111111111111";
const EMAIL = "owner@example.com";
const GOOD_CODE = "123456";

/**
 * A fake of the Supabase MFA API with the behaviour that matters here: a factor becomes verified
 * only after a correct code, and unenroll removes a factor. Every call is recorded in order.
 */
function fakeMfa(initial: FactorInfo[] = []) {
  const factors = new Map<string, FactorInfo>(initial.map((f) => [f.id, { ...f }]));
  const calls: string[] = [];
  let n = 0;
  const api: MfaApi = {
    async listFactors() {
      calls.push("list");
      const all = [...factors.values()].map((f) => ({ ...f }));
      return { data: { all, totp: all.filter((f) => f.id.startsWith("totp")) }, error: null };
    },
    async enroll() {
      calls.push("enroll");
      const id = `totp-${++n}`;
      factors.set(id, { id, status: "unverified", created_at: "2026-11-22T00:00:00Z" });
      return { data: { id, totp: { qr_code: "data:image/svg+xml;base64,AAAA", secret: "JBSWY3DPEHPK3PXP" } }, error: null };
    },
    async challengeAndVerify({ factorId, code }) {
      calls.push(`verify:${factorId}`);
      if (code !== GOOD_CODE || !factors.has(factorId)) return { error: { message: "invalid" } };
      factors.get(factorId)!.status = "verified";
      return { error: null };
    },
    async unenroll({ factorId }) {
      calls.push(`unenroll:${factorId}`);
      factors.delete(factorId);
      return { error: null };
    },
  };
  return { api, factors, calls };
}

const passwordOk = (userId = USER): PasswordCheck => async () => userId;
const passwordWrong: PasswordCheck = async () => null;

describe("status", () => {
  it("is off with no factor, and never 'on' for an unverified one", async () => {
    expect(await getMfaStatus(fakeMfa().api)).toEqual({ state: "off", pendingFactorId: null });
    const pending = fakeMfa([{ id: "totp-x", status: "unverified" }]).api;
    expect(await getMfaStatus(pending)).toEqual({ state: "off", pendingFactorId: "totp-x" });
  });

  it("is on only for a verified factor", async () => {
    const s = await getMfaStatus(fakeMfa([{ id: "totp-a", status: "verified", created_at: "2026-11-01T00:00:00Z" }]).api);
    expect(s).toEqual({ state: "on", factorId: "totp-a", since: "2026-11-01T00:00:00Z" });
  });
});

describe("setup", () => {
  it("returns the QR code and manual key, and leaves two-factor off until a code verifies", async () => {
    const f = fakeMfa();
    const setup = await beginSetup(f.api, "STB Delivery");
    expect(setup.qrCode).toMatch(/^data:image\/svg\+xml;utf-8,/);
    expect(setup.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(await getMfaStatus(f.api)).toEqual({ state: "off", pendingFactorId: setup.factorId });
  });

  it("a wrong code keeps two-factor off and says so", async () => {
    const f = fakeMfa();
    const { factorId } = await beginSetup(f.api, "STB Delivery");
    await expect(confirmSetup(f.api, factorId, "000000")).rejects.toBeInstanceOf(MfaError);
    expect((await getMfaStatus(f.api)).state).toBe("off");
  });

  it("a correct code turns it on; spaces in the code are ignored", async () => {
    const f = fakeMfa();
    const { factorId } = await beginSetup(f.api, "STB Delivery");
    await confirmSetup(f.api, factorId, " 123 456 ");
    expect((await getMfaStatus(f.api)).state).toBe("on");
  });

  it("rejects codes that are not six digits before calling the server", async () => {
    const f = fakeMfa();
    const { factorId } = await beginSetup(f.api, "STB Delivery");
    await expect(confirmSetup(f.api, factorId, "12345")).rejects.toThrow("six-digit");
    expect(f.calls.some((c) => c.startsWith("verify"))).toBe(false);
  });

  it("clears abandoned, unverified attempts before starting a new one", async () => {
    const f = fakeMfa([{ id: "totp-old", status: "unverified" }]);
    await beginSetup(f.api, "STB Delivery");
    expect(f.calls).toContain("unenroll:totp-old");
    expect(f.factors.has("totp-old")).toBe(false);
  });

  it("cancelling removes the unverified factor", async () => {
    const f = fakeMfa();
    const { factorId } = await beginSetup(f.api, "STB Delivery");
    await cancelSetup(f.api, factorId);
    expect(f.factors.has(factorId)).toBe(false);
  });
});

describe("disable", () => {
  const onFactor = () => fakeMfa([{ id: "totp-on", status: "verified", created_at: "2026-11-01T00:00:00Z" }]);

  it("needs the account password first, and removes nothing when it is wrong", async () => {
    const f = onFactor();
    await expect(disableMfa(f.api, passwordWrong, { email: EMAIL, userId: USER, password: "x", code: GOOD_CODE }))
      .rejects.toThrow("password");
    expect(f.calls.some((c) => c.startsWith("unenroll"))).toBe(false);
    expect((await getMfaStatus(f.api)).state).toBe("on");
  });

  it("refuses a password that belongs to a different account", async () => {
    const f = onFactor();
    await expect(disableMfa(f.api, passwordOk("22222222-2222-4222-8222-222222222222"), { email: EMAIL, userId: USER, password: "x", code: GOOD_CODE }))
      .rejects.toThrow("password");
    expect(f.calls.some((c) => c.startsWith("unenroll"))).toBe(false);
  });

  it("needs a current code, and removes nothing when it is wrong", async () => {
    const f = onFactor();
    await expect(disableMfa(f.api, passwordOk(), { email: EMAIL, userId: USER, password: "x", code: "000000" }))
      .rejects.toThrow("code");
    expect((await getMfaStatus(f.api)).state).toBe("on");
  });

  it("checks password, then code, then removes the factor, in that order", async () => {
    const f = onFactor();
    const order: string[] = [];
    const check: PasswordCheck = async () => { order.push("password"); return USER; };
    const api: MfaApi = {
      ...f.api,
      challengeAndVerify: async (p) => { order.push("code"); return f.api.challengeAndVerify(p); },
      unenroll: async (p) => { order.push("remove"); return f.api.unenroll(p); },
    };
    await disableMfa(api, check, { email: EMAIL, userId: USER, password: "right", code: GOOD_CODE });
    expect(order).toEqual(["password", "code", "remove"]);
    expect((await getMfaStatus(f.api)).state).toBe("off");
  });
});

describe("the secret stays out of the application's data", () => {
  it("never returns the secret from status", async () => {
    const f = fakeMfa();
    await beginSetup(f.api, "STB Delivery");
    expect(JSON.stringify(await getMfaStatus(f.api))).not.toContain("JBSWY3DPEHPK3PXP");
  });
});
