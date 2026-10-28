import type { Api } from "@jellyfin/sdk";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";

/** Items a card's play button can start: any video, and series and seasons. */
export function canQuickPlay(item: BaseItemDto): boolean {
  if (item.LocationType === "Virtual") return false;
  return item.MediaType === "Video" || item.Type === "Series" || item.Type === "Season";
}

/**
 * The video a card's play button starts, chosen as jellyfin-web does
 * (playbackmanager.js, getSeriesOrSeasonPlaybackPromise): a series plays its
 * next-up episode, a season its first unwatched episode, else the first one.
 * The player resumes from the saved position by itself.
 */
export async function resolvePlayTarget(
  api: Api,
  userId: string,
  item: BaseItemDto,
): Promise<BaseItemDto | null> {
  if (item.Type !== "Series" && item.Type !== "Season") return item;
  const seriesId = item.Type === "Series" ? item.Id! : item.SeriesId!;
  const tv = getTvShowsApi(api);
  if (item.Type === "Series") {
    const nextUp = (await tv.getNextUp({ seriesId, userId, limit: 1 })).data.Items?.[0];
    if (nextUp) return nextUp;
  }
  const episodes =
    (
      await tv.getEpisodes({
        seriesId,
        seasonId: item.Type === "Season" ? item.Id! : undefined,
        userId,
        isMissing: false,
        enableUserData: true,
      })
    ).data.Items ?? [];
  return episodes.find((episode) => !episode.UserData?.Played) ?? episodes[0] ?? null;
}
