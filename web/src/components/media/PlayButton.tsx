import { Play } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

/** The only element filled with the logo gradient (DESIGN.md, Components). */
export function PlayButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full bg-linear-to-r from-brand-cyan via-brand-blue to-brand-indigo pl-5 pr-6 text-label-md text-white",
        "shadow-[0_8px_24px_-8px_rgb(16_95_240/0.6)] transition-[filter,transform] duration-[120ms] hover:brightness-110 active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      <Play aria-hidden className="size-5 fill-current" />
      {label ?? t("Play")}
    </button>
  );
}
