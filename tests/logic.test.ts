import { describe, it, expect, vi, beforeEach } from "vitest";
import { readToken, readTokenWithFallback, clearSessionToken, openDelivery, requestFile, DeliveryApiError } from "../src/api";
import { buildVCard, daysUntil, safeUrl, videoEmbed, whatsappLink, formatBytes } from "../src/format";

const T = "Abc123_-Abc123_-Abc123_-Abc123_-Abc123_-xyz";

describe("readToken", () => {
  it("reads the fragment form and the legacy path form", () => {
    expect(readToken({ hash: `#${T}`, pathname: "/" })).toBe(T);
    expect(readToken({ hash: `#/${T}`, pathname: "/" })).toBe(T);
    expect(readToken({ hash: `#t=${T}`, pathname: "/" })).toBe(T);
    expect(readToken({ hash: "", pathname: `/reveal/${T}` })).toBe(T);
  });
  it("rejects anything that is not exactly a 43-char base64url token", () => {
    for (const hash of ["", "#", "#short", `#${T}x`, `#${T.slice(0, 42)}!`, "#<script>"]) {
      expect(readToken({ hash, pathname: "/" })).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// readTokenWithFallback / clearSessionToken — fragment scrubbing and session
// ---------------------------------------------------------------------------
describe("readTokenWithFallback", () => {
  beforeEach(() => {
    // Reset location and sessionStorage before each test.
    sessionStorage.clear();
    history.replaceState(null, "", "/");
  });

  it("reads the token from the hash and scrubs the fragment from the URL", () => {
    history.replaceState(null, "", `/#${T}`);
    const tok = readTokenWithFallback();
    expect(tok).toBe(T);
    // The hash should be gone — replaceState was called.
    expect(window.location.hash).toBe("");
  });

  it("stores the token in sessionStorage so a reload can recover it", () => {
    history.replaceState(null, "", `/#${T}`);
    readTokenWithFallback();
    // Simulate a reload: hash is now gone, URL is clean.
    expect(window.location.hash).toBe("");
    // The token must be recoverable from sessionStorage.
    const recovered = readTokenWithFallback();
    expect(recovered).toBe(T);
  });

  it("returns null when neither hash nor sessionStorage holds a valid token", () => {
    history.replaceState(null, "", "/");
    expect(readTokenWithFallback()).toBeNull();
  });

  it("ignores a malformed sessionStorage entry", () => {
    sessionStorage.setItem("stb-delivery-token", "not-a-valid-token!@#");
    expect(readTokenWithFallback()).toBeNull();
  });

  it("clearSessionToken removes the entry so a reload returns null", () => {
    history.replaceState(null, "", `/#${T}`);
    readTokenWithFallback();                // stores in sessionStorage
    clearSessionToken();                    // simulates definitive failure
    expect(readTokenWithFallback()).toBeNull(); // sessionStorage is gone
  });

  it("URL access from /reveal/<token> path is preserved (no fragment to scrub)", () => {
    history.replaceState(null, "", `/reveal/${T}`);
    const tok = readTokenWithFallback();
    // readToken delegates to the pathname form; no hash to clear.
    expect(tok).toBe(T);
    // pathname is unchanged — replaceState only clears the hash.
    expect(window.location.pathname).toBe(`/reveal/${T}`);
  });
});

describe("api", () => {
  const cfg = (status: number, body: unknown) => ({
    url: "https://x.supabase.co/functions/v1/delivery-api",
    anonKey: "anon",
    fetchImpl: vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch,
  });
  it("posts the token in the body, never the URL, without cookies or referrer", async () => {
    const c = cfg(200, { ok: 1 });
    await openDelivery(T, c);
    const [url, init] = (c.fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).not.toContain(T);
    expect(JSON.parse(init.body)).toEqual({ action: "open", token: T });
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.headers.apikey).toBe("anon");
  });
  it("maps statuses to error codes", async () => {
    await expect(openDelivery(T, cfg(404, {}))).rejects.toEqual(new DeliveryApiError("not_found"));
    await expect(openDelivery(T, cfg(429, {}))).rejects.toEqual(new DeliveryApiError("rate_limited"));
    await expect(requestFile(T, "id", cfg(500, {}))).rejects.toEqual(new DeliveryApiError("server_error"));
    await expect(openDelivery(T, { url: undefined, anonKey: undefined })).rejects.toEqual(new DeliveryApiError("not_configured"));
    const offline = { url: "https://x", anonKey: undefined, fetchImpl: (() => Promise.reject(new TypeError("offline"))) as typeof fetch };
    await expect(openDelivery(T, offline)).rejects.toEqual(new DeliveryApiError("network"));
  });
});

describe("format", () => {
  it("builds an escaped vCard", () => {
    const v = buildVCard({
      brand_name: "Sam Tech Builds", tagline: "Web; apps, more", person_name: "Mohamed Asif", role_title: "Founder",
      phone: "+91 1", whatsapp: "+91 2", email: "a@b.co", website: "javascript:alert(1)", location: "Chennai, India",
      services: ["Websites"], socials: [], support_hours: null,
    });
    expect(v).toContain("N:Asif;Mohamed;;;");
    expect(v).toContain("FN:Mohamed Asif");
    expect(v).toContain("ADR;TYPE=WORK:;;Chennai\\, India;;;;");
    expect(v).toContain(String.raw`NOTE:Web\; apps\, more — Websites`);
    expect(v).toContain("TEL;TYPE=CELL:+91 2");
    expect(v).not.toContain("javascript");
    expect(v.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
  });
  it("only allows http(s) links", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("https://ok.example")).toBe("https://ok.example/");
  });
  it("embeds YouTube and Vimeo privately, nothing else", () => {
    expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
    expect(videoEmbed("https://evil.example/watch?v=x")).toBeNull();
  });
  it("counts support days from local calendar dates", () => {
    expect(daysUntil("2026-11-25", new Date(2026, 10, 20, 23, 59))).toBe(5);
    expect(daysUntil("2026-11-20", new Date(2026, 10, 20, 8))).toBe(0);
    expect(daysUntil("2026-11-19", new Date(2026, 10, 20))).toBe(-1);
  });
  it("formats WhatsApp links and sizes", () => {
    expect(whatsappLink("+91 90000 00000", "Hi")).toBe("https://wa.me/919000000000?text=Hi");
    expect(whatsappLink("12")).toBeNull();
    expect(formatBytes(8_600_000)).toBe("8.2 MB");
  });
});
