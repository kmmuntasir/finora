import type { UserDto, UserPolicy } from "@jellyfin/sdk/lib/generated-client/models";
import { getActivityLogApi } from "@jellyfin/sdk/lib/utils/api/activity-log-api";
import { getDevicesApi } from "@jellyfin/sdk/lib/utils/api/devices-api";
import { getItemRefreshApi } from "@jellyfin/sdk/lib/utils/api/item-refresh-api";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api";
import { getLibraryStructureApi } from "@jellyfin/sdk/lib/utils/api/library-structure-api";
import { getLocalizationApi } from "@jellyfin/sdk/lib/utils/api/localization-api";
import { getQuickConnectApi } from "@jellyfin/sdk/lib/utils/api/quick-connect-api";
import { getScheduledTasksApi } from "@jellyfin/sdk/lib/utils/api/scheduled-tasks-api";
import { getSessionApi } from "@jellyfin/sdk/lib/utils/api/session-api";
import { getSystemApi } from "@jellyfin/sdk/lib/utils/api/system-api";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

export function useUsers() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: async ({ signal }) => (await getUserApi(api).getUsers({}, { signal })).data,
  });
}

export function useUser(userId: string | undefined) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: async ({ signal }) =>
      (await getUserApi(api).getUserById({ userId: userId! }, { signal })).data,
    enabled: Boolean(userId),
  });
}

/** Top-level library folders, for per-user library access. */
export function useMediaFolders() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "media-folders"],
    queryFn: async ({ signal }) =>
      (await getLibraryApi(api).getMediaFolders({}, { signal })).data.Items ?? [],
    staleTime: 5 * 60 * 1000,
  });
}

export function useVirtualFolders() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "virtual-folders"],
    queryFn: async ({ signal }) =>
      (await getLibraryStructureApi(api).getVirtualFolders({ signal })).data,
  });
}

/** Sessions active in the last 16 minutes, refreshed every 5 seconds. */
export function useSessions() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "sessions"],
    queryFn: async ({ signal }) =>
      (await getSessionApi(api).getSessions({ activeWithinSeconds: 960 }, { signal })).data,
    refetchInterval: 5000,
  });
}

/** Progress of the "Scan Media Library" task. */
export function useLibraryScanTask() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "scan-task"],
    queryFn: async ({ signal }) =>
      (await getScheduledTasksApi(api).getTasks({ isHidden: false }, { signal })).data.find(
        (task) => task.Key === "RefreshLibrary",
      ) ?? null,
    refetchInterval: (query) => (query.state.data?.State === "Running" ? 2000 : 15000),
  });
}

export function useAdminMutations() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const refreshUsers = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "user"] });
  };
  const users = getUserApi(api);

  return {
    createUser: useMutation({
      mutationFn: async ({
        name,
        password,
        policy,
      }: {
        name: string;
        password: string;
        policy: Partial<UserPolicy>;
      }) => {
        const { data: user } = await users.createUserByName({
          createUserByName: { Name: name, Password: password || undefined },
        });
        if (user.Id && user.Policy) {
          await users.updateUserPolicy({
            userId: user.Id,
            userPolicy: { ...user.Policy, ...policy } as UserPolicy,
          });
        }
        return user;
      },
      onSuccess: refreshUsers,
    }),
    updatePolicy: useMutation({
      mutationFn: async ({ user, changes }: { user: UserDto; changes: Partial<UserPolicy> }) => {
        await users.updateUserPolicy({
          userId: user.Id!,
          userPolicy: { ...user.Policy, ...changes } as UserPolicy,
        });
      },
      onSuccess: refreshUsers,
    }),
    rename: useMutation({
      mutationFn: async ({ user, name }: { user: UserDto; name: string }) => {
        await users.updateUser({ userId: user.Id!, userDto: { ...user, Name: name } });
      },
      onSuccess: refreshUsers,
    }),
    setPassword: useMutation({
      mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
        // Admins may set another user's password without the current one.
        await users.updateUserPassword({ userId, updateUserPassword: { NewPw: password } });
      },
    }),
    deleteUser: useMutation({
      mutationFn: async (userId: string) => {
        await users.deleteUser({ userId });
      },
      onSuccess: refreshUsers,
    }),
    stopSession: useMutation({
      mutationFn: async (sessionId: string) => {
        await getSessionApi(api).sendPlaystateCommand({ sessionId, command: "Stop" });
      },
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
    }),
    messageSession: useMutation({
      mutationFn: async ({ sessionId, text }: { sessionId: string; text: string }) => {
        await getSessionApi(api).sendMessageCommand({
          sessionId,
          messageCommand: { Header: "Message from the server", Text: text, TimeoutMs: 10000 },
        });
      },
    }),
    scanAll: useMutation({
      mutationFn: async () => {
        await getLibraryApi(api).refreshLibrary();
      },
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin", "scan-task"] }),
    }),
    scanLibrary: useMutation({
      mutationFn: async (itemId: string) => {
        await getItemRefreshApi(api).refreshItem({
          itemId,
          metadataRefreshMode: "Default",
          imageRefreshMode: "Default",
          replaceAllMetadata: false,
          replaceAllImages: false,
        });
      },
    }),
  };
}

/** Parental rating options, grouped by score: "PG, TV-PG" share one level. */
export function useParentalRatingLevels() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "parental-ratings"],
    queryFn: async ({ signal }) => {
      const { data } = await getLocalizationApi(api).getParentalRatings({ signal });
      const levels = new Map<string, { score: number; subScore: number | null; names: string[] }>();
      for (const rating of data) {
        const score = rating.RatingScore?.score ?? rating.Value;
        if (score === undefined || score === null) continue;
        const subScore = rating.RatingScore?.subScore ?? null;
        const key = `${score}:${subScore ?? ""}`;
        const level = levels.get(key) ?? { score, subScore, names: [] };
        level.names.push(rating.Name ?? "");
        levels.set(key, level);
      }
      return [...levels.values()].sort(
        (a, b) => a.score - b.score || (a.subScore ?? 0) - (b.subScore ?? 0),
      );
    },
    staleTime: 60 * 60 * 1000,
  });
}

/**
 * Devices last used by this user. Jellyfin's userId filter returns every
 * device the user may *access* (all of them by default), so filter on
 * LastUserId as well.
 */
export function useUserDevices(userId: string) {
  const { api } = useSession();
  const normalise = (id: string | null | undefined) => (id ?? "").replace(/-/g, "").toLowerCase();
  return useQuery({
    queryKey: ["admin", "devices", userId],
    queryFn: async ({ signal }) =>
      ((await getDevicesApi(api).getDevices({ userId }, { signal })).data.Items ?? []).filter(
        (device) => normalise(device.LastUserId) === normalise(userId),
      ),
  });
}

export function useDeviceMutations(userId: string) {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "devices", userId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] });
  };
  return {
    /** Deleting a device revokes its access token, signing it out. */
    signOut: useMutation({
      mutationFn: async (deviceIds: string[]) => {
        for (const id of deviceIds) await getDevicesApi(api).deleteDevice({ id });
      },
      onSettled: refresh,
    }),
    authorizeQuickConnect: useMutation({
      mutationFn: async (code: string) => {
        await getQuickConnectApi(api).authorizeQuickConnect({ code, userId });
      },
      onSuccess: refresh,
    }),
  };
}

export function useSystemInfo() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "system-info"],
    queryFn: async ({ signal }) => (await getSystemApi(api).getSystemInfo({ signal })).data,
    refetchInterval: 30_000,
  });
}

export function useItemCounts() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "item-counts"],
    queryFn: async ({ signal }) => (await getLibraryApi(api).getItemCounts({}, { signal })).data,
    staleTime: 5 * 60 * 1000,
  });
}

export const ACTIVITY_PAGE = 50;

/** Jellyfin's activity log, newest first. `users` limits it to user activity (sign-ins, playback). */
export function useActivityLog(page: number, users: boolean | null) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["admin", "activity", page, users],
    queryFn: async ({ signal }) =>
      (
        await getActivityLogApi(api).getLogEntries(
          {
            startIndex: page * ACTIVITY_PAGE,
            limit: ACTIVITY_PAGE,
            hasUserId: users ?? undefined,
          },
          { signal },
        )
      ).data,
    refetchInterval: page === 0 ? 30_000 : false,
    placeholderData: (previous) => previous,
  });
}

export function useRestartServer() {
  const { api } = useSession();
  return useMutation({ mutationFn: () => getSystemApi(api).restartApplication() });
}
