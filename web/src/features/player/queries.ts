import { MediaSegmentType, type BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getMediaSegmentsApi } from "@jellyfin/sdk/lib/utils/api/media-segments-api";
import { getTvShowsApi } from "@jellyfin/sdk/lib/utils/api/tv-shows-api";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/context";

/** The episode after this one in the series, if any. */
export function useNextEpisode(item: BaseItemDto) {
  const { api, user } = useSession();
  return useQuery({
    queryKey: ["next-episode", user.Id, item.Id],
    enabled: item.Type === "Episode" && Boolean(item.SeriesId),
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const { data } = await getTvShowsApi(api).getEpisodes(
        {
          seriesId: item.SeriesId!,
          userId: user.Id,
          startItemId: item.Id!,
          limit: 2,
          enableUserData: true,
        },
        { signal },
      );
      const next = data.Items?.[1];
      return next && next.Id !== item.Id ? next : null;
    },
  });
}

export interface SkippableSegment {
  type: "Intro" | "Recap" | "Outro" | "Preview" | "Commercial";
  start: number;
  end: number;
}

/** Intro/recap/credits segments; empty when no segment provider plugin is installed. */
export function useSegments(itemId: string) {
  const { api } = useSession();
  return useQuery({
    queryKey: ["segments", itemId],
    staleTime: Infinity,
    queryFn: async ({ signal }): Promise<SkippableSegment[]> => {
      const { data } = await getMediaSegmentsApi(api).getItemSegments(
        {
          itemId,
          includeSegmentTypes: [
            MediaSegmentType.Intro,
            MediaSegmentType.Recap,
            MediaSegmentType.Outro,
            MediaSegmentType.Preview,
            MediaSegmentType.Commercial,
          ],
        },
        { signal },
      );
      return (data.Items ?? [])
        .filter((segment) => segment.Type && segment.Type !== "Unknown")
        .map((segment) => ({
          type: segment.Type as SkippableSegment["type"],
          start: (segment.StartTicks ?? 0) / 10_000_000,
          end: (segment.EndTicks ?? 0) / 10_000_000,
        }))
        .filter((segment) => segment.end > segment.start);
    },
  });
}
