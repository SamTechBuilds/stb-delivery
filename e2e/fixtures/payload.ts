import type { DeliveryPayload } from "../../src/types";

export const TOKEN = "Abc123_-Abc123_-Abc123_-Abc123_-Abc123_-xyz"; // 43 chars
export const API = "https://mockref.supabase.co/functions/v1/delivery-api";
export const IMG = "https://mockref.supabase.co/storage/v1/object/sign/delivery-files";

export function payload(overrides: Partial<DeliveryPayload> = {}): DeliveryPayload {
  return {
    preview: false,
    delivery: {
      theme: "midnight",
      client_name: "Priya",
      business_name: "Priya's Bakehouse",
      welcome_title: "Your new website is ready",
      welcome_message: "Thank you for trusting us with your bakery's first website. We built it to make ordering as easy as walking in.",
      project_title: "Priya's Bakehouse website",
      project_summary: "A fast, mobile-first website with your full menu, daily specials and WhatsApp ordering, ready for Google.",
      live_url: "https://priyasbakehouse.example",
      tech_list: ["React", "Vite", "Supabase", "Netlify"],
      completed_on: "2026-11-23",
      video_url: null,
      handover_checklist: [
        { label: "Domain connected and secured with HTTPS", done: true },
        { label: "Admin login shared through a one-time link", done: true },
        { label: "Google Business Profile linked", done: false },
      ],
      support_contact_note: "Message us any time. We reply within one working day.",
      closing_message: "It was a pleasure building this with you.",
    },
    support: {
      plan_name: "Six-month care plan",
      starts_on: "2026-11-23",
      ends_on: "2027-05-23",
      terms: "Includes bug fixes, security updates and up to two small content changes a month.",
    },
    card: {
      brand_name: "Sam Tech Builds",
      tagline: "Websites and software for growing businesses",
      person_name: "Asif",
      role_title: "Founder",
      phone: "+91 90000 00000",
      whatsapp: "+91 90000 00000",
      email: "hello@samtechbuilds.example",
      website: "https://samtechbuilds.netlify.app",
      location: "Chennai, India",
      services: ["Websites", "Business apps", "Automation"],
      socials: [{ label: "LinkedIn", url: "https://www.linkedin.com/company/example" }],
      support_hours: "Monday to Saturday, 10 am to 7 pm IST",
    },
    assets: [
      { id: "00000000-0000-4000-8000-000000000001", kind: "screenshot", title: "Home page", description: null, file_name: "home.png", mime_type: "image/png", size_bytes: 31000, url: `${IMG}/home.png` },
      { id: "00000000-0000-4000-8000-000000000002", kind: "screenshot", title: "Menu", description: "Prices update from your admin panel.", file_name: "menu.png", mime_type: "image/png", size_bytes: 29000, url: `${IMG}/menu.png` },
      { id: "00000000-0000-4000-8000-000000000003", kind: "screenshot", title: "Ordering", description: null, file_name: "order.png", mime_type: "image/png", size_bytes: 31000, url: `${IMG}/order.png` },
      { id: "00000000-0000-4000-8000-000000000004", kind: "document", title: "Owner's guide", description: "How to update your menu, specials and opening hours.", file_name: "owners-guide.pdf", mime_type: "application/pdf", size_bytes: 1_240_000 },
      { id: "00000000-0000-4000-8000-000000000005", kind: "document", title: "Brand assets", description: null, file_name: "brand-assets.zip", mime_type: "application/zip", size_bytes: 8_600_000 },
    ],
    gift_items: [],
    ...overrides,
  };
}
