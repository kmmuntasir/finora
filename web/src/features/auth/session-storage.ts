/**
 * Persists the signed-in session. "Remember me" uses localStorage; otherwise
 * sessionStorage, which the browser clears when the tab session ends.
 * Only the access token is stored — never a password.
 */

export interface StoredSession {
  serverUrl: string;
  userId: string;
  userName: string;
  accessToken: string;
  /** Set for sessions created through Google admin sign-in (separate device). */
  deviceId?: string;
}

const SESSION_KEY = "finora.session";

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return ["serverUrl", "userId", "userName", "accessToken"].every(
    (key) => typeof record[key] === "string" && record[key] !== "",
  );
}

function readFrom(storage: Storage, serverUrl: string): StoredSession | null {
  const raw = storage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredSession(parsed) && parsed.serverUrl === serverUrl) return parsed;
  } catch {
    // Corrupt entry: fall through and remove it.
  }
  storage.removeItem(SESSION_KEY);
  return null;
}

/** Returns the stored session for this server, if any. */
export function readSession(serverUrl: string): StoredSession | null {
  return readFrom(window.localStorage, serverUrl) ?? readFrom(window.sessionStorage, serverUrl);
}

export function writeSession(session: StoredSession, remember: boolean): void {
  clearSession();
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}
