import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  FEATURES,
  FILTERS,
  RESOLUTIONS,
  VIEW_MODES,
  type Feature,
  type SeriesStatus,
  type ViewMode,
  SORTS,
  type FilterKey,
  type LibraryKind,
  type Resolution,
  type SortKey,
} from "./library-config";

export interface LibraryState {
  sort: SortKey;
  /** Reverses the sort's natural order. */
  reversed: boolean;
  filters: FilterKey[];
  genre: string | null;
  year: number | null;
  rating: string | null;
  resolution: Resolution | null;
  subtitles: boolean;
  tag: string | null;
  /** Studio ID. */
  studio: string | null;
  features: Feature[];
  status: SeriesStatus | null;
  view: ViewMode;
  letter: string | null;
  /** Folder being browsed inside a folder library. */
  parent: string | null;
}

const storageKey = (libraryId: string) => `finora.library.${libraryId}`;

function readSaved(libraryId: string): Partial<LibraryState> {
  try {
    return JSON.parse(
      window.localStorage.getItem(storageKey(libraryId)) ?? "{}",
    ) as Partial<LibraryState>;
  } catch {
    return {};
  }
}

/**
 * Library view state lives in the URL (shareable, back-button friendly).
 * Sort and filters are also remembered per library on this device.
 */
export function useLibraryState(libraryId: string, kind: LibraryKind) {
  const [params, setParams] = useSearchParams();

  const state = useMemo<LibraryState>(() => {
    const saved = readSaved(libraryId);
    const sortParam = params.get("sort") ?? saved.sort;
    const sort = kind.sorts.includes(sortParam as SortKey)
      ? (sortParam as SortKey)
      : kind.defaultSort;
    const filterParam = params.has("filter")
      ? params.get("filter")!.split(",")
      : (saved.filters ?? []);
    return {
      sort,
      reversed: params.has("sort") ? params.get("dir") === "rev" : Boolean(saved.reversed),
      filters: filterParam.filter(
        (f): f is FilterKey => kind.filters.includes(f as FilterKey) && f in FILTERS,
      ),
      genre: params.get("genre"),
      year: Number(params.get("year")) || null,
      rating: params.get("rating"),
      resolution:
        (params.get("res") ?? "") in RESOLUTIONS ? (params.get("res") as Resolution) : null,
      subtitles: params.get("subs") === "1",
      tag: params.get("tag"),
      studio: params.get("studio"),
      features: (params.get("features")?.split(",") ?? []).filter(
        (feature): feature is Feature => feature in FEATURES,
      ),
      status:
        params.get("status") === "Continuing" || params.get("status") === "Ended"
          ? (params.get("status") as SeriesStatus)
          : null,
      view: ((params.get("view") ?? saved.view ?? "grid") in VIEW_MODES
        ? (params.get("view") ?? saved.view ?? "grid")
        : "grid") as ViewMode,
      letter: params.get("letter"),
      parent: params.get("parent"),
    };
  }, [params, libraryId, kind]);

  const update = useCallback(
    (changes: Partial<LibraryState>) => {
      const next = { ...state, ...changes };
      // Changing anything except the letter (or the view) resets the letter jump.
      if (!("letter" in changes) && !("view" in changes)) next.letter = null;
      if (next.sort !== "name") next.letter = null;
      window.localStorage.setItem(
        storageKey(libraryId),
        JSON.stringify({
          sort: next.sort,
          reversed: next.reversed,
          filters: next.filters,
          view: next.view,
        }),
      );
      const search = new URLSearchParams();
      search.set("sort", next.sort);
      if (next.reversed) search.set("dir", "rev");
      if (next.filters.length) search.set("filter", next.filters.join(","));
      if (next.genre) search.set("genre", next.genre);
      if (next.year) search.set("year", String(next.year));
      if (next.rating) search.set("rating", next.rating);
      if (next.resolution) search.set("res", next.resolution);
      if (next.subtitles) search.set("subs", "1");
      if (next.tag) search.set("tag", next.tag);
      if (next.studio) search.set("studio", next.studio);
      if (next.features.length) search.set("features", next.features.join(","));
      if (next.status) search.set("status", next.status);
      if (next.view !== "grid") search.set("view", next.view);
      if (next.letter) search.set("letter", next.letter);
      if (next.parent) search.set("parent", next.parent);
      setParams(search, { replace: !("parent" in changes) });
    },
    [state, libraryId, setParams],
  );

  return { state, update, sortConfig: SORTS[state.sort] };
}
