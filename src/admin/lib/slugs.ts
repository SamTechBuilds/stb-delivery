/**
 * Slug rules, checked here for fast feedback. STB Core is the authority: the slug check constraint,
 * the reserved_slugs trigger and set_delivery_status all enforce the same rules on the server.
 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

/** Mirrors the slugs listed in STB Core migration 20261120000005. A test keeps the two in step. */
export const RESERVED_SLUGS: readonly string[] = [
  "admin", "login", "logout", "signup", "auth", "oauth",
  "assets", "static", "public", "api", "rpc",
  "reveal", "health", "status", "ping",
  "favicon.ico", "robots.txt", "sitemap.xml", "manifest.json",
  "sw.js", "service-worker.js",
  "_redirects", "_headers", "404", "500",
  "help", "docs", "support", "terms", "privacy", "legal",
  "about", "contact", "careers", "blog", "news",
  "stb", "samtechbuilds", "sam-tech-builds",
];

export type SlugCheck =
  | { ok: true; value: string }
  | { ok: true; value: null }
  | { ok: false; error: string };

/** An empty slug means "no public page": the delivery is reachable only by its private links. */
export function checkSlug(raw: string): SlugCheck {
  const value = raw.trim().toLowerCase();
  if (value === "") return { ok: true, value: null };
  if (value.length < 3) return { ok: false, error: "Use at least 3 characters." };
  if (value.length > 80) return { ok: false, error: "Use 80 characters or fewer." };
  if (value.includes("---")) return { ok: false, error: "Avoid three hyphens in a row." };
  if (!SLUG_RE.test(value)) return { ok: false, error: "Use lowercase letters, numbers and single hyphens. Start and end with a letter or number." };
  if (RESERVED_SLUGS.includes(value)) return { ok: false, error: `"${value}" is reserved for the site itself. Choose another.` };
  return { ok: true, value };
}

export function publicUrl(slug: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/${slug}`;
}
