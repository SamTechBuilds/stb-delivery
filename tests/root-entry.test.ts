import { describe, it, expect, beforeEach } from "vitest";
import { hasClientToken } from "../src/api";

const TOKEN = "A".repeat(43);

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState(null, "", "/");
});

describe("hasClientToken (root route decision)", () => {
  it("is false on a plain root with nothing stored", () => {
    expect(hasClientToken()).toBe(false);
  });

  it("is true when a token is in the fragment", () => {
    history.replaceState(null, "", `/#${TOKEN}`);
    expect(hasClientToken()).toBe(true);
  });

  it("is true when a token is in the legacy /reveal path", () => {
    history.replaceState(null, "", `/reveal/${TOKEN}`);
    expect(hasClientToken()).toBe(true);
  });

  it("is true after the fragment was scrubbed but the token is held in sessionStorage (refresh)", () => {
    sessionStorage.setItem("stb-delivery-token", TOKEN);
    expect(hasClientToken()).toBe(true);
  });

  it("does not consume or scrub the URL", () => {
    history.replaceState(null, "", `/#${TOKEN}`);
    hasClientToken();
    expect(window.location.hash).toBe(`#${TOKEN}`);
    expect(sessionStorage.getItem("stb-delivery-token")).toBeNull();
  });
});
