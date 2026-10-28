export type ArtworkShape = "poster" | "landscape" | "square";

export const ASPECT: Record<ArtworkShape, string> = {
  poster: "aspect-[2/3]",
  landscape: "aspect-video",
  square: "aspect-square",
};
