import markUrl from "@/assets/brand/finora-mark.svg";
import wordmarkWhiteUrl from "@/assets/brand/finora-wordmark-white.svg";
import wordmarkUrl from "@/assets/brand/finora-wordmark.svg";
import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  /** Show the wordmark next to the mark. */
  withWordmark?: boolean;
}

export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img src={markUrl} alt={withWordmark ? "" : "Finora"} className="h-8 w-auto" />
      {withWordmark && (
        <>
          <img src={wordmarkWhiteUrl} alt="Finora" className="h-5 w-auto light:hidden" />
          <img src={wordmarkUrl} alt="Finora" className="hidden h-5 w-auto light:block" />
        </>
      )}
    </span>
  );
}
