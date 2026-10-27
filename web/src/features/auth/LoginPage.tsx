import type { AuthenticationResult } from "@jellyfin/sdk/lib/generated-client/models";
import { Eye, EyeOff } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { TextField } from "@/components/TextField";
import { useRuntimeConfig } from "@/config/context";
import { usePublicServerInfo } from "@/features/server/useServerInfo";
import { useAuth } from "./context";
import { describeSignInError } from "./errors";
import { QuickConnectPanel } from "./QuickConnectPanel";
import { startGoogleSignIn } from "./google-signin";
import { useLoginInfo } from "./useLoginInfo";
import { useFinoraConfig } from "@/api/finora";
import { useQuickConnect } from "./useQuickConnect";

export function LoginPage() {
  const { publicApi, config } = useRuntimeConfig();
  const finora = useFinoraConfig();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const { state, completeSignIn } = useAuth();
  const serverInfo = usePublicServerInfo();
  const { quickConnectEnabled, disclaimer } = useLoginInfo();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onQuickConnectSuccess = useCallback(
    (result: AuthenticationResult) => completeSignIn(result, remember),
    [completeSignIn, remember],
  );
  const quickConnect = useQuickConnect(onQuickConnectSuccess);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { data } = await publicApi.authenticateUserByName(username.trim(), password);
      completeSignIn(data, remember);
    } catch (signInError) {
      setError(describeSignInError(signInError));
      setPending(false);
    }
  }

  const expired = state.status === "signed-out" && state.reason === "expired";
  const serverName = serverInfo.data?.ServerName;

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-page-x-mobile py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />

        <div className="rounded-lg bg-surface p-6 sm:p-8">
          {quickConnect.state.phase === "idle" ? (
            <>
              <h1 className="text-headline-md">Sign in</h1>
              <p className="mt-1 text-body-sm text-on-surface-muted">
                {serverName ? `to ${serverName}` : "with your Jellyfin account"}
              </p>

              {expired && (
                <p
                  role="status"
                  className="mt-4 rounded-md bg-surface-overlay px-3 py-2 text-body-sm"
                >
                  Your session ended. Please sign in again.
                </p>
              )}

              <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                <TextField
                  label="Username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <TextField
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((shown) => !shown)}
                      className="grid size-10 place-items-center rounded-full text-on-surface-muted hover:text-on-surface"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  }
                />

                <label className="flex cursor-pointer items-center gap-3 text-body-sm text-on-surface-muted select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Keep me signed in on this device
                </label>

                {error && (
                  <p role="alert" className="text-body-sm text-error">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={pending || !username.trim()}>
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              {finora.data?.googleSignIn && (
                <>
                  <Button
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => {
                      setGoogleError(null);
                      startGoogleSignIn(config.jellyfinUrl, config.apiUrl!, remember).catch(() =>
                        setGoogleError("Couldn't start Google sign-in. Is Quick Connect enabled?"),
                      );
                    }}
                  >
                    Administrator? Sign in with Google
                  </Button>
                  {googleError && (
                    <p role="alert" className="mt-2 text-body-sm text-error">
                      {googleError}
                    </p>
                  )}
                </>
              )}
              {quickConnectEnabled && (
                <>
                  <div className="my-6 flex items-center gap-3 text-caption text-on-surface-subtle">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => void quickConnect.start()}
                  >
                    Use Quick Connect
                  </Button>
                </>
              )}
            </>
          ) : (
            <QuickConnectPanel
              state={quickConnect.state}
              onRetry={() => void quickConnect.start()}
              onCancel={quickConnect.cancel}
            />
          )}
        </div>

        {disclaimer && (
          <p className="mt-6 whitespace-pre-line text-caption text-on-surface-subtle">
            {disclaimer}
          </p>
        )}
      </div>
    </main>
  );
}
