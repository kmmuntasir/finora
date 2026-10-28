import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-2 text-on-surface-muted", className)}
    >
      <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
      <span className="sr-only">{label ?? t("Loading")}</span>
    </span>
  );
}
