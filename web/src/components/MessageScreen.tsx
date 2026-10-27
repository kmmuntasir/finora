import type { ReactNode } from "react";
import { Logo } from "./Logo";

interface MessageScreenProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

/** Full-page message used before the app shell exists (config errors, startup failures). */
export function MessageScreen({ title, children, actions }: MessageScreenProps) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-page-x-mobile py-12 sm:px-page-x">
      <div className="w-full max-w-lg">
        <Logo className="mb-8" />
        <h1 className="text-headline-md text-on-surface">{title}</h1>
        <div className="mt-3 space-y-3 text-body-md text-on-surface-muted">{children}</div>
        {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </main>
  );
}
