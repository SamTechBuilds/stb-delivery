/**
 * Private link tokens. Generated in the owner's browser from 32 random bytes (CSPRNG), shown once,
 * and sent to STB Core only as a SHA-256 hex digest. The database never sees the plaintext.
 * Links carry the token in the URL fragment (/#<token>): browsers never send it to a server.
 */

const B64URL = /^[A-Za-z0-9_-]{43}$/;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function tokenHint(token: string): string {
  return token.slice(-4);
}

export function isWellFormedToken(token: string): boolean {
  return B64URL.test(token);
}

/** The link the client receives. The fragment keeps the token out of logs and Referer headers. */
export function privateLink(token: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/#${token}`;
}
