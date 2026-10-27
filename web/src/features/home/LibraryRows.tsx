import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { LandscapeCard, PosterCard } from "@/components/media/cards";
import { MediaRow } from "@/components/media/MediaRow";
import { RowSkeleton } from "./RowSkeleton";
import { useLatest, useNextUp, useResumeItems, useUserViews } from "./queries";

const LATEST_TYPES = new Set(["movies", "tvshows", "homevideos", "music"]);

function LatestRow({ view }: { view: BaseItemDto }) {
  const { data, isPending } = useLatest(view);
  const landscape = view.CollectionType === "homevideos";
  const itemClassName = landscape
    ? "w-64 md:w-72"
    : view.CollectionType === "music"
      ? "w-36 md:w-44"
      : "w-32 md:w-40";
  if (isPending)
    return (
      <RowSkeleton
        shape={landscape ? "landscape" : view.CollectionType === "music" ? "square" : "poster"}
      />
    );
  if (!data?.length) return null;
  return (
    <MediaRow
      title={`Recently added in ${view.Name}`}
      seeAllHref={`/libraries/${view.Id}`}
      itemClassName={itemClassName}
    >
      {data.map((item) =>
        landscape ? (
          <LandscapeCard key={item.Id} item={item} width={288} subtitle={null} />
        ) : (
          <PosterCard key={item.Id} item={item} />
        ),
      )}
    </MediaRow>
  );
}

export function NextUpRow({ title = "Next up" }: { title?: string }) {
  const { data, isPending } = useNextUp();
  const resume = useResumeItems();
  if (isPending) return <RowSkeleton shape="landscape" />;
  // Episodes already in Continue Watching would appear twice.
  const inProgress = new Set(resume.data?.map((item) => item.Id));
  const items = data?.filter((item) => !inProgress.has(item.Id)) ?? [];
  if (!items.length) return null;
  return (
    <MediaRow title={title} itemClassName="w-64 md:w-80">
      {items.map((item) => (
        <LandscapeCard key={item.Id} item={item} />
      ))}
    </MediaRow>
  );
}

/** "Recently added" rows for every browsable library the user can see. */
export function LatestRows() {
  const { data: views } = useUserViews();
  return (
    <>
      {views
        ?.filter((view) => LATEST_TYPES.has(view.CollectionType ?? ""))
        .map((view) => (
          <LatestRow key={view.Id} view={view} />
        ))}
    </>
  );
}
