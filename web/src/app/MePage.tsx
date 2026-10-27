import { Server, Settings, ShieldCheck } from "lucide-react";
import { useSession } from "@/features/auth/context";
import { Link } from "react-router";
import { UserMenu } from "@/features/auth/UserMenu";

/** Phone profile tab. Settings arrive in Phase 5. */
export function MePage() {
  const { user } = useSession();
  return (
    <div className="px-page-x-mobile pt-8 pb-24 md:px-page-x md:pt-10">
      <h1 className="text-headline-lg">Me</h1>
      <div className="mt-6 max-w-md rounded-lg bg-surface p-2">
        <UserMenu />
      </div>
      <Link
        to="/settings"
        className="mt-3 flex max-w-md items-center gap-3 rounded-lg bg-surface px-4 py-3 text-label-md hover:bg-surface-raised"
      >
        <Settings aria-hidden className="size-5 text-on-surface-muted" />
        Settings
      </Link>
      {user.Policy?.IsAdministrator && (
        <Link
          to="/admin"
          className="mt-3 flex max-w-md items-center gap-3 rounded-lg bg-surface px-4 py-3 text-label-md hover:bg-surface-raised"
        >
          <ShieldCheck aria-hidden className="size-5 text-on-surface-muted" />
          Admin
        </Link>
      )}
      <Link
        to="/server"
        className="mt-3 flex max-w-md items-center gap-3 rounded-lg bg-surface px-4 py-3 text-label-md hover:bg-surface-raised"
      >
        <Server aria-hidden className="size-5 text-on-surface-muted" />
        Server
      </Link>
    </div>
  );
}
