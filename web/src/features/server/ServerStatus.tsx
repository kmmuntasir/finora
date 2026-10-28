import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { usePublicServerInfo } from "./useServerInfo";
import { t } from "@/i18n";

/** Shows whether the configured Jellyfin server is reachable, with its name and version. */
export function ServerStatus() {
  const { config } = useRuntimeConfig();
  const { data, error, isPending, refetch, isFetching } = usePublicServerInfo();

  return (
    <section className="rounded-lg bg-surface p-6" aria-labelledby="server-status-title">
      <h2 id="server-status-title" className="text-title text-on-surface">
        {t("Jellyfin server")}
      </h2>

      {isPending && <Spinner className="mt-4" label={t("Contacting server")} />}

      {error && (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-body-md text-error">
            <CircleAlert aria-hidden className="size-5 shrink-0" />
            {t("Could not reach the server.")}
          </p>
          <p className="mt-2 text-body-sm text-on-surface-muted">
            {t("Check that Jellyfin is running and reachable from this device.")}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {t("Retry")}
          </Button>
        </div>
      )}

      {data && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-md">
          <dt className="text-on-surface-muted">{t("Status")}</dt>
          <dd className="flex items-center gap-2 text-success">
            <CircleCheck aria-hidden className="size-5" />
            {t("Connected")}
          </dd>
          <dt className="text-on-surface-muted">{t("Name")}</dt>
          <dd className="break-words">{data.ServerName ?? t("Unnamed server")}</dd>
          <dt className="text-on-surface-muted">{t("Version")}</dt>
          <dd>{data.Version ?? t("Unknown")}</dd>
          <dt className="text-on-surface-muted">{t("Address")}</dt>
          <dd className="break-all text-on-surface-muted">{config.jellyfinUrl}</dd>
        </dl>
      )}
    </section>
  );
}
