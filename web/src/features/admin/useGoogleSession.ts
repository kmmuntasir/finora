import { useQuery } from "@tanstack/react-query";
import { finoraFetch } from "@/api/finora";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";

export interface GoogleSessionStatus {
  google: boolean;
  email?: string;
  expiresAt?: string;
}

/** Asks the Finora API whether this session came from Google sign-in (only needed on insecure pages). */
export function useGoogleSession() {
  const { config } = useRuntimeConfig();
  const { api } = useSession();
  return useQuery({
    queryKey: ["finora", "auth-session", api.accessToken],
    enabled: Boolean(config.apiUrl) && !window.isSecureContext,
    queryFn: ({ signal }) =>
      finoraFetch<GoogleSessionStatus>(config.apiUrl!, "/auth/session", {
        token: api.accessToken,
        signal,
      }),
    retry: false,
    staleTime: 60 * 1000,
  });
}
