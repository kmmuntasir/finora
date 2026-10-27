import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Check, Heart, Shuffle, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "@/features/auth/context";
import { fetchInstantMix, fetchTracks, isMusic } from "@/features/music/playables";
import { useQueue } from "@/features/music/queue-store";
import { PlayButton } from "@/components/media/PlayButton";
import { cn } from "@/lib/cn";
import { useUserDataToggle } from "./queries";
import { playHref, type PlaySelection } from "./selection";

const ROUND =
  "grid size-12 place-items-center rounded-full bg-white/10 light:bg-black/5 text-on-surface backdrop-blur-sm transition-colors duration-[120ms] hover:bg-white/20 light:hover:bg-black/10 disabled:opacity-50";

interface ItemActionsProps {
  item: BaseItemDto;
  /** The item Play actually starts (e.g. the next episode of a series). */
  playTarget?: BaseItemDto | null;
  playLabel?: string;
  selection?: PlaySelection;
}

export function ItemActions({ item, playTarget, playLabel, selection }: ItemActionsProps) {
  const navigate = useNavigate();
  const { api, user } = useSession();
  const { played, favorite } = useUserDataToggle(item);
  const [loading, setLoading] = useState(false);
  const music = isMusic(item);
  const collection = ["MusicAlbum", "MusicArtist", "Playlist", "BoxSet"].includes(item.Type ?? "");

  /** Music goes to the queue; playlists of videos open the first video. */
  const playQueue = async (mode: "play" | "shuffle" | "mix") => {
    setLoading(true);
    try {
      const tracks =
        mode === "mix"
          ? await fetchInstantMix(api, user.Id!, item)
          : await fetchTracks(api, user.Id!, item);
      const audio = tracks.filter((track) => track.MediaType === "Audio");
      if (audio.length) {
        useQueue.getState().play(audio, 0, { shuffle: mode === "shuffle" });
      } else {
        const firstVideo = tracks.find((track) => track.MediaType === "Video");
        if (firstVideo) void navigate(playHref(firstVideo));
      }
    } finally {
      setLoading(false);
    }
  };
  const target = playTarget === undefined ? item : playTarget;
  const resumable = (target?.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const isPlayed = Boolean(item.UserData?.Played);
  const isFavorite = Boolean(item.UserData?.IsFavorite);
  const canMarkPlayed = item.Type !== "Person" && item.Type !== "MusicArtist";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {(music || item.Type === "Playlist") && (
        <PlayButton label="Play" disabled={loading} onClick={() => void playQueue("play")} />
      )}
      {!music && item.Type !== "Playlist" && target && (
        <PlayButton
          label={playLabel ?? (resumable ? "Resume" : "Play")}
          onClick={() => void navigate(playHref(target, selection))}
        />
      )}
      {(music || item.Type === "Playlist") && collection && (
        <button
          type="button"
          onClick={() => void playQueue("shuffle")}
          disabled={loading}
          aria-label="Shuffle"
          title="Shuffle"
          className={ROUND}
        >
          <Shuffle aria-hidden className="size-5" />
        </button>
      )}
      {music && item.Type !== "MusicGenre" && (
        <button
          type="button"
          onClick={() => void playQueue("mix")}
          disabled={loading}
          aria-label="Instant mix"
          title="Instant mix"
          className={ROUND}
        >
          <Sparkles aria-hidden className="size-5" />
        </button>
      )}
      {!music && target && resumable && (
        <button
          type="button"
          onClick={() => void navigate(playHref(target, selection, true))}
          className="h-12 rounded-full bg-white/10 light:bg-black/5 px-5 text-label-md backdrop-blur-sm hover:bg-white/20 light:hover:bg-black/10"
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
