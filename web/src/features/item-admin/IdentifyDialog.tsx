import type { BaseItemDto, RemoteSearchResult } from "@jellyfin/sdk/lib/generated-client/models";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";
import { TextField } from "@/components/TextField";
import { useApplyIdentification, useRemoteSearch } from "./api";
import { t } from "@/i18n";

/** Finds the item on metadata providers (TMDb, MusicBrainz, …) and applies the chosen match. */
export function IdentifyDialog({ item, onClose }: { item: BaseItemDto; onClose: () => void }) {
  const search = useRemoteSearch(item);
  const apply = useApplyIdentification(item);
  const [name, setName] = useState(item.Name ?? "");
  const [year, setYear] = useState(item.ProductionYear?.toString() ?? "");
  const [imdb, setImdb] = useState(item.ProviderIds?.Imdb ?? "");
  const [tmdb, setTmdb] = useState(item.ProviderIds?.Tmdb ?? "");
  const [replaceImages, setReplaceImages] = useState(true);
  const video = ["Movie", "Series", "BoxSet", "Trailer", "MusicVideo"].includes(item.Type ?? "");

  const run = () => {
    const providerIds: Record<string, string> = {};
    if (imdb.trim()) providerIds.Imdb = imdb.trim();
    if (tmdb.trim()) providerIds.Tmdb = tmdb.trim();
    search.mutate(
      { Name: name.trim(), Year: year ? Number(year) : undefined, ProviderIds: providerIds },
      { onError: () => toast.error(t("The search failed.")) },
    );
  };

  const choose = (result: RemoteSearchResult) =>
    apply.mutate(
      { result, replaceImages },
      {
        onSuccess: () => {
          toast.success(
            t("Identified as “{name}”. Metadata is updating.", { name: result.Name ?? "" }),
          );
          onClose();
        },
        onError: () => toast.error(t("Couldn't apply this match.")),
      },
    );

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("Identify")}
      description={item.Name ?? undefined}
      className="md:w-[min(44rem,calc(100%-2rem))]"
    >
      <form
        className="grid gap-3 sm:grid-cols-[1fr_7rem]"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <TextField
          label={t("Name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t("Year")}
          type="number"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        />
        {video && (
          <>
            <TextField
              label={t("IMDb ID")}
              value={imdb}
              onChange={(event) => setImdb(event.target.value)}
              placeholder="tt0133093"
            />
            <TextField
              label={t("TMDb ID")}
              value={tmdb}
              onChange={(event) => setTmdb(event.target.value)}
            />
          </>
        )}
        <label className="flex cursor-pointer items-center gap-3 text-body-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={replaceImages}
            onChange={(event) => setReplaceImages(event.target.checked)}
            className="size-4 accent-primary"
          />
          {t("Replace existing images")}
        </label>
        <Button type="submit" className="justify-self-start" disabled={search.isPending}>
          {search.isPending ? t("Searching…") : t("Search")}
        </Button>
      </form>

      <div className="mt-5" aria-live="polite">
        {search.isPending ? (
          <Spinner className="flex justify-center py-6" />
        ) : search.data?.length === 0 ? (
          <p className="text-body-md text-on-surface-muted">
            {t("No matches. Try another name or an ID.")}
          </p>
        ) : (
          <ul className="space-y-2">
            {search.data?.map((result, index) => (
              <li key={`${result.SearchProviderName}-${index}`}>
                <button
                  type="button"
                  disabled={apply.isPending}
                  onClick={() => choose(result)}
                  className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-surface-raised disabled:opacity-60"
                >
                  {result.ImageUrl ? (
                    <img
                      src={result.ImageUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-14 shrink-0 rounded-sm bg-surface-raised object-cover"
                    />
                  ) : (
                    <span className="h-20 w-14 shrink-0 rounded-sm bg-surface-raised" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-label-md">
                      {result.Name}
                      {result.ProductionYear ? ` (${result.ProductionYear})` : ""}
                    </span>
                    <span className="block text-caption text-on-surface-muted">
                      {result.SearchProviderName}
                    </span>
                    {result.Overview && (
                      <span className="mt-1 line-clamp-2 block text-body-sm text-on-surface-muted">
                        {result.Overview}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
