import type { UserDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { relativeTime } from "@/lib/format";
import { useSessions, useUsers } from "./queries";

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

  if (isPending) return <Spinner />;
  if (isError)
    return (
      <p role="alert" className="text-body-md text-error">
        Couldn't load users.
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
            placeholder={`Search ${users.length} users`}
            aria-label="Search users"
            className="h-10 w-full rounded-full border border-border-strong bg-surface pr-4 pl-9 text-body-sm placeholder:text-on-surface-subtle"
          />
        </div>
        <Link
          to="/admin/users/new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-label-md text-on-primary hover:bg-primary-hover"
        >
          <Plus aria-hidden className="size-4" />
          Add user
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg bg-surface">
        <table className="w-full min-w-[40rem] text-left text-body-sm">
          <thead className="text-label-sm text-on-surface-subtle">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-3 font-bold">
                User
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Libraries
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Last active
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((user) => {
              const policy = user.Policy;
              return (
                <tr key={user.Id} className="hover:bg-surface-raised">
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
                      ? "All"
                      : `${policy?.EnabledFolders?.length ?? 0} selected`}
                  </td>
                  <td className="px-4 py-2.5 text-on-surface-muted">
                    {relativeTime(user.LastActivityDate)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-1.5">
                      {online.has(user.Id) && <Badge tone="primary">Online</Badge>}
                      {policy?.IsAdministrator && <Badge>Admin</Badge>}
                      {policy?.IsDisabled && <Badge tone="warning">Disabled</Badge>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-body-md text-on-surface-muted">
            No users match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
