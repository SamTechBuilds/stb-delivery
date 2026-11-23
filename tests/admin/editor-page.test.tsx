import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

vi.mock("../../src/admin/data", () => ({
  getDelivery: vi.fn(),
  listAssets: vi.fn(),
  listLinks: vi.fn(),
  recentEvents: vi.fn(),
  listSupportPeriods: vi.fn(),
  updateDelivery: vi.fn(),
  setStatus: vi.fn(),
  issueLink: vi.fn(),
  revokeLink: vi.fn(),
  saveTemplate: vi.fn(),
  addAsset: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
  signAsset: vi.fn(),
}));

import * as data from "../../src/admin/data";
import { DeliveryEditor } from "../../src/admin/pages/DeliveryEditor";
import { defaultLayout } from "../../src/admin/lib/layout";

const m = vi.mocked(data);

function record(over: Record<string, unknown> = {}) {
  return {
    id: "d1",
    project_id: "p1",
    status: "draft",
    slug: null,
    theme: "midnight",
    client_display_name: "Ameer",
    business_display_name: "S Ameer Ali Spares",
    project_title: "Parts site",
    project_summary: null,
    live_url: "https://ameer.example",
    tech_list: ["React"],
    completed_on: null,
    video_url: null,
    handover_checklist: [{ label: "Domain handed over", done: false }],
    welcome_title: null,
    welcome_message: null,
    support_contact_note: null,
    closing_message: null,
    support_period_id: null,
    section_layout: defaultLayout(),
    reveal_gift: true,
    updated_at: "2026-11-20T10:00:00Z",
    open_count: 0,
    last_opened_at: null,
    published_at: null,
    ...over,
  };
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/admin/deliveries/d1"]}>
      <Routes>
        <Route path="/admin/deliveries/:id" element={<DeliveryEditor />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getDelivery.mockResolvedValue(record() as never);
  m.listAssets.mockResolvedValue([]);
  m.listLinks.mockResolvedValue([]);
  m.recentEvents.mockResolvedValue([]);
  m.listSupportPeriods.mockResolvedValue([]);
  m.updateDelivery.mockResolvedValue(undefined);
  m.setStatus.mockResolvedValue(undefined);
  m.issueLink.mockResolvedValue("token-id");
});
afterEach(() => cleanup());

describe("delivery editor", () => {
  it("loads the delivery, and keeps Save and Publish disabled until the form is valid and saved", async () => {
    renderEditor();
    expect(await screen.findByRole("heading", { name: "Parts site" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("blocks publishing while there are unsaved changes", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Parts site" });
    fireEvent.change(screen.getByLabelText("Project title"), { target: { value: "Parts site v2" } });
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("refuses a reserved slug with a plain reason and does not call the database", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Parts site" });
    fireEvent.change(screen.getByLabelText(/Public address/), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/reserved for the site itself/)).toBeInTheDocument();
    expect(m.updateDelivery).not.toHaveBeenCalled();
  });

  it("saves only the approved fields and the chosen slug", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Parts site" });
    fireEvent.change(screen.getByLabelText(/Public address/), { target: { value: "ameer-parts" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.updateDelivery).toHaveBeenCalledTimes(1));
    const [id, patch] = m.updateDelivery.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(id).toBe("d1");
    expect(patch.slug).toBe("ameer-parts");
    expect(Object.keys(patch)).not.toEqual(expect.arrayContaining(["internal_notes", "budget_minor", "email", "phone", "address"]));
  });

  it("publishes a saved, valid draft through the database status function", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Parts site" });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(m.setStatus).toHaveBeenCalledWith("d1", "published"));
  });

  it("archives only after a second confirmation, and never revokes links", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Parts site" });
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(m.setStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Archive (links are kept)" }));
    await waitFor(() => expect(m.setStatus).toHaveBeenCalledWith("d1", "archived"));
    expect(m.revokeLink).not.toHaveBeenCalled();
  });

  it("sends a reordered and hidden section layout when saved from the builder", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Parts site" });
    fireEvent.click(screen.getByRole("tab", { name: "Builder" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Walkthrough video down" }));
    fireEvent.click(screen.getByLabelText("Show Visiting card"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.updateDelivery).toHaveBeenCalledTimes(1));
    const layout = (m.updateDelivery.mock.calls[0][1] as { section_layout: { key: string; visible: boolean }[] }).section_layout;
    expect(layout.map((i) => i.key)).toEqual(["screens", "walkthrough", "handover", "support", "card"]);
    expect(layout.find((i) => i.key === "card")?.visible).toBe(false);
  });

  it("shows a private link once, and stores only its hash", async () => {
    renderEditor();
    await screen.findByRole("heading", { name: "Parts site" });
    fireEvent.click(screen.getByRole("tab", { name: "Private links" }));
    fireEvent.click(screen.getByRole("button", { name: "Create link" }));
    await waitFor(() => expect(m.issueLink).toHaveBeenCalledTimes(1));
    const args = m.issueLink.mock.calls[0][1] as Record<string, unknown>;
    expect(args.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const shown = (screen.getByLabelText("New private link") as HTMLInputElement).value;
    expect(shown).toMatch(/\/#[A-Za-z0-9_-]{43}$/);
    const token = shown.split("/#")[1];
    expect(JSON.stringify(args)).not.toContain(token);
    expect(within(screen.getByRole("status")).getByText(/will not be shown again/)).toBeInTheDocument();
  });
});
