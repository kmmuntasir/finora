import type { ActivityLogEntry } from "@jellyfin/sdk/lib/generated-client/models";
import { AlertTriangle, Info, LogIn, Play, Settings2, XCircle } from "lucide-react";
import { formatDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

function icon(entry: ActivityLogEntry) {
  if (entry.Severity === "Error" || entry.Severity === "Critical") return XCircle;
  if (entry.Severity === "Warning") return AlertTriangle;
  const type = entry.Type ?? "";
  if (type.startsWith("VideoPlayback") || type.startsWith("AudioPlayback")) return Play;
  if (type.includes("Authentication") || type.includes("Session")) return LogIn;
  if (type.includes("Plugin") || type.includes("Task") || type.includes("Configuration"))
    return Settings2;
  return Info;
}

/** Jellyfin activity entries: who signed in, what played, failures, server changes. */
export function ActivityList({ entries }: { entries: ActivityLogEntry[] }) {
  if (!entries.length)
    return <p className="text-body-md text-on-surface-muted">{t("Nothing recorded yet.")}</p>;
  return (
    <ul className="divide-y divide-border rounded-lg bg-surface">
      {entries.map((entry) => {
        const Icon = icon(entry);
        const problem =
          entry.Severity === "Error" ||
          entry.Severity === "Critical" ||
          entry.Severity === "Warning";
        return (
          <li key={entry.Id} className="flex items-start gap-3 px-4 py-3">
            <Icon
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0",
                problem ? "text-error" : "text-on-surface-muted",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-body-md">{entry.Name}</p>
              {entry.ShortOverview && (
                <p className="text-body-sm text-on-surface-muted">{entry.ShortOverview}</p>
              )}
            </div>
            <time
              dateTime={entry.Date}
              title={formatDate(entry.Date, "datetime")}
              className="shrink-0 text-caption text-on-surface-subtle"
            >
              {relativeTime(entry.Date)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
