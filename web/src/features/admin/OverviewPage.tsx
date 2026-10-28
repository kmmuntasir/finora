import { RotateCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/Spinner";
import { formatNumber } from "@/lib/format";
import { ActivityList } from "./ActivityList";
import {
  useActivityLog,
  useItemCounts,
  useRestartServer,
  useSessions,
  useSystemInfo,
} from "./queries";

const COUNTS: { key: string; label: string }[] = [
  { key: "MovieCount", label: "Movies" },
  { key: "SeriesCount", label: "Shows" },
  { key: "EpisodeCount", label: "Episodes" },
  { key: "AlbumCount", label: "Albums" },
  { key: "SongCount", label: "Songs" },
  { key: "BoxSetCount", label: "Collections" },
  { key: "BookCount", label: "Books" },
  { key: "MusicVideoCount", label: "Music videos" },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-4 py-3">
      <p className="text-headline-md tabular-nums">{value}</p>
      <p className="text-body-sm text-on-surface-muted">{label}</p>
    </div>
  );
}

/** Server at a glance: version, restart state, library size, who is watching, latest activity. */
export function OverviewPage() {
  const info = useSystemInfo();
  const counts = useItemCounts();
  const sessions = useSessions();
  const activity = useActivityLog(0, null);
  const restart = useRestartServer();
  const [confirm, setConfirm] = useState(false);
  const playing = sessions.data?.filter((session) => session.NowPlayingItem).length ?? 0;

  if (info.isPending) return <Spinner />;
  if (info.isError)
    return (
      <p role="alert" className="text-body-md text-error">
        Couldn't load the server information.
      </p>
    );
  const system = info.data;

  return (
    <div className="space-y-8 pb-16">
      <section aria-labelledby="server-title" className="rounded-lg bg-surface p-5 md:p-6">
        <h2 id="server-title" className="text-title">
          {system.ServerName}
        </h2>
        <p className="mt-1 text-body-sm text-on-surface-muted">
          Jellyfin {system.Version}
          {system.OperatingSystemDisplayName ? ` on ${system.OperatingSystemDisplayName}` : ""}
        </p>
        {system.HasPendingRestart && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-warning/15 px-4 py-3"
          >
            <p className="text-body-md">The server needs a restart to finish applying changes.</p>
            <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
              <RotateCw aria-hidden className="size-4" />
              Restart
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="library-title">
        <h2 id="library-title" className="mb-3 text-title">
          Library
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Playing now" value={formatNumber(playing)} />
          {COUNTS.map(({ key, label }) => {
            const value = (counts.data as Record<string, number> | undefined)?.[key] ?? 0;
            return value > 0 ? <Stat key={key} label={label} value={formatNumber(value)} /> : null;
          })}
        </div>
      </section>

      <section aria-labelledby="activity-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="activity-title" className="text-title">
            Recent activity
          </h2>
          <Link to="/admin/activity" className="text-label-md text-primary hover:underline">
            All activity
          </Link>
        </div>
        {activity.isPending ? (
          <Spinner />
        ) : (
          <ActivityList entries={activity.data?.Items?.slice(0, 8) ?? []} />
        )}
      </section>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Restart the server?"
        confirmLabel="Restart"
        destructive
        busy={restart.isPending}
        onConfirm={() =>
          restart.mutate(undefined, {
            onSuccess: () => {
              setConfirm(false);
              toast.success("Restarting. Playback stops for everyone for a minute or so.");
            },
            onError: () => toast.error("Couldn't restart the server."),
          })
        }
      >
        Everyone watching right now will be interrupted for about a minute.
      </ConfirmDialog>
    </div>
  );
}
