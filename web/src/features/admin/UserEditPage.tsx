import type { UserDto, UserPolicy } from "@jellyfin/sdk/lib/generated-client/models";
import { isAxiosError } from "axios";
import { ArrowLeft } from "lucide-react";
import { Switch } from "radix-ui";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/Spinner";
import { TextField } from "@/components/TextField";
import { useSession } from "@/features/auth/context";
import { relativeTime } from "@/lib/format";
import { useAdminMutations, useMediaFolders, useUser } from "./queries";
import { QuickConnectForUser, UserDevices } from "./UserDevices";
import { RESTRICTION_DEFAULTS, type RestrictionDraft } from "./restrictions";
import { Limits, ParentalControls } from "./UserRestrictions";
import { msg, t } from "@/i18n";

type PolicyDraft = Pick<
  UserPolicy,
  | "IsAdministrator"
  | "IsDisabled"
  | "IsHidden"
  | "EnableAllFolders"
  | "EnabledFolders"
  | "EnableMediaPlayback"
  | "EnableAudioPlaybackTranscoding"
  | "EnableVideoPlaybackTranscoding"
  | "EnablePlaybackRemuxing"
  | "EnableContentDownloading"
  | "EnableContentDeletion"
  | "EnableRemoteAccess"
  | "EnableSubtitleManagement"
  | "EnableCollectionManagement"
> &
  RestrictionDraft;

const NEW_USER_DEFAULTS: PolicyDraft = {
  IsAdministrator: false,
  IsDisabled: false,
  IsHidden: true,
  EnableAllFolders: false,
  EnabledFolders: [],
  EnableMediaPlayback: true,
  EnableAudioPlaybackTranscoding: true,
  EnableVideoPlaybackTranscoding: true,
  EnablePlaybackRemuxing: true,
  EnableContentDownloading: true,
  EnableContentDeletion: false,
  EnableRemoteAccess: true,
  EnableSubtitleManagement: false,
  EnableCollectionManagement: false,
  ...RESTRICTION_DEFAULTS,
};

const PERMISSIONS: { key: keyof PolicyDraft & `Enable${string}`; label: string; hint?: string }[] =
  [
    { key: "EnableMediaPlayback", label: msg("Can play media") },
    { key: "EnableRemoteAccess", label: msg("Can connect from outside the home network") },
    {
      key: "EnableVideoPlaybackTranscoding",
      label: msg("Allow video transcoding"),
      hint: msg("Uses the server's CPU when a device can't play a file"),
    },
    { key: "EnableAudioPlaybackTranscoding", label: msg("Allow audio transcoding") },
    {
      key: "EnablePlaybackRemuxing",
      label: msg("Allow remuxing"),
      hint: msg("Repackaging without re-encoding; cheap"),
    },
    { key: "EnableContentDownloading", label: msg("Can download files") },
    { key: "EnableSubtitleManagement", label: msg("Can manage subtitles") },
    { key: "EnableCollectionManagement", label: msg("Can create and edit collections") },
    {
      key: "EnableContentDeletion",
      label: msg("Can delete media"),
      hint: msg("Deletes files from the server's disks"),
    },
  ];

function draftFrom(policy: UserPolicy | null | undefined): PolicyDraft {
  const draft = { ...NEW_USER_DEFAULTS };
  if (!policy) return draft;
  for (const key of Object.keys(draft) as (keyof PolicyDraft)[]) {
    (draft as Record<string, unknown>)[key] = policy[key] ?? draft[key];
  }
  // Saved schedules carry server IDs; compare and send only what the form edits.
  draft.AccessSchedules = (draft.AccessSchedules ?? []).map(
    ({ DayOfWeek, StartHour, EndHour }) => ({
      DayOfWeek,
      StartHour,
      EndHour,
    }),
  );
  return draft;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-surface p-5 md:p-6">
      <h2 className="text-title">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <label htmlFor={id} className="text-label-md">
          {label}
        </label>
        {hint && <p className="text-body-sm text-on-surface-muted">{hint}</p>}
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="relative h-7 w-12 shrink-0 rounded-full bg-border-strong transition-colors duration-150 data-[state=checked]:bg-primary disabled:opacity-50"
      >
        <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-6" />
      </Switch.Root>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string" && data.length < 200) return data;
  }
  return fallback;
}

export function UserEditPage() {
  const { userId } = useParams();
  const isNew = userId === "new";
  const { data: user, isPending, isError } = useUser(isNew ? undefined : userId);
  if (!isNew && isPending) return <Spinner />;
  if (!isNew && (isError || !user))
    return (
      <p role="alert" className="text-body-md text-error">
        {t("This user could not be loaded.")}
      </p>
    );
  return <UserForm key={user?.Id ?? "new"} user={isNew ? null : user!} />;
}

function UserForm({ user }: { user: UserDto | null }) {
  const navigate = useNavigate();
  const { user: me } = useSession();
  const { data: folders } = useMediaFolders();
  const { createUser, updatePolicy, rename, setPassword, deleteUser } = useAdminMutations();
  const isSelf = user?.Id === me.Id;

  const [name, setName] = useState(user?.Name ?? "");
  const [password, setPasswordValue] = useState("");
  const [policy, setPolicy] = useState<PolicyDraft>(() => draftFrom(user?.Policy));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const original = useMemo(() => draftFrom(user?.Policy), [user?.Policy]);
  const policyChanged = JSON.stringify(original) !== JSON.stringify(policy);
  const nameChanged = Boolean(user) && name.trim() !== user?.Name;
  const dirty = !user || policyChanged || nameChanged;
  const saving = createUser.isPending || updatePolicy.isPending || rename.isPending;

  const set = <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) =>
    setPolicy((draft) => ({ ...draft, [key]: value }));
  const toggleFolder = (id: string, on: boolean) =>
    set(
      "EnabledFolders",
      on
        ? [...(policy.EnabledFolders ?? []), id]
        : (policy.EnabledFolders ?? []).filter((folder) => folder !== id),
    );

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (!user) {
        const created = await createUser.mutateAsync({ name: trimmed, password, policy });
        toast.success(t("{name} was created.", { name: trimmed }));
        void navigate(`/admin/users/${created.Id}`, { replace: true });
        return;
      }
      if (nameChanged) await rename.mutateAsync({ user, name: trimmed });
      if (policyChanged) await updatePolicy.mutateAsync({ user, changes: policy });
      toast.success(t("Changes saved."));
    } catch (error) {
      toast.error(errorMessage(error, t("Couldn't save the changes.")));
    }
  };

  return (
    <form onSubmit={(event) => void onSave(event)} className="max-w-3xl space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/users"
          aria-label={t("Back to users")}
          className="grid size-10 place-items-center rounded-full hover:bg-surface-raised"
        >
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <div className="min-w-0">
          <h2 className="truncate text-headline-md">{user ? user.Name : t("New user")}</h2>
          {user && (
            <p className="text-body-sm text-on-surface-muted">
              {t("Last active {when}", {
                when: relativeTime(user.LastActivityDate).toLowerCase(),
              })}
            </p>
          )}
        </div>
      </div>

      <Section title={t("Account")}>
        <div className="grid gap-4 sm:max-w-sm">
          <TextField
            label={t("Name")}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
          {!user && (
            <TextField
              label={t("Password")}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPasswordValue(event.target.value)}
            />
          )}
        </div>
        <div className="mt-2 divide-y divide-border">
          <ToggleRow
            label={t("Account enabled")}
            checked={!policy.IsDisabled}
            onChange={(value) => set("IsDisabled", !value)}
            disabled={isSelf}
          />
          <ToggleRow
            label={t("Administrator")}
            hint={t("Full control over the server")}
            checked={Boolean(policy.IsAdministrator)}
            onChange={(value) => set("IsAdministrator", value)}
            disabled={isSelf}
          />
          <ToggleRow
            label={t("Hide from the login screen")}
            hint={t("The user types their name to sign in")}
            checked={Boolean(policy.IsHidden)}
            onChange={(value) => set("IsHidden", value)}
          />
        </div>
        {isSelf && (
          <p className="mt-2 text-body-sm text-on-surface-muted">
            {t("You can't disable yourself or remove your own admin rights.")}
          </p>
        )}
      </Section>

      <Section title={t("Library access")}>
        <ToggleRow
          label={t("All libraries")}
          checked={Boolean(policy.EnableAllFolders)}
          onChange={(value) => set("EnableAllFolders", value)}
        />
        {!policy.EnableAllFolders && (
          <fieldset className="mt-2 grid gap-1 sm:grid-cols-2">
            <legend className="sr-only">{t("Libraries")}</legend>
            {folders?.map((folder) => {
              const checked = policy.EnabledFolders?.includes(folder.Id!) ?? false;
              return (
                <label
                  key={folder.Id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-raised"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleFolder(folder.Id!, event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-body-md">{folder.Name}</span>
                </label>
              );
            })}
          </fieldset>
        )}
      </Section>

      <Section title={t("Permissions")}>
        <div className="divide-y divide-border">
          {PERMISSIONS.map((permission) => (
            <ToggleRow
              key={permission.key}
              label={t(permission.label)}
              hint={permission.hint && t(permission.hint)}
              checked={Boolean(policy[permission.key])}
              onChange={(value) => set(permission.key, value as never)}
            />
          ))}
        </div>
      </Section>

      <Section title={t("Parental controls")}>
        <ParentalControls draft={policy} set={set} />
      </Section>

      <Section title={t("Limits")}>
        <Limits draft={policy} set={set} />
      </Section>

      {user && (
        <Section title={t("Devices")}>
          <UserDevices userId={user.Id!} name={user.Name ?? ""} />
        </Section>
      )}

      {user && (
        <Section title={t("Sign in a TV or another device")}>
          <p className="mb-4 text-body-sm text-on-surface-muted">
            {t("Choose Quick Connect on the device, then enter the code it shows.")}
          </p>
          <QuickConnectForUser userId={user.Id!} name={user.Name ?? ""} />
        </Section>
      )}

      {user && (
        <PasswordReset
          userId={user.Id!}
          name={user.Name ?? ""}
          isSelf={isSelf}
          onSet={setPassword.mutateAsync}
          busy={setPassword.isPending}
        />
      )}

      {user && !isSelf && (
        <Section title={t("Delete user")}>
          <p className="text-body-sm text-on-surface-muted">
            {t(
              "Removes the account, its settings and its watch history. Media files are not affected.",
            )}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4 text-error"
            onClick={() => setConfirmDelete(true)}
          >
            {t("Delete {name}", { name: user.Name ?? "" })}
          </Button>
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title={t("Delete {name}?", { name: user.Name ?? "" })}
            confirmLabel={t("Delete user")}
            destructive
            busy={deleteUser.isPending}
            onConfirm={() =>
              deleteUser.mutate(user.Id!, {
                onSuccess: () => {
                  toast.success(t("{name} was deleted.", { name: user.Name ?? "" }));
                  void navigate("/admin/users", { replace: true });
                },
                onError: (error) =>
                  toast.error(errorMessage(error, t("Couldn't delete the user."))),
              })
            }
          >
            {t("This can't be undone. {name} will lose their watch history and settings.", {
              name: user.Name ?? "",
            })}
          </ConfirmDialog>
        </Section>
      )}

      {dirty && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-end gap-3 rounded-lg bg-surface-overlay p-3 shadow-[0_8px_24px_rgb(0_0_0/0.4)] ring-1 ring-border md:bottom-4">
          {user && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPolicy(original);
                setName(user.Name ?? "");
              }}
            >
              {t("Discard")}
            </Button>
          )}
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? t("Saving…") : user ? t("Save changes") : t("Create user")}
          </Button>
        </div>
      )}
    </form>
  );
}

function PasswordReset({
  userId,
  name,
  isSelf,
  onSet,
  busy,
}: {
  userId: string;
  name: string;
  isSelf: boolean;
  onSet: (args: { userId: string; password: string }) => Promise<void>;
  busy: boolean;
}) {
  const [value, setValue] = useState("");
  if (isSelf) {
    return (
      <Section title={t("Password")}>
        <p className="text-body-sm text-on-surface-muted">
          {t("Change your own password in")}{" "}
          <Link to="/settings" className="text-primary hover:underline">
            {t("Settings")}
          </Link>
          .
        </p>
      </Section>
    );
  }
  return (
    <Section title={t("Set a new password")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          label={t("New password for {name}", { name })}
          type="password"
          autoComplete="new-password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="sm:w-72"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !value}
          onClick={() =>
            void onSet({ userId, password: value })
              .then(() => {
                setValue("");
                toast.success(t("Password for {name} updated.", { name }));
              })
              .catch((error: unknown) =>
                toast.error(errorMessage(error, t("Couldn't set the password."))),
              )
          }
        >
          {t("Set password")}
        </Button>
      </div>
    </Section>
  );
}
