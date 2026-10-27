import { House } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";

/**
 * Minimal Phase 0 shell. The real navigation is designed in the prototype
 * round (docs/ui-plan.md, section 8).
 */
export function AppShell() {
  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[var(--spacing-sidebar)_1fr]">
      <header className="flex items-center border-b border-border px-page-x-mobile py-3 md:hidden">
        <Logo />
      </header>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <Logo className="px-2" />
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-label-md transition-colors duration-[120ms]",
                isActive
                  ? "bg-surface-overlay text-on-surface"
                  : "text-on-surface-muted hover:bg-surface-raised hover:text-on-surface",
              )
            }
          >
            <House aria-hidden className="size-5" />
            Home
          </NavLink>
        </nav>
        <p className="mt-auto px-2 text-caption text-on-surface-subtle">Finora {__APP_VERSION__}</p>
      </aside>

      <main className="min-w-0 px-page-x-mobile py-6 md:px-page-x md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
