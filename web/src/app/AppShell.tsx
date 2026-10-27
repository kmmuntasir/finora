import { House, LayoutGrid, Search, Server, Settings, UserRound } from "lucide-react";
import { useEffect, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/features/auth/UserMenu";
import { useUserViews } from "@/features/home/queries";
import { viewIcon } from "@/features/library/view-icons";
import { NowPlayingBar } from "@/features/music/NowPlayingBar";
import { NowPlayingView } from "@/features/music/NowPlayingView";
import { currentEntry, useQueue } from "@/features/music/queue-store";
import { cn } from "@/lib/cn";
import { libraryHref } from "@/lib/routes";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

function SidebarLink({
  to,
  icon: IconComponent,
  label,
  end,
}: {
  to: string;
  icon: Icon;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-label-md transition-colors duration-[120ms]",
          isActive
            ? "bg-surface-overlay text-on-surface"
            : "text-on-surface-muted hover:bg-surface-raised hover:text-on-surface",
        )
      }
    >
      <IconComponent aria-hidden className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function TabLink({
  to,
  icon: IconComponent,
  label,
  end,
}: {
  to: string;
  icon: Icon;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center gap-1 pt-2 pb-1 text-label-sm transition-colors duration-[120ms]",
          isActive ? "text-on-surface" : "text-on-surface-subtle",
        )
      }
    >
      <IconComponent aria-hidden className="size-6" />
      {label}
    </NavLink>
  );
}

/** "/" or Ctrl/⌘+K opens search, unless the user is typing somewhere. */
function useSearchShortcut() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      const commandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (
        commandK ||
        (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey)
      ) {
        event.preventDefault();
        void navigate("/search");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
}

export function AppShell() {
  const { data: views } = useUserViews();
  const musicLoaded = useQueue((state) => currentEntry(state) !== null);
  useSearchShortcut();

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[var(--spacing-sidebar)_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <Logo className="px-2" />
        <nav aria-label="Main" className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <SidebarLink to="/" end icon={House} label="Home" />
          <SidebarLink to="/search" icon={Search} label="Search" />
          <p className="mt-6 mb-1 px-3 text-label-sm text-on-surface-subtle">Libraries</p>
          {views?.map((view) => (
            <SidebarLink
              key={view.Id}
              to={libraryHref(view)}
              icon={viewIcon(view.CollectionType)}
              label={view.Name ?? ""}
            />
          ))}
          <div className="mt-auto pt-6">
            <SidebarLink to="/settings" icon={Settings} label="Settings" />
            <SidebarLink to="/server" icon={Server} label="Server" />
          </div>
        </nav>
        <div className="mt-3 border-t border-border pt-3">
          <UserMenu />
          <p className="mt-2 px-2 text-caption text-on-surface-subtle">Finora {__APP_VERSION__}</p>
        </div>
      </aside>

      <main
        className={cn(
          "min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0",
          musicLoaded &&
            "pb-[calc(4rem+var(--spacing-player-bar)+env(safe-area-inset-bottom))] md:pb-[var(--spacing-player-bar)]",
        )}
      >
        <Outlet />
      </main>

      <NowPlayingBar />
      <NowPlayingView />

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <TabLink to="/" end icon={House} label="Home" />
        <TabLink to="/search" icon={Search} label="Search" />
        <TabLink to="/libraries" icon={LayoutGrid} label="Libraries" />
        <TabLink to="/me" icon={UserRound} label="Me" />
      </nav>
    </div>
  );
}
