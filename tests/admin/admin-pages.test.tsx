import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("../../src/admin/data", () => ({
  listClients: vi.fn(), listProjects: vi.fn(), listSupportPeriods: vi.fn(), saveClient: vi.fn(),
  saveProject: vi.fn(), addSupportPeriod: vi.fn(),
  listTemplates: vi.fn(), saveTemplate: vi.fn(), deleteTemplate: vi.fn(),
  getBusinessProfile: vi.fn(), saveBusinessProfile: vi.fn(),
}));
vi.mock("../../src/admin/supabase", () => ({
  supabase: { auth: { mfa: { listFactors: vi.fn() } } },
}));
vi.mock("../../src/admin/auth", () => ({
  useAdminAuth: () => ({ state: { kind: "owner", userId: "u1", email: "owner@example.com" }, signOut: vi.fn(), refresh: vi.fn() }),
}));

import * as data from "../../src/admin/data";
import { supabase } from "../../src/admin/supabase";
import { ClientsPage } from "../../src/admin/pages/Clients";
import { TemplatesPage } from "../../src/admin/pages/Templates";
import { SettingsPage } from "../../src/admin/pages/Settings";

const m = vi.mocked(data);
const mfa = vi.mocked(supabase.auth.mfa.listFactors);

beforeEach(() => {
  vi.clearAllMocks();
  m.listProjects.mockResolvedValue([]);
  m.listSupportPeriods.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("clients page", () => {
  it("refuses to save a client without a name and does not call the database", async () => {
    m.listClients.mockResolvedValue([]);
    render(<MemoryRouter><ClientsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "New client" }));
    fireEvent.click(screen.getByRole("button", { name: "Save client" }));
    expect(await screen.findByText("Add the client's name.")).toBeInTheDocument();
    expect(m.saveClient).not.toHaveBeenCalled();
  });

  it("saves a client with internal notes kept in their own field", async () => {
    m.listClients.mockResolvedValue([]);
    m.saveClient.mockResolvedValue("c1");
    render(<MemoryRouter><ClientsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "New client" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ameer" } });
    fireEvent.change(screen.getByLabelText(/Internal notes/), { target: { value: "Pays late" } });
    fireEvent.click(screen.getByRole("button", { name: "Save client" }));
    await waitFor(() => expect(m.saveClient).toHaveBeenCalledTimes(1));
    expect(m.saveClient.mock.calls[0][0]).toMatchObject({ name: "Ameer", notes: "Pays late" });
  });
});

describe("templates page", () => {
  it("lists templates with their gift and section summary, and says the layout holds no client data", async () => {
    m.listTemplates.mockResolvedValue([{
      id: "t1", name: "Shop site", description: null, theme: "aurora", reveal_gift: false,
      section_layout: [{ key: "walkthrough", visible: true }, { key: "card", visible: false }],
      welcome_title: null, welcome_message: null, support_contact_note: null, closing_message: null,
    }] as never);
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
    expect(await screen.findByText("Shop site")).toBeInTheDocument();
    expect(screen.getByText(/aurora theme · gift box off · 1 sections shown/)).toBeInTheDocument();
  });

  it("deletes only after a second confirmation", async () => {
    m.listTemplates.mockResolvedValue([{
      id: "t1", name: "Shop site", description: null, theme: "ivory", reveal_gift: true,
      section_layout: [], welcome_title: null, welcome_message: null, support_contact_note: null, closing_message: null,
    }] as never);
    m.deleteTemplate.mockResolvedValue(undefined);
    render(<MemoryRouter><TemplatesPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(m.deleteTemplate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete template" }));
    await waitFor(() => expect(m.deleteTemplate).toHaveBeenCalledWith("t1"));
  });
});

describe("settings page", () => {
  it("reports two-factor as on only when a verified authenticator factor exists", async () => {
    mfa.mockResolvedValue({ data: { totp: [{ id: "f1", status: "verified", created_at: "2026-11-01T00:00:00Z" }], all: [{ id: "f1", status: "verified" }] }, error: null } as never);
    m.getBusinessProfile.mockResolvedValue({
      brand_name: "Sam Tech Builds", tagline: null, person_name: null, role_title: null, phone: null, whatsapp: null,
      email: null, website: null, location: null, services: [], support_hours: null,
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(await screen.findByText(/Sign-in asks for a six-digit code/)).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
  });

  it("reports two-factor as not set up when no verified factor exists", async () => {
    mfa.mockResolvedValue({ data: { totp: [], all: [{ id: "f1", status: "unverified" }] }, error: null } as never);
    m.getBusinessProfile.mockResolvedValue({
      brand_name: "Sam Tech Builds", tagline: null, person_name: null, role_title: null, phone: null, whatsapp: null,
      email: null, website: null, location: null, services: [], support_hours: null,
    });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(await screen.findByText(/Two-step sign-in is optional/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up two-step sign-in" })).toBeInTheDocument();
  });
});
