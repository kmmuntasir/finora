import type { AuthenticationResult, UserDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Eye, EyeOff, Languages, UserRound } from "lucide-react";
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
import { ForgotPasswordPanel } from "./ForgotPasswordPanel";
import { useLoginInfo, usePublicUsers } from "./useLoginInfo";
import { useFinoraConfig } from "@/api/finora";
import { currentLanguage, LANGUAGES, setLanguage, type Language } from "@/i18n";
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
  const publicUsers = usePublicUsers().data ?? [];
  const [chosen, setChosen] = useState<UserDto | null>(null);
  const [manual, setManual] = useState(false);
  const [forgot, setForgot] = useState(false);
  const showPicker = publicUsers.length > 0 && !chosen && !manual;

  const onQuickConnectSuccess = useCallback(
    (result: AuthenticationResult) => completeSignIn(result, remember),
    [completeSignIn, remember],
  );
  const quickConnect = useQuickConnect(onQuickConnectSuccess);

  async function signIn(name: string, secret: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { data } = await publicApi.authenticateUserByName(name, secret);
      completeSignIn(data, remember);
    } catch (signInError) {
      setError(describeSignInError(signInError));
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn(username.trim(), password);
  }

  function choose(user: UserDto) {
    setChosen(user);
    setUsername(user.Name ?? "");
    setPassword("");
    setError(null);
    // Accounts without a password sign in straight away, as in the official client.
    if (!user.HasPassword) void signIn(user.Name ?? "", "");
  }

  const expired = state.status === "signed-out" && state.reason === "expired";
  const serverName = serverInfo.data?.ServerName;

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-page-x-mobile py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />

        <div className="rounded-lg bg-surface p-6 sm:p-8">
          {forgot ? (
            <ForgotPasswordPanel
              initialUsername={username}
              onDone={(name) => {
                setForgot(false);
                if (name) {
                  setUsername(name);
                  setManual(true);
                  setChosen(null);
                }
              }}
            />
          ) : quickConnect.state.phase === "idle" ? (
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

              {showPicker ? (
                <UserPicker
                  users={publicUsers}
                  jellyfinUrl={config.jellyfinUrl}
                  onChoose={choose}
                  onOther={() => setManual(true)}
                  disabled={pending}
                />
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  {chosen ? (
                    <div className="flex items-center gap-3">
                      <Avatar user={chosen} jellyfinUrl={config.jellyfinUrl} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-title">{chosen.Name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setChosen(null);
                          setUsername("");
                          setError(null);
                        }}
                        className="text-label-md text-primary hover:underline"
                      >
                        Not you?
                      </button>
                    </div>
                  ) : (
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
                  )}
                  <TextField
                    label="Password"
                    autoFocus={Boolean(chosen)}
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
                  <div className="flex justify-between gap-3 text-label-md">
                    <button
                      type="button"
                      onClick={() => setForgot(true)}
                      className="text-on-surface-muted hover:text-on-surface"
                    >
                      Forgot password?
                    </button>
                    {publicUsers.length > 0 && !chosen && (
                      <button
                        type="button"
                        onClick={() => setManual(false)}
                        className="text-on-surface-muted hover:text-on-surface"
                      >
                        Choose a user
                      </button>
                    )}
                  </div>
                </form>
              )}

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

        <label className="mt-6 flex items-center justify-center gap-2 text-caption text-on-surface-subtle">
          <Languages aria-hidden className="size-4" />
          <span className="sr-only">Language</span>
          <select
            value={currentLanguage()}
            onChange={(event) => void setLanguage(event.target.value as Language)}
            className="rounded-md bg-transparent px-1 py-1 text-caption text-on-surface-muted hover:text-on-surface"
          >
            {LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        {disclaimer && (
          <p className="mt-6 whitespace-pre-line text-caption text-on-surface-subtle">
            {disclaimer}
          </p>
        )}
      </div>
    </main>
  );
}

function Avatar({
  user,
  jellyfinUrl,
  size,
}: {
  user: UserDto;
  jellyfinUrl: string;
  size: "sm" | "lg";
}) {
  const box = size === "lg" ? "size-20" : "size-10";
  return user.PrimaryImageTag ? (
    <img
      src={`${jellyfinUrl}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}&maxWidth=160`}
      alt=""
      className={`${box} shrink-0 rounded-full bg-surface-raised object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`${box} grid shrink-0 place-items-center rounded-full bg-primary/20 text-primary ${size === "lg" ? "text-headline-md" : "text-title"}`}
    >
      {(user.Name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** The server's visible users as avatars, like the official client's sign-in screen. */
function UserPicker({
  users,
  jellyfinUrl,
  onChoose,
  onOther,
  disabled,
}: {
  users: UserDto[];
  jellyfinUrl: string;
  onChoose: (user: UserDto) => void;
  onOther: () => void;
  disabled: boolean;
}) {
  return (
    <ul className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5" aria-label="Who's watching?">
      {users.map((user) => (
        <li key={user.Id}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChoose(user)}
            className="group flex w-full flex-col items-center gap-2 rounded-md p-1 text-center disabled:opacity-60"
          >
            <span className="rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-surface transition-shadow group-hover:ring-primary group-focus-visible:ring-primary">
              <Avatar user={user} jellyfinUrl={jellyfinUrl} size="lg" />
            </span>
            <span className="w-full truncate text-label-md">{user.Name}</span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onOther}
          className="group flex w-full flex-col items-center gap-2 rounded-md p-1 text-center"
        >
          <span className="grid size-20 place-items-center rounded-full bg-surface-raised text-on-surface-muted ring-2 ring-transparent ring-offset-2 ring-offset-surface group-hover:ring-primary group-focus-visible:ring-primary">
            <UserRound aria-hidden className="size-8" />
          </span>
          <span className="text-label-md text-on-surface-muted">Other user</span>
        </button>
      </li>
    </ul>
  );
}
