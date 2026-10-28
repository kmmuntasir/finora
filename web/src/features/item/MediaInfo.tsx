import type { MediaSourceInfo } from "@jellyfin/sdk/lib/generated-client/models";
import { t } from "@/i18n";

function formatSize(bytes: number | null | undefined): string | null {
  if (!bytes) return null;
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function formatBitrate(bps: number | null | undefined): string | null {
  if (!bps) return null;
  return bps >= 1_000_000
    ? `${(bps / 1_000_000).toFixed(1)} Mbps`
    : `${Math.round(bps / 1000)} kbps`;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-on-surface-muted">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
}

/** Technical details of the selected version, collapsed by default. */
export function MediaInfo({ source }: { source: MediaSourceInfo }) {
  const streams = source.MediaStreams ?? [];
  const video = streams.find((stream) => stream.Type === "Video");
  const audio = streams.filter((stream) => stream.Type === "Audio");
  const subtitles = streams.filter((stream) => stream.Type === "Subtitle");

  return (
    <details className="group rounded-lg bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 text-label-md select-none marker:hidden">
        <span className="inline-block transition-transform duration-150 group-open:rotate-90">
          ›
        </span>{" "}
        {t("Media info")}
      </summary>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 pb-5 text-body-sm">
        <Row label={t("File")} value={source.Path?.split(/[\\/]/).pop()} />
        <Row label={t("Container")} value={source.Container?.toUpperCase()} />
        <Row label={t("Size")} value={formatSize(source.Size)} />
        <Row label={t("Bitrate")} value={formatBitrate(source.Bitrate)} />
        <Row
          label={t("Video")}
          value={
            video
              ? [
                  video.DisplayTitle ?? video.Codec?.toUpperCase(),
                  video.Width && video.Height ? `${video.Width}×${video.Height}` : null,
                  video.VideoRange,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null
          }
        />
        {audio.map((stream) => (
          <Row key={stream.Index} label={t("Audio")} value={stream.DisplayTitle} />
        ))}
        {subtitles.map((stream) => (
          <Row
            key={stream.Index}
            label={t("Subtitle")}
            value={
              stream.IsExternal
                ? t("{title} (external)", { title: stream.DisplayTitle ?? "" })
                : (stream.DisplayTitle ?? "")
            }
          />
        ))}
      </dl>
    </details>
  );
}
