import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Check, Heart } from "lucide-react";
import { useNavigate } from "react-router";
import { PlayButton } from "@/components/media/PlayButton";
import { cn } from "@/lib/cn";
import { useUserDataToggle } from "./queries";
import { playHref, type PlaySelection } from "./selection";

const ROUND =
  "grid size-12 place-items-center rounded-full bg-white/10 text-on-surface backdrop-blur-sm transition-colors duration-[120ms] hover:bg-white/20 disabled:opacity-50";

interface ItemActionsProps {
  item: BaseItemDto;
  /** The item Play actually starts (e.g. the next episode of a series). */
  playTarget?: BaseItemDto | null;
  playLabel?: string;
  selection?: PlaySelection;
}

export function ItemActions({ item, playTarget, playLabel, selection }: ItemActionsProps) {
  const navigate = useNavigate();
  const { played, favorite } = useUserDataToggle(item);
  const target = playTarget === undefined ? item : playTarget;
  const resumable = (target?.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const isPlayed = Boolean(item.UserData?.Played);
  const isFavorite = Boolean(item.UserData?.IsFavorite);
  const canMarkPlayed = item.Type !== "Person" && item.Type !== "MusicArtist";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {target && (
        <PlayButton
          label={playLabel ?? (resumable ? "Resume" : "Play")}
          onClick={() => void navigate(playHref(target, selection))}
        />
      )}
      {target && resumable && (
        <button
          type="button"
          onClick={() => void navigate(playHref(target, selection, true))}
          className="h-12 rounded-full bg-white/10 px-5 text-label-md backdrop-blur-sm hover:bg-white/20"
        >
          Play from beginning
        </button>
      )}
      {canMarkPlayed && (
        <button
          type="button"
          onClick={() => played.mutate(!isPlayed)}
          aria-pressed={isPlayed}
          aria-label={isPlayed ? "Mark as unwatched" : "Mark as watched"}
          title={isPlayed ? "Mark as unwatched" : "Mark as watched"}
          className={cn(ROUND, isPlayed && "text-success")}
        >
          <Check aria-hidden className="size-5" strokeWidth={isPlayed ? 3 : 2} />
        </button>
      )}
      <button
        type="button"
        onClick={() => favorite.mutate(!isFavorite)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
        title={isFavorite ? "Remove from favourites" : "Add to favourites"}
        className={cn(ROUND, isFavorite && "text-error")}
      >
        <Heart aria-hidden className={cn("size-5", isFavorite && "fill-current")} />
      </button>
    </div>
  );
}
