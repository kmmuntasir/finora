import { getQuickConnectApi } from "@jellyfin/sdk/lib/utils/api/quick-connect-api";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import type { AuthenticationResult } from "@jellyfin/sdk/lib/generated-client/models";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRuntimeConfig } from "@/config/context";
import { describeSignInError } from "./errors";

export type QuickConnectState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "waiting"; code: string }
  | { phase: "completing" }
  | { phase: "expired" }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 3000;

/**
 * Drives Jellyfin Quick Connect: request a code, poll until another signed-in
 * device approves it, then exchange the secret for a session.
 */
export function useQuickConnect(onAuthenticated: (result: AuthenticationResult) => void) {
  const { publicApi } = useRuntimeConfig();
  const [state, setState] = useState<QuickConnectState>({ phase: "idle" });
  const runRef = useRef(0);

  const cancel = useCallback(() => {
    runRef.current += 1;
    setState({ phase: "idle" });
  }, []);

  useEffect(() => () => void (runRef.current += 1), []);

  const start = useCallback(async () => {
    const run = ++runRef.current;
    const active = () => run === runRef.current;
    setState({ phase: "starting" });

    try {
      const quickConnect = getQuickConnectApi(publicApi);
      const { data: initiated } = await quickConnect.initiateQuickConnect();
      const { Code: code, Secret: secret } = initiated;
      if (!code || !secret) throw new Error("Quick Connect returned no code");
      if (!active()) return;
      setState({ phase: "waiting", code });

      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (!active()) return;
        const { data: status } = await quickConnect.getQuickConnectState({ secret });
        if (!active()) return;
        if (status.Authenticated) break;
      }

      setState({ phase: "completing" });
      const { data: result } = await getUserApi(publicApi).authenticateWithQuickConnect({
        quickConnectDto: { Secret: secret },
      });
      if (active()) onAuthenticated(result);
    } catch (error) {
      if (!active()) return;
      // Jellyfin forgets requests after 10 minutes and then answers 404.
      if (isAxiosError(error) && error.response?.status === 404) setState({ phase: "expired" });
      else setState({ phase: "error", message: describeSignInError(error) });
    }
  }, [publicApi, onAuthenticated]);

  return { state, start, cancel };
}
