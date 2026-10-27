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
import { GripVertical, X } from "lucide-react";
import { Artwork } from "@/components/media/Artwork";
import { formatClock } from "@/features/player/player-preferences";
import { cn } from "@/lib/cn";
import { useQueue, type QueueEntry } from "./queue-store";
import { trackArt } from "./stream-url";

function Row({
  entry,
  position,
  current,
}: {
  entry: QueueEntry;
  position: number;
  current: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.key,
  });
  const { jumpTo, remove } = useQueue.getState();
  const item = entry.item;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 rounded-md px-1 py-1.5",
        current ? "bg-white/10" : "hover:bg-white/5",
        isDragging && "relative z-10 bg-surface-overlay shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.Name}`}
        className="grid size-8 shrink-0 cursor-grab place-items-center text-on-surface-subtle touch-none active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => jumpTo(position)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Artwork
          image={trackArt(item)}
          shape="square"
          width={40}
          title={item.Name ?? ""}
          className="w-10 shrink-0 rounded-sm"
        />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-label-md", current && "text-primary")}>
            {item.Name}
          </span>
          <span className="block truncate text-caption text-on-surface-muted">
            {item.Artists?.join(", ") || item.AlbumArtist}
          </span>
        </span>
        <span className="text-caption text-on-surface-muted tabular-nums">
          {item.RunTimeTicks ? formatClock(item.RunTimeTicks / 10_000_000) : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={() => remove(position)}
        aria-label={`Remove ${item.Name} from queue`}
        className="grid size-8 shrink-0 place-items-center rounded-full text-on-surface-subtle opacity-0 group-hover:opacity-100 hover:text-on-surface focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/** The play queue with drag-to-reorder (mouse, touch and keyboard). */
export function QueueList() {
  const queue = useQueue((state) => state.queue);
  const index = useQueue((state) => state.index);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = queue.findIndex((entry) => entry.key === active.id);
    const to = queue.findIndex((entry) => entry.key === over.id);
    if (from >= 0 && to >= 0) useQueue.getState().move(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={queue.map((entry) => entry.key)}
        strategy={verticalListSortingStrategy}
      >
        <ol aria-label="Queue" className="space-y-0.5">
          {queue.map((entry, position) => (
            <Row key={entry.key} entry={entry} position={position} current={position === index} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
