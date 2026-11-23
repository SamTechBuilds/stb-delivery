/**
 * Turn a database or API error into a sentence for the owner. Raw messages are never shown: they
 * can name internal columns or functions. Only the known, deliberate messages from STB Core pass.
 */
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

export function friendlyError(e: DbErrorLike | null | undefined): string {
  if (!e) return "Something went wrong. Try again.";
  const msg = e.message ?? "";
  switch (e.code) {
    case "23505":
      return "That slug is already used by another delivery. Choose another.";
    case "23514":
      if (/reserved/i.test(msg)) return "That slug is reserved for the site itself. Choose another.";
      if (/slug/i.test(msg)) return "That slug isn't valid. Use lowercase letters, numbers and single hyphens.";
      return "A value doesn't meet the rules for this field.";
    case "22023":
      if (/slug/i.test(msg)) return "That slug isn't valid. Use lowercase letters, numbers and single hyphens.";
      if (/cannot change status/i.test(msg)) return "That status change isn't allowed from the current state.";
      if (/archived/i.test(msg)) return "This delivery is archived. Restore it before issuing new links.";
      if (/expiry/i.test(msg)) return "The expiry date must be in the future.";
      return "That change isn't allowed right now.";
    case "42501":
      return "You don't have permission for that. Sign out, sign back in and confirm your authenticator code.";
    case "P0002":
      return "That item no longer exists. Reload the page.";
    case "PGRST116":
      return "That item could not be found.";
    default:
      return "Something went wrong. Try again.";
  }
}
