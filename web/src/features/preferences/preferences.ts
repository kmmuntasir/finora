import type { DisplayPreferencesDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getDisplayPreferencesApi } from "@jellyfin/sdk/lib/utils/api/display-preferences-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

/**
 * Finora's per-user preferences, stored in Jellyfin's display preferences
 * (`CustomPrefs`) so they follow the user to every device. Every value is a
 * string from a fixed set; anything else falls back to the default.
 */
const CHOICES = {
  homeLayout: ["spotlight", "dashboard", "focus"],
  subtitleSize: ["medium", "small", "large", "xlarge"],
  subtitleColor: ["white", "yellow"],
  subtitleBackground: ["box", "shadow", "none"],
  subtitlePosition: ["bottom", "raised"],
  skipSegments: ["button", "auto", "off"],
  /** Theme songs (and optionally theme videos) on detail pages. */
  themeMedia: ["off", "music", "all"],
  /** "auto" follows the browser; otherwise a BCP 47 locale for dates and numbers. */
  dateLocale: ["auto", "en-US", "en-GB", "bn-BD", "en-IN", "de-DE", "fr-FR", "es-ES", "ja-JP"],
} as const;

type Choices = typeof CHOICES;
export type FinoraPreferences = { [K in keyof Choices]: Choices[K][number] } & {
  /**
   * Home rows in display order; a leading "-" hides a row. Not named
   * "homesection…": Jellyfin parses keys with that prefix as its own
   * (DisplayPreferencesController.cs:180) and fails with HTTP 500.
   */
  homeRows: string;
};
export type HomeLayout = FinoraPreferences["homeLayout"];

export const DEFAULT_PREFERENCES: FinoraPreferences = {
  ...(Object.fromEntries(Object.entries(CHOICES).map(([key, values]) => [key, values[0]])) as {
    [K in keyof Choices]: Choices[K][number];
  }),
  homeRows: "",
};

const PREFERENCES_ID = "finora";
const CLIENT = "finora";

/** Reads known keys from CustomPrefs, ignoring anything invalid. */
export function parsePreferences(
  custom: Record<string, string | null> | null | undefined,
): FinoraPreferences {
  const result: Record<string, string> = { ...DEFAULT_PREFERENCES };
  for (const [key, values] of Object.entries(CHOICES)) {
    const value = custom?.[key];
    if (value && (values as readonly string[]).includes(value)) result[key] = value;
  }
  if (typeof custom?.homeRows === "string") result.homeRows = custom.homeRows;
  return result as FinoraPreferences;
}

function useDisplayPreferences() {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["display-preferences", user.Id, PREFERENCES_ID],
    queryFn: async ({ signal }) =>
      (
        await getDisplayPreferencesApi(api).getDisplayPreferences(
          { displayPreferencesId: PREFERENCES_ID, userId: user.Id, client: CLIENT },
          { signal },
        )
      ).data,
    staleTime: Infinity,
  });
}

export function usePreferences(): { preferences: FinoraPreferences; isLoading: boolean } {
  const { data, isPending } = useDisplayPreferences();
  return { preferences: parsePreferences(data?.CustomPrefs), isLoading: isPending };
}

/**
 * Saves run one at a time: Jellyfin 10.11 inserts new CustomPrefs keys
 * without a lock, and two overlapping saves fail with a UNIQUE constraint
 * error (HTTP 500).
 */
let saveQueue: Promise<unknown> = Promise.resolve();

/** Saves preferences with an optimistic update. */
export function useSetPreference() {
  const { api, user } = useSession();
  const queryClient = useQueryClient();
  const key = ["display-preferences", user.Id, PREFERENCES_ID];

  return useMutation({
    mutationFn: (changes: Partial<FinoraPreferences>) => {
      const current = queryClient.getQueryData<DisplayPreferencesDto>(key) ?? {};
      queryClient.setQueryData<DisplayPreferencesDto>(key, {
        ...current,
        CustomPrefs: { ...current.CustomPrefs, ...changes },
      });
      const save = saveQueue.then(async () => {
        // Send the latest state, which includes any changes queued after this one.
        const latest = queryClient.getQueryData<DisplayPreferencesDto>(key) ?? {};
        await getDisplayPreferencesApi(api).updateDisplayPreferences({
          displayPreferencesId: PREFERENCES_ID,
          userId: user.Id,
          client: CLIENT,
          displayPreferencesDto: latest,
        });
      });
      saveQueue = save.catch(() => undefined);
      return save;
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}
