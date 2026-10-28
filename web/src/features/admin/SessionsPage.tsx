import type { SessionInfoDto } from "@jellyfin/sdk/lib/generated-client/models";
import { MessageSquare, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { landscapeImage } from "@/api/images";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Artwork } from "@/components/media/Artwork";
import { ProgressBar } from "@/components/media/ProgressBar";
import { Spinner } from "@/components/Spinner";
import { formatClock } from "@/features/player/player-preferences";
import { cardSubtitle, cardTitle, relativeTime } from "@/lib/format";
import { useAdminMutations, useSessions } from "./queries";
import { t } from "@/i18n";

const TICKS_PER_SECOND = 10_000_000;

function methodLabel(session: SessionInfoDto): string | null {
  const method = session.PlayState?.PlayMethod;
  if (!method) return null;
  if (method === "Transcode") {
    const info = session.TranscodingInfo;
    const video = info?.IsVideoDirect === false;
    const audio = info?.IsAudioDirect === false;
    if (video && audio) return t("Transcoding video + audio");
    if (video) return t("Transcoding video");
    if (audio) return t("Transcoding audio");
    return t("Transcoding");
  }
  return method === "DirectStream" ? t("Direct stream") : t("Direct play");
}

/** Jellyfin sends transcode reasons as a flags string ("VideoCodecNotSupported, AudioCodecNotSupported"). */
function transcodeReasons(session: SessionInfoDto): string {
  const reasons = session.TranscodingInfo?.TranscodeReasons as unknown;
  const text = Array.isArray(reasons)
    ? reasons.join(", ")
    : typeof reasons === "string"
      ? reasons
      : "";
  return text ? ` (${text})` : "";
}

function SessionCard({ session }: { session: SessionInfoDto }) {
  const { stopSession, messageSession } = useAdminMutations();
  const [confirmStop, setConfirmStop] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const item = session.NowPlayingItem;
  const position = (session.PlayState?.PositionTicks ?? 0) / TICKS_PER_SECOND;
  const duration = (item?.RunTimeTicks ?? 0) / TICKS_PER_SECOND;

  return (
    <li className="rounded-lg bg-surface p-4">
      <div className="flex items-start gap-4">
        {item && (
          <Artwork
            image={landscapeImage(item)}
            shape="landscape"
            width={160}
            title={cardTitle(item)}
            className="w-32 shrink-0 rounded-md md:w-40"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-label-md">
            {session.UserName ?? t("Unknown user")}
            <span className="ml-2 text-body-sm text-on-surface-muted">
              {session.Client} · {session.DeviceName}
            </span>
          </p>
          {item ? (
            <>
              <p className="mt-1 truncate text-body-md">
                {cardTitle(item)}
                {cardSubtitle(item) && (
                  <span className="text-on-surface-muted"> · {cardSubtitle(item)}</span>
                )}
              </p>
              <p className="text-body-sm text-on-surface-muted">
                {session.PlayState?.IsPaused ? t("Paused") : t("Playing")} · {methodLabel(session)}
                {transcodeReasons(session)}
              </p>
              {duration > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={position / duration} className="flex-1" />
                  <span className="text-caption text-on-surface-muted tabular-nums">
                    {formatClock(position)} / {formatClock(duration)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-body-sm text-on-surface-muted">
              {t("Idle · active {when}", {
                when: relativeTime(session.LastActivityDate).toLowerCase(),
              })}
            </p>
          )}
        </div>
      </div>
      {session.SupportsRemoteControl !== false && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item && (
            <Button size="sm" variant="secondary" onClick={() => setConfirmStop(true)}>
              <Square aria-hidden className="size-3.5 fill-current" />
              {t("Stop playback")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setMessage("")}>
            <MessageSquare aria-hidden className="size-4" />
            {t("Send message")}
          </Button>
        </div>
      )}
      {message !== null && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!message.trim()) return;
            messageSession.mutate(
              { sessionId: session.Id!, text: message.trim() },
              {
                onSuccess: () => {
                  toast.success(t("Message sent."));
                  setMessage(null);
                },
                onError: () => toast.error(t("Couldn't send the message.")),
              },
            );
          }}
        >
          <input
            autoFocus
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            aria-label={t("Message to {name}", { name: session.UserName ?? "" })}
            placeholder={t("Shown on their screen for 10 seconds")}
            className="h-9 min-w-0 flex-1 rounded-md border border-border-strong bg-background px-3 text-body-sm"
          />
          <Button size="sm" type="submit" disabled={!message.trim() || messageSession.isPending}>
            {t("Send")}
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setMessage(null)}>
            {t("Cancel")}
          </Button>
        </form>
      )}
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title={t("Stop playback?")}
        confirmLabel={t("Stop")}
        destructive
        busy={stopSession.isPending}
        onConfirm={() =>
          stopSession.mutate(session.Id!, {
            onSuccess: () => {
              setConfirmStop(false);
              toast.success(t("Playback stopped."));
            },
            onError: () => toast.error(t("Couldn't stop playback.")),
          })
        }
      >
        {t("{user}'s playback of {title} on {device} will stop.", {
          user: session.UserName ?? "",
          title: item ? cardTitle(item) : t("this item"),
          device: session.DeviceName ?? "",
        })}
      </ConfirmDialog>
    </li>
  );
}

export function SessionsPage() {
  const { data: sessions, isPending, isError } = useSessions();
  if (isPending) return <Spinner />;
  if (isError)
    return (
      <p role="alert" className="text-body-md text-error">
        {t("Couldn't load sessions.")}
      </p>
    );
  const playing = sessions.filter((session) => session.NowPlayingItem);
  const idle = sessions.filter((session) => !session.NowPlayingItem && session.UserId);
  return (
    <div className="space-y-8">
      <section aria-labelledby="playing-title">
        <h2 id="playing-title" className="mb-3 text-title">
          {t("Playing now")} <span className="text-on-surface-muted">({playing.length})</span>
        </h2>
        {playing.length ? (
          <ul className="grid gap-3 xl:grid-cols-2">
            {playing.map((session) => (
              <SessionCard key={session.Id} session={session} />
            ))}
          </ul>
        ) : (
          <p className="text-body-md text-on-surface-muted">{t("Nobody is watching right now.")}</p>
        )}
      </section>
      {idle.length > 0 && (
        <section aria-labelledby="idle-title">
          <h2 id="idle-title" className="mb-3 text-title">
            {t("Recently active")} <span className="text-on-surface-muted">({idle.length})</span>
          </h2>
          <ul className="grid gap-3 xl:grid-cols-2">
            {idle.map((session) => (
              <SessionCard key={session.Id} session={session} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
