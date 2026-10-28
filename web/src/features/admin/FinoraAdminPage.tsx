import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { finoraFetch, FinoraApiError, useFinoraConfig } from "@/api/finora";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { TextField } from "@/components/TextField";
import { useRuntimeConfig } from "@/config/context";
import type { Announcement } from "@/features/announcements/AnnouncementBanner";
import { useSession } from "@/features/auth/context";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { useSubtitleLanguages } from "@/features/subtitles/api";
import { useUsers } from "./queries";
import { msg, t, tn } from "@/i18n";

interface ApiSettings {
  jellyfinUrl: string;
  jellyfinApiKeySet: boolean;
  publicUrl: string;
  allowedOrigins: string[];
  googleClientId: string;
  googleClientSecretSet: boolean;
  googleSessionHours: number;
  subtitleProviders: string[];
  subtitleAccess: "all" | "admins";
  subtitleDailyLimit: number;
  openSubtitlesApiKeySet: boolean;
  openSubtitlesUsername: string;
  openSubtitlesPasswordSet: boolean;
  openSubtitlesActivity: OpenSubtitlesActivity | null;
  autoSubtitles: boolean;
  autoSubtitleLanguages: string[];
  autoSubtitleHour: number;
  autoSubtitlePerRun: number;
  lockedByEnvironment: Record<string, boolean>;
}

interface OpenSubtitlesActivity {
  lastDownload: string | null;
  since: string | null;
  purgeAfter: string | null;
  warning: boolean;
  remaining: number | null;
  resetAt: string | null;
}

const PROVIDERS = [
  { id: "addic7ed", name: "Addic7ed", hint: msg("TV episodes; free, no account") },
  {
    id: "subdl",
    name: "SubDL",
    hint: msg("Movies and TV; free, about 300 downloads a day per server"),
  },
  {
    id: "opensubtitles",
    name: "OpenSubtitles",
    hint: msg("Needs a free API key from opensubtitles.com"),
  },
];

interface AllowedAdmin {
  email: string;
  jellyfinUserId: string;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof FinoraApiError ? error.message : fallback;
}

/** Calls the Finora API with the signed-in user's token. */
function useFinora() {
  const { config } = useRuntimeConfig();
  const { api } = useSession();
  return <T,>(
    path: string,
    options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  ) => finoraFetch<T>(config.apiUrl!, path, { ...options, token: api.accessToken });
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-surface p-5 md:p-6">
      <h2 className="text-title">{title}</h2>
      {description && <div className="mt-1 text-body-sm text-on-surface-muted">{description}</div>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function FinoraAdminPage() {
  const { config } = useRuntimeConfig();
  const finora = useFinoraConfig();
  if (!config.apiUrl)
    return (
      <p className="text-body-md text-on-surface-muted">
        {t("No Finora API is configured for this site.")}
      </p>
    );
  if (finora.isPending) return <Spinner />;
  if (!finora.data) {
    return (
      <p role="alert" className="text-body-md text-error">
        {t("The Finora API at {url} is not reachable.", { url: config.apiUrl })}
      </p>
    );
  }
  if (!finora.data.configured) return <SetupForm />;
  return (
    <div className="max-w-3xl space-y-6">
      <SettingsForm />
      <SubtitleSettings />
      <AutoSubtitleSettings />
      <Allowlist />
      <Announcements />
    </div>
  );
}

function SetupForm() {
  const { config } = useRuntimeConfig();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [jellyfinUrl, setJellyfinUrl] = useState(config.jellyfinUrl);
  const [apiKey, setApiKey] = useState("");
  const [origins, setOrigins] = useState(window.location.origin);
  const setup = useMutation({
    mutationFn: () =>
      finoraFetch<{ serverName: string }>(config.apiUrl!, "/setup", {
        method: "POST",
        body: { code: code.trim(), jellyfinUrl, apiKey: apiKey.trim(), allowedOrigins: origins },
      }),
    onSuccess: (data) => {
      toast.success(t("Connected to {name}.", { name: data.serverName }));
      void queryClient.invalidateQueries({ queryKey: ["finora"] });
    },
  });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setup.mutate();
  };
  return (
    <Section
      title={t("Set up the Finora API")}
      description={t(
        "The API printed a one-time setup code in its log when it started. Create a Jellyfin API key in the Jellyfin dashboard (Administration → API Keys).",
      )}
    >
      <form onSubmit={onSubmit} className="grid max-w-md gap-4">
        <TextField
          label={t("Setup code")}
          inputMode="numeric"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />
        <TextField
          label={t("Jellyfin address")}
          value={jellyfinUrl}
          onChange={(event) => setJellyfinUrl(event.target.value)}
          required
        />
        <TextField
          label={t("Jellyfin API key")}
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          required
          autoComplete="off"
        />
        <TextField
          label={t("Finora Web addresses (comma-separated)")}
          value={origins}
          onChange={(event) => setOrigins(event.target.value)}
          required
        />
        {setup.isError && (
          <p role="alert" className="text-body-sm text-error">
            {errorText(setup.error, t("Setup failed."))}
          </p>
        )}
        <Button type="submit" disabled={setup.isPending} className="justify-self-start">
          {setup.isPending ? t("Connecting…") : t("Connect")}
        </Button>
      </form>
    </Section>
  );
}

function SettingsForm() {
  const call = useFinora();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["finora", "admin-settings"],
    queryFn: ({ signal }) => call<ApiSettings>("/admin/settings", { signal }),
  });
  if (settings.isPending) return <Spinner />;
  if (settings.isError || !settings.data) {
    return (
      <p role="alert" className="text-body-md text-error">
        {errorText(settings.error, t("Couldn't load the API settings."))}
      </p>
    );
  }
  return (
    <SettingsFormFields
      settings={settings.data}
      onSaved={(next) => {
        queryClient.setQueryData(["finora", "admin-settings"], next);
        void queryClient.invalidateQueries({ queryKey: ["finora", "public-config"] });
      }}
    />
  );
}

function SettingsFormFields({
  settings,
  onSaved,
}: {
  settings: ApiSettings;
  onSaved: (settings: ApiSettings) => void;
}) {
  const call = useFinora();
  const [publicUrl, setPublicUrl] = useState(settings.publicUrl);
  const [origins, setOrigins] = useState(settings.allowedOrigins.join(", "));
  const [clientId, setClientId] = useState(settings.googleClientId);
  const [clientSecret, setClientSecret] = useState("");
  const [hours, setHours] = useState(String(settings.googleSessionHours));
  const locked = settings.lockedByEnvironment;
  const hoursId = useId();

  const save = useMutation({
    mutationFn: () =>
      call<ApiSettings>("/admin/settings", {
        method: "PUT",
        body: {
          ...(locked.public_url ? {} : { publicUrl }),
          ...(locked.allowed_origins
            ? {}
            : { allowedOrigins: origins.split(",").map((origin) => origin.trim()) }),
          ...(locked.google_client_id ? {} : { googleClientId: clientId }),
          ...(clientSecret && !locked.google_client_secret
            ? { googleClientSecret: clientSecret }
            : {}),
          ...(locked.google_session_hours ? {} : { googleSessionHours: Number(hours) }),
        },
      }),
    onSuccess: (next) => {
      setClientSecret("");
      onSaved(next);
      toast.success(t("API settings saved."));
    },
    onError: (error) => toast.error(errorText(error, t("Couldn't save the settings."))),
  });

  return (
    <Section
      title={t("API settings")}
      description={
        <>
          {t("Connected to Jellyfin at")}{" "}
          <span className="text-on-surface">{settings.jellyfinUrl}</span>.{" "}
          {t("Values set by environment variables can't be changed here.")}
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="grid gap-4 sm:max-w-lg"
      >
        <TextField
          label={t("Finora Web addresses (comma-separated)")}
          value={origins}
          onChange={(event) => setOrigins(event.target.value)}
          disabled={locked.allowed_origins}
        />
        <TextField
          label={t("This API's public HTTPS address (for Google sign-in)")}
          placeholder="https://finora-api.example.com"
          value={publicUrl}
          onChange={(event) => setPublicUrl(event.target.value)}
          disabled={locked.public_url}
        />
        <TextField
          label={t("Google OAuth client ID")}
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          disabled={locked.google_client_id}
          autoComplete="off"
        />
        <TextField
          label={t("Google OAuth client secret")}
          type="password"
          placeholder={settings.googleClientSecretSet ? t("Saved — leave empty to keep") : ""}
          value={clientSecret}
          onChange={(event) => setClientSecret(event.target.value)}
          disabled={locked.google_client_secret}
          autoComplete="off"
        />
        <div>
          <label htmlFor={hoursId} className="mb-1.5 block text-label-md">
            {t("Google admin sessions end after")}
          </label>
          <select
            id={hoursId}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            disabled={locked.google_session_hours}
            className="h-12 w-full rounded-md border border-border-strong bg-background px-3 text-body-md"
          >
            {[1, 4, 8, 12, 24, 72, 168].map((value) => (
              <option key={value} value={value}>
                {value < 24
                  ? tn(value, "{count} hour", "{count} hours")
                  : tn(value / 24, "{count} day", "{count} days")}
              </option>
            ))}
          </select>
        </div>
        <p className="text-body-sm text-on-surface-muted">
          {t("In Google Cloud, add")}{" "}
          <code className="text-on-surface">
            {(publicUrl || "https://…") + "/api/v1/auth/google/callback"}
          </code>{" "}
          {t("as an authorised redirect URI.")}
        </p>
        <Button type="submit" disabled={save.isPending} className="justify-self-start">
          {save.isPending ? t("Saving…") : t("Save settings")}
        </Button>
      </form>
    </Section>
  );
}

function SubtitleSettings() {
  const call = useFinora();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["finora", "admin-settings"],
    queryFn: ({ signal }) => call<ApiSettings>("/admin/settings", { signal }),
  });
  if (!settings.data) return null;
  return (
    <SubtitleSettingsFields
      key={JSON.stringify([
        settings.data.subtitleProviders,
        settings.data.subtitleAccess,
        settings.data.subtitleDailyLimit,
      ])}
      settings={settings.data}
      onSaved={(next) => {
        queryClient.setQueryData(["finora", "admin-settings"], next);
        void queryClient.invalidateQueries({ queryKey: ["finora", "public-config"] });
      }}
    />
  );
}

function SubtitleSettingsFields({
  settings,
  onSaved,
}: {
  settings: ApiSettings;
  onSaved: (settings: ApiSettings) => void;
}) {
  const call = useFinora();
  const locked = settings.lockedByEnvironment;
  const [enabled, setEnabled] = useState<string[]>(settings.subtitleProviders);
  const [access, setAccess] = useState(settings.subtitleAccess);
  const [limit, setLimit] = useState(String(settings.subtitleDailyLimit));
  const [osKey, setOsKey] = useState("");
  const [osUser, setOsUser] = useState(settings.openSubtitlesUsername);
  const [osPassword, setOsPassword] = useState("");
  const ids = { access: useId(), limit: useId() };

  const save = useMutation({
    mutationFn: () =>
      call<ApiSettings>("/admin/settings", {
        method: "PUT",
        body: {
          ...(locked.subtitle_providers ? {} : { subtitleProviders: enabled }),
          ...(locked.subtitle_access ? {} : { subtitleAccess: access }),
          ...(locked.subtitle_daily_limit ? {} : { subtitleDailyLimit: Number(limit) || 0 }),
          ...(osKey && !locked.opensubtitles_api_key ? { openSubtitlesApiKey: osKey } : {}),
          ...(locked.opensubtitles_username ? {} : { openSubtitlesUsername: osUser }),
          ...(osPassword && !locked.opensubtitles_password
            ? { openSubtitlesPassword: osPassword }
            : {}),
        },
      }),
    onSuccess: (next) => {
      setOsKey("");
      setOsPassword("");
      onSaved(next);
      toast.success(t("Subtitle settings saved."));
    },
    onError: (error) => toast.error(errorText(error, t("Couldn't save."))),
  });

  const move = (id: string, delta: -1 | 1) => {
    const position = enabled.indexOf(id);
    const next = [...enabled];
    const target = position + delta;
    if (position < 0 || target < 0 || target >= next.length) return;
    [next[position], next[target]] = [next[target]!, next[position]!];
    setEnabled(next);
  };

  const ordered = [
    ...enabled,
    ...PROVIDERS.map((provider) => provider.id).filter((id) => !enabled.includes(id)),
  ];
  return (
    <Section
      title={t("Subtitle finder")}
      description={t(
        "Providers are searched together; results are ranked by how well they match the file.",
      )}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="grid gap-5"
      >
        <ul className="divide-y divide-border rounded-md bg-background">
          {ordered.map((id) => {
            const provider = PROVIDERS.find((candidate) => candidate.id === id)!;
            const on = enabled.includes(id);
            return (
              <li key={id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked.subtitle_providers}
                  onChange={(event) =>
                    setEnabled(
                      event.target.checked
                        ? [...enabled, id]
                        : enabled.filter((value) => value !== id),
                    )
                  }
                  aria-label={t("Use {name}", { name: provider.name })}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-label-md">{provider.name}</span>
                  <span className="block text-caption text-on-surface-muted">
                    {t(provider.hint)}
                  </span>
                </span>
                {on && (
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => move(id, -1)}
                      aria-label={t("Move {name} up", { name: provider.name })}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => move(id, 1)}
                      aria-label={t("Move {name} down", { name: provider.name })}
                    >
                      ↓
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.access} className="mb-1.5 block text-label-md">
              {t("Who can download subtitles")}
            </label>
            <select
              id={ids.access}
              value={access}
              disabled={locked.subtitle_access}
              onChange={(event) => setAccess(event.target.value as "all" | "admins")}
              className="h-12 w-full rounded-md border border-border-strong bg-background px-3 text-body-md"
            >
              <option value="all">{t("Everyone")}</option>
              <option value="admins">{t("Administrators only")}</option>
            </select>
          </div>
          <div>
            <label htmlFor={ids.limit} className="mb-1.5 block text-label-md">
              {t("Downloads per person per day (0 = no limit)")}
            </label>
            <input
              id={ids.limit}
              type="number"
              min={0}
              max={1000}
              value={limit}
              disabled={locked.subtitle_daily_limit}
              onChange={(event) => setLimit(event.target.value)}
              className="h-12 w-full rounded-md border border-border-strong bg-background px-3 text-body-md"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label={t("OpenSubtitles API key")}
            type="password"
            autoComplete="off"
            placeholder={settings.openSubtitlesApiKeySet ? t("Saved — leave empty to keep") : ""}
            value={osKey}
            onChange={(event) => setOsKey(event.target.value)}
            disabled={locked.opensubtitles_api_key}
          />
          <TextField
            label={t("Username (optional)")}
            autoComplete="off"
            value={osUser}
            onChange={(event) => setOsUser(event.target.value)}
            disabled={locked.opensubtitles_username}
          />
          <TextField
            label={t("Password (optional)")}
            type="password"
            autoComplete="off"
            placeholder={settings.openSubtitlesPasswordSet ? t("Saved") : ""}
            value={osPassword}
            onChange={(event) => setOsPassword(event.target.value)}
            disabled={locked.opensubtitles_password}
          />
        </div>
        {settings.openSubtitlesActivity && (
          <OpenSubtitlesStatus activity={settings.openSubtitlesActivity} />
        )}
        <ProviderHealthTable />
        <Button type="submit" disabled={save.isPending} className="justify-self-start">
          {save.isPending ? t("Saving…") : t("Save subtitle settings")}
        </Button>
      </form>
    </Section>
  );
}

interface ProviderHealth {
  id: string;
  name: string;
  enabled: boolean;
  cooldownUntil: string | null;
  cooldownReason?: string;
  downloadsToday: number;
  remaining: number | null;
}

/** Each provider's state: resting after a quota error, and downloads today (UTC). */
function ProviderHealthTable() {
  const call = useFinora();
  const health = useQuery({
    queryKey: ["finora", "subtitle-providers"],
    queryFn: ({ signal }) => call<ProviderHealth[]>("/admin/subtitle-providers", { signal }),
    refetchInterval: 60_000,
  });
  if (!health.data?.length) return null;
  return (
    <div>
      <p className="mb-2 text-label-md">{t("Provider status")}</p>
      <ul className="divide-y divide-border rounded-md bg-background">
        {health.data.map((provider) => (
          <li
            key={provider.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
          >
            <span className={cn("text-body-md", !provider.enabled && "text-on-surface-subtle")}>
              {provider.name}
              {!provider.enabled && ` ${t("(off)")}`}
            </span>
            <span className="text-body-sm text-on-surface-muted">
              {provider.cooldownUntil ? (
                <span className="text-warning">
                  {t("Paused until {date}: {reason}", {
                    date: formatDate(provider.cooldownUntil, "datetime"),
                    reason: provider.cooldownReason ?? "",
                  })}
                </span>
              ) : provider.enabled ? (
                t("Ready")
              ) : (
                "—"
              )}
              {" · "}
              {tn(provider.downloadsToday, "{count} download today", "{count} downloads today")}
              {provider.remaining !== null &&
                ` · ${t("{count} left", { count: provider.remaining })}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** OpenSubtitles deletes keys that download nothing for 60 days; Finora tracks the last download. */
function OpenSubtitlesStatus({ activity }: { activity: OpenSubtitlesActivity }) {
  const last = activity.lastDownload
    ? t("Last download through Finora: {date}.", { date: formatDate(activity.lastDownload) })
    : t("No download through Finora yet.");
  const purge = activity.purgeAfter
    ? ` ${t(
        "OpenSubtitles deletes keys with no downloads for 60 days — download a subtitle before {date} to keep this one.",
        { date: formatDate(activity.purgeAfter) },
      )}`
    : ` ${t("OpenSubtitles deletes keys with no downloads for 60 days.")}`;
  const quota =
    activity.remaining !== null
      ? ` ${t("{count} downloads left today.", { count: activity.remaining })}`
      : "";
  return (
    <p
      role={activity.warning ? "alert" : undefined}
      className={
        activity.warning
          ? "rounded-md bg-warning/15 px-3 py-2 text-body-sm text-on-surface"
          : "text-body-sm text-on-surface-muted"
      }
    >
      {last}
      {purge}
      {quota}
    </p>
  );
}

function Allowlist() {
  const call = useFinora();
  const queryClient = useQueryClient();
  const { data: users } = useUsers();
  const admins = (users ?? []).filter((user) => user.Policy?.IsAdministrator);
  const list = useQuery({
    queryKey: ["finora", "allowlist"],
    queryFn: ({ signal }) => call<AllowedAdmin[]>("/admin/allowlist", { signal }),
  });
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const selectId = useId();

  const add = useMutation({
    mutationFn: () =>
      call<AllowedAdmin[]>("/admin/allowlist", {
        method: "PUT",
        body: { email, jellyfinUserId: userId || admins[0]?.Id },
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(["finora", "allowlist"], next);
      setEmail("");
      toast.success(t("Google account linked."));
    },
    onError: (error) => toast.error(errorText(error, t("Couldn't link the account."))),
  });
  const remove = useMutation({
    mutationFn: (address: string) =>
      call(`/admin/allowlist/${encodeURIComponent(address)}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["finora", "allowlist"] }),
  });

  return (
    <Section
      title={t("Google sign-in for admins")}
      description={t(
        "Link Google accounts to Jellyfin administrators. Over plain HTTP, the admin console only opens for sessions started with Google.",
      )}
    >
      {list.data?.length ? (
        <ul className="mb-5 divide-y divide-border rounded-md bg-background">
          {list.data.map((entry) => (
            <li key={entry.email} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0 text-body-sm">
                <span className="block truncate">{entry.email}</span>
                <span className="text-on-surface-muted">
                  →{" "}
                  {users?.find((user) => user.Id === entry.jellyfinUserId)?.Name ??
                    t("Unknown user")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(entry.email)}
                aria-label={t("Remove {name}", { name: entry.email })}
                className="grid size-8 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-error"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-body-sm text-on-surface-muted">
          {t("No Google accounts linked yet.")}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <TextField
          label={t("Google email")}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="sm:flex-1"
        />
        <div>
          <label htmlFor={selectId} className="mb-1.5 block text-label-md">
            {t("Jellyfin admin")}
          </label>
          <select
            id={selectId}
            value={userId || admins[0]?.Id || ""}
            onChange={(event) => setUserId(event.target.value)}
            className="h-12 rounded-md border border-border-strong bg-background px-3 text-body-md"
          >
            {admins.map((admin) => (
              <option key={admin.Id} value={admin.Id!}>
                {admin.Name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={!email || add.isPending}>
          {t("Link")}
        </Button>
      </form>
    </Section>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Announcements() {
  const call = useFinora();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["finora", "admin-announcements"],
    queryFn: ({ signal }) => call<Announcement[]>("/admin/announcements", { signal }),
  });
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Announcement["tone"]>("info");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const ids = { message: useId(), tone: useId(), starts: useId(), ends: useId() };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["finora", "admin-announcements"] });
    void queryClient.invalidateQueries({ queryKey: ["finora", "announcements"] });
  };

  const create = useMutation({
    mutationFn: () =>
      call("/admin/announcements", {
        method: "POST",
        body: {
          message,
          tone,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      setMessage("");
      setStartsAt("");
      setEndsAt("");
      refresh();
      toast.success(t("Announcement published."));
    },
    onError: (error) => toast.error(errorText(error, t("Couldn't publish."))),
  });
  const remove = useMutation({
    mutationFn: (id: number) => call(`/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const inputClass =
    "h-12 w-full rounded-md border border-border-strong bg-background px-3 text-body-md";
  return (
    <Section
      title={t("Announcements")}
      description={t("Shown at the top of every page for all users.")}
    >
      {list.data?.length ? (
        <ul className="mb-5 space-y-2">
          {list.data.map((announcement) => (
            <li
              key={announcement.id}
              className="flex items-start justify-between gap-3 rounded-md bg-background px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-body-md whitespace-pre-line">{announcement.message}</p>
                <p className="mt-1 text-caption text-on-surface-muted">
                  {t(TONE_LABELS[announcement.tone] ?? announcement.tone)} ·{" "}
                  {announcement.startsAt
                    ? announcement.endsAt
                      ? t("from {start} until {end}", {
                          start: formatDate(announcement.startsAt, "datetime"),
                          end: formatDate(announcement.endsAt, "datetime"),
                        })
                      : t("from {start} until removed", {
                          start: formatDate(announcement.startsAt, "datetime"),
                        })
                    : announcement.endsAt
                      ? t("now until {end}", { end: formatDate(announcement.endsAt, "datetime") })
                      : t("now until removed")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(announcement.id)}
                aria-label={t("Delete announcement")}
                className="grid size-8 shrink-0 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-error"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-body-sm text-on-surface-muted">{t("No announcements.")}</p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="grid gap-4"
      >
        <div>
          <label htmlFor={ids.message} className="mb-1.5 block text-label-md">
            {t("Message")}
          </label>
          <textarea
            id={ids.message}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={500}
            rows={3}
            required
            className="w-full rounded-md border border-border-strong bg-background px-3.5 py-3 text-body-md"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={ids.tone} className="mb-1.5 block text-label-md">
              {t("Style")}
            </label>
            <select
              id={ids.tone}
              value={tone}
              onChange={(event) => setTone(event.target.value as Announcement["tone"])}
              className={inputClass}
            >
              <option value="info">{t("Information")}</option>
              <option value="warning">{t("Warning")}</option>
              <option value="success">{t("Good news")}</option>
            </select>
          </div>
          <div>
            <label htmlFor={ids.starts} className="mb-1.5 block text-label-md">
              {t("Starts (optional)")}
            </label>
            <input
              id={ids.starts}
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={ids.ends} className="mb-1.5 block text-label-md">
              {t("Ends (optional)")}
            </label>
            <input
              id={ids.ends}
              type="datetime-local"
              value={endsAt}
              min={toLocalInput(startsAt || null)}
              onChange={(event) => setEndsAt(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <Button
          type="submit"
          disabled={!message.trim() || create.isPending}
          className="justify-self-start"
        >
          {t("Publish")}
        </Button>
      </form>
    </Section>
  );
}

const TONE_LABELS: Record<string, string> = {
  info: msg("Information"),
  warning: msg("Warning"),
  success: msg("Good news"),
};

interface AutoRun {
  started: string;
  finished: string | null;
  checked: number;
  downloaded: number;
  failed: number;
  stopped?: string;
}

interface AutoStatus {
  enabled: boolean;
  running: boolean;
  current: AutoRun | null;
  lastRun: AutoRun | null;
  nextRun: string | null;
}

function runSummary(run: AutoRun): string {
  const parts = [
    t("{count} downloaded", { count: run.downloaded }),
    t("{count} checked", { count: run.checked }),
    run.failed ? t("{count} without a match", { count: run.failed }) : null,
  ].filter(Boolean);
  return (
    parts.join(", ") +
    (run.stopped ? `. ${t("Stopped early: {reason}.", { reason: run.stopped })}` : ".")
  );
}

/** The nightly job that fetches missing subtitles across the library. */
function AutoSubtitleSettings() {
  const call = useFinora();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["finora", "admin-settings"],
    queryFn: ({ signal }) => call<ApiSettings>("/admin/settings", { signal }),
  });
  const status = useQuery({
    queryKey: ["finora", "auto-subtitles"],
    queryFn: ({ signal }) => call<AutoStatus>("/admin/auto-subtitles", { signal }),
    refetchInterval: (query) => (query.state.data?.running ? 3000 : 60_000),
  });
  const runNow = useMutation({
    mutationFn: () => call("/admin/auto-subtitles/run", { method: "POST" }),
    onSuccess: () => {
      toast.success(t("Started. Progress shows here."));
      window.setTimeout(() => void status.refetch(), 1000);
    },
    onError: (error) => toast.error(errorText(error, t("Couldn't start the run."))),
  });
  if (!settings.data) return null;
  const current = status.data?.current;
  const last = status.data?.lastRun;

  return (
    <Section
      title={t("Automatic subtitles")}
      description={t(
        "Every night, look for movies and episodes without subtitles in your languages and download the best match, newest first. Off by default.",
      )}
    >
      <AutoSubtitleFields
        key={JSON.stringify([
          settings.data.autoSubtitles,
          settings.data.autoSubtitleLanguages,
          settings.data.autoSubtitleHour,
          settings.data.autoSubtitlePerRun,
        ])}
        settings={settings.data}
        onSaved={(next) => {
          queryClient.setQueryData(["finora", "admin-settings"], next);
          void status.refetch();
        }}
      />
      <div
        className="mt-6 space-y-2 rounded-md bg-background px-4 py-3 text-body-sm"
        aria-live="polite"
      >
        {status.data?.running && current ? (
          <p className="flex items-center gap-2">
            <Spinner label={t("Running")} />
            {t("Running now: {summary}…", { summary: runSummary(current).replace(/\.$/, "") })}
          </p>
        ) : last ? (
          <p>
            {t("Last run {date}: {summary}", {
              date: formatDate(last.started, "datetime"),
              summary: runSummary(last),
            })}
          </p>
        ) : (
          <p className="text-on-surface-muted">{t("Hasn't run yet.")}</p>
        )}
        {status.data?.nextRun && !status.data.running && (
          <p className="text-on-surface-muted">
            {t("Next run {date}.", { date: formatDate(status.data.nextRun, "datetime") })}
          </p>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={runNow.isPending || status.data?.running}
          onClick={() => runNow.mutate()}
        >
          {t("Run now")}
        </Button>
      </div>
    </Section>
  );
}

function AutoSubtitleFields({
  settings,
  onSaved,
}: {
  settings: ApiSettings;
  onSaved: (settings: ApiSettings) => void;
}) {
  const call = useFinora();
  const languages = useSubtitleLanguages();
  const locked = settings.lockedByEnvironment;
  const [on, setOn] = useState(settings.autoSubtitles);
  const [codes, setCodes] = useState<string[]>(settings.autoSubtitleLanguages);
  const [hour, setHour] = useState(settings.autoSubtitleHour);
  const [perRun, setPerRun] = useState(String(settings.autoSubtitlePerRun));
  const ids = { on: useId(), hour: useId(), perRun: useId(), language: useId() };

  const save = useMutation({
    mutationFn: () =>
      call<ApiSettings>("/admin/settings", {
        method: "PUT",
        body: {
          ...(locked.auto_subtitles ? {} : { autoSubtitles: on }),
          ...(locked.auto_subtitle_languages ? {} : { autoSubtitleLanguages: codes }),
          ...(locked.auto_subtitle_hour ? {} : { autoSubtitleHour: hour }),
          ...(locked.auto_subtitle_per_run ? {} : { autoSubtitlePerRun: Number(perRun) || 25 }),
        },
      }),
    onSuccess: (next) => {
      onSaved(next);
      toast.success(t("Automatic subtitle settings saved."));
    },
    onError: (error) => toast.error(errorText(error, t("Couldn't save."))),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <label htmlFor={ids.on} className="flex cursor-pointer items-center gap-3 text-body-md">
        <input
          id={ids.on}
          type="checkbox"
          checked={on}
          disabled={locked.auto_subtitles}
          onChange={(event) => setOn(event.target.checked)}
          className="size-4 accent-primary"
        />
        {t("Download missing subtitles automatically")}
      </label>
      <fieldset disabled={locked.auto_subtitle_languages}>
        <legend className="mb-1.5 text-label-md">{t("Languages")}</legend>
        <div className="flex flex-wrap gap-2">
          {codes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-surface-raised py-1 pr-1 pl-3 text-label-sm"
            >
              {languages.data?.find((language) => language.code === code)?.name ?? code}
              <button
                type="button"
                aria-label={t("Remove {name}", { name: code })}
                disabled={codes.length === 1}
                onClick={() => setCodes(codes.filter((other) => other !== code))}
                className="grid size-6 place-items-center rounded-full hover:bg-surface-overlay disabled:opacity-40"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </span>
          ))}
          <select
            id={ids.language}
            aria-label={t("Add a language")}
            value=""
            onChange={(event) => {
              const code = event.target.value;
              if (code && !codes.includes(code)) setCodes([...codes, code]);
            }}
            className="h-8 rounded-full border border-border-strong bg-background px-3 text-label-sm"
          >
            <option value="">{t("Add a language…")}</option>
            {languages.data
              ?.filter((language) => !codes.includes(language.code))
              .map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
          </select>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={ids.hour} className="mb-1.5 block text-label-md">
            {t("Start time (server's time zone)")}
          </label>
          <select
            id={ids.hour}
            value={hour}
            disabled={locked.auto_subtitle_hour}
            onChange={(event) => setHour(Number(event.target.value))}
            className="h-12 w-full rounded-md border border-border-strong bg-background px-3 text-body-md"
          >
            {Array.from({ length: 24 }, (_, value) => (
              <option key={value} value={value}>
                {String(value).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.perRun} className="mb-1.5 block text-label-md">
            {t("Downloads per night")}
          </label>
          <input
            id={ids.perRun}
            type="number"
            min={1}
            max={200}
            value={perRun}
            disabled={locked.auto_subtitle_per_run}
            onChange={(event) => setPerRun(event.target.value)}
            className="h-12 w-full rounded-md border border-border-strong bg-background px-3 text-body-md"
          />
        </div>
      </div>
      <p className="text-body-sm text-on-surface-muted">
        {t(
          "A title with no match is tried again after a week, three times at most. Providers that reach their daily limit are paused until the next day. OpenSubtitles allows automatic downloads for your own library on your own account.",
        )}
      </p>
      <Button type="submit" disabled={save.isPending} className="justify-self-start">
        {save.isPending ? t("Saving…") : t("Save")}
      </Button>
    </form>
  );
}
