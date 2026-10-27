import { useSession } from "@/features/auth/context";
import { ServerStatus } from "@/features/server/ServerStatus";

export function HomePage() {
  const { user } = useSession();
  return (
    <div className="max-w-2xl">
      <h1 className="text-headline-lg">Welcome, {user.Name}</h1>
      <p className="mt-2 text-body-md text-on-surface-muted">
        You are signed in. Your libraries arrive in the next step.
      </p>
      <div className="mt-8">
        <ServerStatus />
      </div>
    </div>
  );
}
