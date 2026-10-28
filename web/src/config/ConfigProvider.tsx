import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { MessageScreen } from "@/components/MessageScreen";
import { Spinner } from "@/components/Spinner";
import { createJellyfinApi } from "@/api/jellyfin";
import { ConfigContext } from "./context";
import { loadRuntimeConfig, type ConfigProblem, type ConfigResult } from "./runtime-config";
import { t } from "@/i18n";

/** Fills `{name}` placeholders in translated text with `<code>` elements. */
function withCode(text: string, values: Record<string, string>): ReactNode[] {
  return text
    .split(/\{(\w+)\}/)
    .map((part, index) =>
      index % 2 === 1 && part in values ? (
        <code key={index}>{values[part]}</code>
      ) : (
        <Fragment key={index}>{part}</Fragment>
      ),
    );
}

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
        <Spinner label={t("Loading configuration")} />
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
      {t("Try again")}
    </Button>
  );

  switch (problem.kind) {
    case "missing":
      return (
        <MessageScreen title={t("Finora is not configured yet")} actions={reload}>
          <p>
            {withCode(
              t(
                "Finora could not load {config}. Copy {example} to {config} next to {index} and set {field} to your Jellyfin server.",
              ),
              {
                config: "config.json",
                example: "config.example.json",
                index: "index.html",
                field: "jellyfinUrl",
              },
            )}
          </p>
          <p className="text-body-sm text-on-surface-subtle">
            {t("Details: {detail}", { detail: problem.detail })}
          </p>
        </MessageScreen>
      );
    case "invalid":
      return (
        <MessageScreen title={t("config.json has a problem")} actions={reload}>
          <p>{problem.detail}.</p>
          <p className="text-body-sm text-on-surface-subtle">
            {t("Expected: {example}", {
              example: '{ "jellyfinUrl": "http://<server>:<port>", "apiUrl": null }',
            })}
          </p>
        </MessageScreen>
      );
    case "insecure-mix":
      return (
        <MessageScreen title={t("This page is HTTPS, but a server address is HTTP")}>
          <p>
            {withCode(
              t(
                "Finora is loaded over HTTPS, and browsers block requests from HTTPS pages to HTTP addresses. {field} is set to {url}.",
              ),
              { field: problem.field, url: problem.url },
            )}
          </p>
          <p>
            {t(
              "Either give that server an HTTPS address, or serve Finora over HTTP as well. Both setups are supported.",
            )}
          </p>
        </MessageScreen>
      );
  }
}
