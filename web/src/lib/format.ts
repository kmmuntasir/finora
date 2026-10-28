import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { currentLanguage, languageLocale, t } from "@/i18n";

const TICKS_PER_MINUTE = 600_000_000;

export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return t("{minutes} min", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? t("{hours} h {minutes} min", { hours, minutes: rest }) : t("{hours} h", { hours });
}

export function runtime(item: BaseItemDto): string | null {
  return item.RunTimeTicks ? formatMinutes(item.RunTimeTicks / TICKS_PER_MINUTE) : null;
}

/** "32 min left" for partially watched items. */
export function timeLeft(item: BaseItemDto): string | null {
  const total = item.RunTimeTicks;
  const position = item.UserData?.PlaybackPositionTicks;
  if (!total || !position) return null;
  return t("{time} left", { time: formatMinutes((total - position) / TICKS_PER_MINUTE) });
}

/** Watched fraction between 0 and 1, or null when not started. */
export function progress(item: BaseItemDto): number | null {
  const percentage = item.UserData?.PlayedPercentage;
  if (!percentage || percentage <= 0) return null;
  return Math.min(1, percentage / 100);
}

/** "S2:E5" for episodes. */
export function episodeCode(item: BaseItemDto): string | null {
  if (item.Type !== "Episode") return null;
  const season = item.ParentIndexNumber;
  const episode = item.IndexNumber;
  if (season == null || episode == null) return null;
  return `S${season}:E${episode}`;
}

/** Card title: series name for episodes, item name otherwise. */
export function cardTitle(item: BaseItemDto): string {
  return (item.Type === "Episode" ? item.SeriesName : item.Name) ?? item.Name ?? t("Untitled");
}

/** Secondary line for cards. */
export function cardSubtitle(item: BaseItemDto): string | null {
  if (item.Type === "Episode") {
    const code = episodeCode(item);
    return [code, item.Name].filter(Boolean).join(" · ") || null;
  }
  if (item.Type === "MusicAlbum") return item.AlbumArtist ?? null;
  if (item.Type === "Series") {
    const start = item.ProductionYear;
    if (!start) return null;
    return item.Status === "Continuing" ? `${start}–` : String(start);
  }
  return item.ProductionYear ? String(item.ProductionYear) : null;
}

/** Second line for Continue Watching: episode code and time left. */
export function continueSubtitle(item: BaseItemDto): string | null {
  return (
    [item.Type === "Episode" ? cardSubtitle(item) : null, timeLeft(item)]
      .filter(Boolean)
      .join(" · ") || null
  );
}

/** "3 hours ago", "2 days ago"; "Never" for missing dates. */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return t("Never");
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  // English follows the browser (as before); other interface languages use their own.
  const language = currentLanguage();
  const format = new Intl.RelativeTimeFormat(
    language === "en" ? undefined : languageLocale(language),
    {
      numeric: "auto",
    },
  );
  for (const [unit, size] of units) {
    // Round towards zero: 18 months ago reads as "last year", not "2 years ago".
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit);
  }
  return t("Just now");
}

/** Locale for dates and numbers from Settings; undefined follows the browser. */
let displayLocale: string | undefined;

export function setDisplayLocale(locale: string | undefined): void {
  displayLocale = locale && locale !== "auto" ? locale : undefined;
}

/** "28 Oct 2026" style dates in the chosen locale. */
export function formatDate(
  value: string | Date | null | undefined,
  style: "date" | "datetime" = "date",
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(displayLocale, {
    dateStyle: "medium",
    ...(style === "datetime" ? { timeStyle: "short" } : {}),
  }).format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(displayLocale).format(value);
}
