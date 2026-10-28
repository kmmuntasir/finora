import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import type { QuickConnectState } from "./useQuickConnect";
import { t } from "@/i18n";

interface QuickConnectPanelProps {
  state: QuickConnectState;
  onRetry: () => void;
  onCancel: () => void;
}

export function QuickConnectPanel({ state, onRetry, onCancel }: QuickConnectPanelProps) {
  return (
    <div aria-live="polite">
      <h2 className="text-title">{t("Sign in with Quick Connect")}</h2>

      {(state.phase === "starting" || state.phase === "completing") && (
        <Spinner
          className="mt-6"
          label={state.phase === "starting" ? t("Requesting a code") : t("Signing you in")}
        />
      )}

      {state.phase === "waiting" && (
        <>
          <p className="mt-2 text-body-sm text-on-surface-muted">
            {t(
              "On a phone, TV or computer where you are already signed in, open Quick Connect in Jellyfin's settings and enter this code.",
            )}
          </p>
          <p
            className="mt-6 rounded-md bg-background py-5 text-center font-bold text-[40px] leading-none tracking-[0.3em] pl-[0.3em] tabular-nums"
            aria-label={t("Code {code}", { code: state.code.split("").join(" ") })}
          >
            {state.code}
          </p>
          <p className="mt-4 flex items-center gap-2 text-body-sm text-on-surface-muted">
            <Spinner label={t("Waiting for approval")} className="[&_svg]:size-4" />
            {t("Waiting for approval…")}
          </p>
        </>
      )}

      {state.phase === "expired" && (
        <p role="alert" className="mt-4 text-body-md text-on-surface-muted">
          {t("The code expired. Request a new one to try again.")}
        </p>
      )}

      {state.phase === "error" && (
        <p role="alert" className="mt-4 text-body-md text-error">
          {state.message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {(state.phase === "expired" || state.phase === "error") && (
          <Button onClick={onRetry}>{t("New code")}</Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          {t("Use password instead")}
        </Button>
      </div>
    </div>
  );
}
