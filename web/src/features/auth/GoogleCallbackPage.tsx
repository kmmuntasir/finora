import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { finoraFetch } from "@/api/finora";
import { createJellyfinApi } from "@/api/jellyfin";
import { MessageScreen } from "@/components/MessageScreen";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { markGoogleAdminSession } from "@/features/admin/access";
import { useAuth } from "./context";
import { clearPendingGoogleSignIn, readPendingGoogleSignIn } from "./google-signin";
import { msg, t } from "@/i18n";

const REASONS: Record<string, string> = {
  cancelled: msg("Google sign-in was cancelled."),
  "not-allowed": msg("This Google account is not linked to a Finora administrator."),
  "code-expired": msg("The sign-in took too long. Please try again."),
  google: msg("Google could not confirm the sign-in. Please try again."),
  unavailable: msg("Google sign-in is not available right now."),
  "bad-request": msg("The sign-in request was invalid. Please try again."),
};

/** Finishes Google admin sign-in after the Finora API redirects back. */
export function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const { config } = useRuntimeConfig();
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  // Read the one-time pending sign-in exactly once, during the first render.
  const [initial] = useState(() => {
    const pending = readPendingGoogleSignIn();
    clearPendingGoogleSignIn();
    if (params.get("google") !== "ok") {
      const reason = REASONS[params.get("reason") ?? ""];
      return {
        pending: null,
        error: reason ? t(reason) : t("Google sign-in failed."),
      };
    }
    if (!pending || !config.apiUrl) {
      return {
        pending: null,
        error: t("This sign-in was started in another tab or has expired. Please try again."),
      };
    }
    return { pending, error: null };
  });
  const [error, setError] = useState<string | null>(initial.error);
  const started = useRef(false);

  useEffect(() => {
    const pending = initial.pending;
    if (started.current || !pending || !config.apiUrl) return;
    started.current = true;
    void (async () => {
      try {
        const api = createJellyfinApi(config.jellyfinUrl, undefined, pending.deviceId);
        const { data: result } = await getUserApi(api).authenticateWithQuickConnect({
          quickConnectDto: { Secret: pending.secret },
        });
        if (!result.AccessToken) throw new Error("No session returned");
        await finoraFetch(config.apiUrl!, "/auth/google/confirm", {
          method: "POST",
          token: result.AccessToken,
          body: { code: pending.code, deviceId: pending.deviceId },
        });
        markGoogleAdminSession(true);
        completeSignIn(result, pending.remember, pending.deviceId);
        void navigate("/admin", { replace: true });
      } catch {
        setError(t("The sign-in could not be completed. Please try again."));
      }
    })();
  }, [initial, config, completeSignIn, navigate]);

  if (error) {
    return (
      <MessageScreen
        title={t("Couldn't sign in with Google")}
        actions={
          <Link
            to="/login"
            className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-label-md text-on-primary hover:bg-primary-hover"
          >
            {t("Back to sign in")}
          </Link>
        }
      >
        <p>{error}</p>
      </MessageScreen>
    );
  }
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner label={t("Finishing Google sign-in")} />
    </div>
  );
}
