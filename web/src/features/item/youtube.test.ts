import { describe, expect, it } from "vitest";
import { youtubeId } from "./youtube";

describe("youtubeId", () => {
  it("reads the common URL shapes", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
    expect(youtubeId("https://youtu.be/xyz")).toBe("xyz");
    expect(youtubeId("https://www.youtube.com/embed/q-1_2")).toBe("q-1_2");
    expect(youtubeId("https://vimeo.com/1")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
  });
});
