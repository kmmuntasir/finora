import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useSearchParams } from "react-router";
import { cn } from "@/lib/cn";
import { ActivityList } from "./ActivityList";
import { ACTIVITY_PAGE, useActivityLog } from "./queries";
import { msg, t } from "@/i18n";

const FILTERS = [
  { value: "all", label: msg("Everything"), users: null },
  { value: "users", label: msg("User activity"), users: true },
  { value: "system", label: msg("Server"), users: false },
] as const;

export function ActivityPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, Number(params.get("page")) || 0);
  const filter = FILTERS.find((entry) => entry.value === params.get("show")) ?? FILTERS[0];
  const log = useActivityLog(page, filter.users);
  const total = log.data?.TotalRecordCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE));
  const go = (next: Record<string, string>) =>
    setParams({ ...Object.fromEntries(params), ...next }, { replace: true });

  return (
    <div className="space-y-4 pb-16">
      <div role="radiogroup" aria-label={t("Show")} className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="radio"
            aria-checked={entry.value === filter.value}
            onClick={() => go({ show: entry.value, page: "0" })}
            className={cn(
              "h-9 rounded-full px-3.5 text-label-md",
              entry.value === filter.value
                ? "bg-primary text-on-primary"
                : "bg-surface-raised text-on-surface-muted hover:text-on-surface",
            )}
          >
            {t(entry.label)}
          </button>
        ))}
      </div>
      {log.isPending ? (
        <Spinner />
      ) : log.isError ? (
        <p role="alert" className="text-body-md text-error">
          {t("Couldn't load the activity log.")}
        </p>
      ) : (
        <ActivityList entries={log.data.Items ?? []} />
      )}
      {pages > 1 && (
        <nav aria-label={t("Pages")} className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => go({ page: String(page - 1) })}
          >
            {t("Newer")}
          </Button>
          <span className="text-body-sm text-on-surface-muted tabular-nums">
            {t("Page {page} of {pages}", { page: page + 1, pages })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= pages}
            onClick={() => go({ page: String(page + 1) })}
          >
            {t("Older")}
          </Button>
        </nav>
      )}
    </div>
  );
}
