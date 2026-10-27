import { LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth, useSession } from "./context";

/** Signed-in user with a sign-out action. Replaced by a full profile menu later. */
export function UserMenu() {
  const { user } = useSession();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const name = user.Name ?? "User";

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-overlay text-label-md uppercase"
      >
        {name.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label-md">{name}</span>
        {user.Policy?.IsAdministrator && (
          <span className="block text-caption text-on-surface-subtle">Administrator</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          setSigningOut(true);
          void signOut();
        }}
        disabled={signingOut}
        className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-muted transition-colors duration-[120ms] hover:bg-surface-overlay hover:text-on-surface disabled:opacity-50"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </div>
  );
}
