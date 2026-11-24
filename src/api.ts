import type { ApiError, DeliveryPayload } from "./types";

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const SS_KEY = "stb-delivery-token";

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

/**
 * True when this tab is holding a private client delivery: a token in the URL, or one already
 * stored for refresh and back/forward. Read-only: it does not scrub the URL or store anything,
 * so the root route can decide between client delivery and the admin entry before the token
 * is consumed by TokenDelivery.
 */
export function hasClientToken(): boolean {
  if (readToken() !== null) return true;
  try {
    return sessionStorage.getItem(SS_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Read the token from the URL fragment or sessionStorage, then scrub the fragment from the
 * address bar and browser history so the token does not persist in navigation history.
 *
 * Recovery path (refresh, back/forward):
 *   - On first visit: token is in the hash → stored to sessionStorage → hash is cleared.
 *   - On reload or return: hash is gone, token is recovered from sessionStorage.
 *   - On error (not_found / rate_limited): call clearSessionToken() to remove the stale entry.
 *
 * The token is never sent to the server. sessionStorage is scoped to the tab and cleared when
 * the tab closes, so it does not persist across sessions.
 */
export function readTokenWithFallback(): string | null {
  const fromUrl = readToken();
  if (fromUrl) {
    // Scrub the fragment from the address bar without adding a history entry.
    // This runs synchronously before the first render.
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch { /* private browsing may block history API */ }
    // Store in sessionStorage so refresh and back/forward navigation can recover the token.
    try {
      sessionStorage.setItem(SS_KEY, fromUrl);
    } catch { /* storage quota or private browsing */ }
    return fromUrl;
  }
  // Hash is gone — try sessionStorage (refresh or back/forward navigation).
  try {
    const stored = sessionStorage.getItem(SS_KEY);
    if (stored && TOKEN_RE.test(stored)) return stored;
  } catch { /* private browsing */ }
  return null;
}

/** Remove the session token after a definitive failure (not_found, bad_request). */
export function clearSessionToken(): void {
  try { sessionStorage.removeItem(SS_KEY); } catch { /* ok */ }
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
