import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/media/ProgressBar";
import { Spinner } from "@/components/Spinner";
import { relativeTime } from "@/lib/format";
import { useAdminMutations, useLibraryScanTask, useVirtualFolders } from "./queries";
import { msg, t } from "@/i18n";

const TYPE_LABEL: Record<string, string> = {
  movies: msg("Movies"),
  tvshows: msg("TV shows"),
  music: msg("Music"),
  homevideos: msg("Home videos & photos"),
  boxsets: msg("Collections"),
  books: msg("Books"),
  musicvideos: msg("Music videos"),
  mixed: msg("Mixed"),
};

export function LibrariesAdminPage() {
  const { data: libraries, isPending } = useVirtualFolders();
  const { data: task } = useLibraryScanTask();
  const { scanAll, scanLibrary } = useAdminMutations();
  const running = task?.State === "Running";
  const lastRun = task?.LastExecutionResult;

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-title">{t("Scan all libraries")}</h2>
            <p className="text-body-sm text-on-surface-muted">
              {running
                ? t("Scanning… {percent}%", {
                    percent: Math.round(task?.CurrentProgressPercentage ?? 0),
                  })
                : lastRun?.EndTimeUtc
                  ? t("Last scan {when} ({status})", {
                      when: relativeTime(lastRun.EndTimeUtc).toLowerCase(),
                      status: lastRun.Status ?? t("unknown"),
                    })
                  : t("Finds new, changed and removed files.")}
            </p>
          </div>
          <Button
            onClick={() =>
              scanAll.mutate(undefined, {
                onSuccess: () => toast.success(t("Library scan started.")),
                onError: () => toast.error(t("Couldn't start the scan.")),
              })
            }
            disabled={running || scanAll.isPending}
          >
            <RefreshCw
              aria-hidden
              className={running ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"}
            />
            {running ? t("Scanning") : t("Scan now")}
          </Button>
        </div>
        {running && (
          <ProgressBar value={(task?.CurrentProgressPercentage ?? 0) / 100} className="mt-4" />
        )}
      </section>

      {isPending ? (
        <Spinner />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {libraries?.map((library) => (
            <li
              key={library.ItemId}
              className="flex items-start justify-between gap-4 rounded-lg bg-surface p-5"
            >
              <div className="min-w-0">
                <p className="text-label-md">{library.Name}</p>
                <p className="text-body-sm text-on-surface-muted">
                  {t(TYPE_LABEL[library.CollectionType ?? ""] ?? msg("Library"))}
                </p>
                <ul className="mt-2 space-y-0.5">
                  {library.Locations?.map((location) => (
                    <li
                      key={location}
                      className="truncate text-caption text-on-surface-subtle"
                      title={location}
                    >
                      {location}
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={scanLibrary.isPending}
                onClick={() =>
                  scanLibrary.mutate(library.ItemId!, {
                    onSuccess: () =>
                      toast.success(t("Scanning {name}.", { name: library.Name ?? "" })),
                    onError: () =>
                      toast.error(t("Couldn't scan {name}.", { name: library.Name ?? "" })),
                  })
                }
              >
                {t("Scan")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
