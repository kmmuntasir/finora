import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { describe, expect, it } from "vitest";
import { backdropImage, imageUrl, landscapeImage, posterImage, wideArtwork } from "./images";

const movie: BaseItemDto = {
  Id: "m1",
  Type: "Movie",
  ImageTags: { Primary: "p", Thumb: "t" },
  BackdropImageTags: ["b"],
};

const episode: BaseItemDto = {
  Id: "e1",
  Type: "Episode",
  SeriesId: "s1",
  SeriesPrimaryImageTag: "sp",
  ImageTags: { Primary: "ep" },
  ParentBackdropItemId: "s1",
  ParentBackdropImageTags: ["sb"],
};

describe("image selection", () => {
  it("uses the series poster for episodes", () => {
    expect(posterImage(episode)).toEqual({ itemId: "s1", kind: "Primary", tag: "sp" });
    expect(posterImage(movie)).toEqual({ itemId: "m1", kind: "Primary", tag: "p" });
  });

  it("falls back to the parent backdrop", () => {
    expect(backdropImage(movie)).toEqual({ itemId: "m1", kind: "Backdrop", tag: "b" });
    expect(backdropImage(episode)).toEqual({ itemId: "s1", kind: "Backdrop", tag: "sb" });
    expect(backdropImage({ Id: "x", Type: "Movie" })).toBeNull();
  });

  it("prefers frame grabs for episodes and thumbs for films", () => {
    expect(landscapeImage(episode)).toEqual({ itemId: "e1", kind: "Primary", tag: "ep" });
    expect(landscapeImage(movie)).toEqual({ itemId: "m1", kind: "Thumb", tag: "t" });
  });

  it("builds resized image URLs", () => {
    expect(imageUrl("http://h", { itemId: "m1", kind: "Primary", tag: "p" }, 300.4)).toBe(
      "http://h/Items/m1/Images/Primary?tag=p&maxWidth=300&quality=90",
    );
  });
});

describe("wideArtwork", () => {
  it("falls back to the Primary image, letterboxed", () => {
    const bare: BaseItemDto = { Id: "x", Type: "Movie", ImageTags: { Primary: "p" } };
    expect(wideArtwork(bare)).toEqual({
      image: { itemId: "x", kind: "Primary", tag: "p" },
      letterbox: true,
    });
    expect(wideArtwork(movie).letterbox).toBe(false);
    expect(wideArtwork(movie, true).image?.kind).toBe("Backdrop");
  });
});
