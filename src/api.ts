import type { ApiError, DeliveryPayload } from "./types";

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Tokens travel in the URL fragment (`/#<token>`), which browsers never send to the server or in
 * the Referer header. `/reveal/<token>` is accepted for hand-typed links but is not generated.
 */
export function readToken(loc: Pick<Location, "hash" | "pathname"> = window.location): string | null {
  const fromHash = decodeURIComponent(loc.hash.replace(/^#\/?/, "").replace(/^t=/, ""));
  if (TOKEN_RE.test(fromHash)) return fromHash;
  const m = loc.pathname.match(/\/reveal\/([A-Za-z0-9_-]{43})\/?$/);
  return m ? m[1] : null;
}

export class DeliveryApiError extends Error {
  constructor(public code: ApiError) {
    super(code);
  }
}

interface Config {
  url: string | undefined;
  anonKey: string | undefined;
  fetchImpl?: typeof fetch;
}

const defaultConfig = (): Config => ({
  url: import.meta.env.VITE_DELIVERY_API_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

async function call<T>(body: Record<string, unknown>, cfg: Config): Promise<T> {
  if (!cfg.url) throw new DeliveryApiError("not_configured");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.anonKey) headers.apikey = cfg.anonKey;
  let res: Response;
  try {
    res = await (cfg.fetchImpl ?? fetch)(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
  } catch {
    throw new DeliveryApiError("network");
  }
  if (res.ok) return (await res.json()) as T;
  if (res.status === 404) throw new DeliveryApiError("not_found");
  if (res.status === 429) throw new DeliveryApiError("rate_limited");
  if (res.status === 400) throw new DeliveryApiError("bad_request");
  throw new DeliveryApiError("server_error");
}

export function openDelivery(token: string, cfg: Config = defaultConfig()) {
  return call<DeliveryPayload>({ action: "open", token }, cfg);
}

export function requestFile(token: string, assetId: string, cfg: Config = defaultConfig()) {
  return call<{ url: string; file_name: string }>({ action: "file", token, assetId }, cfg);
}
