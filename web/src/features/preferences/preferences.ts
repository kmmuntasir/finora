import type { DisplayPreferencesDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getDisplayPreferencesApi } from "@jellyfin/sdk/lib/utils/api/display-preferences-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

/**
 * Finora's per-user preferences, stored in Jellyfin's display preferences
 * (`CustomPrefs`) so they follow the user to every device.
 */
export interface FinoraPreferences {
  homeLayout: HomeLayout;
}

export type HomeLayout = "spotlight" | "dashboard" | "focus";

const HOME_LAYOUTS: readonly HomeLayout[] = ["spotlight", "dashboard", "focus"];

export const DEFAULT_PREFERENCES: FinoraPreferences = { homeLayout: "spotlight" };

const PREFERENCES_ID = "finora";
const CLIENT = "finora";

/** Reads known keys from CustomPrefs, ignoring anything invalid. */
export function parsePreferences(
  custom: Record<string, string | null> | null | undefined,
): FinoraPreferences {
  const homeLayout = custom?.homeLayout;
  return {
    homeLayout: HOME_LAYOUTS.includes(homeLayout as HomeLayout)
      ? (homeLayout as HomeLayout)
      : DEFAULT_PREFERENCES.homeLayout,
  };
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

/** Saves preferences with an optimistic update. */
export function useSetPreference() {
  const { api, user } = useSession();
  const queryClient = useQueryClient();
  const key = ["display-preferences", user.Id, PREFERENCES_ID];

  return useMutation({
    mutationFn: async (changes: Partial<FinoraPreferences>) => {
      const current = queryClient.getQueryData<DisplayPreferencesDto>(key) ?? {};
      const next: DisplayPreferencesDto = {
        ...current,
        CustomPrefs: { ...current.CustomPrefs, ...changes },
      };
      queryClient.setQueryData(key, next);
      await getDisplayPreferencesApi(api).updateDisplayPreferences({
        displayPreferencesId: PREFERENCES_ID,
        userId: user.Id,
        client: CLIENT,
        displayPreferencesDto: next,
      });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}
