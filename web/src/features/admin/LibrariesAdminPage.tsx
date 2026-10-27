import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { ProgressBar } from "@/components/media/ProgressBar";
import { Spinner } from "@/components/Spinner";
import { relativeTime } from "@/lib/format";
import { useAdminMutations, useLibraryScanTask, useVirtualFolders } from "./queries";

const TYPE_LABEL: Record<string, string> = {
  movies: "Movies",
  tvshows: "TV shows",
  music: "Music",
  homevideos: "Home videos & photos",
  boxsets: "Collections",
  books: "Books",
  musicvideos: "Music videos",
  mixed: "Mixed",
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
            <h2 className="text-title">Scan all libraries</h2>
            <p className="text-body-sm text-on-surface-muted">
              {running
                ? `Scanning… ${Math.round(task?.CurrentProgressPercentage ?? 0)}%`
                : lastRun?.EndTimeUtc
                  ? `Last scan ${relativeTime(lastRun.EndTimeUtc).toLowerCase()} (${lastRun.Status ?? "unknown"})`
                  : "Finds new, changed and removed files."}
            </p>
          </div>
          <Button
            onClick={() =>
              scanAll.mutate(undefined, {
                onSuccess: () => toast.success("Library scan started."),
                onError: () => toast.error("Couldn't start the scan."),
              })
            }
            disabled={running || scanAll.isPending}
          >
            <RefreshCw
              aria-hidden
              className={running ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"}
            />
            {running ? "Scanning" : "Scan now"}
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
                  {TYPE_LABEL[library.CollectionType ?? ""] ?? "Library"}
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
                    onSuccess: () => toast.success(`Scanning ${library.Name}.`),
                    onError: () => toast.error(`Couldn't scan ${library.Name}.`),
                  })
                }
              >
                Scan
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
