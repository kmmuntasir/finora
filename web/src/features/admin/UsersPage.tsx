import type { UserDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Captions, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { relativeTime } from "@/lib/format";
import { SUBTITLE_MODES } from "@/features/settings/subtitle-options";
import { BulkSubtitleDialog } from "./BulkSubtitleDialog";
import { useSessions, useUsers } from "./queries";
import { t } from "@/i18n";

function Avatar({ user }: { user: UserDto }) {
  const { config } = useRuntimeConfig();
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-overlay text-label-md uppercase">
      {user.PrimaryImageTag ? (
        <img
          src={`${config.jellyfinUrl}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}&maxWidth=72`}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        (user.Name ?? "?").slice(0, 1)
      )}
    </span>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "primary" | "warning";
}) {
  const tones = {
    neutral: "bg-surface-overlay text-on-surface-muted",
    primary: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-label-sm ${tones[tone]}`}>{children}</span>
  );
}

export function UsersPage() {
  const { data: users, isPending, isError } = useUsers();
  const { data: sessions } = useSessions();
  const [query, setQuery] = useState("");

  const online = useMemo(() => new Set(sessions?.map((session) => session.UserId)), [sessions]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...(users ?? [])]
      .filter((user) => !term || user.Name?.toLowerCase().includes(term))
      .sort((a, b) =>
        (a.Name ?? "").localeCompare(b.Name ?? "", undefined, { sensitivity: "base" }),
      );
  }, [users, query]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulk, setBulk] = useState(false);
  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allShown = filtered.length > 0 && filtered.every((user) => selected.has(user.Id!));

  if (isPending) return <Spinner />;
  if (isError)
    return (
      <p role="alert" className="text-body-md text-error">
        {t("Couldn't load users.")}
      </p>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-surface-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Search {count} users", { count: users.length })}
            aria-label={t("Search users")}
            className="h-10 w-full rounded-full border border-border-strong bg-surface pr-4 pl-9 text-body-sm placeholder:text-on-surface-subtle"
          />
        </div>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setBulk(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-raised px-4 text-label-md hover:bg-surface-overlay"
          >
            <Captions aria-hidden className="size-4" />
            {t("Subtitle settings for {count}", { count: selected.size })}
          </button>
        )}
        <Link
          to="/admin/users/new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-label-md text-on-primary hover:bg-primary-hover"
        >
          <Plus aria-hidden className="size-4" />
          {t("Add user")}
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg bg-surface">
        <table className="w-full min-w-[40rem] text-left text-body-sm">
          <thead className="text-label-sm text-on-surface-subtle">
            <tr className="border-b border-border">
              <th scope="col" className="w-10 py-3 pl-4">
                <input
                  type="checkbox"
                  aria-label={t("Select all shown users")}
                  checked={allShown}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? new Set(filtered.map((user) => user.Id!)) : new Set(),
                    )
                  }
                  className="size-4 accent-primary"
                />
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                {t("User")}
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                {t("Libraries")}
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                {t("Last active")}
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                {t("Subtitles")}
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                {t("Status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((user) => {
              const policy = user.Policy;
              return (
                <tr key={user.Id} className="hover:bg-surface-raised">
                  <td className="py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label={t("Select {name}", { name: user.Name ?? "" })}
                      checked={selected.has(user.Id!)}
                      onChange={(event) => toggle(user.Id!, event.target.checked)}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/admin/users/${user.Id}`}
                      className="flex items-center gap-3 font-bold hover:underline"
                    >
                      <Avatar user={user} />
                      <span className="truncate">{user.Name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-on-surface-muted">
                    {policy?.EnableAllFolders
                      ? t("All")
                      : t("{count} selected", { count: policy?.EnabledFolders?.length ?? 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-on-surface-muted">
                    {relativeTime(user.LastActivityDate)}
                  </td>
                  <td className="px-4 py-2.5 text-on-surface-muted">
                    {[
                      t(
                        SUBTITLE_MODES.find(
                          (mode) => mode.value === user.Configuration?.SubtitleMode,
                        )?.label ?? SUBTITLE_MODES[0]!.label,
                      ),
                      user.Configuration?.SubtitleLanguagePreference || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-1.5">
                      {online.has(user.Id) && <Badge tone="primary">{t("Online")}</Badge>}
                      {policy?.IsAdministrator && <Badge>{t("Admin")}</Badge>}
                      {policy?.IsDisabled && <Badge tone="warning">{t("Disabled")}</Badge>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-body-md text-on-surface-muted">
            {t("No users match “{query}”.", { query })}
          </p>
        )}
      </div>
      {bulk && (
        <BulkSubtitleDialog
          users={(users ?? []).filter((user) => selected.has(user.Id!))}
          onClose={() => {
            setBulk(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
