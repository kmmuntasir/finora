import type { UserDto, UserPolicy } from "@jellyfin/sdk/lib/generated-client/models";
import { getItemRefreshApi } from "@jellyfin/sdk/lib/utils/api/item-refresh-api";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api";
import { getLibraryStructureApi } from "@jellyfin/sdk/lib/utils/api/library-structure-api";
import { getScheduledTasksApi } from "@jellyfin/sdk/lib/utils/api/scheduled-tasks-api";
import { getSessionApi } from "@jellyfin/sdk/lib/utils/api/session-api";
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
