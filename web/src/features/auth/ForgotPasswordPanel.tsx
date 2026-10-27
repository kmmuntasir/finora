import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import { useState } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useRuntimeConfig } from "@/config/context";

type Step = "name" | "pin" | "done";

/**
 * Jellyfin's PIN reset. The server writes a PIN to a file on its disk (only
 * for requests from the home network), and redeeming the PIN makes it the
 * new password (Jellyfin 10.11 DefaultPasswordResetProvider).
 */
export function ForgotPasswordPanel({
  initialUsername,
  onDone,
}: {
  initialUsername: string;
  onDone: (username: string) => void;
}) {
  const { publicApi } = useRuntimeConfig();
  const [step, setStep] = useState<Step>("name");
  const [username, setUsername] = useState(initialUsername);
  const [pin, setPin] = useState("");
  const [pinFile, setPinFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await getUserApi(publicApi).forgotPassword({
        forgotPasswordDto: { EnteredUsername: username.trim() },
      });
      if (data.Action === "ContactAdmin") {
        setError("Password reset is turned off. Ask the server's administrator.");
      } else if (data.Action === "InNetworkRequired") {
        setError("Password reset only works from the server's home network.");
      } else {
        setPinFile(data.PinFile ?? null);
        setStep("pin");
      }
    } catch {
      setError("The server didn't respond. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await getUserApi(publicApi).forgotPasswordPin({
        forgotPasswordPinDto: { Pin: pin.trim() },
      });
      if (data.Success) setStep("done");
      else setError("That PIN didn't match. Check it and try again.");
    } catch {
      setError("That PIN didn't match, or it has expired.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-headline-md">Reset password</h1>
      {step === "name" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
        >
          <p className="text-body-sm text-on-surface-muted">
            Jellyfin writes a one-time PIN to a file on the server. This only works when you're on
            the server's home network, and someone with access to the server must read the PIN for
            you.
          </p>
          <TextField
            label="Username"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-body-sm text-error">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || !username.trim()}>
            Request a PIN
          </Button>
        </form>
      )}
      {step === "pin" && (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void redeem();
          }}
        >
          <p className="text-body-sm text-on-surface-muted">
            If <strong className="text-on-surface">{username}</strong> exists and you're on the home
            network, the PIN is in this file on the server for the next 30 minutes:
          </p>
          {pinFile && (
            <code className="block rounded-md bg-surface-overlay px-3 py-2 text-caption break-all">
              {pinFile}
            </code>
          )}
          <TextField
            label="PIN"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            required
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="1A-2B-3C-4D"
          />
          {error && (
            <p role="alert" className="text-body-sm text-error">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || !pin.trim()}>
            Reset password
          </Button>
        </form>
      )}
      {step === "done" && (
        <div className="mt-6 space-y-4" role="status">
          <p className="text-body-md">
            Done. Your password is now the PIN, exactly as you typed it. Sign in with it, then
            choose a new password in Settings.
          </p>
          <Button className="w-full" onClick={() => onDone(username.trim())}>
            Back to sign in
          </Button>
        </div>
      )}
      {step !== "done" && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => onDone(username.trim())}>
          Back to sign in
        </Button>
      )}
    </div>
  );
}
