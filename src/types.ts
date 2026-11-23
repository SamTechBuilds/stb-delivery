// Mirrors the delivery-api response. Every field is optional on the wire except the obvious ones,
// because the owner may leave most of them blank.

export type Theme = "midnight" | "aurora" | "ivory";

export type SectionKey = "walkthrough" | "screens" | "handover" | "support" | "card";

export interface ChecklistItem {
  label: string;
  done?: boolean;
}

export interface DeliveryInfo {
  theme: Theme;
  client_name: string;
  business_name: string | null;
  welcome_title: string | null;
  welcome_message: string | null;
  project_title: string;
  project_summary: string | null;
  live_url: string | null;
  tech_list: string[];
  completed_on: string | null;
  video_url: string | null;
  handover_checklist: ChecklistItem[];
  support_contact_note: string | null;
  closing_message: string | null;
  /** Added in STB Core 0007. Absent on older responses: treat as true. */
  reveal_gift?: boolean;
  /** Visible sections in the owner's order. Absent on older responses: all sections, default order. */
  sections?: SectionKey[];
}

export interface SupportInfo {
  plan_name: string;
  starts_on: string;
  ends_on: string;
  terms: string | null;
}

export interface SocialLink {
  label: string;
  url: string;
}

export interface CardInfo {
  brand_name: string;
  tagline: string | null;
  person_name: string | null;
  role_title: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  location: string | null;
  services: string[];
  socials: SocialLink[];
  support_hours: string | null;
}

export interface Asset {
  id: string;
  kind: "screenshot" | "document";
  title: string;
  description: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  url?: string | null;
}

export interface DeliveryPayload {
  delivery: DeliveryInfo;
  support: SupportInfo | null;
  card: CardInfo | null;
  assets: Asset[];
  preview: boolean;
}

export type ApiError = "not_found" | "rate_limited" | "network" | "server_error" | "bad_request" | "not_configured";
