import { BaseItemKind, ItemSortBy, SortOrder } from "@jellyfin/sdk/lib/generated-client/models";
import type { ArtworkShape } from "@/components/media/Artwork";
import { msg } from "@/i18n";

export type SortKey = "name" | "added" | "released" | "rating" | "runtime" | "random";
export type FilterKey = "unplayed" | "played" | "resumable" | "favorite";

export const SORTS: Record<SortKey, { label: string; by: ItemSortBy[]; order: SortOrder }> = {
  name: { label: msg("Name"), by: [ItemSortBy.SortName], order: SortOrder.Ascending },
  added: {
    label: msg("Date added"),
    by: [ItemSortBy.DateCreated, ItemSortBy.SortName],
    order: SortOrder.Descending,
  },
  released: {
    label: msg("Release date"),
    by: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName],
    order: SortOrder.Descending,
  },
  rating: {
    label: msg("Rating"),
    by: [ItemSortBy.CommunityRating, ItemSortBy.SortName],
    order: SortOrder.Descending,
  },
  runtime: {
    label: msg("Runtime"),
    by: [ItemSortBy.Runtime, ItemSortBy.SortName],
    order: SortOrder.Ascending,
  },
  random: { label: msg("Random"), by: [ItemSortBy.Random], order: SortOrder.Ascending },
};

export const FILTERS: Record<FilterKey, string> = {
  unplayed: msg("Unwatched"),
  played: msg("Watched"),
  resumable: msg("In progress"),
  favorite: msg("Favourites"),
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
  /** Year, age rating, resolution, subtitle, tag, studio and feature filters (video libraries). */
  advancedFilters: boolean;
  /** Continuing / ended filter (TV). */
  seriesStatus?: boolean;
  /** Item counts, singular and plural ("{count} movie"); render with `tn`. */
  noun: { one: string; many: string };
}

export type ViewMode = "grid" | "thumbs" | "list";
export const VIEW_MODES: Record<ViewMode, string> = {
  grid: msg("Posters"),
  thumbs: msg("Thumbnails"),
  list: msg("List"),
};

/** Item-query flags; Jellyfin 10.11 has no HDR filter. */
export type Feature = "3d" | "trailer" | "extras";
export const FEATURES: Record<Feature, string> = {
  "3d": "3D",
  trailer: msg("Has a trailer"),
  extras: msg("Has extras"),
};

export type SeriesStatus = "Continuing" | "Ended";

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
    noun: { one: msg("{count} movie"), many: msg("{count} movies") },
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
    seriesStatus: true,
    noun: { one: msg("{count} show"), many: msg("{count} shows") },
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
    noun: { one: msg("{count} album"), many: msg("{count} albums") },
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
    noun: { one: msg("{count} collection"), many: msg("{count} collections") },
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
    noun: { one: msg("{count} playlist"), many: msg("{count} playlists") },
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
    noun: { one: msg("{count} item"), many: msg("{count} items") },
  },
};

/** The "Episodes" view of a TV library. */
export const EPISODES_KIND: LibraryKind = {
  itemTypes: [BaseItemKind.Episode],
  recursive: true,
  shape: "landscape",
  sorts: ["added", "released", "name", "random"],
  defaultSort: "added",
  filters: VIDEO_FILTERS,
  genres: false,
  advancedFilters: false,
  noun: { one: msg("{count} episode"), many: msg("{count} episodes") },
};

export function libraryKind(collectionType: string | null | undefined): LibraryKind {
  return LIBRARY_KINDS[collectionType ?? ""] ?? LIBRARY_KINDS.homevideos!;
}

export const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

export type LibraryTab = "library" | "suggestions" | "upcoming" | "networks" | "episodes";

/** Extra views per library type, after the main library grid. */
export const LIBRARY_TABS: Record<string, { tab: LibraryTab; label: string }[]> = {
  movies: [
    { tab: "library", label: msg("Movies") },
    { tab: "suggestions", label: msg("Suggestions") },
  ],
  tvshows: [
    { tab: "library", label: msg("Shows") },
    { tab: "upcoming", label: msg("Upcoming") },
    { tab: "networks", label: msg("Networks") },
    { tab: "episodes", label: msg("Episodes") },
  ],
};
