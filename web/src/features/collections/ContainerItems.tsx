import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { GripVertical, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { wideArtwork } from "@/api/images";
import { Button } from "@/components/Button";
import { Artwork } from "@/components/media/Artwork";
import { PosterCard } from "@/components/media/cards";
import { Spinner } from "@/components/Spinner";
import { playHref } from "@/features/item/selection";
import { formatClock } from "@/features/player/player-preferences";
import { useQueue } from "@/features/music/queue-store";
import { trackArt } from "@/features/music/stream-url";
import { cardSubtitle, cardTitle } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  useCanManageCollections,
  useMovePlaylistItem,
  usePlaylistEditable,
  usePlaylistItems,
  useRemoveFromContainer,
} from "./api";
import { t } from "@/i18n";

/** Playlist contents in playlist order; owners can drag to reorder and remove entries. */
export function PlaylistItems({ playlist }: { playlist: BaseItemDto }) {
  const items = usePlaylistItems(playlist);
  const editable = usePlaylistEditable(playlist).data ?? false;
  const move = useMovePlaylistItem(playlist);
  const remove = useRemoveFromContainer(playlist);
  const navigate = useNavigate();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (items.isPending) return <Spinner />;
  if (items.isError)
    return (
      <p role="alert" className="text-body-md text-error">
        {t("Couldn't load this playlist.")}
      </p>
    );
  const list = items.data;
  if (!list.length)
    return <p className="text-body-md text-on-surface-muted">{t("This playlist is empty.")}</p>;

  const play = (index: number) => {
    const item = list[index]!;
    if (item.MediaType === "Audio") {
      const audio = list.filter((entry) => entry.MediaType === "Audio");
      useQueue.getState().play(audio, audio.indexOf(item));
    } else {
      void navigate(playHref(item, {}, false, playlist.Id!));
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const from = list.findIndex((item) => item.PlaylistItemId === event.active.id);
    const to = list.findIndex((item) => item.PlaylistItemId === event.over!.id);
    if (from < 0 || to < 0) return;
    move.mutate({ from, to }, { onError: () => toast.error(t("Couldn't reorder the playlist.")) });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={list.map((item) => item.PlaylistItemId ?? item.Id!)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="divide-y divide-border/60 rounded-lg bg-surface">
          {list.map((item, index) => (
            <PlaylistRow
              key={item.PlaylistItemId ?? item.Id}
              item={item}
              editable={editable}
              onPlay={() => play(index)}
              onRemove={() =>
                remove.mutate([item], {
                  onSuccess: () => toast.success(t("Removed “{name}”.", { name: item.Name ?? "" })),
                  onError: () => toast.error(t("Couldn't remove it.")),
                })
              }
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function PlaylistRow({
  item,
  editable,
  onPlay,
  onRemove,
}: {
  item: BaseItemDto;
  editable: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const id = item.PlaylistItemId ?? item.Id!;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editable,
  });
  const audio = item.MediaType === "Audio";
  const wide = wideArtwork(item);
  const subtitle = audio ? item.Artists?.join(", ") || item.AlbumArtist : cardSubtitle(item);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 px-2 py-2 hover:bg-white/5 light:hover:bg-black/5",
        isDragging && "relative z-10 bg-surface-overlay shadow-lg",
      )}
    >
      {editable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t("Reorder {name}", { name: item.Name ?? "" })}
          className="grid size-8 shrink-0 cursor-grab touch-none place-items-center text-on-surface-subtle active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onPlay}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={t("Play {title}", { title: cardTitle(item) })}
      >
        <Artwork
          image={audio ? trackArt(item) : wide.image}
          letterbox={!audio && wide.letterbox}
          shape={audio ? "square" : "landscape"}
          width={audio ? 48 : 112}
          title={item.Name ?? ""}
          className={cn("shrink-0 rounded-sm", audio ? "w-12" : "w-24 md:w-28")}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-md">{cardTitle(item)}</span>
          {subtitle && (
            <span className="block truncate text-caption text-on-surface-muted">{subtitle}</span>
          )}
        </span>
        <span className="text-caption text-on-surface-muted tabular-nums">
          {item.RunTimeTicks ? formatClock(item.RunTimeTicks / 10_000_000) : ""}
        </span>
      </button>
      {editable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("Remove {name} from playlist", { name: item.Name ?? "" })}
          title={t("Remove")}
          className="grid size-8 shrink-0 place-items-center rounded-full text-on-surface-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-error focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </li>
  );
}

/** Collection contents as posters; collection managers can switch to editing to remove items. */
export function CollectionItems({
  collection,
  items,
}: {
  collection: BaseItemDto;
  items: BaseItemDto[];
}) {
  const canManage = useCanManageCollections();
  const remove = useRemoveFromContainer(collection);
  const [editing, setEditing] = useState(false);

  return (
    <div>
      {canManage && items.length > 0 && (
        <Button
          size="sm"
          variant={editing ? "primary" : "secondary"}
          className="mb-4"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? (
            t("Done")
          ) : (
            <>
              <Pencil aria-hidden className="size-4" />
              {t("Edit collection")}
            </>
          )}
        </Button>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-6 md:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        {items.map((child) => (
          <div key={child.Id} className="relative">
            <PosterCard item={child} />
            {editing && (
              <button
                type="button"
                onClick={() =>
                  remove.mutate([child], {
                    onSuccess: () =>
                      toast.success(
                        t("Removed “{name}” from the collection.", { name: child.Name ?? "" }),
                      ),
                    onError: () => toast.error(t("Couldn't remove it.")),
                  })
                }
                aria-label={t("Remove {name} from collection", { name: child.Name ?? "" })}
                className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-scrim text-on-surface ring-1 ring-white/20 hover:bg-error hover:text-background"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
