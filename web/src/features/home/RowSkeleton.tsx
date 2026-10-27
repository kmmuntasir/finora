import { cn } from "@/lib/cn";

const SHAPES = {
  poster: "w-32 md:w-40 aspect-[2/3]",
  landscape: "w-64 md:w-80 aspect-video",
  square: "w-36 md:w-44 aspect-square",
} as const;

export function RowSkeleton({ shape }: { shape: keyof typeof SHAPES }) {
  return (
    <div aria-hidden className="px-page-x-mobile md:px-page-x">
      <div className="mb-3 h-6 w-48 rounded-full bg-surface-raised" />
      <div className="flex gap-3 overflow-hidden md:gap-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className={cn(
              "shrink-0 animate-pulse rounded-md bg-surface-raised motion-reduce:animate-none",
              SHAPES[shape],
            )}
          />
        ))}
      </div>
    </div>
  );
}
