import { useQuery } from "@tanstack/react-query";
import { useRuntimeConfig } from "@/config/context";

/** Error from the Finora API, carrying its message for the UI. */
export class FinoraApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Calls the optional Finora API (decision 0002). Tokens go in the Authorization header. */
export async function finoraFetch<T>(
  apiUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok)
    throw new FinoraApiError(response.status, data.error ?? `Request failed (${response.status})`);
  return data as T;
}

export interface FinoraPublicConfig {
  configured: boolean;
  googleSignIn: boolean;
  features: { announcements: boolean; subtitles: boolean };
}

/** Public API status; `data` is null when no API is configured or it is unreachable. */
export function useFinoraConfig() {
  const { config } = useRuntimeConfig();
  return useQuery({
    queryKey: ["finora", "public-config", config.apiUrl],
    enabled: Boolean(config.apiUrl),
    queryFn: async ({ signal }) => {
      try {
        return await finoraFetch<FinoraPublicConfig>(config.apiUrl!, "/public/config", { signal });
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
