import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { finoraFetch, useFinoraConfig } from "@/api/finora";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";

export interface SubtitleLanguage {
  code: string;
  code3: string;
  name: string;
}

export interface SubtitleResult {
  id: string;
  provider: string;
  providerName: string;
  release: string;
  hearingImpaired: boolean;
  aiTranslated: boolean;
  forced: boolean;
  hashMatch: boolean;
  releaseMatch: boolean;
  downloads: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  status: "ok" | "error" | "quota" | "skipped";
  message?: string;
  results: number;
}

export interface FinoraSubtitle {
  id: string;
  itemId: string;
  language: string;
  language3: string;
  provider: string;
  release: string;
  hearingImpaired: boolean;
  forced: boolean;
  uploadError?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  /** Path on the Finora API; prefix with the API URL. */
  url: string;
  /** Jellyfin's stream index once indexed; null until then. */
  jellyfinStreamIndex: number | null;
}

/** Whether the subtitle finder is available (Finora API configured with providers). */
export function useSubtitlesEnabled(): boolean {
  const finora = useFinoraConfig();
  return Boolean(finora.data?.configured && finora.data.features.subtitles);
}

function useCall() {
  const { config } = useRuntimeConfig();
  const { api } = useSession();
  return <T>(
    path: string,
    options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  ) => finoraFetch<T>(config.apiUrl!, path, { ...options, token: api.accessToken });
}

export function useSubtitleLanguages() {
  const { config } = useRuntimeConfig();
  return useQuery({
    queryKey: ["finora", "subtitle-languages"],
    queryFn: ({ signal }) =>
      finoraFetch<SubtitleLanguage[]>(config.apiUrl!, "/subtitles/languages", { signal }),
    staleTime: Infinity,
  });
}

export function useSubtitleSearch(itemId: string, language: string, enabled: boolean) {
  const call = useCall();
  return useQuery({
    queryKey: ["finora", "subtitle-search", itemId, language],
    queryFn: ({ signal }) =>
      call<{ results: SubtitleResult[]; providers: ProviderStatus[]; hash: boolean }>(
        `/subtitles/search?itemId=${encodeURIComponent(itemId)}&lang=${encodeURIComponent(language)}`,
        { signal },
      ),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** Subtitles added through Finora for an item (empty when the API is absent). */
export function useItemSubtitles(itemId: string | undefined, enabled = true) {
  const call = useCall();
  const subtitlesEnabled = useSubtitlesEnabled();
  return useQuery({
    queryKey: ["finora", "item-subtitles", itemId],
    queryFn: ({ signal }) => call<FinoraSubtitle[]>(`/subtitles/items/${itemId}`, { signal }),
    enabled: Boolean(itemId) && subtitlesEnabled && enabled,
    staleTime: 30 * 1000,
  });
}

export function useSubtitleMutations(itemId: string) {
  const call = useCall();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["finora", "item-subtitles", itemId] });
    // Jellyfin indexes the upload within seconds; refresh the item's streams.
    window.setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: ["item-details"] }),
      4000,
    );
  };
  return {
    download: useMutation({
      mutationFn: ({ candidate, language }: { candidate: string; language: string }) =>
        call<FinoraSubtitle>("/subtitles/download", {
          method: "POST",
          body: { itemId, candidate, language },
        }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => call(`/subtitles/${id}`, { method: "DELETE" }),
      onSuccess: refresh,
    }),
  };
}
