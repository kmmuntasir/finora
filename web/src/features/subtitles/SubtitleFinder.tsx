import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Captions, Check, Download, Trash2, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useId, useState } from "react";
import { toast } from "sonner";
import { FinoraApiError } from "@/api/finora";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/context";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import {
  useItemSubtitles,
  useSubtitleLanguages,
  useSubtitleMutations,
  useSubtitleSearch,
  useSubtitlesEnabled,
  type SubtitleResult,
} from "./api";

const SUPPORTED_TYPES = new Set(["Movie", "Episode", "Video"]);

function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "good" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-label-sm",
        tone === "good" && "bg-success/15 text-success",
        tone === "neutral" && "bg-surface-overlay text-on-surface-muted",
        tone === "muted" && "bg-warning/15 text-warning",
      )}
    >
      {children}
    </span>
  );
}

/** "Find subtitles" button and dialog for a movie, episode or video. */
export function SubtitleFinder({ item }: { item: BaseItemDto }) {
  const enabled = useSubtitlesEnabled();
  const [open, setOpen] = useState(false);
  if (!enabled || !item.Id || !SUPPORTED_TYPES.has(item.Type ?? "")) return null;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm">
          <Captions aria-hidden className="size-4" />
          Find subtitles
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-xl bg-surface-overlay shadow-[0_24px_48px_rgb(0_0_0/0.5)] ring-1 ring-border md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[80vh] md:w-[min(44rem,calc(100%-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl">
          {open && <FinderBody item={item} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FinderBody({ item }: { item: BaseItemDto }) {
  const { user } = useSession();
  const languages = useSubtitleLanguages();
  const preferred = user.Configuration?.SubtitleLanguagePreference;
  const initial =
    languages.data?.find((language) => language.code3 === preferred || language.code === preferred)
      ?.code ?? "en";
  const [language, setLanguage] = useState<string | null>(null);
  const lang = language ?? initial;
  const search = useSubtitleSearch(item.Id!, lang, true);
  const existing = useItemSubtitles(item.Id!);
  const { download, remove } = useSubtitleMutations(item.Id!);
  const [chosen, setChosen] = useState<string | null>(null);
  const selectId = useId();

  const choose = (result: SubtitleResult) => {
    setChosen(result.id);
    download.mutate(
      { candidate: result.id, language: lang },
      {
        onSuccess: (subtitle) => {
          toast.success(
            subtitle.uploadError
              ? "Subtitle added in Finora (Jellyfin didn't accept it)."
              : "Subtitle added for everyone.",
          );
        },
        onError: (error) =>
          toast.error(
            error instanceof FinoraApiError ? error.message : "Couldn't add the subtitle.",
          ),
        onSettled: () => setChosen(null),
      },
    );
  };

  const title =
    item.Type === "Episode" ? `${item.SeriesName ?? ""} · ${item.Name ?? ""}` : (item.Name ?? "");
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div className="min-w-0">
          <Dialog.Title className="text-title">Find subtitles</Dialog.Title>
          <Dialog.Description className="truncate text-body-sm text-on-surface-muted">
            {title}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Close"
          className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-raised"
        >
          <X aria-hidden className="size-5" />
        </Dialog.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={selectId} className="mb-1.5 block text-label-md">
              Language
            </label>
            <select
              id={selectId}
              value={lang}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-10 rounded-md border border-border-strong bg-background px-3 text-body-sm"
            >
              {languages.data?.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </div>
          {search.data && (
            <p className="pb-2 text-body-sm text-on-surface-muted">
              {search.data.providers
                .map(
                  (provider) =>
                    `${provider.name}: ${provider.status === "ok" ? provider.results : (provider.message ?? provider.status)}`,
                )
                .join(" · ")}
            </p>
          )}
        </div>

        {existing.data && existing.data.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2 text-label-md">Added through Finora</h3>
            <ul className="space-y-2">
              {existing.data.map((subtitle) => (
                <li
                  key={subtitle.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2"
                >
                  <span className="min-w-0 text-body-sm">
                    <span className="block truncate">{subtitle.release || subtitle.provider}</span>
                    <span className="text-caption text-on-surface-muted">
                      {subtitle.language.toUpperCase()} · {subtitle.createdByName} ·{" "}
                      {relativeTime(subtitle.createdAt).toLowerCase()}
                      {subtitle.jellyfinStreamIndex === null ? " · being indexed by Jellyfin" : ""}
                    </span>
                  </span>
                  {(subtitle.createdById === user.Id || user.Policy?.IsAdministrator) && (
                    <button
                      type="button"
                      onClick={() =>
                        remove.mutate(subtitle.id, {
                          onSuccess: () => toast.success("Subtitle removed."),
                        })
                      }
                      aria-label="Remove subtitle"
                      className="grid size-8 shrink-0 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-error"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5" aria-busy={search.isFetching}>
          {search.isPending ? (
            <div className="flex items-center gap-3 py-8 text-body-sm text-on-surface-muted">
              <Spinner />
              Searching subtitle sites… this can take up to half a minute.
            </div>
          ) : search.isError ? (
            <p role="alert" className="py-6 text-body-md text-error">
              {search.error instanceof FinoraApiError ? search.error.message : "The search failed."}
            </p>
          ) : !search.data?.results.length ? (
            <p className="py-6 text-body-md text-on-surface-muted">
              No subtitles found in this language.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {search.data.results.map((result) => (
                <li key={result.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm" title={result.release}>
                      {result.release || "Unnamed release"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-caption text-on-surface-subtle">
                        {result.providerName}
                      </span>
                      {result.hashMatch && <Badge tone="good">Exact sync</Badge>}
                      {result.releaseMatch && <Badge tone="good">Matches your file</Badge>}
                      {result.hearingImpaired && <Badge>Hearing impaired</Badge>}
                      {result.forced && <Badge>Forced</Badge>}
                      {result.aiTranslated && <Badge tone="muted">Machine translated</Badge>}
                      {result.downloads > 0 && (
                        <span className="text-caption text-on-surface-subtle">
                          {result.downloads.toLocaleString()} downloads
                        </span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => choose(result)} disabled={download.isPending}>
                    {chosen === result.id ? (
                      <Spinner label="Adding" className="[&_svg]:size-4 [&_svg]:text-on-primary" />
                    ) : download.isSuccess && download.variables?.candidate === result.id ? (
                      <Check aria-hidden className="size-4" />
                    ) : (
                      <Download aria-hidden className="size-4" />
                    )}
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
