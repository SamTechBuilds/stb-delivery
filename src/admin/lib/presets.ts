/**
 * Starter templates shipped with the app. They are plain data, not database rows: choosing one
 * pre-fills the Templates editor, and nothing is saved until the owner clicks Save. They hold
 * wording, theme and section visibility only, never client or project details.
 */
import type { TemplateRecord } from "../data";
import { defaultLayout, type SectionKey } from "./layout";

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  theme: TemplateRecord["theme"];
  reveal_gift: boolean;
  welcome_title: string;
  welcome_message: string;
  support_contact_note: string | null;
  closing_message: string | null;
  hidden?: SectionKey[];
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "clean-launch",
    name: "Clean launch",
    description: "Dark theme with the gift box. For a new website going live.",
    theme: "midnight",
    reveal_gift: true,
    welcome_title: "Your new website is ready",
    welcome_message: "Thank you for trusting us with your project. Everything you need to look after it is in one place.",
    support_contact_note: "Questions about your website? Get in touch and we will reply within one working day.",
    closing_message: "Thank you for working with us.",
  },
  {
    id: "print-minded",
    name: "Print-minded",
    description: "Light, paper-like theme for clients who share and print their pages.",
    theme: "ivory",
    reveal_gift: true,
    welcome_title: "Your project, delivered",
    welcome_message: "Here is the finished work, the files you can keep, and how to get support.",
    support_contact_note: null,
    closing_message: null,
  },
  {
    id: "direct-handover",
    name: "Direct handover",
    description: "No gift box. The client opens straight onto the project.",
    theme: "aurora",
    reveal_gift: false,
    welcome_title: "Your application is handed over",
    welcome_message: "The project is complete. The handover checklist below confirms what has been delivered.",
    support_contact_note: null,
    closing_message: null,
    hidden: ["card"],
  },
  {
    id: "plain",
    name: "Plain",
    description: "Minimal wording and no gift box. Start from a blank page and add your own text.",
    theme: "ivory",
    reveal_gift: false,
    welcome_title: "",
    welcome_message: "",
    support_contact_note: null,
    closing_message: null,
  },
];

/** Converts a preset into the fields the template editor reads. */
export function presetSeed(p: TemplatePreset): Partial<TemplateRecord> {
  return {
    name: p.name,
    theme: p.theme,
    reveal_gift: p.reveal_gift,
    welcome_title: p.welcome_title || null,
    welcome_message: p.welcome_message || null,
    support_contact_note: p.support_contact_note,
    closing_message: p.closing_message,
    section_layout: defaultLayout().map((item) => ({ ...item, visible: !(p.hidden ?? []).includes(item.key) })),
  };
}
