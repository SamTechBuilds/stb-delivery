/**
 * Public slug API client.
 *
 * Calls the delivery-public Edge Function (a GET endpoint) rather than the
 * token-based delivery-api (a POST endpoint). The two share a response shape
 * but use different auth models:
 *
 *   Token path: POST with a base64url token in the body → private delivery.
 *   Slug path:  GET  /delivery-public/<slug>           → published delivery only.
 *
 * Both return a DeliveryPayload. The slug path never returns previews or
 * draft/revoked deliveries. File downloads are not available through the
 * slug path (screenshots are pre-signed; documents require a token link).
 */
import type { DeliveryPayload } from "./types";
import { DeliveryApiError } from "./api";

interface SlugConfig {
  /** Base URL of the Supabase project, e.g. https://xyz.supabase.co */
  supabaseUrl: string | undefined;
  /** The publishable/anon key, sent as the apikey header. */
  anonKey: string | undefined;
  fetchImpl?: typeof fetch;
}

const defaultSlugConfig = (): SlugConfig => ({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

/**
 * Fetch a published delivery by its slug.
 *
 * The Edge Function is at `/functions/v1/delivery-public/<slug>` and returns
 * the same DeliveryPayload shape as the token path's "open" action, minus
 * download URLs for documents (those require a token).
 */
export async function openBySlug(
  slug: string,
  cfg: SlugConfig = defaultSlugConfig(),
): Promise<DeliveryPayload> {
  if (!cfg.supabaseUrl) throw new DeliveryApiError("not_configured");

  const url = `${cfg.supabaseUrl.replace(/\/+$/, "")}/functions/v1/delivery-public/${encodeURIComponent(slug)}`;
  const headers: Record<string, string> = {};
  if (cfg.anonKey) headers.apikey = cfg.anonKey;

  let res: Response;
  try {
    res = await (cfg.fetchImpl ?? fetch)(url, {
      method: "GET",
      headers,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
  } catch {
    throw new DeliveryApiError("network");
  }

  if (res.ok) return (await res.json()) as DeliveryPayload;
  if (res.status === 404) throw new DeliveryApiError("not_found");
  if (res.status === 429) throw new DeliveryApiError("rate_limited");
  if (res.status === 400) throw new DeliveryApiError("bad_request");
  throw new DeliveryApiError("server_error");
}

/** The slug regex from stb-core, used for client-side validation before making a request. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;

/** Validate and normalise a slug. Returns lowercase or null. */
export function normaliseSlug(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (!SLUG_RE.test(lower)) return null;
  if (/---/.test(lower)) return null;
  return lower;
}
