import type {
  SubtitlePlaybackMode,
  UserConfiguration,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getQuickConnectApi } from "@jellyfin/sdk/lib/utils/api/quick-connect-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Camera, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
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
  type FinoraPreferences,
  type HomeLayout,
} from "@/features/preferences/preferences";
import { applyTheme, readTheme, saveTheme, type ThemeChoice } from "@/features/preferences/theme";
import { useUserViews } from "@/features/home/queries";
import {
  HOME_SECTIONS,
  parseHomeSections,
  serializeHomeSections,
  type HomeSection,
} from "@/features/home/sections";
import { cn } from "@/lib/cn";
import { readTvMode, saveTvMode } from "@/features/tv/tv-mode";
import { LANGUAGES, msg, setLanguage, t, type Language } from "@/i18n";
import { languageOptions, SUBTITLE_MODES } from "./subtitle-options";
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
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  /** Accessible name when no visible <label> points at the switch. */
  label?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch.Root
      id={id}
      aria-label={label}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className="relative h-7 w-12 rounded-full bg-border-strong transition-colors duration-150 data-[state=checked]:bg-primary disabled:opacity-50"
    >
      <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform duration-150 data-[state=checked]:translate-x-6" />
    </Switch.Root>
  );
}

const HOME_LAYOUTS: { value: HomeLayout; label: string }[] = [
  { value: "spotlight", label: msg("Spotlight") },
  { value: "dashboard", label: msg("Dashboard") },
  { value: "focus", label: msg("Focus") },
];

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-page-x-mobile pt-8 pb-24 md:px-page-x md:pt-10">
      <h1 className="text-headline-lg">{t("Settings")}</h1>
      <ProfileSection />
      <AppearanceSection />
      <HomeSection />
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
    <Section title={t("Profile")}>
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
            <p className="text-body-sm text-on-surface-muted">{t("Administrator")}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-label={t("Choose a profile picture")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                if (file.size > 5 * 1024 * 1024)
                  return setError(t("Choose an image smaller than 5 MB."));
                setError(null);
                upload.mutate(file, {
                  onError: () => setError(t("The picture could not be uploaded.")),
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
              {upload.isPending ? t("Uploading…") : avatar ? t("Change picture") : t("Add picture")}
            </Button>
            {avatar && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                <Trash2 aria-hidden className="size-4" />
                {t("Remove")}
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
  const localeId = useId();
  const languageId = useId();
  const tvId = useId();
  const [tvMode, setTvMode] = useState(readTvMode);
  return (
    <Section
      title={t("Appearance")}
      description={t("Theme is saved on this device; the home layout follows you everywhere.")}
    >
      <Row label={t("Theme")} htmlFor={themeId}>
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
          <option value="dark">{t("Dark")}</option>
          <option value="light">{t("Light")}</option>
          <option value="system">{t("Match system")}</option>
        </select>
      </Row>
      <Row label={t("Home layout")} htmlFor={layoutId}>
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
              {t(layout.label)}
            </option>
          ))}
        </select>
      </Row>
      <Row
        label={t("Language")}
        hint={t("বাংলা is a draft that is still being reviewed.")}
        htmlFor={languageId}
      >
        <select
          id={languageId}
          className={SELECT}
          value={preferences.language}
          onChange={(event) => {
            const language = event.target.value as Language;
            setPreference.mutate({ language });
            void setLanguage(language);
          }}
        >
          {LANGUAGES.map((language) => (
            <option key={language.value} value={language.value}>
              {language.label}
            </option>
          ))}
        </select>
      </Row>
      <Row
        label={t("Date and number format")}
        hint={t("“Same as this browser” follows the language above.")}
        htmlFor={localeId}
      >
        <PreferenceSelect id={localeId} name="dateLocale" options={DATE_LOCALES} />
      </Row>
      <Row
        label={t("Remote-control navigation")}
        hint={t("For TVs: arrow keys move between items, Back goes back. This device only.")}
        htmlFor={tvId}
      >
        <Toggle
          id={tvId}
          checked={tvMode}
          onChange={(on) => {
            setTvMode(on);
            saveTvMode(on);
          }}
        />
      </Row>
    </Section>
  );
}

function MoveButtons({
  label,
  index,
  count,
  onMove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <span className="flex">
      <button
        type="button"
        aria-label={t("Move {label} up", { label })}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className="grid size-9 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-on-surface disabled:opacity-30"
      >
        <ChevronUp aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t("Move {label} down", { label })}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        className="grid size-9 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-on-surface disabled:opacity-30"
      >
        <ChevronDown aria-hidden className="size-4" />
      </button>
    </span>
  );
}

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry!);
  return next;
}

/** Home rows (Finora preference) and library order and visibility (Jellyfin user settings). */
function HomeSection() {
  const { preferences } = usePreferences();
  const setPreference = useSetPreference();
  const { config, save, saving, failed } = useConfigField();
  const { data: views } = useUserViews();
  const queryClient = useQueryClient();
  const sections = parseHomeSections(preferences.homeRows);
  const saveSections = (next: HomeSection[]) =>
    setPreference.mutate({ homeRows: serializeHomeSections(next) });
  const latestExcludes = new Set(config.LatestItemsExcludes ?? []);
  const homeExcludes = new Set(config.MyMediaExcludes ?? []);
  const saveViews = (changes: Partial<UserConfiguration>) =>
    save(changes, () => void queryClient.invalidateQueries({ queryKey: ["views"] }));
  const toggle = (list: Set<string>, id: string, on: boolean) =>
    on ? [...list].filter((entry) => entry !== id) : [...list, id];

  return (
    <Section
      title={t("Home")}
      description={t(
        "Rows follow you everywhere; library settings are shared with other Jellyfin apps.",
      )}
    >
      <div className="py-4 first:pt-0">
        <h3 className="text-label-md">{t("Rows")}</h3>
        <ul className="mt-2">
          {sections.map((section, index) => {
            const label = t(HOME_SECTIONS.find((entry) => entry.id === section.id)!.label);
            return (
              <li key={section.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className={cn("text-body-md", !section.visible && "text-on-surface-subtle")}>
                  {label}
                </span>
                <span className="flex items-center gap-2">
                  <MoveButtons
                    label={label}
                    index={index}
                    count={sections.length}
                    onMove={(from, to) => saveSections(moved(sections, from, to))}
                  />
                  <Toggle
                    id={`home-section-${section.id}`}
                    label={t("Show {label}", { label })}
                    checked={section.visible}
                    onChange={(visible) =>
                      saveSections(
                        sections.map((entry) =>
                          entry.id === section.id ? { ...entry, visible } : entry,
                        ),
                      )
                    }
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {views && views.length > 0 && (
        <div className="py-4 last:pb-0">
          <h3 className="text-label-md">{t("Libraries")}</h3>
          <p className="text-body-sm text-on-surface-muted">
            {t("Order, and whether each appears on the home page and in “Recently added”.")}
          </p>
          <ul className="mt-2">
            {views.map((view, index) => {
              const id = view.Id!;
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"
                >
                  <span className="text-body-md">{view.Name}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-body-sm text-on-surface-muted">
                      <input
                        type="checkbox"
                        checked={!homeExcludes.has(id)}
                        onChange={(event) =>
                          saveViews({
                            MyMediaExcludes: toggle(homeExcludes, id, event.target.checked),
                          })
                        }
                        className="size-4 accent-primary"
                      />
                      {t("Home")}
                    </label>
                    <label className="flex items-center gap-2 text-body-sm text-on-surface-muted">
                      <input
                        type="checkbox"
                        checked={!latestExcludes.has(id)}
                        onChange={(event) =>
                          saveViews({
                            LatestItemsExcludes: toggle(latestExcludes, id, event.target.checked),
                          })
                        }
                        className="size-4 accent-primary"
                      />
                      {t("Recently added")}
                    </label>
                    <MoveButtons
                      label={view.Name ?? t("library")}
                      index={index}
                      count={views.length}
                      onMove={(from, to) =>
                        saveViews({
                          OrderedViews: moved(
                            views.map((entry) => entry.Id!),
                            from,
                            to,
                          ),
                        })
                      }
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          <SaveStatus saving={saving} failed={failed} />
        </div>
      )}
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
  const languages = languageOptions(cultures);
  return (
    <select
      id={id}
      className={SELECT}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t("Any language")}</option>
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
    save: (changes: Partial<UserConfiguration>, onSuccess?: () => void) =>
      update.mutate(changes, { onSuccess }),
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
      {failed ? t("Couldn't save. Try again.") : saving ? t("Saving…") : ""}
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
    skip: useId(),
    theme: useId(),
  };

  return (
    <Section title={t("Playback")} description={t("Saved to your Jellyfin account unless noted.")}>
      <Row label={t("Preferred audio language")} htmlFor={ids.audio}>
        <LanguageSelect
          id={ids.audio}
          value={config.AudioLanguagePreference ?? ""}
          onChange={(value) => save({ AudioLanguagePreference: value || null })}
        />
      </Row>
      <Row
        label={t("Play the default audio track")}
        hint={t("Otherwise prefer your audio language")}
        htmlFor={ids.defaultTrack}
      >
        <Toggle
          id={ids.defaultTrack}
          checked={config.PlayDefaultAudioTrack ?? true}
          onChange={(value) => save({ PlayDefaultAudioTrack: value })}
        />
      </Row>
      <Row
        label={t("Streaming quality")}
        hint={t("On this device. Lower it on slow connections.")}
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
              {option.label === "Original" ? t("Original (no limit)") : option.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label={t("Autoplay next episode")} htmlFor={ids.autoplay}>
        <Toggle
          id={ids.autoplay}
          checked={config.EnableNextEpisodeAutoPlay ?? true}
          onChange={(value) => {
            savePlayerPreferences({ autoplayNext: value });
            save({ EnableNextEpisodeAutoPlay: value });
          }}
        />
      </Row>
      <Row
        label={t("Intros, recaps and credits")}
        hint={t("When the server knows where they are")}
        htmlFor={ids.skip}
      >
        <PreferenceSelect id={ids.skip} name="skipSegments" options={SKIP_SEGMENTS} />
      </Row>
      <Row
        label={t("Theme music on detail pages")}
        hint={t("When the library has theme songs or videos")}
        htmlFor={ids.theme}
      >
        <PreferenceSelect id={ids.theme} name="themeMedia" options={THEME_MEDIA} />
      </Row>
      <Row label={t("Remember audio choices")} hint={t("Per series")} htmlFor={ids.rememberAudio}>
        <Toggle
          id={ids.rememberAudio}
          checked={config.RememberAudioSelections ?? true}
          onChange={(value) => save({ RememberAudioSelections: value })}
        />
      </Row>
      <Row label={t("Remember subtitle choices")} hint={t("Per series")} htmlFor={ids.rememberSubs}>
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
  const ids = {
    language: useId(),
    mode: useId(),
    size: useId(),
    color: useId(),
    background: useId(),
    position: useId(),
  };
  const mode =
    SUBTITLE_MODES.find((option) => option.value === config.SubtitleMode) ?? SUBTITLE_MODES[0]!;
  return (
    <Section title={t("Subtitles")} description={t("Saved to your Jellyfin account.")}>
      <Row label={t("Preferred subtitle language")} htmlFor={ids.language}>
        <LanguageSelect
          id={ids.language}
          value={config.SubtitleLanguagePreference ?? ""}
          onChange={(value) => save({ SubtitleLanguagePreference: value || null })}
        />
      </Row>
      <Row label={t("When to show subtitles")} hint={t(mode.hint)} htmlFor={ids.mode}>
        <select
          id={ids.mode}
          className={SELECT}
          value={mode.value}
          onChange={(event) => save({ SubtitleMode: event.target.value as SubtitlePlaybackMode })}
        >
          {SUBTITLE_MODES.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
      </Row>
      <SaveStatus saving={saving} failed={failed} />
      <h3 className="mt-6 text-label-md">{t("Appearance")}</h3>
      <p className="text-body-sm text-on-surface-muted">{t("Follows you to every device.")}</p>
      <SubtitlePreview />
      <Row label={t("Size")} htmlFor={ids.size}>
        <PreferenceSelect id={ids.size} name="subtitleSize" options={SUBTITLE_SIZES} />
      </Row>
      <Row label={t("Colour")} htmlFor={ids.color}>
        <PreferenceSelect id={ids.color} name="subtitleColor" options={SUBTITLE_COLORS} />
      </Row>
      <Row label={t("Background")} htmlFor={ids.background}>
        <PreferenceSelect
          id={ids.background}
          name="subtitleBackground"
          options={SUBTITLE_BACKGROUNDS}
        />
      </Row>
      <Row label={t("Position")} htmlFor={ids.position}>
        <PreferenceSelect id={ids.position} name="subtitlePosition" options={SUBTITLE_POSITIONS} />
      </Row>
    </Section>
  );
}

type ChoiceKey = Exclude<keyof FinoraPreferences, "homeRows">;

/** A select bound to one of Finora's server-synced preferences. */
function PreferenceSelect<K extends ChoiceKey>({
  id,
  name,
  options,
}: {
  id: string;
  name: K;
  options: readonly { value: FinoraPreferences[K]; label: string }[];
}) {
  const { preferences } = usePreferences();
  const setPreference = useSetPreference();
  return (
    <select
      id={id}
      className={SELECT}
      value={preferences[name]}
      onChange={(event) =>
        setPreference.mutate({ [name]: event.target.value } as Partial<FinoraPreferences>)
      }
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {t(option.label)}
        </option>
      ))}
    </select>
  );
}

/** A sample line styled like the player's subtitles. */
function SubtitlePreview() {
  const { preferences } = usePreferences();
  const size = {
    small: "text-body-md",
    medium: "text-body-lg",
    large: "text-title",
    xlarge: "text-headline-md",
  }[preferences.subtitleSize];
  return (
    <div
      aria-hidden
      className="relative mt-3 mb-2 grid h-28 place-items-end justify-center overflow-hidden rounded-md bg-linear-to-br from-[#2b3a55] via-[#4b6584] to-[#a5b1c2] pb-3"
    >
      <span
        className={cn(
          size,
          preferences.subtitlePosition === "raised" && "mb-6",
          preferences.subtitleColor === "yellow" ? "text-[#ffe14d]" : "text-white",
          preferences.subtitleBackground === "box" && "bg-black/60 px-1.5",
          preferences.subtitleBackground === "shadow" &&
            "[text-shadow:0_0_3px_#000,0_0_3px_#000,0_2px_4px_#000]",
        )}
      >
        The quick brown fox — দ্রুত বাদামি শেয়াল
      </span>
    </div>
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
      title={t("Quick Connect")}
      description={t("Sign in a TV or another device: enter the code it shows.")}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          label={t("Code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="sm:w-64"
        />
        <Button type="submit" disabled={!code.trim() || authorize.isPending}>
          {authorize.isPending ? t("Authorising…") : t("Authorise")}
        </Button>
      </form>
      <p
        role="status"
        className={cn("mt-3 h-5 text-body-sm", authorize.isError ? "text-error" : "text-success")}
      >
        {authorize.isError
          ? isAxiosError(authorize.error) && authorize.error.response?.status === 404
            ? t("That code wasn't found. Check it and try again.")
            : t("Couldn't authorise the code.")
          : authorize.isSuccess
            ? t("Device signed in.")
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
    <Section title={t("Password")}>
      <form onSubmit={onSubmit} className="grid gap-4 sm:max-w-sm">
        <TextField
          label={t("Current password")}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <TextField
          label={t("New password")}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <TextField
          label={t("Confirm new password")}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {mismatch && (
          <p className="text-body-sm text-error">{t("The new passwords don't match.")}</p>
        )}
        <p
          role="status"
          className={cn("h-5 text-body-sm", change.isError ? "text-error" : "text-success")}
        >
          {change.isError
            ? isAxiosError(change.error) && change.error.response?.status === 403
              ? t("The current password is wrong.")
              : t("Couldn't change the password.")
            : change.isSuccess
              ? t("Password changed.")
              : ""}
        </p>
        <Button
          type="submit"
          disabled={!next || mismatch || change.isPending}
          className="justify-self-start"
        >
          {change.isPending ? t("Saving…") : t("Change password")}
        </Button>
      </form>
    </Section>
  );
}

const SUBTITLE_SIZES = [
  { value: "small", label: msg("Small") },
  { value: "medium", label: msg("Medium") },
  { value: "large", label: msg("Large") },
  { value: "xlarge", label: msg("Extra large") },
] as const;

const SUBTITLE_COLORS = [
  { value: "white", label: msg("White") },
  { value: "yellow", label: msg("Yellow") },
] as const;

const SUBTITLE_BACKGROUNDS = [
  { value: "box", label: msg("Dark box") },
  { value: "shadow", label: msg("Outline only") },
  { value: "none", label: msg("None") },
] as const;

const SUBTITLE_POSITIONS = [
  { value: "bottom", label: msg("Bottom") },
  { value: "raised", label: msg("Raised") },
] as const;

const THEME_MEDIA = [
  { value: "off", label: msg("Off") },
  { value: "music", label: msg("Theme songs") },
  { value: "all", label: msg("Theme songs and videos") },
] as const;

const SKIP_SEGMENTS = [
  { value: "button", label: msg("Show a skip button") },
  { value: "auto", label: msg("Skip automatically") },
  { value: "off", label: msg("Do nothing") },
] as const;

const DATE_LOCALES = [
  { value: "auto", label: msg("Same as this browser") },
  { value: "en-US", label: msg("English (US) — Oct 28, 2026") },
  { value: "en-GB", label: msg("English (UK) — 28 Oct 2026") },
  { value: "en-IN", label: msg("English (India) — 28 Oct 2026") },
  { value: "bn-BD", label: "বাংলা — ২৮ অক্টো, ২০২৬" },
  { value: "de-DE", label: "Deutsch — 28.10.2026" },
  { value: "fr-FR", label: "Français — 28 oct. 2026" },
  { value: "es-ES", label: "Español — 28 oct 2026" },
  { value: "ja-JP", label: "日本語 — 2026/10/28" },
] as const;
