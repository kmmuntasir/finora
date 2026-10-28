import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Play } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useSession } from "@/features/auth/context";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";
import { canQuickPlay, resolvePlayTarget } from "./play-target";
import { playHref } from "./selection";

/**
 * The round play button centred on a card's artwork, shown on hover (like
 * Jellyfin's own web client): the card itself opens the details page, this
 * starts or resumes playback directly. Mouse only: it is skipped by Tab and
 * TV-mode arrows, and hidden on touch screens, where a tap opens the card.
 * Place it in a `group` element, over the artwork.
 */
export function CardPlayButton({ item, compact }: { item: BaseItemDto; compact?: boolean }) {
  const { api, user } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!canQuickPlay(item)) return null;

  const resumable = (item.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const label = resumable
    ? t("Resume {title}", { title: item.Name ?? "" })
    : t("Play {title}", { title: item.Name ?? "" });

  const play = async () => {
    setBusy(true);
    try {
      const target = await resolvePlayTarget(api, user.Id!, item);
      if (target) void navigate(playHref(target));
      else toast.error(t("There is nothing to play yet."));
    } catch {
      toast.error(t("Couldn't start playback."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={() => void play()}
      className={cn(
        // DESIGN.md: the Play button, circular on cards, in the logo gradient.
        "pointer-events-auto grid place-items-center rounded-full bg-linear-to-r from-brand-cyan via-brand-blue to-brand-indigo text-white",
        "shadow-[0_8px_24px_-6px_rgb(0_0_0/0.6)] scale-90 opacity-0 transition-[opacity,transform,filter] duration-150 ease-out",
        "group-hover:scale-100 group-hover:opacity-100 hover:brightness-110 active:scale-95",
        "[@media(hover:none)]:hidden",
        compact ? "size-11" : "size-14",
        busy && "opacity-100",
      )}
    >
      <Play aria-hidden className={cn("ml-0.5 fill-current", compact ? "size-5" : "size-6")} />
    </button>
  );
}
