import { describe, it, expect, vi } from "vitest";
import { readToken, openDelivery, requestFile, DeliveryApiError } from "../src/api";
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
