import { BaseItemKind, ItemSortBy, SortOrder } from "@jellyfin/sdk/lib/generated-client/models";
import type { ArtworkShape } from "@/components/media/Artwork";

export type SortKey = "name" | "added" | "released" | "rating" | "runtime" | "random";
export type FilterKey = "unplayed" | "played" | "resumable" | "favorite";

export const SORTS: Record<SortKey, { label: string; by: ItemSortBy[]; order: SortOrder }> = {
  name: { label: "Name", by: [ItemSortBy.SortName], order: SortOrder.Ascending },
  added: {
    label: "Date added",
    by: [ItemSortBy.DateCreated, ItemSortBy.SortName],
    order: SortOrder.Descending,
  },
  released: {
    label: "Release date",
    by: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName],
    order: SortOrder.Descending,
  },
  rating: {
    label: "Rating",
    by: [ItemSortBy.CommunityRating, ItemSortBy.SortName],
    order: SortOrder.Descending,
  },
  runtime: {
    label: "Runtime",
    by: [ItemSortBy.Runtime, ItemSortBy.SortName],
    order: SortOrder.Ascending,
  },
  random: { label: "Random", by: [ItemSortBy.Random], order: SortOrder.Ascending },
};

export const FILTERS: Record<FilterKey, string> = {
  unplayed: "Unwatched",
  played: "Watched",
  resumable: "In progress",
  favorite: "Favourites",
};

export interface LibraryKind {
  /** Item types listed at the top level of this library. */
  itemTypes: BaseItemKind[] | null;
  /** Folder libraries list direct children only and allow folder navigation. */
  recursive: boolean;
  shape: ArtworkShape;
  sorts: SortKey[];
  defaultSort: SortKey;
  filters: FilterKey[];
  genres: boolean;
  /** Year, age rating, resolution and subtitle filters (video libraries). */
  advancedFilters: boolean;
  noun: { one: string; many: string };
}

export type Resolution = "sd" | "hd" | "4k";
export const RESOLUTIONS: Record<Resolution, string> = { sd: "SD", hd: "HD", "4k": "4K" };

const VIDEO_FILTERS: FilterKey[] = ["unplayed", "played", "resumable", "favorite"];

export const LIBRARY_KINDS: Record<string, LibraryKind> = {
  movies: {
    itemTypes: [BaseItemKind.Movie],
    recursive: true,
    shape: "poster",
    sorts: ["name", "added", "released", "rating", "runtime", "random"],
    defaultSort: "name",
    filters: VIDEO_FILTERS,
    genres: true,
    advancedFilters: true,
    noun: { one: "movie", many: "movies" },
  },
  tvshows: {
    itemTypes: [BaseItemKind.Series],
    recursive: true,
    shape: "poster",
    sorts: ["name", "added", "released", "rating", "random"],
    defaultSort: "name",
    filters: ["unplayed", "played", "favorite"],
    genres: true,
    advancedFilters: true,
    noun: { one: "show", many: "shows" },
  },
  music: {
    itemTypes: [BaseItemKind.MusicAlbum],
    recursive: true,
    shape: "square",
    sorts: ["name", "added", "released", "random"],
    defaultSort: "name",
    filters: ["favorite"],
    genres: true,
    advancedFilters: false,
    noun: { one: "album", many: "albums" },
  },
  boxsets: {
    itemTypes: [BaseItemKind.BoxSet],
    recursive: true,
    shape: "poster",
    sorts: ["name", "added", "random"],
    defaultSort: "name",
    filters: ["favorite"],
    genres: false,
    advancedFilters: false,
    noun: { one: "collection", many: "collections" },
  },
  playlists: {
    itemTypes: [BaseItemKind.Playlist],
    recursive: true,
    shape: "square",
    sorts: ["name", "added"],
    defaultSort: "name",
    filters: [],
    genres: false,
    advancedFilters: false,
    noun: { one: "playlist", many: "playlists" },
  },
  homevideos: {
    itemTypes: null,
    recursive: false,
    shape: "landscape",
    sorts: ["name", "added", "random"],
    defaultSort: "name",
    filters: VIDEO_FILTERS,
    genres: false,
    advancedFilters: false,
    noun: { one: "item", many: "items" },
  },
};

export function libraryKind(collectionType: string | null | undefined): LibraryKind {
  return LIBRARY_KINDS[collectionType ?? ""] ?? LIBRARY_KINDS.homevideos!;
}

export const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
