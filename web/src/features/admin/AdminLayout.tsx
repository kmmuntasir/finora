import { ExternalLink } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useRuntimeConfig } from "@/config/context";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/Spinner";
import { useAdminAccess } from "./access";
import { useGoogleSession } from "./useGoogleSession";

const TABS = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/sessions", label: "Active sessions" },
  { to: "/admin/libraries", label: "Libraries" },
  { to: "/admin/finora", label: "Finora", needsApi: true },
];

export function AdminLayout() {
  const googleSession = useGoogleSession();
  const access = useAdminAccess(googleSession.data?.google === true);
  const { config } = useRuntimeConfig();

  if (!access.allowed && googleSession.isFetching) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner />
      </div>
    );
  }

  if (!access.allowed) {
    return (
      <div className="px-page-x-mobile py-12 md:px-page-x">
        <h1 className="text-headline-md">Admin</h1>
        <p className="mt-2 max-w-xl text-body-md text-on-surface-muted">
          {access.reason === "not-admin"
            ? "This area is for server administrators."
            : "This server is reached over an unencrypted connection, so the admin console needs Google sign-in. Ask the server owner to set up the Finora API, or use the Jellyfin dashboard."}
        </p>
      </div>
    );
  }

  return (
    <div className="px-page-x-mobile pt-8 pb-24 md:px-page-x md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-headline-lg">Admin</h1>
        <a
          href={`${config.jellyfinUrl}/web/#/dashboard`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-label-md text-on-surface-muted hover:text-on-surface"
        >
          Open Jellyfin dashboard
          <ExternalLink aria-hidden className="size-4" />
        </a>
      </div>
      <nav aria-label="Admin" className="mt-5 flex gap-1 border-b border-border">
        {TABS.filter((tab) => !tab.needsApi || config.apiUrl).map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2.5 text-label-md transition-colors duration-[120ms]",
                isActive
                  ? "border-primary text-on-surface"
                  : "border-transparent text-on-surface-muted hover:text-on-surface",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
