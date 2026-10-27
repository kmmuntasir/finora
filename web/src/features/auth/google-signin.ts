import { getQuickConnectApi } from "@jellyfin/sdk/lib/utils/api/quick-connect-api";
import { createJellyfinApi } from "@/api/jellyfin";

/**
 * Google admin sign-in (decision 0004): Finora Web starts Quick Connect on a
 * fresh device, the Finora API verifies the Google account and approves the
 * code, and the browser completes Quick Connect. No password is involved.
 */

export interface PendingGoogleSignIn {
  deviceId: string;
  secret: string;
  code: string;
  remember: boolean;
}

const PENDING_KEY = "finora.googleSignIn";

export function readPendingGoogleSignIn(): PendingGoogleSignIn | null {
  try {
    return JSON.parse(
      window.sessionStorage.getItem(PENDING_KEY) ?? "null",
    ) as PendingGoogleSignIn | null;
  } catch {
    return null;
  }
}

export function clearPendingGoogleSignIn(): void {
  window.sessionStorage.removeItem(PENDING_KEY);
}

export async function startGoogleSignIn(
  jellyfinUrl: string,
  apiUrl: string,
  remember: boolean,
): Promise<void> {
  const deviceId = crypto.randomUUID();
  const api = createJellyfinApi(jellyfinUrl, undefined, deviceId);
  const { data } = await getQuickConnectApi(api).initiateQuickConnect();
  if (!data.Code || !data.Secret) throw new Error("Quick Connect returned no code");
  const pending: PendingGoogleSignIn = { deviceId, secret: data.Secret, code: data.Code, remember };
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const params = new URLSearchParams({
    code: data.Code,
    return: `${window.location.origin}/auth/google`,
  });
  window.location.assign(`${apiUrl}/api/v1/auth/google/start?${params.toString()}`);
}
