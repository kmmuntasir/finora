import { isAxiosError } from "axios";
import { t } from "@/i18n";

/** Turns a failed sign-in request into a message a person can act on. */
export function describeSignInError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return t("Can't reach the server. Check your connection and try again.");
    const status = error.response.status;
    if (status === 401) return t("Wrong username or password.");
    if (status === 403) return t("This account is not allowed to sign in.");
    if (status >= 500) return t("The server had a problem. Try again in a moment.");
    return t("Sign-in failed (error {status}).", { status });
  }
  return t("Sign-in failed. Try again.");
}

export function isUnauthorized(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}
