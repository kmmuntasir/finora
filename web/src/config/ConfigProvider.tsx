import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { MessageScreen } from "@/components/MessageScreen";
import { Spinner } from "@/components/Spinner";
import { createJellyfinApi } from "@/api/jellyfin";
import { ConfigContext } from "./context";
import { loadRuntimeConfig, type ConfigProblem, type ConfigResult } from "./runtime-config";

/** Loads config.json before anything else renders, and explains problems clearly. */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ConfigResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRuntimeConfig().then((loaded) => {
      if (!cancelled) setResult(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!result) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label="Loading configuration" />
      </div>
    );
  }

  if (!result.ok) return <ConfigProblemScreen problem={result.problem} />;

  return (
    <ConfigContext.Provider
      value={{ config: result.config, publicApi: createJellyfinApi(result.config.jellyfinUrl) }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

function ConfigProblemScreen({ problem }: { problem: ConfigProblem }) {
  const reload = (
    <Button onClick={() => window.location.reload()} variant="secondary">
      Try again
    </Button>
  );

  switch (problem.kind) {
    case "missing":
      return (
        <MessageScreen title="Finora is not configured yet" actions={reload}>
          <p>
            Finora could not load <code>config.json</code>. Copy <code>config.example.json</code> to{" "}
            <code>config.json</code> next to <code>index.html</code> and set{" "}
            <code>jellyfinUrl</code> to your Jellyfin server.
          </p>
          <p className="text-body-sm text-on-surface-subtle">Details: {problem.detail}</p>
        </MessageScreen>
      );
    case "invalid":
      return (
        <MessageScreen title="config.json has a problem" actions={reload}>
          <p>{problem.detail}.</p>
          <p className="text-body-sm text-on-surface-subtle">
            Expected: {'{ "jellyfinUrl": "http://<server>:<port>", "apiUrl": null }'}
          </p>
        </MessageScreen>
      );
    case "insecure-mix":
      return (
        <MessageScreen title="This page is HTTPS, but a server address is HTTP">
          <p>
            Finora is loaded over HTTPS, and browsers block requests from HTTPS pages to HTTP
            addresses. <code>{problem.field}</code> is set to <code>{problem.url}</code>.
          </p>
          <p>
            Either give that server an HTTPS address, or serve Finora over HTTP as well. Both setups
            are supported.
          </p>
        </MessageScreen>
      );
  }
}
