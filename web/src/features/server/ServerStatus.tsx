import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { usePublicServerInfo } from "./useServerInfo";

/** Shows whether the configured Jellyfin server is reachable, with its name and version. */
export function ServerStatus() {
  const { config } = useRuntimeConfig();
  const { data, error, isPending, refetch, isFetching } = usePublicServerInfo();

  return (
    <section className="rounded-lg bg-surface p-6" aria-labelledby="server-status-title">
      <h2 id="server-status-title" className="text-title text-on-surface">
        Jellyfin server
      </h2>

      {isPending && <Spinner className="mt-4" label="Contacting server" />}

      {error && (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-body-md text-error">
            <CircleAlert aria-hidden className="size-5 shrink-0" />
            Could not reach the server.
          </p>
          <p className="mt-2 text-body-sm text-on-surface-muted">
            Check that Jellyfin is running and reachable from this device.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Retry
          </Button>
        </div>
      )}

      {data && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-md">
          <dt className="text-on-surface-muted">Status</dt>
          <dd className="flex items-center gap-2 text-success">
            <CircleCheck aria-hidden className="size-5" />
            Connected
          </dd>
          <dt className="text-on-surface-muted">Name</dt>
          <dd className="break-words">{data.ServerName ?? "Unnamed server"}</dd>
          <dt className="text-on-surface-muted">Version</dt>
          <dd>{data.Version ?? "Unknown"}</dd>
          <dt className="text-on-surface-muted">Address</dt>
          <dd className="break-all text-on-surface-muted">{config.jellyfinUrl}</dd>
        </dl>
      )}
    </section>
  );
}
