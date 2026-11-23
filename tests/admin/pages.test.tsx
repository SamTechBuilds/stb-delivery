import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

vi.mock("../../src/admin/data", () => ({
  listDeliveries: vi.fn(),
  recentEvents: vi.fn(),
  listProjectsWithClients: vi.fn(),
  listTemplates: vi.fn(),
  getProjectForCopy: vi.fn(),
  createDelivery: vi.fn(),
}));

import * as data from "../../src/admin/data";
import { Dashboard } from "../../src/admin/pages/Dashboard";
import { DeliveryList } from "../../src/admin/pages/DeliveryList";
import { NewDelivery } from "../../src/admin/pages/NewDelivery";

const m = vi.mocked(data);
const future = new Date(Date.now() + 86_400_000).toISOString();

const ROWS = [
  {
    id: "d1", slug: "ameer-project", status: "published", theme: "midnight", project_id: "p1",
    project_title: "Ameer parts site", client_display_name: "Ameer", business_display_name: "S Ameer Ali Spares",
    published_at: null, updated_at: "2026-11-20T10:00:00Z", open_count: 3, last_opened_at: null,
    delivery_tokens: [{ kind: "client", revoked_at: null, expires_at: future }],
  },
  {
    id: "d2", slug: null, status: "draft", theme: "ivory", project_id: "p2",
    project_title: "Bakery site", client_display_name: "Priya", business_display_name: null,
    published_at: null, updated_at: "2026-11-19T10:00:00Z", open_count: 0, last_opened_at: null, delivery_tokens: [],
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => cleanup());

function statValue(label: string): string | undefined {
  const stat = Array.from(document.querySelectorAll(".a-stat")).find(
    (el) => el.querySelector("span")?.textContent === label,
  );
  return stat?.querySelector("strong")?.textContent ?? undefined;
}

describe("dashboard", () => {
  it("shows totals computed from the deliveries, including active private links", async () => {
    m.listDeliveries.mockResolvedValue([...ROWS] as never);
    m.recentEvents.mockResolvedValue([]);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await screen.findByText("Ameer parts site");
    expect(statValue("Total deliveries")).toBe("2");
    expect(statValue("Drafts")).toBe("1");
    expect(statValue("Published")).toBe("1");
    expect(statValue("Private links active")).toBe("1");
  });

  it("shows each delivery with its client, project, status and visibility", async () => {
    m.listDeliveries.mockResolvedValue([...ROWS] as never);
    m.recentEvents.mockResolvedValue([]);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText("Ameer parts site")).toBeInTheDocument();
    expect(screen.getByText(/Public page and private link/)).toBeInTheDocument();
    expect(screen.getByText(/Not visible to clients/)).toBeInTheDocument();
  });

  it("invites the owner to start when there are no deliveries", async () => {
    m.listDeliveries.mockResolvedValue([]);
    m.recentEvents.mockResolvedValue([]);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByText("Start your first delivery")).toBeInTheDocument();
  });

  it("shows a plain error, not a raw database message, when loading fails", async () => {
    m.listDeliveries.mockRejectedValue(Object.assign(new Error('permission denied for table "staff"'), { code: "42501" }));
    m.recentEvents.mockResolvedValue([]);
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission");
    expect(screen.queryByText(/staff/)).toBeNull();
  });
});

describe("delivery list", () => {
  it("filters by status and by search text", async () => {
    m.listDeliveries.mockResolvedValue([...ROWS] as never);
    render(<MemoryRouter><DeliveryList /></MemoryRouter>);
    expect(await screen.findByText("Bakery site")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Published" }));
    expect(screen.queryByText("Bakery site")).toBeNull();
    expect(screen.getByText("Ameer parts site")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "priya" } });
    expect(screen.queryByText("Ameer parts site")).toBeNull();
    expect(screen.getByText("Bakery site")).toBeInTheDocument();
  });
});

describe("new delivery", () => {
  const PROJECT = { id: "p9", name: "Ameer parts site", clients: { name: "Ameer", business_name: "S Ameer Ali Spares" } };
  const COPY = {
    id: "p9", client_id: "c9", name: "Ameer parts site", description: "A shop for spares", live_url: "https://ameer.example",
    completed_on: "2026-11-20", tech_stack: ["React", "Supabase"],
    clients: { id: "c9", name: "Ameer", business_name: "S Ameer Ali Spares" },
  };

  it("creates a draft whose content contains no internal project or client fields", async () => {
    m.listProjectsWithClients.mockResolvedValue([PROJECT] as never);
    m.listTemplates.mockResolvedValue([]);
    // Simulate a project whose internal records hold secrets. The mapping must not copy them.
    m.getProjectForCopy.mockResolvedValue({
      ...COPY, internal_notes: "INTERNAL-SECRET-NOTE", budget_minor: 999999, currency: "XYZ",
      clients: { ...COPY.clients, notes: "CLIENT-SECRET", email: "x@y.co", phone: "+91 000", address: "Hidden Lane" },
    } as never);
    m.createDelivery.mockResolvedValue("new-id");

    render(<MemoryRouter initialEntries={["/admin/deliveries/new"]}><Routes><Route path="/admin/deliveries/new" element={<NewDelivery />} /><Route path="/admin/deliveries/:id" element={<p>EDITOR</p>} /></Routes></MemoryRouter>);
    const select = await screen.findByRole("combobox", { name: "Project" });
    fireEvent.change(select, { target: { value: "p9" } });
    await screen.findByText("The draft will start with");
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => expect(m.createDelivery).toHaveBeenCalledTimes(1));
    const sent = JSON.stringify(m.createDelivery.mock.calls[0][0]);
    for (const secret of ["INTERNAL-SECRET-NOTE", "999999", "XYZ", "CLIENT-SECRET", "x@y.co", "+91 000", "Hidden Lane"]) {
      expect(sent).not.toContain(secret);
    }
    expect(sent).toContain("Ameer parts site");
    expect(await screen.findByText("EDITOR")).toBeInTheDocument();
  });

  it("tells the owner to add a project first when none exist", async () => {
    m.listProjectsWithClients.mockResolvedValue([]);
    m.listTemplates.mockResolvedValue([]);
    render(<MemoryRouter><NewDelivery /></MemoryRouter>);
    expect(await screen.findByText("You need a project before you can create a delivery.")).toBeInTheDocument();
  });
});
