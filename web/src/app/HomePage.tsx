import { ServerStatus } from "@/features/server/ServerStatus";

export function HomePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-headline-lg">Welcome to Finora</h1>
      <p className="mt-2 text-body-md text-on-surface-muted">
        Finora is getting ready. Sign-in and your libraries arrive in the next steps.
      </p>
      <div className="mt-8">
        <ServerStatus />
      </div>
    </div>
  );
}
