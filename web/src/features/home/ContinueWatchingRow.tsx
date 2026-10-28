import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { LandscapeCard } from "@/components/media/cards";
import { MediaRow } from "@/components/media/MediaRow";
import { continueSubtitle } from "@/lib/format";
import { t } from "@/i18n";

export function ContinueWatchingRow({ items, title }: { items: BaseItemDto[]; title?: string }) {
  if (!items.length) return null;
  return (
    <MediaRow title={title ?? t("Continue watching")} itemClassName="w-64 md:w-80">
      {items.map((item) => (
        <LandscapeCard key={item.Id} item={item} subtitle={continueSubtitle(item)} />
      ))}
    </MediaRow>
  );
}
