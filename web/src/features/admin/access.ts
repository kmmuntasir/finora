import { useSession } from "@/features/auth/context";

export type AdminAccess =
  { allowed: true } | { allowed: false; reason: "not-admin" | "insecure-connection" };

/** Set once a Google-backed admin session is confirmed by the Finora API (see decision 0004). */
const GOOGLE_SESSION_KEY = "finora.adminGoogleSession";

export function markGoogleAdminSession(active: boolean): void {
  if (active) window.sessionStorage.setItem(GOOGLE_SESSION_KEY, "1");
  else window.sessionStorage.removeItem(GOOGLE_SESSION_KEY);
}

/**
 * Decision 0004: over plain HTTP the admin console unlocks only for sessions
 * that came from Google sign-in, so admin passwords never travel unencrypted.
 * Secure contexts (HTTPS, and localhost during development) allow password
 * sessions. This is a Finora guard rail, not a security boundary.
 */
export function useAdminAccess(): AdminAccess {
  const { user } = useSession();
  if (!user.Policy?.IsAdministrator) return { allowed: false, reason: "not-admin" };
  if (window.isSecureContext) return { allowed: true };
  if (window.sessionStorage.getItem(GOOGLE_SESSION_KEY) === "1") return { allowed: true };
  return { allowed: false, reason: "insecure-connection" };
}
