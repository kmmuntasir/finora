import { createContext, useContext } from "react";
import type { Api } from "@jellyfin/sdk";
import type { AuthenticationResult, UserDto } from "@jellyfin/sdk/lib/generated-client/models";

export type SignedOutReason = "signed-out" | "expired";

export type AuthState =
  | { status: "restoring" }
  | { status: "signed-out"; reason?: SignedOutReason }
  | { status: "unreachable" }
  | { status: "signed-in"; user: UserDto; api: Api };

export interface AuthContextValue {
  state: AuthState;
  /** Stores a successful authentication and switches to the signed-in state. */
  completeSignIn: (result: AuthenticationResult, remember: boolean) => void;
  signOut: () => Promise<void>;
  /** Retries restoring a stored session after the server was unreachable. */
  retryRestore: () => void;
  /** Reloads the signed-in user (after changing settings or the profile picture). */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** The signed-in user and API client. Only for components behind <RequireAuth>. */
export function useSession(): { user: UserDto; api: Api } {
  const { state } = useAuth();
  if (state.status !== "signed-in") throw new Error("useSession requires a signed-in user");
  return { user: state.user, api: state.api };
}
