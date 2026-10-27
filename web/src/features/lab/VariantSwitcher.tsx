import { useSearchParams } from "react-router";
import { cn } from "@/lib/cn";

export interface Variant {
  id: string;
  name: string;
}

/** Floating switcher for comparing prototype variants (prototype round only). */
export function useVariant(variants: Variant[]) {
  const [params, setParams] = useSearchParams();
  const current = variants.find((variant) => variant.id === params.get("v")) ?? variants[0]!;
  const switcher = (
    <div
      role="radiogroup"
      aria-label="Prototype variant"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full bg-surface-overlay/95 p-1 shadow-[0_8px_24px_rgb(0_0_0/0.5)] ring-1 ring-border backdrop-blur"
    >
      {variants.map((variant) => (
        <button
          key={variant.id}
          type="button"
          role="radio"
          aria-checked={variant.id === current.id}
          onClick={() => setParams({ v: variant.id }, { replace: true })}
          className={cn(
            "rounded-full px-4 py-2 text-label-sm transition-colors duration-[120ms]",
            variant.id === current.id
              ? "bg-primary text-on-primary"
              : "text-on-surface-muted hover:text-on-surface",
          )}
        >
          {variant.id.toUpperCase()} · {variant.name}
        </button>
      ))}
    </div>
  );
  return { current, switcher };
}
