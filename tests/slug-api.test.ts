import { describe, it, expect, vi } from "vitest";
import { normaliseSlug, openBySlug, SLUG_RE } from "../src/slug-api";
import { DeliveryApiError } from "../src/api";

describe("SLUG_RE", () => {
  it("matches valid slugs", () => {
    expect(SLUG_RE.test("ameerproject")).toBe(true);
    expect(SLUG_RE.test("my-new-project")).toBe(true);
    expect(SLUG_RE.test("a1")).toBe(false); // too short — need 3+ chars
    expect(SLUG_RE.test("abc")).toBe(true);
  });
  it("rejects invalid slugs", () => {
    expect(SLUG_RE.test("")).toBe(false);
    expect(SLUG_RE.test("-starts-with-dash")).toBe(false);
    expect(SLUG_RE.test("ends-with-dash-")).toBe(false);
    expect(SLUG_RE.test("UPPER")).toBe(false); // must be lowercase
    expect(SLUG_RE.test("has spaces")).toBe(false);
    expect(SLUG_RE.test("has_underscore")).toBe(false);
    expect(SLUG_RE.test("a")).toBe(false); // too short
  });
});

describe("normaliseSlug", () => {
  it("lowercases and validates", () => {
    expect(normaliseSlug("MyProject")).toBe("myproject");
    expect(normaliseSlug("AMEER-PROJECT")).toBe("ameer-project");
  });
  it("rejects triple hyphens", () => {
    expect(normaliseSlug("bad---slug")).toBeNull();
  });
  it("rejects invalid patterns", () => {
    expect(normaliseSlug("")).toBeNull();
    expect(normaliseSlug("-bad")).toBeNull();
    expect(normaliseSlug("a")).toBeNull();
    expect(normaliseSlug("has space")).toBeNull();
  });
});

describe("openBySlug", () => {
  const cfg = (status: number, body: unknown) => ({
    supabaseUrl: "https://xyz.supabase.co",
    anonKey: "anon-key",
    fetchImpl: vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch,
  });

  it("sends a GET to the slug endpoint with no body, no cookies, no referrer", async () => {
    const c = cfg(200, { delivery: {}, assets: [], preview: false });
    await openBySlug("myproject", c);
    const [url, init] = (c.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://xyz.supabase.co/functions/v1/delivery-public/myproject");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.cache).toBe("no-store");
    expect(init.headers.apikey).toBe("anon-key");
  });

  it("encodes slug in the URL", async () => {
    const c = cfg(200, { delivery: {}, assets: [], preview: false });
    await openBySlug("my%project", c);
    const [url] = (c.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("my%25project");
  });

  it("maps error statuses", async () => {
    await expect(openBySlug("x", cfg(404, {}))).rejects.toEqual(new DeliveryApiError("not_found"));
    await expect(openBySlug("x", cfg(429, {}))).rejects.toEqual(new DeliveryApiError("rate_limited"));
    await expect(openBySlug("x", cfg(400, {}))).rejects.toEqual(new DeliveryApiError("bad_request"));
    await expect(openBySlug("x", cfg(500, {}))).rejects.toEqual(new DeliveryApiError("server_error"));
  });

  it("throws not_configured when supabaseUrl is undefined", async () => {
    await expect(openBySlug("x", { supabaseUrl: undefined, anonKey: undefined }))
      .rejects.toEqual(new DeliveryApiError("not_configured"));
  });

  it("throws network error on fetch failure", async () => {
    const c = {
      supabaseUrl: "https://xyz.supabase.co",
      anonKey: undefined,
      fetchImpl: (() => Promise.reject(new TypeError("offline"))) as typeof fetch,
    };
    await expect(openBySlug("x", c)).rejects.toEqual(new DeliveryApiError("network"));
  });

  it("strips trailing slashes from supabaseUrl", async () => {
    const c = cfg(200, { delivery: {}, assets: [], preview: false });
    c.supabaseUrl = "https://xyz.supabase.co///";
    await openBySlug("test", c);
    const [url] = (c.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://xyz.supabase.co/functions/v1/delivery-public/test");
  });
});
