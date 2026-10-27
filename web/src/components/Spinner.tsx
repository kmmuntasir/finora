import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-2 text-on-surface-muted", className)}
    >
      <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
