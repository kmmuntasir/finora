import { useQueryClient } from "@tanstack/react-query";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import type { Api } from "@jellyfin/sdk";
import type { AuthenticationResult } from "@jellyfin/sdk/lib/generated-client/models";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createJellyfinApi } from "@/api/jellyfin";
import { useRuntimeConfig } from "@/config/context";
import { AuthContext, type AuthContextValue, type AuthState } from "./context";
import { isUnauthorized } from "./errors";
import { clearSession, readSession, writeSession } from "./session-storage";

/** Creates an authenticated client that signs the user out when the token stops working. */
function createSessionApi(baseUrl: string, token: string, onExpired: () => void): Api {
  const api = createJellyfinApi(baseUrl, token);
  api.axiosInstance.interceptors.response.use(undefined, (error: unknown) => {
    if (isUnauthorized(error)) onExpired();
    return Promise.reject(error);
  });
  return api;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { config } = useRuntimeConfig();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    readSession(config.jellyfinUrl) ? { status: "restoring" } : { status: "signed-out" },
  );
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const expire = useCallback(() => {
    clearSession();
    queryClient.clear();
    setState({ status: "signed-out", reason: "expired" });
  }, [queryClient]);

  useEffect(() => {
    // Without a stored session the initial state is already "signed-out".
    const stored = readSession(config.jellyfinUrl);
    if (!stored) return;

    let cancelled = false;
    const api = createSessionApi(config.jellyfinUrl, stored.accessToken, expire);
    getUserApi(api)
      .getCurrentUser()
      .then(({ data: user }) => {
        if (!cancelled) setState({ status: "signed-in", user, api });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isUnauthorized(error)) expire();
        else setState({ status: "unreachable" });
      });
    return () => {
      cancelled = true;
    };
  }, [config.jellyfinUrl, expire, restoreAttempt]);

  const completeSignIn = useCallback(
    (result: AuthenticationResult, remember: boolean) => {
      const { AccessToken: token, User: user } = result;
      if (!token || !user?.Id || !user.Name) throw new Error("Incomplete authentication result");
      writeSession(
        { serverUrl: config.jellyfinUrl, userId: user.Id, userName: user.Name, accessToken: token },
        remember,
      );
      setState({
        status: "signed-in",
        user,
        api: createSessionApi(config.jellyfinUrl, token, expire),
      });
    },
    [config.jellyfinUrl, expire],
  );

  const signOut = useCallback(async () => {
    if (state.status === "signed-in") {
      // Best effort: the session is cleared locally even if the server is unreachable.
      await state.api.logout().catch(() => undefined);
    }
    clearSession();
    queryClient.clear();
    setState({ status: "signed-out", reason: "signed-out" });
  }, [state, queryClient]);

  const retryRestore = useCallback(() => {
    setState({ status: "restoring" });
    setRestoreAttempt((attempt) => attempt + 1);
  }, []);

  const refreshUser = useCallback(async () => {
    if (state.status !== "signed-in") return;
    const { data: user } = await getUserApi(state.api).getCurrentUser();
    setState({ status: "signed-in", user, api: state.api });
  }, [state]);

  const value = useMemo<AuthContextValue>(
    () => ({ state, completeSignIn, signOut, retryRestore, refreshUser }),
    [state, completeSignIn, signOut, retryRestore, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
