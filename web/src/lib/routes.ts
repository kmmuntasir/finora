import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";

export function itemHref(item: BaseItemDto): string {
  return `/items/${item.Id}`;
}

export function libraryHref(view: BaseItemDto): string {
  return `/libraries/${view.Id}`;
}
