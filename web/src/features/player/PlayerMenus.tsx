import type { ChapterInfo } from "@jellyfin/sdk/lib/generated-client/models";
import { AudioLines, Captions, Check, ListVideo, Settings } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { offsetLabel, SUBTITLE_OFFSETS } from "./subtitle-timing";
import type { ReactNode } from "react";
import type { AudioTrack, SubtitleTrack } from "./playback";
import { BITRATE_OPTIONS, formatClock } from "./player-preferences";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const CONTENT =
  "z-[60] max-h-[min(60vh,26rem)] min-w-56 overflow-y-auto rounded-lg bg-surface-overlay/95 p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.6)] ring-1 ring-border backdrop-blur";
const ITEM =
  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body-sm outline-none select-none data-[highlighted]:bg-white/10";
const LABEL = "px-3 pt-2 pb-1 text-label-sm text-on-surface-subtle";

export const CONTROL_BUTTON =
  "grid size-11 place-items-center rounded-full text-white transition-colors duration-[120ms] hover:bg-white/15 data-[state=open]:bg-white/15";

function Indicator() {
  return (
    <span className="grid size-4 shrink-0 place-items-center">
      <DropdownMenu.ItemIndicator>
        <Check aria-hidden className="size-4 text-primary" />
      </DropdownMenu.ItemIndicator>
    </span>
  );
}

function Menu({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger aria-label={label} title={label} className={CONTROL_BUTTON}>
        {icon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="end" sideOffset={10} className={CONTENT}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Chapter list; the current chapter is checked. */
export function ChapterMenu({
  chapters,
  current,
  onSeek,
}: {
  chapters: ChapterInfo[];
  current: number;
  onSeek: (seconds: number) => void;
}) {
  if (chapters.length < 2) return null;
  const starts = chapters.map((chapter) => (chapter.StartPositionTicks ?? 0) / 10_000_000);
  const active = starts.findLastIndex((start) => start <= current + 0.5);
  return (
    <Menu label="Chapters" icon={<ListVideo aria-hidden className="size-6" />}>
      <DropdownMenu.Label className={LABEL}>Chapters</DropdownMenu.Label>
      <div className="max-h-[50vh] overflow-y-auto">
        <DropdownMenu.RadioGroup
          value={String(active)}
          onValueChange={(value) => onSeek(starts[Number(value)] ?? 0)}
        >
          {chapters.map((chapter, index) => (
            <DropdownMenu.RadioItem key={index} value={String(index)} className={ITEM}>
              <Indicator />
              <span className="min-w-0 flex-1 truncate">
                {chapter.Name || `Chapter ${index + 1}`}
              </span>
              <span className="text-caption text-on-surface-subtle tabular-nums">
                {formatClock(starts[index]!)}
              </span>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </div>
    </Menu>
  );
}

export function SubtitleMenu({
  tracks,
  selected,
  onSelect,
}: {
  tracks: SubtitleTrack[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  if (!tracks.length) return null;
  return (
    <Menu label="Subtitles" icon={<Captions aria-hidden className="size-6" />}>
      <DropdownMenu.Label className={LABEL}>Subtitles</DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={String(selected)}
        onValueChange={(value) => onSelect(Number(value))}
      >
        <DropdownMenu.RadioItem value="-1" className={ITEM}>
          <Indicator />
          Off
        </DropdownMenu.RadioItem>
        {tracks.map((track) => (
          <DropdownMenu.RadioItem key={track.index} value={String(track.index)} className={ITEM}>
            <Indicator />
            <span className="min-w-0 flex-1 truncate">{track.label}</span>
            {track.url === null && (
              <span className="text-caption text-on-surface-subtle">burn-in</span>
            )}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </Menu>
  );
}

export function AudioMenu({
  tracks,
  selected,
  onSelect,
}: {
  tracks: AudioTrack[];
  selected: number | undefined;
  onSelect: (index: number) => void;
}) {
  if (tracks.length < 2) return null;
  return (
    <Menu label="Audio" icon={<AudioLines aria-hidden className="size-6" />}>
      <DropdownMenu.Label className={LABEL}>Audio</DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={String(selected)}
        onValueChange={(value) => onSelect(Number(value))}
      >
        {tracks.map((track) => (
          <DropdownMenu.RadioItem key={track.index} value={String(track.index)} className={ITEM}>
            <Indicator />
            <span className="min-w-0 flex-1 truncate">{track.label}</span>
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </Menu>
  );
}

export function SettingsMenu({
  bitrate,
  onBitrate,
  speed,
  onSpeed,
  autoplayNext,
  onAutoplayNext,
  showAutoplay,
  onShowInfo,
  subtitleOffset,
  onSubtitleOffset,
  showSubtitleOffset,
}: {
  bitrate: number;
  onBitrate: (value: number) => void;
  speed: number;
  onSpeed: (value: number) => void;
  autoplayNext: boolean;
  onAutoplayNext: (value: boolean) => void;
  showAutoplay: boolean;
  onShowInfo: () => void;
  subtitleOffset: number;
  onSubtitleOffset: (value: number) => void;
  showSubtitleOffset: boolean;
}) {
  return (
    <Menu label="Settings" icon={<Settings aria-hidden className="size-6" />}>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger className={ITEM}>
          <span className="flex-1">Quality</span>
          <span className="text-on-surface-muted">
            {BITRATE_OPTIONS.find((o) => o.value === bitrate)?.label ?? "Custom"}
          </span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent sideOffset={6} className={CONTENT}>
            <DropdownMenu.RadioGroup
              value={String(bitrate)}
              onValueChange={(value) => onBitrate(Number(value))}
            >
              {BITRATE_OPTIONS.map((option) => (
                <DropdownMenu.RadioItem
                  key={option.value}
                  value={String(option.value)}
                  className={ITEM}
                >
                  <Indicator />
                  {option.label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
      {showSubtitleOffset && (
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger className={ITEM}>
            <span className="flex-1">Subtitle timing</span>
            <span className="text-on-surface-muted">
              {subtitleOffset === 0
                ? "In sync"
                : `${subtitleOffset > 0 ? "+" : ""}${subtitleOffset} s`}
            </span>
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent sideOffset={6} className={CONTENT}>
              <DropdownMenu.Label className={LABEL}>Keys: G earlier, H later</DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                value={String(subtitleOffset)}
                onValueChange={(value) => onSubtitleOffset(Number(value))}
              >
                {(SUBTITLE_OFFSETS.includes(subtitleOffset)
                  ? SUBTITLE_OFFSETS
                  : [...SUBTITLE_OFFSETS, subtitleOffset].sort((a, b) => a - b)
                ).map((value) => (
                  <DropdownMenu.RadioItem key={value} value={String(value)} className={ITEM}>
                    <Indicator />
                    {offsetLabel(value)}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      )}
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger className={ITEM}>
          <span className="flex-1">Speed</span>
          <span className="text-on-surface-muted">{speed === 1 ? "Normal" : `${speed}×`}</span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent sideOffset={6} className={CONTENT}>
            <DropdownMenu.RadioGroup
              value={String(speed)}
              onValueChange={(value) => onSpeed(Number(value))}
            >
              {SPEEDS.map((value) => (
                <DropdownMenu.RadioItem key={value} value={String(value)} className={ITEM}>
                  <Indicator />
                  {value === 1 ? "Normal" : `${value}×`}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
      {showAutoplay && (
        <DropdownMenu.CheckboxItem
          checked={autoplayNext}
          onCheckedChange={onAutoplayNext}
          className={ITEM}
        >
          <Indicator />
          Autoplay next episode
        </DropdownMenu.CheckboxItem>
      )}
      <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
      <DropdownMenu.Item onSelect={onShowInfo} className={ITEM}>
        <span className="size-4" />
        Playback info
      </DropdownMenu.Item>
    </Menu>
  );
}
