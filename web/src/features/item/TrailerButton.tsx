import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Clapperboard } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useLocalTrailers } from "./queries";
import { youtubeId } from "./youtube";

/**
 * Plays a local trailer in the player, or a remote one (usually YouTube) in a
 * dialog through youtube-nocookie.com, Google's privacy-enhanced embed.
 */
export function TrailerButton({ item, className }: { item: BaseItemDto; className: string }) {
  const navigate = useNavigate();
  const local = useLocalTrailers(item).data?.[0];
  const remote = item.RemoteTrailers?.find((trailer) => trailer.Url)?.Url ?? null;
  const [open, setOpen] = useState(false);
  if (!local && !remote) return null;
  const video = remote ? youtubeId(remote) : null;

  const play = () => {
    if (local?.Id) void navigate(`/play/${local.Id}`);
    else if (video) setOpen(true);
    else if (remote) window.open(remote, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button
        type="button"
        onClick={play}
        aria-label="Play trailer"
        title="Trailer"
        className={className}
      >
        <Clapperboard aria-hidden className="size-5" />
      </button>
      {video && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(64rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2">
              <Dialog.Title className="sr-only">Trailer for {item.Name}</Dialog.Title>
              <Dialog.Description className="sr-only">Press Escape to close.</Dialog.Description>
              <div className="aspect-video overflow-hidden rounded-lg bg-black shadow-[0_24px_48px_rgb(0_0_0/0.6)]">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}?autoplay=1&rel=0`}
                  title={`Trailer for ${item.Name}`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="size-full"
                />
              </div>
              <Dialog.Close className="mt-3 block w-full text-center text-label-md text-white/80 hover:text-white">
                Close
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
