import type {
  SubtitlePlaybackMode,
  UserConfiguration,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getQuickConnectApi } from "@jellyfin/sdk/lib/utils/api/quick-connect-api";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Camera, Trash2 } from "lucide-react";
import { Switch } from "radix-ui";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";
import {
  BITRATE_OPTIONS,
  readPlayerPreferences,
  savePlayerPreferences,
} from "@/features/player/player-preferences";
import {
  usePreferences,
  useSetPreference,
  type HomeLayout,
} from "@/features/preferences/preferences";
import { applyTheme, readTheme, saveTheme, type ThemeChoice } from "@/features/preferences/theme";
import { cn } from "@/lib/cn";
import {
  useChangePassword,
  useCultures,
  useProfilePicture,
  useUpdateUserConfiguration,
} from "./queries";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-surface p-5 md:p-6">
      <h2 className="text-title">{title}</h2>
      {description && <p className="mt-1 text-body-sm text-on-surface-muted">{description}</p>}
      <div className="mt-5 divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-label-md">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-body-sm text-on-surface-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const SELECT =
  "h-10 w-full rounded-md border border-border-strong bg-background px-3 text-body-sm text-on-surface hover:border-on-surface-subtle sm:w-64";

function Toggle({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className="relative h-7 w-12 rounded-full bg-border-strong transition-colors duration-150 data-[state=checked]:bg-primary disabled:opacity-50"
    >
      <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-6" />
    </Switch.Root>
  );
}

const SUBTITLE_MODES: { value: SubtitlePlaybackMode; label: string; hint: string }[] = [
  { value: "Default", label: "Default", hint: "Show subtitles marked default or forced" },
  { value: "Smart", label: "Smart", hint: "Show subtitles when the audio is in another language" },
  { value: "OnlyForced", label: "Only forced", hint: "Only subtitles for foreign-language parts" },
  { value: "Always", label: "Always", hint: "Always show subtitles when available" },
  { value: "None", label: "Off", hint: "Never show subtitles automatically" },
];

const HOME_LAYOUTS: { value: HomeLayout; label: string }[] = [
  { value: "spotlight", label: "Spotlight" },
  { value: "dashboard", label: "Dashboard" },
  { value: "focus", label: "Focus" },
];

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-page-x-mobile pt-8 pb-24 md:px-page-x md:pt-10">
      <h1 className="text-headline-lg">Settings</h1>
      <ProfileSection />
      <AppearanceSection />
      <PlaybackSection />
      <SubtitleSection />
      <QuickConnectSection />
      <PasswordSection />
    </div>
  );
}

function ProfileSection() {
  const { user } = useSession();
  const { config } = useRuntimeConfig();
  const { upload, remove } = useProfilePicture();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const avatar = user.PrimaryImageTag
    ? `${config.jellyfinUrl}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}&maxWidth=192`
    : null;

  return (
    <Section title="Profile">
      <div className="flex items-center gap-5 py-1">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-overlay text-headline-md uppercase">
          {avatar ? (
            <img src={avatar} alt="" className="size-full object-cover" />
          ) : (
            (user.Name ?? "?").slice(0, 1)
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-title">{user.Name}</p>
          {user.Policy?.IsAdministrator && (
            <p className="text-body-sm text-on-surface-muted">Administrator</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (file.size > 5 * 1024 * 1024)
                  return setError("Choose an image smaller than 5 MB.");
                setError(null);
                upload.mutate(file, {
                  onError: () => setError("The picture could not be uploaded."),
                });
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              disabled={upload.isPending}
            >
              <Camera aria-hidden className="size-4" />
              {upload.isPending ? "Uploading…" : avatar ? "Change picture" : "Add picture"}
            </Button>
            {avatar && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 aria-hidden className="size-4" />
                Remove
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-body-sm text-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const { preferences } = usePreferences();
  const setPreference = useSetPreference();
  const themeId = useId();
  const layoutId = useId();
  return (
    <Section
      title="Appearance"
      description="Theme is saved on this device; the home layout follows you everywhere."
    >
      <Row label="Theme" htmlFor={themeId}>
        <select
          id={themeId}
          className={SELECT}
          value={theme}
          onChange={(event) => {
            const choice = event.target.value as ThemeChoice;
            setTheme(choice);
            saveTheme(choice);
            applyTheme(choice);
          }}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">Match system</option>
        </select>
      </Row>
      <Row label="Home layout" htmlFor={layoutId}>
        <select
          id={layoutId}
          className={SELECT}
          value={preferences.homeLayout}
          onChange={(event) =>
            setPreference.mutate({ homeLayout: event.target.value as HomeLayout })
          }
        >
          {HOME_LAYOUTS.map((layout) => (
            <option key={layout.value} value={layout.value}>
              {layout.label}
            </option>
          ))}
        </select>
      </Row>
    </Section>
  );
}

function LanguageSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: cultures } = useCultures();
  // Several cultures share a three-letter code (e.g. Chinese variants); keep the first.
  const languages = [
    ...new Map(
      (cultures ?? [])
        .filter((culture) => culture.ThreeLetterISOLanguageName)
        .map(
          (culture) =>
            [
              culture.ThreeLetterISOLanguageName!,
              culture.DisplayName ?? culture.Name ?? "",
            ] as const,
        )
        .reverse(),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <select
      id={id}
      className={SELECT}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Any language</option>
      {languages.map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
}

function useConfigField() {
  const { user } = useSession();
  const update = useUpdateUserConfiguration();
  const config: UserConfiguration = user.Configuration ?? {};
  return {
    config,
    save: (changes: Partial<UserConfiguration>) => update.mutate(changes),
    saving: update.isPending,
    failed: update.isError,
  };
}

function SaveStatus({ saving, failed }: { saving: boolean; failed: boolean }) {
  return (
    <p
      aria-live="polite"
      className={cn("h-5 text-caption", failed ? "text-error" : "text-on-surface-subtle")}
    >
      {failed ? "Couldn't save. Try again." : saving ? "Saving…" : ""}
    </p>
  );
}

function PlaybackSection() {
  const { config, save, saving, failed } = useConfigField();
  const [bitrate, setBitrate] = useState(() => readPlayerPreferences().maxBitrate);
  const ids = {
    audio: useId(),
    quality: useId(),
    defaultTrack: useId(),
    autoplay: useId(),
    rememberAudio: useId(),
    rememberSubs: useId(),
  };

  return (
    <Section title="Playback" description="Saved to your Jellyfin account unless noted.">
      <Row label="Preferred audio language" htmlFor={ids.audio}>
        <LanguageSelect
          id={ids.audio}
          value={config.AudioLanguagePreference ?? ""}
          onChange={(value) => save({ AudioLanguagePreference: value || null })}
        />
      </Row>
      <Row
        label="Play the default audio track"
        hint="Otherwise prefer your audio language"
        htmlFor={ids.defaultTrack}
      >
        <Toggle
          id={ids.defaultTrack}
          checked={config.PlayDefaultAudioTrack ?? true}
          onChange={(value) => save({ PlayDefaultAudioTrack: value })}
        />
      </Row>
      <Row
        label="Streaming quality"
        hint="On this device. Lower it on slow connections."
        htmlFor={ids.quality}
      >
        <select
          id={ids.quality}
          className={SELECT}
          value={bitrate}
          onChange={(event) => {
            const value = Number(event.target.value);
            setBitrate(value);
            savePlayerPreferences({ maxBitrate: value });
          }}
        >
          {BITRATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label === "Original" ? "Original (no limit)" : option.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Autoplay next episode" htmlFor={ids.autoplay}>
        <Toggle
          id={ids.autoplay}
          checked={config.EnableNextEpisodeAutoPlay ?? true}
          onChange={(value) => {
            savePlayerPreferences({ autoplayNext: value });
            save({ EnableNextEpisodeAutoPlay: value });
          }}
        />
      </Row>
      <Row label="Remember audio choices" hint="Per series" htmlFor={ids.rememberAudio}>
        <Toggle
          id={ids.rememberAudio}
          checked={config.RememberAudioSelections ?? true}
          onChange={(value) => save({ RememberAudioSelections: value })}
        />
      </Row>
      <Row label="Remember subtitle choices" hint="Per series" htmlFor={ids.rememberSubs}>
        <Toggle
          id={ids.rememberSubs}
          checked={config.RememberSubtitleSelections ?? true}
          onChange={(value) => save({ RememberSubtitleSelections: value })}
        />
      </Row>
      <SaveStatus saving={saving} failed={failed} />
    </Section>
  );
}

function SubtitleSection() {
  const { config, save, saving, failed } = useConfigField();
  const ids = { language: useId(), mode: useId() };
  const mode =
    SUBTITLE_MODES.find((option) => option.value === config.SubtitleMode) ?? SUBTITLE_MODES[0]!;
  return (
    <Section title="Subtitles" description="Saved to your Jellyfin account.">
      <Row label="Preferred subtitle language" htmlFor={ids.language}>
        <LanguageSelect
          id={ids.language}
          value={config.SubtitleLanguagePreference ?? ""}
          onChange={(value) => save({ SubtitleLanguagePreference: value || null })}
        />
      </Row>
      <Row label="When to show subtitles" hint={mode.hint} htmlFor={ids.mode}>
        <select
          id={ids.mode}
          className={SELECT}
          value={mode.value}
          onChange={(event) => save({ SubtitleMode: event.target.value as SubtitlePlaybackMode })}
        >
          {SUBTITLE_MODES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Row>
      <SaveStatus saving={saving} failed={failed} />
    </Section>
  );
}

function QuickConnectSection() {
  const { api, user } = useSession();
  const [code, setCode] = useState("");
  const authorize = useMutation({
    mutationFn: async (value: string) => {
      await getQuickConnectApi(api).authorizeQuickConnect({ code: value, userId: user.Id! });
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = code.replace(/\s/g, "");
    if (value) authorize.mutate(value, { onSuccess: () => setCode("") });
  };

  return (
    <Section
      title="Quick Connect"
      description="Sign in a TV or another device: enter the code it shows."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="sm:w-64"
        />
        <Button type="submit" disabled={!code.trim() || authorize.isPending}>
          {authorize.isPending ? "Authorising…" : "Authorise"}
        </Button>
      </form>
      <p
        role="status"
        className={cn("mt-3 h-5 text-body-sm", authorize.isError ? "text-error" : "text-success")}
      >
        {authorize.isError
          ? isAxiosError(authorize.error) && authorize.error.response?.status === 404
            ? "That code wasn't found. Check it and try again."
            : "Couldn't authorise the code."
          : authorize.isSuccess
            ? "Device signed in."
            : ""}
      </p>
    </Section>
  );
}

function PasswordSection() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mismatch || !next) return;
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
        },
      },
    );
  };

  return (
    <Section title="Password">
      <form onSubmit={onSubmit} className="grid gap-4 sm:max-w-sm">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {mismatch && <p className="text-body-sm text-error">The new passwords don't match.</p>}
        <p
          role="status"
          className={cn("h-5 text-body-sm", change.isError ? "text-error" : "text-success")}
        >
          {change.isError
            ? isAxiosError(change.error) && change.error.response?.status === 403
              ? "The current password is wrong."
              : "Couldn't change the password."
            : change.isSuccess
              ? "Password changed."
              : ""}
        </p>
        <Button
          type="submit"
          disabled={!next || mismatch || change.isPending}
          className="justify-self-start"
        >
          {change.isPending ? "Saving…" : "Change password"}
        </Button>
      </form>
    </Section>
  );
}
