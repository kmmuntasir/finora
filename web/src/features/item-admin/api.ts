import type {
  BaseItemDto,
  ImageInfo,
  ImageType,
  MetadataEditorInfo,
  RemoteImageResult,
  RemoteSearchResult,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getImageApi } from "@jellyfin/sdk/lib/utils/api/image-api";
import { getItemRefreshApi } from "@jellyfin/sdk/lib/utils/api/item-refresh-api";
import { getItemUpdateApi } from "@jellyfin/sdk/lib/utils/api/item-update-api";
import { getRemoteImageApi } from "@jellyfin/sdk/lib/utils/api/remote-image-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";
import { toBase64 } from "@/lib/files";

/** Item types Jellyfin can identify against online metadata providers (ItemLookupController). */
export const IDENTIFIABLE: Record<string, string> = {
  Movie: "Movie",
  Series: "Series",
  MusicAlbum: "MusicAlbum",
  MusicArtist: "MusicArtist",
  Person: "Person",
  BoxSet: "BoxSet",
  Book: "Book",
  Trailer: "Trailer",
  MusicVideo: "MusicVideo",
};

function useInvalidateItem(itemId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["item-details"] });
    void queryClient.invalidateQueries({ queryKey: ["item-images", itemId] });
    void queryClient.invalidateQueries({ queryKey: ["related"] });
  };
}

export type RefreshMode = "scan" | "missing" | "replace";

export function useRefreshItem(item: BaseItemDto) {
  const { api } = useSession();
  const invalidate = useInvalidateItem(item.Id!);
  return useMutation({
    mutationFn: async ({ mode, replaceImages }: { mode: RefreshMode; replaceImages: boolean }) => {
      const full = mode === "scan" ? "Default" : "FullRefresh";
      await getItemRefreshApi(api).refreshItem({
        itemId: item.Id!,
        metadataRefreshMode: full,
        imageRefreshMode: full,
        replaceAllMetadata: mode === "replace",
        replaceAllImages: replaceImages,
      });
    },
    // Jellyfin refreshes in the background; check again after a moment.
    onSuccess: () => window.setTimeout(invalidate, 4000),
  });
}

export function useMetadataEditorInfo(itemId: string, enabled: boolean) {
  const { api } = useSession();
  return useQuery<MetadataEditorInfo>({
    queryKey: ["metadata-editor", itemId],
    queryFn: async ({ signal }) =>
      (await getItemUpdateApi(api).getMetadataEditorInfo({ itemId }, { signal })).data,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateItem(itemId: string) {
  const { api } = useSession();
  const invalidate = useInvalidateItem(itemId);
  return useMutation({
    mutationFn: (item: BaseItemDto) =>
      getItemUpdateApi(api).updateItem({ itemId, baseItemDto: item }),
    onSuccess: invalidate,
  });
}

export function useRemoteSearch(item: BaseItemDto) {
  const { api } = useSession();
  return useMutation({
    mutationFn: async (info: {
      Name?: string;
      Year?: number;
      ProviderIds?: Record<string, string>;
    }): Promise<RemoteSearchResult[]> => {
      const type = IDENTIFIABLE[item.Type ?? ""];
      if (!type) return [];
      const { data } = await api.axiosInstance.post<RemoteSearchResult[]>(
        `${api.basePath}/Items/RemoteSearch/${type}`,
        { SearchInfo: info, ItemId: item.Id, IncludeDisabledProviders: true },
        { headers: { Authorization: api.authorizationHeader } },
      );
      return data;
    },
  });
}

export function useApplyIdentification(item: BaseItemDto) {
  const { api } = useSession();
  const invalidate = useInvalidateItem(item.Id!);
  return useMutation({
    mutationFn: async ({
      result,
      replaceImages,
    }: {
      result: RemoteSearchResult;
      replaceImages: boolean;
    }) => {
      await api.axiosInstance.post(
        `${api.basePath}/Items/RemoteSearch/Apply/${item.Id}?replaceAllImages=${replaceImages}`,
        result,
        { headers: { Authorization: api.authorizationHeader } },
      );
    },
    onSuccess: () => window.setTimeout(invalidate, 4000),
  });
}

export function useItemImages(itemId: string, enabled: boolean) {
  const { api } = useSession();
  return useQuery<ImageInfo[]>({
    queryKey: ["item-images", itemId],
    queryFn: async ({ signal }) =>
      (await getImageApi(api).getItemImageInfos({ itemId }, { signal })).data,
    enabled,
  });
}

export function useRemoteImages(itemId: string, type: ImageType | null) {
  const { api } = useSession();
  return useQuery<RemoteImageResult>({
    queryKey: ["remote-images", itemId, type],
    queryFn: async ({ signal }) =>
      (
        await getRemoteImageApi(api).getRemoteImages(
          { itemId, type: type!, includeAllLanguages: false, limit: 60 },
          { signal },
        )
      ).data,
    enabled: type !== null,
    staleTime: 10 * 60 * 1000,
  });
}

export function useImageMutations(itemId: string) {
  const { api } = useSession();
  const invalidate = useInvalidateItem(itemId);
  const remove = useMutation({
    mutationFn: ({ type, index }: { type: ImageType; index: number }) =>
      getImageApi(api).deleteItemImageByIndex({ itemId, imageType: type, imageIndex: index }),
    onSuccess: invalidate,
  });
  const download = useMutation({
    mutationFn: ({ type, url }: { type: ImageType; url: string }) =>
      getRemoteImageApi(api).downloadRemoteImage({ itemId, type, imageUrl: url }),
    onSuccess: invalidate,
  });
  /** Jellyfin expects the image body base64-encoded, with the image's content type. */
  const upload = useMutation({
    mutationFn: async ({ type, file }: { type: ImageType; file: File }) => {
      const body = await toBase64(file);
      await api.axiosInstance.post(`${api.basePath}/Items/${itemId}/Images/${type}`, body, {
        headers: { Authorization: api.authorizationHeader, "Content-Type": file.type },
      });
    },
    onSuccess: invalidate,
  });
  return { remove, download, upload };
}
