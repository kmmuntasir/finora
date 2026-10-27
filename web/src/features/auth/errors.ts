import { isAxiosError } from "axios";

/** Turns a failed sign-in request into a message a person can act on. */
export function describeSignInError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return "Can't reach the server. Check your connection and try again.";
    const status = error.response.status;
    if (status === 401) return "Wrong username or password.";
    if (status === 403) return "This account is not allowed to sign in.";
    if (status >= 500) return "The server had a problem. Try again in a moment.";
    return `Sign-in failed (error ${status}).`;
  }
  return "Sign-in failed. Try again.";
}

export function isUnauthorized(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401;
}
