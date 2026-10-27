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
import { useUsers } from "./queries";

interface ApiSettings {
  jellyfinUrl: string;
  jellyfinApiKeySet: boolean;
  publicUrl: string;
  allowedOrigins: string[];
  googleClientId: string;
  googleClientSecretSet: boolean;
  googleSessionHours: number;
  lockedByEnvironment: Record<string, boolean>;
}

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
        No Finora API is configured for this site.
      </p>
    );
  if (finora.isPending) return <Spinner />;
  if (!finora.data) {
    return (
      <p role="alert" className="text-body-md text-error">
        The Finora API at {config.apiUrl} is not reachable.
      </p>
    );
  }
  if (!finora.data.configured) return <SetupForm />;
  return (
    <div className="max-w-3xl space-y-6">
      <SettingsForm />
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
      toast.success(`Connected to ${data.serverName}.`);
      void queryClient.invalidateQueries({ queryKey: ["finora"] });
    },
  });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setup.mutate();
  };
  return (
    <Section
      title="Set up the Finora API"
      description="The API printed a one-time setup code in its log when it started. Create a Jellyfin API key in the Jellyfin dashboard (Administration → API Keys)."
    >
      <form onSubmit={onSubmit} className="grid max-w-md gap-4">
        <TextField
          label="Setup code"
          inputMode="numeric"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />
        <TextField
          label="Jellyfin address"
          value={jellyfinUrl}
          onChange={(event) => setJellyfinUrl(event.target.value)}
          required
        />
        <TextField
          label="Jellyfin API key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          required
          autoComplete="off"
        />
        <TextField
          label="Finora Web addresses (comma-separated)"
          value={origins}
          onChange={(event) => setOrigins(event.target.value)}
          required
        />
        {setup.isError && (
          <p role="alert" className="text-body-sm text-error">
            {errorText(setup.error, "Setup failed.")}
          </p>
        )}
        <Button type="submit" disabled={setup.isPending} className="justify-self-start">
          {setup.isPending ? "Connecting…" : "Connect"}
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
        {errorText(settings.error, "Couldn't load the API settings.")}
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
      toast.success("API settings saved.");
    },
    onError: (error) => toast.error(errorText(error, "Couldn't save the settings.")),
  });

  return (
    <Section
      title="API settings"
      description={
        <>
          Connected to Jellyfin at <span className="text-on-surface">{settings.jellyfinUrl}</span>.
          Values set by environment variables can't be changed here.
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
          label="Finora Web addresses (comma-separated)"
          value={origins}
          onChange={(event) => setOrigins(event.target.value)}
          disabled={locked.allowed_origins}
        />
        <TextField
          label="This API's public HTTPS address (for Google sign-in)"
          placeholder="https://finora-api.example.com"
          value={publicUrl}
          onChange={(event) => setPublicUrl(event.target.value)}
          disabled={locked.public_url}
        />
        <TextField
          label="Google OAuth client ID"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          disabled={locked.google_client_id}
          autoComplete="off"
        />
        <TextField
          label="Google OAuth client secret"
          type="password"
          placeholder={settings.googleClientSecretSet ? "Saved — leave empty to keep" : ""}
          value={clientSecret}
          onChange={(event) => setClientSecret(event.target.value)}
          disabled={locked.google_client_secret}
          autoComplete="off"
        />
        <div>
          <label htmlFor={hoursId} className="mb-1.5 block text-label-md">
            Google admin sessions end after
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
                  ? `${value} hour${value === 1 ? "" : "s"}`
                  : `${value / 24} day${value === 24 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </div>
        <p className="text-body-sm text-on-surface-muted">
          In Google Cloud, add{" "}
          <code className="text-on-surface">
            {(publicUrl || "https://…") + "/api/v1/auth/google/callback"}
          </code>{" "}
          as an authorised redirect URI.
        </p>
        <Button type="submit" disabled={save.isPending} className="justify-self-start">
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </Section>
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
      toast.success("Google account linked.");
    },
    onError: (error) => toast.error(errorText(error, "Couldn't link the account.")),
  });
  const remove = useMutation({
    mutationFn: (address: string) =>
      call(`/admin/allowlist/${encodeURIComponent(address)}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["finora", "allowlist"] }),
  });

  return (
    <Section
      title="Google sign-in for admins"
      description="Link Google accounts to Jellyfin administrators. Over plain HTTP, the admin console only opens for sessions started with Google."
    >
      {list.data?.length ? (
        <ul className="mb-5 divide-y divide-border rounded-md bg-background">
          {list.data.map((entry) => (
            <li key={entry.email} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0 text-body-sm">
                <span className="block truncate">{entry.email}</span>
                <span className="text-on-surface-muted">
                  →{" "}
                  {users?.find((user) => user.Id === entry.jellyfinUserId)?.Name ?? "Unknown user"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(entry.email)}
                aria-label={`Remove ${entry.email}`}
                className="grid size-8 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-error"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-body-sm text-on-surface-muted">No Google accounts linked yet.</p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <TextField
          label="Google email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="sm:flex-1"
        />
        <div>
          <label htmlFor={selectId} className="mb-1.5 block text-label-md">
            Jellyfin admin
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
          Link
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
      toast.success("Announcement published.");
    },
    onError: (error) => toast.error(errorText(error, "Couldn't publish.")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => call(`/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const inputClass =
    "h-12 w-full rounded-md border border-border-strong bg-background px-3 text-body-md";
  return (
    <Section title="Announcements" description="Shown at the top of every page for all users.">
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
                  {announcement.tone} ·{" "}
                  {announcement.startsAt
                    ? `from ${new Date(announcement.startsAt).toLocaleString()}`
                    : "now"}
                  {announcement.endsAt
                    ? ` until ${new Date(announcement.endsAt).toLocaleString()}`
                    : " until removed"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate(announcement.id)}
                aria-label="Delete announcement"
                className="grid size-8 shrink-0 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-error"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 text-body-sm text-on-surface-muted">No announcements.</p>
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
            Message
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
              Style
            </label>
            <select
              id={ids.tone}
              value={tone}
              onChange={(event) => setTone(event.target.value as Announcement["tone"])}
              className={inputClass}
            >
              <option value="info">Information</option>
              <option value="warning">Warning</option>
              <option value="success">Good news</option>
            </select>
          </div>
          <div>
            <label htmlFor={ids.starts} className="mb-1.5 block text-label-md">
              Starts (optional)
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
              Ends (optional)
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
          Publish
        </Button>
      </form>
    </Section>
  );
}
