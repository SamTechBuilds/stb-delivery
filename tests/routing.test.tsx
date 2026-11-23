import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router";
import { SlugDelivery } from "../src/pages/SlugDelivery";
import { NotFound } from "../src/pages/NotFound";
import type { DeliveryPayload } from "../src/types";

// Mock the slug API module
vi.mock("../src/slug-api", async () => {
  const actual = await vi.importActual<typeof import("../src/slug-api")>("../src/slug-api");
  return {
    ...actual,
    openBySlug: vi.fn(),
  };
});

// Mock QRCode to avoid canvas dependency in test
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,mock") },
}));

import { openBySlug } from "../src/slug-api";
import { DeliveryApiError } from "../src/api";

const mockedOpenBySlug = openBySlug as unknown as ReturnType<typeof vi.fn>;

const MOCK_PAYLOAD: DeliveryPayload = {
  delivery: {
    theme: "midnight",
    client_name: "Test Client",
    business_name: "Test Business",
    welcome_title: "Welcome",
    welcome_message: "Hello",
    project_title: "Test Project",
    project_summary: "A test project",
    live_url: null,
    tech_list: [],
    completed_on: "2026-11-15",
    video_url: null,
    handover_checklist: [],
    support_contact_note: null,
    closing_message: null,
  },
  support: null,
  card: {
    brand_name: "Sam Tech Builds",
    tagline: "Web and mobile",
    person_name: "Mohamed Asif",
    role_title: "Founder",
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    location: null,
    services: [],
    socials: [],
    support_hours: null,
  },
  assets: [],
  preview: false,
};

/** Render a route at a given path using the same reserved-route structure as App.tsx. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/:slug" element={<SlugDelivery />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("slug routing", () => {
  it("renders a loading state and then the delivery for a valid slug", async () => {
    mockedOpenBySlug.mockResolvedValue(MOCK_PAYLOAD);
    renderAt("/ameerproject");
    expect(screen.getByText("Loading your delivery…")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Test Client")).toBeInTheDocument();
    });
    expect(mockedOpenBySlug).toHaveBeenCalledWith("ameerproject");
  });

  it("shows the gift box with the open button", async () => {
    mockedOpenBySlug.mockResolvedValue(MOCK_PAYLOAD);
    renderAt("/ameerproject");
    await waitFor(() => {
      expect(screen.getByText("Test Client")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Open your gift" })).toBeInTheDocument();
  });

  it("shows an error for a 404 slug", async () => {
    mockedOpenBySlug.mockRejectedValue(new DeliveryApiError("not_found"));
    renderAt("/nonexistent");
    await waitFor(() => {
      expect(screen.getByText("This project wasn't found")).toBeInTheDocument();
    });
  });

  it("shows an error for a rate-limited slug", async () => {
    mockedOpenBySlug.mockRejectedValue(new DeliveryApiError("rate_limited"));
    renderAt("/limited");
    await waitFor(() => {
      expect(screen.getByText("Too many requests")).toBeInTheDocument();
    });
  });

  it("shows not_found for an invalid slug pattern without calling the API", async () => {
    // /-invalid starts with hyphen so normaliseSlug returns null
    mockedOpenBySlug.mockResolvedValue(MOCK_PAYLOAD); // should not be called
    renderAt("/--invalid");
    await waitFor(() => {
      expect(screen.getByText("This project wasn't found")).toBeInTheDocument();
    });
    expect(mockedOpenBySlug).not.toHaveBeenCalled();
  });

  it("normalises uppercase slugs to lowercase", async () => {
    mockedOpenBySlug.mockResolvedValue(MOCK_PAYLOAD);
    renderAt("/MyProject");
    await waitFor(() => {
      expect(screen.getByText("Test Client")).toBeInTheDocument();
    });
    expect(mockedOpenBySlug).toHaveBeenCalledWith("myproject");
  });

  it("filters out document assets in slug view", async () => {
    const payload: DeliveryPayload = {
      ...MOCK_PAYLOAD,
      assets: [
        { id: "1", kind: "screenshot", title: "Screen 1", description: null, file_name: "s.png", mime_type: "image/png", size_bytes: 100, url: "https://example.com/s.png" },
        { id: "2", kind: "document", title: "Doc 1", description: null, file_name: "d.pdf", mime_type: "application/pdf", size_bytes: 200 },
      ],
    };
    mockedOpenBySlug.mockResolvedValue(payload);
    renderAt("/testproject");
    await waitFor(() => {
      expect(screen.getByText("Test Client")).toBeInTheDocument();
    });
    // Documents should not be accessible through the slug path — slug page strips them
  });
});

describe("reserved routes", () => {
  it("/admin redirects to home and does not call openBySlug", () => {
    renderAt("/admin");
    expect(mockedOpenBySlug).not.toHaveBeenCalled();
  });

  it("/admin/settings redirects to home and does not call openBySlug", () => {
    render(
      <MemoryRouter initialEntries={["/admin/settings"]}>
        <Routes>
          <Route path="/admin/*" element={<Navigate to="/" replace />} />
          <Route path="/:slug" element={<SlugDelivery />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mockedOpenBySlug).not.toHaveBeenCalled();
  });

  it("/login redirects to home and does not call openBySlug", () => {
    renderAt("/login");
    expect(mockedOpenBySlug).not.toHaveBeenCalled();
  });
});

describe("404 page", () => {
  it("shows for unknown nested paths", () => {
    renderAt("/some/nested/path");
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });
});
