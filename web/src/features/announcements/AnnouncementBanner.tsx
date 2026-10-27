import { useQuery } from "@tanstack/react-query";
import { Info, PartyPopper, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { finoraFetch, useFinoraConfig } from "@/api/finora";
import { useRuntimeConfig } from "@/config/context";
import { cn } from "@/lib/cn";

export interface Announcement {
  id: number;
  message: string;
  tone: "info" | "warning" | "success";
  startsAt: string | null;
  endsAt: string | null;
}

const DISMISSED_KEY = "finora.dismissedAnnouncements";

function readDismissed(): number[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as number[];
  } catch {
    return [];
  }
}

const TONES = {
  info: { icon: Info, className: "bg-primary/15 text-on-surface ring-primary/30" },
  warning: { icon: TriangleAlert, className: "bg-warning/15 text-on-surface ring-warning/40" },
  success: { icon: PartyPopper, className: "bg-success/15 text-on-surface ring-success/30" },
} as const;

/** Site-wide notices from the Finora API; dismissible for the rest of the browser session. */
export function AnnouncementBanner() {
  const { config } = useRuntimeConfig();
  const finora = useFinoraConfig();
  const [dismissed, setDismissed] = useState(readDismissed);
  const { data } = useQuery({
    queryKey: ["finora", "announcements"],
    enabled: Boolean(config.apiUrl && finora.data?.configured),
    queryFn: ({ signal }) =>
      finoraFetch<Announcement[]>(config.apiUrl!, "/announcements", { signal }),
    refetchInterval: 5 * 60 * 1000,
  });
  const visible = (data ?? []).filter((announcement) => !dismissed.includes(announcement.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-2 px-page-x-mobile pt-4 md:px-page-x">
      {visible.map((announcement) => {
        const tone = TONES[announcement.tone] ?? TONES.info;
        const Icon = tone.icon;
        return (
          <div
            key={announcement.id}
            role="status"
            className={cn("flex items-start gap-3 rounded-lg px-4 py-3 ring-1", tone.className)}
          >
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p className="min-w-0 flex-1 text-body-md whitespace-pre-line">
              {announcement.message}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = [...dismissed, announcement.id];
                setDismissed(next);
                window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
              }}
              aria-label="Dismiss announcement"
              className="grid size-7 shrink-0 place-items-center rounded-full text-on-surface-muted hover:bg-black/10 hover:text-on-surface"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
