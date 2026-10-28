import type { Api } from "@jellyfin/sdk";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canQuickPlay, resolvePlayTarget } from "./play-target";

const tv = { getNextUp: vi.fn(), getEpisodes: vi.fn() };
vi.mock("@jellyfin/sdk/lib/utils/api/tv-shows-api", () => ({ getTvShowsApi: () => tv }));

const api = {} as Api;
const episode = (id: string, played: boolean): BaseItemDto => ({
  Id: id,
  Type: "Episode",
  MediaType: "Video",
  UserData: { Played: played },
});

describe("canQuickPlay", () => {
  it("allows videos, series and seasons but not music or missing episodes", () => {
    expect(canQuickPlay({ Type: "Movie", MediaType: "Video" })).toBe(true);
    expect(canQuickPlay({ Type: "Series" })).toBe(true);
    expect(canQuickPlay({ Type: "Season" })).toBe(true);
    expect(canQuickPlay({ Type: "MusicAlbum" })).toBe(false);
    expect(canQuickPlay({ Type: "Episode", MediaType: "Video", LocationType: "Virtual" })).toBe(
      false,
    );
  });
});

describe("resolvePlayTarget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("plays a video itself", async () => {
    const movie: BaseItemDto = { Id: "m1", Type: "Movie", MediaType: "Video" };
    expect(await resolvePlayTarget(api, "u", movie)).toBe(movie);
    expect(tv.getEpisodes).not.toHaveBeenCalled();
  });

  it("plays a series' next-up episode", async () => {
    tv.getNextUp.mockResolvedValue({ data: { Items: [episode("e5", false)] } });
    expect((await resolvePlayTarget(api, "u", { Id: "s1", Type: "Series" }))?.Id).toBe("e5");
  });

  it("falls back to the first episode of a fully watched series", async () => {
    tv.getNextUp.mockResolvedValue({ data: { Items: [] } });
    tv.getEpisodes.mockResolvedValue({
      data: { Items: [episode("e1", true), episode("e2", true)] },
    });
    expect((await resolvePlayTarget(api, "u", { Id: "s1", Type: "Series" }))?.Id).toBe("e1");
  });

  it("plays a season's first unwatched episode", async () => {
    tv.getEpisodes.mockResolvedValue({
      data: { Items: [episode("e1", true), episode("e2", false), episode("e3", false)] },
    });
    const target = await resolvePlayTarget(api, "u", { Id: "sn2", Type: "Season", SeriesId: "s1" });
    expect(target?.Id).toBe("e2");
    expect(tv.getNextUp).not.toHaveBeenCalled();
    expect(tv.getEpisodes).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: "s1", seasonId: "sn2", isMissing: false }),
    );
  });
});
