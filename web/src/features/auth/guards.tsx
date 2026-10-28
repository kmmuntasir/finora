import { Navigate, Outlet, useLocation } from "react-router";
import { Button } from "@/components/Button";
import { MessageScreen } from "@/components/MessageScreen";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "./context";
import { t } from "@/i18n";

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner label={label} />
    </div>
  );
}

/** Renders child routes only for signed-in users; otherwise sends them to /login. */
export function RequireAuth() {
  const { state, retryRestore, signOut } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case "restoring":
      return <FullPageSpinner label={t("Signing you in")} />;
    case "unreachable":
      return (
        <MessageScreen
          title={t("Can't reach the server")}
          actions={
            <>
              <Button onClick={retryRestore}>{t("Try again")}</Button>
              <Button variant="secondary" onClick={() => void signOut()}>
                {t("Sign out")}
              </Button>
            </>
          }
        >
          <p>{t("Your Jellyfin server did not respond. It may be offline or restarting.")}</p>
        </MessageScreen>
      );
    case "signed-out":
      return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    case "signed-in":
      return <Outlet />;
  }
}

/** Keeps signed-in users away from the login page. */
export function RedirectIfSignedIn() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "restoring") return <FullPageSpinner label={t("Signing you in")} />;
  if (state.status === "signed-in") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
  }
  return <Outlet />;
}
