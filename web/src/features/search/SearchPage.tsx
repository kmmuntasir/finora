import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { LandscapeCard, PosterCard } from "@/components/media/cards";
import { MediaRow } from "@/components/media/MediaRow";
import { Spinner } from "@/components/Spinner";
import { useDebounced } from "@/lib/useDebounced";
import { useSearch } from "./queries";

const LANDSCAPE_GROUPS = new Set(["episodes", "videos"]);
const SQUARE_GROUPS = new Set(["artists", "albums", "songs", "people"]);

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const term = params.get("q") ?? "";
  const debounced = useDebounced(term, 300);
  const search = useSearch(debounced);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const searching = debounced.trim().length >= 2;

  return (
    <div className="pt-8 pb-24 md:pt-10">
      <div className="px-page-x-mobile md:px-page-x">
        <h1 className="sr-only">Search</h1>
        <div className="relative max-w-2xl">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-on-surface-muted"
          />
          <input
            ref={input}
            type="search"
            value={term}
            onChange={(event) =>
              setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })
            }
            placeholder="Movies, shows, people, music…"
            aria-label="Search"
            enterKeyHint="search"
            autoComplete="off"
            className="h-14 w-full rounded-full border border-border-strong bg-surface pr-12 pl-12 text-body-lg text-on-surface placeholder:text-on-surface-subtle focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setParams({}, { replace: true });
                input.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-on-surface"
            >
              <X aria-hidden className="size-5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-10" aria-live="polite" aria-busy={search.isFetching}>
        {!searching && (
          <p className="px-page-x-mobile text-body-md text-on-surface-muted md:px-page-x">
            Type at least two letters to search every library.
          </p>
        )}
        {searching && search.isPending && (
          <Spinner className="px-page-x-mobile md:px-page-x" label="Searching" />
        )}
        {searching && search.isError && (
          <p role="alert" className="px-page-x-mobile text-body-md text-error md:px-page-x">
            Search failed. Check your connection and try again.
          </p>
        )}
        {searching && search.data?.length === 0 && (
          <p className="px-page-x-mobile text-body-md text-on-surface-muted md:px-page-x">
            Nothing found for “{debounced.trim()}”.
          </p>
        )}
        {search.data?.map((group) => (
          <MediaRow
            key={group.id}
            title={`${group.title} (${group.items.length})`}
            itemClassName={
              LANDSCAPE_GROUPS.has(group.id)
                ? "w-64 md:w-72"
                : SQUARE_GROUPS.has(group.id)
                  ? "w-32 md:w-40"
                  : "w-32 md:w-40"
            }
          >
            {group.items.map((item) =>
              LANDSCAPE_GROUPS.has(group.id) ? (
                <LandscapeCard key={item.Id} item={item} width={288} />
              ) : (
                <PosterCard key={item.Id} item={item} />
              ),
            )}
          </MediaRow>
        ))}
      </div>
    </div>
  );
}
