import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../src/admin/data", () => ({
  issueLink: vi.fn().mockResolvedValue("id"),
}));

import * as data from "../../src/admin/data";
import { PreviewPanel } from "../../src/admin/pages/DeliveryTools";

afterEach(() => cleanup());

describe("preview panel", () => {
  it("issues a one-hour preview token and loads it in the fragment of the public page", async () => {
    render(<PreviewPanel deliveryId="d1" dirty={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Load preview" }));
    await waitFor(() => expect(data.issueLink).toHaveBeenCalledTimes(1));
    const args = vi.mocked(data.issueLink).mock.calls[0][1];
    expect(args.kind).toBe("preview");
    expect(args.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const expires = Date.parse(args.expiresAt ?? "");
    expect(expires - Date.now()).toBeLessThanOrEqual(60 * 60_000 + 1000);
    const frame = await screen.findByTitle("Client preview");
    expect(frame.getAttribute("src")).toMatch(/^\/#[A-Za-z0-9_-]{43}$/);
  });

  it("switches between desktop and mobile widths", async () => {
    render(<PreviewPanel deliveryId="d1" dirty={false} />);
    const desktop = screen.getByRole("button", { name: "Desktop" });
    const mobile = screen.getByRole("button", { name: "Mobile" });
    expect(desktop.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(mobile);
    expect(mobile.getAttribute("aria-pressed")).toBe("true");
    expect(desktop.getAttribute("aria-pressed")).toBe("false");
  });
});
