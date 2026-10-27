import type { UserConfiguration } from "@jellyfin/sdk/lib/generated-client/models";
import { getLocalizationApi } from "@jellyfin/sdk/lib/utils/api/localization-api";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth, useSession } from "@/features/auth/context";

export function useCultures() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["cultures"],
    queryFn: async ({ signal }) => (await getLocalizationApi(api).getCultures({ signal })).data,
    staleTime: Infinity,
  });
}

/** Saves part of the user's Jellyfin configuration (it follows them to every client). */
export function useUpdateUserConfiguration() {
  const { api, user } = useSession();
  const { refreshUser } = useAuth();
  return useMutation({
    mutationFn: async (changes: Partial<UserConfiguration>) => {
      await getUserApi(api).updateUserConfiguration({
        userId: user.Id!,
        userConfiguration: { ...user.Configuration, ...changes },
      });
      await refreshUser();
    },
  });
}

export function useChangePassword() {
  const { api, user } = useSession();
  return useMutation({
    mutationFn: async ({ current, next }: { current: string; next: string }) => {
      await getUserApi(api).updateUserPassword({
        userId: user.Id!,
        updateUserPassword: { CurrentPw: current, NewPw: next },
      });
    },
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

/** Jellyfin expects the image body base64-encoded, with the image's content type. */
export function useProfilePicture() {
  const { api, user } = useSession();
  const { refreshUser } = useAuth();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = await toBase64(file);
      await api.axiosInstance.post(`${api.basePath}/UserImage?userId=${user.Id}`, body, {
        headers: { Authorization: api.authorizationHeader, "Content-Type": file.type },
      });
      await refreshUser();
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      await api.axiosInstance.delete(`${api.basePath}/UserImage?userId=${user.Id}`, {
        headers: { Authorization: api.authorizationHeader },
      });
      await refreshUser();
    },
  });
  return { upload, remove };
}
