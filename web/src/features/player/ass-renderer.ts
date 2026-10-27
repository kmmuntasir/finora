import { useEffect, useRef, useState, type RefObject } from "react";
import fallbackFont from "@/assets/fonts/solaimanlipi-normal.woff2?url";

interface AssRendererOptions {
  /** Original ASS/SSA URL of the selected track, or null when none is selected. */
  assUrl: string | null;
  /** Fonts embedded in the video file. */
  fontUrls: string[];
  /** Seconds; positive shows subtitles later (same meaning as the timing menu). */
  offset: number;
}

type Instance = { destroy: () => Promise<void> | void; timeOffset: number };

/**
 * Renders ASS/SSA subtitles with JASSUB (libass in WebAssembly) on top of the
 * video, keeping their styling and positioning. JASSUB is loaded only when an
 * ASS track is shown. Returns whether it is active; when it isn't (old
 * browser, load failure), the caller keeps showing the WebVTT version.
 */
export function useAssRenderer(
  videoRef: RefObject<HTMLVideoElement | null>,
  { assUrl, fontUrls, offset }: AssRendererOptions,
): boolean {
  // The URL JASSUB is currently showing; the instance itself lives in a ref.
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const rendererRef = useRef<Instance | null>(null);
  const fontKey = fontUrls.join("\n");
  const offsetRef = useRef(offset);

  useEffect(() => {
    const video = videoRef.current;
    if (!assUrl || !video) return;
    let cancelled = false;
    let renderer: Instance | null = null;
    void (async () => {
      try {
        // Fonts are fetched up front and handed over as bytes, so they are in
        // place before the first frame (given URLs, JASSUB loads them later and
        // the first lines flash in the wrong font).
        const [{ default: JASSUB }, fonts] = await Promise.all([
          import("jassub"),
          Promise.all(
            [fallbackFont, ...(fontKey ? fontKey.split("\n") : [])].map(async (url) => {
              try {
                const response = await fetch(url);
                return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
              } catch {
                return null;
              }
            }),
          ),
        ]);
        if (cancelled) return;
        const created = new JASSUB({
          video,
          subUrl: assUrl,
          // SolaimanLipi (Latin and Bengali) is preloaded and is the default font:
          // libass uses it for fonts the subtitle names but neither the file nor
          // Finora provides. The family name must match the one inside the font
          // file ("SolaimanLipi Normal").
          fonts: fonts.filter((font): font is Uint8Array<ArrayBuffer> => font !== null),
          defaultFont: "solaimanlipi normal",
          // Everything needed is provided above; local font lookups need a
          // permission prompt and online lookups would contact Google Fonts.
          queryFonts: false,
        });
        renderer = created as unknown as Instance;
        await created.ready;
        if (cancelled) {
          void renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        renderer.timeOffset = -offsetRef.current;
        setActiveUrl(assUrl);
      } catch {
        // Unsupported browser or blocked worker: the WebVTT track stays in use.
        if (renderer) void renderer.destroy();
        renderer = null;
      }
    })();
    return () => {
      cancelled = true;
      rendererRef.current = null;
      setActiveUrl(null);
      if (renderer) void renderer.destroy();
    };
  }, [videoRef, assUrl, fontKey]);

  // JASSUB draws at mediaTime + timeOffset; a later subtitle means an earlier draw time.
  useEffect(() => {
    offsetRef.current = offset;
    if (rendererRef.current) rendererRef.current.timeOffset = -offset;
  }, [offset]);

  return activeUrl !== null && activeUrl === assUrl;
}
