import { formatNumber } from "@/lib/format";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PlayButton } from "@/components/media/PlayButton";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useUserViews } from "@/features/home/queries";
import { AlphabetRail } from "./AlphabetRail";
import { ItemGrid } from "./ItemGrid";
import { libraryKind, type LibraryKind } from "./library-config";
import { useLibraryState } from "./library-state";
import { LibraryToolbar } from "./LibraryToolbar";
import {
  useAncestors,
  useGenres,
  useItemSummary,
  useLibraryFilterValues,
  useLibraryItems,
} from "./queries";

export function LibraryPage() {
  const { libraryId } = useParams();
  const { data: views, isPending } = useUserViews();
  const view = views?.find((candidate) => candidate.Id === libraryId);

  if (isPending) return <PageSpinner />;
  if (!view?.Id) {
    return (
      <div className="px-page-x-mobile py-10 md:px-page-x">
        <h1 className="text-headline-md">Library not found</h1>
        <p className="mt-2 text-body-md text-on-surface-muted">
          It may have been removed, or you no longer have access.
        </p>
      </div>
    );
  }
  return <Library key={view.Id} view={view} kind={libraryKind(view.CollectionType)} />;
}

function PageSpinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner />
    </div>
  );
}

function Library({ view, kind }: { view: BaseItemDto; kind: LibraryKind }) {
  const { state, update } = useLibraryState(view.Id!, kind);
  const items = useLibraryItems(view, kind, state);
  const genres = useGenres(view, kind);
  const filterValues = useLibraryFilterValues(view, kind);

  const list = useMemo(
    () => items.data?.pages.flatMap((page) => page.Items ?? []) ?? [],
    [items.data],
  );
  const total = items.data?.pages[0]?.TotalRecordCount ?? 0;
  const filtered =
    state.filters.length > 0 ||
    state.genre !== null ||
    state.letter !== null ||
    state.year !== null ||
    state.rating !== null ||
    state.resolution !== null ||
    state.subtitles;
  const showRail = state.sort === "name" && kind.recursive;

  return (
    <div className="px-page-x-mobile pt-8 pb-24 md:px-page-x md:pt-10">
      <header className="mb-6">
        {!kind.recursive && state.parent ? (
          <FolderTrail
            view={view}
            folderId={state.parent}
            onNavigate={(parent) => update({ parent })}
          />
        ) : (
          <h1 className="text-headline-lg">{view.Name}</h1>
        )}
        <p className="mt-1 text-body-sm text-on-surface-muted" aria-live="polite">
          {items.isPending
            ? " "
            : `${formatNumber(total)} ${total === 1 ? kind.noun.one : kind.noun.many}`}
        </p>
        {!kind.recursive && list.some((item) => item.MediaType === "Video") && (
          <PlayAll items={list} />
        )}
        <div className="mt-5">
          <LibraryToolbar
            kind={kind}
            state={state}
            update={update}
            genres={(genres.data ?? [])
              .map((genre) => genre.Name)
              .filter((name): name is string => Boolean(name))}
            years={filterValues.data?.years ?? []}
            ratings={filterValues.data?.ratings ?? []}
          />
        </div>
        {showRail && (
          <div className="mt-4 lg:hidden">
            <AlphabetRail active={state.letter} onSelect={(letter) => update({ letter })} />
          </div>
        )}
      </header>

      <div className={showRail ? "lg:grid lg:grid-cols-[1fr_auto] lg:gap-6" : undefined}>
        <div className="min-w-0">
          {items.isPending ? (
            <PageSpinner />
          ) : items.isError ? (
            <div role="alert" className="py-16 text-center">
              <p className="text-body-md">Couldn't load this library.</p>
              <Button className="mt-4" variant="secondary" onClick={() => void items.refetch()}>
                Try again
              </Button>
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-body-md">
                {filtered ? "Nothing matches these filters." : "This library is empty."}
              </p>
              {filtered && (
                <Button
                  className="mt-4"
                  variant="secondary"
                  onClick={() =>
                    update({
                      filters: [],
                      genre: null,
                      letter: null,
                      year: null,
                      rating: null,
                      resolution: null,
                      subtitles: false,
                    })
                  }
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <ItemGrid
              items={list}
              shape={kind.shape}
              hasMore={Boolean(items.hasNextPage) && !items.isFetchingNextPage}
              onLoadMore={() => void items.fetchNextPage()}
              folderHref={kind.recursive ? undefined : (item) => folderHref(view, item)}
            />
          )}
          {items.isFetchingNextPage && (
            <Spinner className="mt-8 flex justify-center" label="Loading more" />
          )}
        </div>
        {showRail && (
          <div className="hidden lg:block">
            <AlphabetRail active={state.letter} onSelect={(letter) => update({ letter })} />
          </div>
        )}
      </div>
    </div>
  );
}

function folderHref(view: BaseItemDto, folder: BaseItemDto): string {
  return `/libraries/${view.Id}?parent=${folder.Id}`;
}

/** Breadcrumbs: Library › Folder › Subfolder. */
function FolderTrail({
  view,
  folderId,
  onNavigate,
}: {
  view: BaseItemDto;
  folderId: string;
  onNavigate: (parent: string | null) => void;
}) {
  const { data: ancestors } = useAncestors(folderId);
  const { data: current } = useItemSummary(folderId);
  // Ancestors come nearest-first: …, subfolder, library root folder, "root".
  // The library root folder stands in for the view, so drop it and the
  // server-level roots, keeping only folders inside the library.
  const trail = useMemo(() => {
    if (!ancestors) return [];
    const ordered = [...ancestors]
      .reverse()
      .filter(
        (ancestor) =>
          !["AggregateFolder", "UserRootFolder", "CollectionFolder"].includes(ancestor.Type ?? ""),
      );
    return ordered.slice(1);
  }, [ancestors]);

  return (
    <div>
      <nav
        aria-label="Folder"
        className="flex flex-wrap items-center gap-1 text-label-md text-on-surface-muted"
      >
        <Link
          to={`/libraries/${view.Id}`}
          onClick={() => onNavigate(null)}
          className="hover:text-on-surface"
        >
          {view.Name}
        </Link>
        {trail.map((folder) => (
          <span key={folder.Id} className="flex items-center gap-1">
            <ChevronRight aria-hidden className="size-4" />
            <button
              type="button"
              onClick={() => onNavigate(folder.Id ?? null)}
              className="hover:text-on-surface"
            >
              {folder.Name}
            </button>
          </span>
        ))}
      </nav>
      <h1 className="mt-1 text-headline-lg">{current?.Name ?? " "}</h1>
    </div>
  );
}

/** Plays the first video in this folder; Up next then continues through the folder by name. */
function PlayAll({ items }: { items: BaseItemDto[] }) {
  const navigate = useNavigate();
  const first = [...items]
    .filter((item) => item.MediaType === "Video" && !item.IsFolder)
    .sort((a, b) => (a.SortName ?? a.Name ?? "").localeCompare(b.SortName ?? b.Name ?? ""))[0];
  if (!first) return null;
  return (
    <PlayButton
      className="mt-4"
      label="Play all"
      onClick={() => void navigate(`/play/${first.Id}`)}
    />
  );
}
