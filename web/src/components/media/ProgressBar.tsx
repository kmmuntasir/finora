import { cn } from "@/lib/cn";
import { t } from "@/i18n";

/** Playback progress in the logo gradient. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={t("Watched")}
      className={cn("h-1 overflow-hidden rounded-full bg-white/20 light:bg-black/10", className)}
    >
      <div
        className="h-full rounded-full bg-linear-to-r from-brand-cyan to-brand-blue"
        style={{ width: `${Math.max(2, value * 100)}%` }}
      />
    </div>
  );
}
