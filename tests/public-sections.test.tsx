import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProjectPage } from "../src/components/ProjectPage";
import { DEFAULT_SECTIONS, sectionOrder, showsGift } from "../src/sections";
import type { DeliveryPayload } from "../src/types";

afterEach(() => cleanup());

function payload(over: Partial<DeliveryPayload["delivery"]> = {}): DeliveryPayload {
  return {
    delivery: {
      theme: "midnight", client_name: "Ameer", business_name: null, welcome_title: null, welcome_message: null,
      project_title: "Parts site", project_summary: null, live_url: null, tech_list: [], completed_on: null,
      video_url: "https://youtube.com", handover_checklist: [{ label: "Domain handed over" }],
      support_contact_note: null, closing_message: null,
      ...over,
    },
    support: { plan_name: "Care plan", starts_on: "2026-11-01", ends_on: "2027-11-01", terms: null },
    card: { brand_name: "Sam Tech Builds", tagline: null, person_name: null, role_title: null, phone: null, whatsapp: null,
      email: null, website: null, location: null, services: [], socials: [], support_hours: null },
    assets: [],
    gift_items: [],
    preview: false,
  };
}

const noop = async () => {};

function headingsIn(): string[] {
  return screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent ?? "");
}

describe("sectionOrder", () => {
  it("keeps the default order when nothing is stored", () => {
    expect(sectionOrder(undefined)).toEqual([...DEFAULT_SECTIONS]);
    expect(sectionOrder("nope")).toEqual([...DEFAULT_SECTIONS]);
  });

  it("drops unknown and repeated keys and keeps the owner's order", () => {
    expect(sectionOrder(["card", "bogus", "card", "walkthrough"])).toEqual(["card", "walkthrough"]);
  });
});

describe("gift box setting", () => {
  it("shows the gift unless the owner switched it off", () => {
    expect(showsGift({ reveal_gift: false })).toBe(false);
    expect(showsGift({ reveal_gift: true })).toBe(true);
    expect(showsGift({})).toBe(true);
  });
});

describe("project page sections", () => {
  it("renders the visible sections in the owner's order", () => {
    render(<ProjectPage data={payload({ sections: ["card", "handover", "walkthrough"] })} onDownload={noop} />);
    expect(headingsIn()).toEqual(["Keep in touch", "Your handover", "Walkthrough"]);
  });

  it("leaves out sections the owner has hidden, even when the data is present", () => {
    render(<ProjectPage data={payload({ sections: ["handover"] })} onDownload={noop} />);
    expect(headingsIn()).toEqual(["Your handover"]);
    expect(screen.queryByText("Walkthrough")).toBeNull();
    expect(screen.queryByText("Keep in touch")).toBeNull();
  });

  it("shows every section in default order when the list is absent", () => {
    render(<ProjectPage data={payload()} onDownload={noop} />);
    expect(headingsIn()).toEqual(["Walkthrough", "Your handover", "Support", "Keep in touch"]);
  });
});
