/**
 * Optional TOTP two-factor sign-in, through Supabase Auth.
 *
 * Rules this module keeps:
 *   - Nothing is required. An owner with no verified factor signs in with a password and works.
 *   - A factor counts as "on" only after a code verifies against it (listFactors status "verified").
 *   - The TOTP secret and QR code live in component state for the setup screen only. They are never
 *     written to storage, logged, or sent to an application table.
 *   - Disabling needs the account password and a current code, and the database still checks
 *     the AAL2 session. Password checks use a second, non-persisting client, so the signed-in
 *     session is never replaced mid-flow.
 *   - One verified authenticator per owner: setup is hidden while one is on.
 */

export interface FactorInfo {
  id: string;
  status: "verified" | "unverified";
  created_at?: string;
  friendly_name?: string | null;
}

export interface MfaApi {
  listFactors(): Promise<{ data: { all: FactorInfo[]; totp: FactorInfo[] } | null; error: { message: string } | null }>;
  enroll(p: { factorType: "totp"; friendlyName?: string }): Promise<{
    data: { id: string; totp: { qr_code: string; secret: string } } | null;
    error: { message: string } | null;
  }>;
  challengeAndVerify(p: { factorId: string; code: string }): Promise<{ error: { message: string } | null }>;
  unenroll(p: { factorId: string }): Promise<{ error: { message: string } | null }>;
}

/** Returns the user id when the password is right for this email, or null when it is wrong. */
export type PasswordCheck = (email: string, password: string) => Promise<string | null>;

export type MfaStatus =
  | { state: "off"; pendingFactorId: string | null }
  | { state: "on"; factorId: string; since: string | null };

export class MfaError extends Error {}

const SVG_PREFIX = "data:image/svg+xml;utf-8,";

/**
 * supabase-js adds the data-URI prefix to the QR SVG without encoding it. An SVG with a "#" (a colour,
 * for example) then cuts the image short in the browser. This re-encodes the SVG so the image always
 * loads, and it also accepts a value that is already a prefixed data URI.
 */
export function qrImageSrc(raw: string): string {
  let body = raw;
  while (body.startsWith(SVG_PREFIX)) body = body.slice(SVG_PREFIX.length);
  if (body.startsWith("%3C")) body = decodeURIComponent(body);
  return `${SVG_PREFIX}${encodeURIComponent(body)}`;
}

const CODE_RE = /^\d{6}$/;
export const normaliseCode = (raw: string) => raw.replace(/\s/g, "");

export async function getMfaStatus(api: MfaApi): Promise<MfaStatus> {
  const res = await api.listFactors();
  if (res.error || !res.data) throw new MfaError("Couldn't check two-factor sign-in right now. Reload to try again.");
  const verified = res.data.totp.find((f) => f.status === "verified");
  if (verified) return { state: "on", factorId: verified.id, since: verified.created_at ?? null };
  const pending = res.data.all.find((f) => f.status !== "verified");
  return { state: "off", pendingFactorId: pending?.id ?? null };
}

/** Starts a new, unverified factor. Earlier unverified attempts are removed first. */
export async function beginSetup(api: MfaApi, appName: string): Promise<{ factorId: string; qrCode: string; secret: string }> {
  const res = await api.listFactors();
  if (res.error || !res.data) throw new MfaError("Couldn't start two-factor setup. Reload to try again.");
  for (const f of res.data.all) {
    if (f.status !== "verified") await api.unenroll({ factorId: f.id });
  }
  const created = await api.enroll({ factorType: "totp", friendlyName: `${appName} ${new Date().toISOString().slice(0, 10)}` });
  if (created.error || !created.data) throw new MfaError("Couldn't start two-factor setup. Reload to try again.");
  return { factorId: created.data.id, qrCode: qrImageSrc(created.data.totp.qr_code), secret: created.data.totp.secret };
}

/** Turns the factor on only if the code verifies. A wrong code leaves two-factor off. */
export async function confirmSetup(api: MfaApi, factorId: string, rawCode: string): Promise<void> {
  const code = normaliseCode(rawCode);
  if (!CODE_RE.test(code)) throw new MfaError("Enter the six-digit code from your app.");
  const res = await api.challengeAndVerify({ factorId, code });
  if (res.error) throw new MfaError("That code didn't work. Enter the current six-digit code from your app.");
}

/** Removes an enrolment the owner abandoned before confirming it. */
export async function cancelSetup(api: MfaApi, factorId: string): Promise<void> {
  await api.unenroll({ factorId });
}

export interface DisableInput { email: string; userId: string; password: string; code: string }

/**
 * Turns two-factor off. Order matters:
 *   1. the password must belong to this account (checked without touching the signed-in session),
 *   2. a current code must verify against the active factor (this also refreshes to AAL2),
 *   3. only then is the factor removed.
 */
export async function disableMfa(api: MfaApi, check: PasswordCheck, input: DisableInput): Promise<void> {
  const code = normaliseCode(input.code);
  if (!CODE_RE.test(code)) throw new MfaError("Enter the six-digit code from your app.");

  const checkedUser = await check(input.email, input.password);
  if (!checkedUser || checkedUser !== input.userId) throw new MfaError("That password isn't right.");

  const res = await api.listFactors();
  if (res.error || !res.data) throw new MfaError("Couldn't check two-factor sign-in right now. Reload to try again.");
  const active = res.data.totp.find((f) => f.status === "verified");
  if (!active) throw new MfaError("Two-factor sign-in isn't on.");

  const verify = await api.challengeAndVerify({ factorId: active.id, code });
  if (verify.error) throw new MfaError("That code didn't work. Enter the current six-digit code from your app.");

  const removed = await api.unenroll({ factorId: active.id });
  if (removed.error) throw new MfaError("Couldn't turn off two-factor sign-in. Try again.");
}
