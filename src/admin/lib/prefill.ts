import { defaultLayout } from "./layout";

/** Only the columns a client may ever see are read from the internal records. */
export interface ProjectForCopy {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  live_url: string | null;
  completed_on: string | null;
  tech_stack: string[];
}
export interface ClientForCopy {
  id: string;
  name: string;
  business_name: string | null;
}

export interface TemplateForCopy {
  theme: "midnight" | "aurora" | "ivory";
  section_layout: unknown;
  reveal_gift: boolean;
  welcome_title: string | null;
  welcome_message: string | null;
  support_contact_note: string | null;
  closing_message: string | null;
}

/** The exact insert payload for a new delivery. Internal fields are never in this shape. */
export interface NewDeliveryDraft {
  project_id: string;
  client_display_name: string;
  business_display_name: string | null;
  project_title: string;
  project_summary: string | null;
  live_url: string | null;
  tech_list: string[];
  completed_on: string | null;
  theme: "midnight" | "aurora" | "ivory";
  section_layout: ReturnType<typeof defaultLayout>;
  reveal_gift: boolean;
  welcome_title: string | null;
  welcome_message: string | null;
  support_contact_note: string | null;
  closing_message: string | null;
}

/**
 * Copy a project's client-facing facts into a new delivery. Internal notes, budget, currency,
 * the client's email, phone and address, and the client's internal notes are deliberately absent.
 */
export function draftFromProject(project: ProjectForCopy, client: ClientForCopy): NewDeliveryDraft {
  return {
    project_id: project.id,
    client_display_name: client.name,
    business_display_name: client.business_name,
    project_title: project.name,
    project_summary: project.description,
    live_url: project.live_url,
    tech_list: project.tech_stack.slice(0, 30),
    completed_on: project.completed_on,
    theme: "midnight",
    section_layout: defaultLayout(),
    reveal_gift: true,
    welcome_title: null,
    welcome_message: null,
    support_contact_note: null,
    closing_message: null,
  };
}

/** Apply a template's presentation and generic copy. A template never carries client data. */
export function applyTemplate(draft: NewDeliveryDraft, t: TemplateForCopy): NewDeliveryDraft {
  return {
    ...draft,
    theme: t.theme,
    section_layout: t.section_layout as NewDeliveryDraft["section_layout"],
    reveal_gift: t.reveal_gift,
    welcome_title: t.welcome_title,
    welcome_message: t.welcome_message,
    support_contact_note: t.support_contact_note,
    closing_message: t.closing_message,
  };
}
