import { isAxiosError } from "axios";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/Spinner";
import { useSession } from "@/features/auth/context";
import { relativeTime } from "@/lib/format";
import { useDeviceMutations, useUserDevices } from "./queries";

/** The user's signed-in devices: sign out one or all of them. */
export function UserDevices({ userId, name }: { userId: string; name: string }) {
  const { api } = useSession();
  const devices = useUserDevices(userId);
  const { signOut } = useDeviceMutations(userId);
  const [confirmAll, setConfirmAll] = useState(false);
  // Never sign out the device this admin is using right now.
  const currentDevice = api.deviceInfo.id;
  const others = (devices.data ?? []).filter((device) => device.Id !== currentDevice);

  if (devices.isPending) return <Spinner />;
  if (devices.isError)
    return (
      <p role="alert" className="text-body-sm text-error">
        Couldn't load devices.
      </p>
    );

  return (
    <div>
      {devices.data.length === 0 ? (
        <p className="text-body-sm text-on-surface-muted">{name} isn't signed in anywhere.</p>
      ) : (
        <ul className="divide-y divide-border">
          {devices.data.map((device) => (
            <li key={device.Id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-label-md">
                  {device.CustomName || device.Name}
                  {device.Id === currentDevice && (
                    <span className="ml-2 text-caption text-on-surface-muted">This device</span>
                  )}
                </p>
                <p className="truncate text-body-sm text-on-surface-muted">
                  {device.AppName} {device.AppVersion} · {relativeTime(device.DateLastActivity)}
                </p>
              </div>
              {device.Id !== currentDevice && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={signOut.isPending}
                  onClick={() =>
                    signOut.mutate([device.Id!], {
                      onSuccess: () => toast.success(`Signed out ${device.Name}.`),
                      onError: () => toast.error("Couldn't sign out that device."),
                    })
                  }
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {others.length > 1 && (
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => setConfirmAll(true)}
        >
          <LogOut aria-hidden className="size-4" />
          Sign out of all devices
        </Button>
      )}
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={`Sign ${name} out everywhere?`}
        confirmLabel="Sign out"
        destructive
        busy={signOut.isPending}
        onConfirm={() =>
          signOut.mutate(
            others.map((device) => device.Id!),
            {
              onSuccess: () => {
                setConfirmAll(false);
                toast.success(`Signed ${name} out of ${others.length} devices.`);
              },
              onError: () => toast.error("Some devices couldn't be signed out."),
            },
          )
        }
      >
        Every app and browser {name} uses will need to sign in again.
      </ConfirmDialog>
    </div>
  );
}

/** Approve a Quick Connect code shown on a TV or another device, signing it in as this user. */
export function QuickConnectForUser({ userId, name }: { userId: string; name: string }) {
  const { authorizeQuickConnect } = useDeviceMutations(userId);
  const [code, setCode] = useState("");
  const submit = () => {
    if (code.length < 6) return;
    authorizeQuickConnect.mutate(code.trim(), {
      onSuccess: () => {
        setCode("");
        toast.success(`The device is now signed in as ${name}.`);
      },
      onError: (error) =>
        toast.error(
          isAxiosError(error) && error.response?.status === 404
            ? "That code wasn't found or has expired."
            : "Couldn't approve the code. Is Quick Connect enabled?",
        ),
    });
  };
  // A div, not a form: this sits inside the user form.
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div>
        <label htmlFor="qc-code" className="mb-1.5 block text-label-md">
          Quick Connect code
        </label>
        <input
          id="qc-code"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="123456"
          className="h-11 w-40 rounded-md border border-border-strong bg-background px-3 text-body-md tracking-widest tabular-nums"
        />
      </div>
      <Button
        type="button"
        onClick={submit}
        variant="secondary"
        disabled={code.length < 6 || authorizeQuickConnect.isPending}
      >
        Sign in as {name}
      </Button>
    </div>
  );
}
