/** Device-local player preferences. Server-synced settings arrive with the settings phase. */

export const BITRATE_OPTIONS = [
  { label: "Original", value: 120_000_000 },
  { label: "20 Mbps", value: 20_000_000 },
  { label: "10 Mbps", value: 10_000_000 },
  { label: "8 Mbps", value: 8_000_000 },
  { label: "4 Mbps", value: 4_000_000 },
  { label: "2 Mbps", value: 2_000_000 },
  { label: "1 Mbps", value: 1_000_000 },
] as const;

interface PlayerPreferences {
  maxBitrate: number;
  volume: number;
  muted: boolean;
  autoplayNext: boolean;
}

const KEY = "finora.player";
const DEFAULTS: PlayerPreferences = {
  maxBitrate: 120_000_000,
  volume: 1,
  muted: false,
  autoplayNext: true,
};

export function readPlayerPreferences(): PlayerPreferences {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(KEY) ?? "{}",
    ) as Partial<PlayerPreferences>;
    return {
      maxBitrate: typeof saved.maxBitrate === "number" ? saved.maxBitrate : DEFAULTS.maxBitrate,
      volume:
        typeof saved.volume === "number" ? Math.min(1, Math.max(0, saved.volume)) : DEFAULTS.volume,
      muted: typeof saved.muted === "boolean" ? saved.muted : DEFAULTS.muted,
      autoplayNext:
        typeof saved.autoplayNext === "boolean" ? saved.autoplayNext : DEFAULTS.autoplayNext,
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePlayerPreferences(changes: Partial<PlayerPreferences>): void {
  window.localStorage.setItem(KEY, JSON.stringify({ ...readPlayerPreferences(), ...changes }));
}

/** 3725 → "1:02:05"; 65 → "1:05". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
