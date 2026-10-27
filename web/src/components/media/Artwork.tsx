import { useState } from "react";
import markUrl from "@/assets/brand/finora-mark.svg";
import { imageUrl, type ImageRef } from "@/api/images";
import { useRuntimeConfig } from "@/config/context";
import { cn } from "@/lib/cn";

export type ArtworkShape = "poster" | "landscape" | "square";

const ASPECT: Record<ArtworkShape, string> = {
  poster: "aspect-[2/3]",
  landscape: "aspect-video",
  square: "aspect-square",
};

interface ArtworkProps {
  image: ImageRef | null;
  shape: ArtworkShape;
  /** Rendered width in CSS pixels; the server resizes to this × device pixel ratio. */
  width: number;
  /** Title shown on the placeholder when there is no image. */
  title: string;
  className?: string;
  priority?: boolean;
  /**
   * Portrait artwork shown inside a landscape frame: the poster is centred on
   * a blurred copy of itself instead of being cropped.
   */
  letterbox?: boolean;
}

/** Server-resized artwork with a fade-in, and a branded placeholder when none exists. */
export function Artwork({
  image,
  shape,
  width,
  title,
  className,
  priority,
  letterbox,
}: ArtworkProps) {
  const { config } = useRuntimeConfig();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showImage = image && !failed;
  const density = Math.min(2, window.devicePixelRatio || 1);

  return (
    <div className={cn("relative overflow-hidden bg-surface-raised", ASPECT[shape], className)}>
      {showImage && letterbox ? (
        <>
          <img
            src={imageUrl(config.jellyfinUrl, image, 120)}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-xl"
          />
          <img
            src={imageUrl(config.jellyfinUrl, image, (width / 1.6) * density)}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              "relative mx-auto h-full w-auto object-contain shadow-[0_0_24px_rgb(0_0_0/0.5)] transition-opacity duration-200 ease-out",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : showImage ? (
        <img
          src={imageUrl(config.jellyfinUrl, image, width * density)}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "size-full object-cover transition-opacity duration-200 ease-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
          <img src={markUrl} alt="" className="w-1/4 max-w-12 opacity-40" />
          <span className="line-clamp-3 text-label-sm text-on-surface-subtle">{title}</span>
        </div>
      )}
    </div>
  );
}
