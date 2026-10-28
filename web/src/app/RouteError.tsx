import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from "@/components/Button";
import { t } from "@/i18n";

/** Shown instead of a page that crashed, so people can recover without a blank screen. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  console.error(error);
  return (
    <div role="alert" className="grid min-h-[60vh] place-items-center px-page-x-mobile text-center">
      <div className="max-w-md">
        <h1 className="text-headline-md">
          {notFound ? t("This page doesn't exist") : t("Something went wrong")}
        </h1>
        <p className="mt-2 text-body-md text-on-surface-muted">
          {notFound
            ? t("The link may be old, or the item was removed.")
            : t("This page ran into a problem. Reloading usually helps.")}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()}>{t("Reload")}</Button>
          <Button variant="secondary" onClick={() => window.location.assign("/")}>
            {t("Go home")}
          </Button>
        </div>
      </div>
    </div>
  );
}
