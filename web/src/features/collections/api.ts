import {
  BaseItemKind,
  ItemFields,
  ItemSortBy,
  type BaseItemDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getCollectionApi } from "@jellyfin/sdk/lib/utils/api/collection-api";
import { getItemsApi } from "@jellyfin/sdk/lib/utils/api/items-api";
import { getLibraryApi } from "@jellyfin/sdk/lib/utils/api/library-api";
import { getPlaylistsApi } from "@jellyfin/sdk/lib/utils/api/playlists-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

export type Container = "playlist" | "collection";

/** Collections need the "manage collections" permission (Jellyfin 10.9+); admins always have it. */
export function useCanManageCollections(): boolean {
  const { user } = useSession();
  return Boolean(user.Policy?.IsAdministrator || user.Policy?.EnableCollectionManagement);
}

/** Playlists and collections the user can add to, newest name first. */
export function useContainers(kind: Container, enabled: boolean) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["containers", user.Id, kind],
    queryFn: async ({ signal }) => {
      const items =
        (
          await getItemsApi(api).getItems(
            {
              userId: user.Id,
              includeItemTypes: [kind === "playlist" ? BaseItemKind.Playlist : BaseItemKind.BoxSet],
              recursive: true,
              sortBy: [ItemSortBy.SortName],
              fields: [ItemFields.ChildCount],
            },
            { signal },
          )
        ).data.Items ?? [];
      if (kind === "collection") return items;
      // Shared playlists may be read-only; keep the ones this user can edit.
      const editable = await Promise.all(
        items.map(async (playlist) => {
          try {
            const permission = await getPlaylistsApi(api).getPlaylistUser(
              { playlistId: playlist.Id!, userId: user.Id! },
              { signal },
            );
            return permission.data?.CanEdit ? playlist : null;
          } catch {
            return null;
          }
        }),
      );
      return editable.filter((playlist): playlist is BaseItemDto => playlist !== null);
    },
    enabled,
  });
}

/** Whether the signed-in user may edit a playlist (owner or shared with edit rights). */
export function usePlaylistEditable(playlist: BaseItemDto) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["playlist-permission", user.Id, playlist.Id],
    queryFn: async ({ signal }) => {
      try {
        const permission = await getPlaylistsApi(api).getPlaylistUser(
          { playlistId: playlist.Id!, userId: user.Id! },
          { signal },
        );
        return Boolean(permission.data?.CanEdit);
      } catch {
        return false;
      }
    },
    enabled: playlist.Type === "Playlist",
  });
}

/** Refreshes everything that lists playlist or collection contents. */
function useRefreshContainers() {
  const queryClient = useQueryClient();
  return () => {
    for (const prefix of [
      "containers",
      "related",
      "library-items",
      "item-details",
      "playlist-items",
    ]) {
      void queryClient.invalidateQueries({ queryKey: [prefix] });
    }
  };
}

export function useAddToContainer(kind: Container) {
  const { api, user } = useSession();
  const refresh = useRefreshContainers();
  return useMutation({
    mutationFn: async ({ containerId, ids }: { containerId: string; ids: string[] }) => {
      if (kind === "playlist") {
        await getPlaylistsApi(api).addItemToPlaylist({
          playlistId: containerId,
          ids,
          userId: user.Id,
        });
      } else {
        await getCollectionApi(api).addToCollection({ collectionId: containerId, ids });
      }
    },
    onSettled: refresh,
  });
}

export function useCreateContainer(kind: Container) {
  const { api, user } = useSession();
  const refresh = useRefreshContainers();
  return useMutation({
    mutationFn: async ({ name, ids }: { name: string; ids: string[] }) => {
      if (kind === "playlist") {
        const result = await getPlaylistsApi(api).createPlaylist({
          createPlaylistDto: { Name: name, Ids: ids, UserId: user.Id, IsPublic: false },
        });
        return result.data.Id ?? null;
      }
      const result = await getCollectionApi(api).createCollection({ name, ids });
      return result.data.Id ?? null;
    },
    onSettled: refresh,
  });
}

export function useRemoveFromContainer(container: BaseItemDto) {
  const { api } = useSession();
  const refresh = useRefreshContainers();
  return useMutation({
    /** Playlists take entry IDs (PlaylistItemId); collections take item IDs. */
    mutationFn: async (items: BaseItemDto[]) => {
      if (container.Type === "Playlist") {
        await getPlaylistsApi(api).removeItemFromPlaylist({
          playlistId: container.Id!,
          entryIds: items.map((item) => item.PlaylistItemId ?? item.Id!),
        });
      } else {
        await getCollectionApi(api).removeFromCollection({
          collectionId: container.Id!,
          ids: items.map((item) => item.Id!),
        });
      }
    },
    onSettled: refresh,
  });
}

export function usePlaylistItems(playlist: BaseItemDto) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["playlist-items", user.Id, playlist.Id],
    queryFn: async ({ signal }) =>
      (
        await getPlaylistsApi(api).getPlaylistItems(
          {
            playlistId: playlist.Id!,
            userId: user.Id,
            fields: [ItemFields.PrimaryImageAspectRatio, ItemFields.MediaSourceCount],
            enableUserData: true,
          },
          { signal },
        )
      ).data.Items ?? [],
    enabled: playlist.Type === "Playlist",
  });
}

export function useMovePlaylistItem(playlist: BaseItemDto) {
  const { api, user } = useSession();
  const queryClient = useQueryClient();
  const key = ["playlist-items", user.Id, playlist.Id];
  return useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const items = queryClient.getQueryData<BaseItemDto[]>(key) ?? [];
      const moved = items[from];
      if (!moved?.PlaylistItemId) return;
      const next = [...items];
      next.splice(from, 1);
      next.splice(to, 0, moved);
      queryClient.setQueryData(key, next);
      await getPlaylistsApi(api).moveItem({
        playlistId: playlist.Id!,
        itemId: moved.PlaylistItemId,
        newIndex: to,
      });
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useRenamePlaylist(playlist: BaseItemDto) {
  const { api } = useSession();
  const refresh = useRefreshContainers();
  return useMutation({
    mutationFn: (name: string) =>
      getPlaylistsApi(api).updatePlaylist({
        playlistId: playlist.Id!,
        updatePlaylistDto: { Name: name },
      }),
    onSettled: refresh,
  });
}

/** Deletes an item from the server (and disk, for media). Needs the item's CanDelete. */
export function useDeleteItem() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => getLibraryApi(api).deleteItem({ itemId }),
    onSuccess: () => void queryClient.invalidateQueries(),
  });
}
