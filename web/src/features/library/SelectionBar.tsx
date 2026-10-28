import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { getPlaystateApi } from "@jellyfin/sdk/lib/utils/api/playstate-api";
import { getUserLibraryApi } from "@jellyfin/sdk/lib/utils/api/user-library-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FolderPlus, Heart, ListPlus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useSession } from "@/features/auth/context";
import { AddToDialog } from "@/features/collections/AddToDialog";
import { useCanManageCollections } from "@/features/collections/api";
import { t, tn } from "@/i18n";

type BulkAction = "played" | "unplayed" | "favorite";

/** Actions for the selected items, pinned to the bottom of the screen. */
export function SelectionBar({
  items,
  onClear,
  onDone,
}: {
  items: BaseItemDto[];
  onClear: () => void;
  onDone: () => void;
}) {
  const { api, user } = useSession();
  const queryClient = useQueryClient();
  const canManageCollections = useCanManageCollections();
  const [dialog, setDialog] = useState<"playlist" | "collection" | null>(null);

  const bulk = useMutation({
    mutationFn: async (action: BulkAction) => {
      const playstate = getPlaystateApi(api);
      const library = getUserLibraryApi(api);
      // One at a time: Jellyfin has no batch endpoint, and this keeps the server load gentle.
      for (const item of items) {
        const params = { itemId: item.Id!, userId: user.Id };
        if (action === "played") await playstate.markPlayedItem(params);
        else if (action === "unplayed") await playstate.markUnplayedItem(params);
        else await library.markFavoriteItem(params);
      }
    },
    onSuccess: (_data, action) => {
      const count = items.length;
      toast.success(
        action === "played"
          ? tn(count, "Marked {count} item as watched.", "Marked {count} items as watched.")
          : action === "unplayed"
            ? tn(count, "Marked {count} item as unwatched.", "Marked {count} items as unwatched.")
            : tn(count, "Added {count} item to favourites.", "Added {count} items to favourites."),
      );
      onDone();
    },
    onError: () => toast.error(t("Some items couldn't be updated.")),
    onSettled: () => {
      for (const prefix of ["library-items", "resume", "next-up", "item-details"]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }
    },
  });

  const disabled = items.length === 0 || bulk.isPending;
  return (
    <>
      <div
        role="toolbar"
        aria-label={t("Selected items")}
        className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-3xl items-center gap-0.5 rounded-xl bg-surface-overlay p-2 shadow-[0_12px_32px_rgb(0_0_0/0.5)] ring-1 ring-border md:bottom-6"
      >
        <span className="shrink-0 px-2 text-label-md tabular-nums sm:px-3" aria-live="polite">
          {items.length}
          <span className="max-sm:sr-only"> {t("selected")}</span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1">
          <BarButton
            icon={<Eye aria-hidden className="size-4" />}
            disabled={disabled}
            onClick={() => bulk.mutate("played")}
          >
            {t("Watched")}
          </BarButton>
          <BarButton
            icon={<EyeOff aria-hidden className="size-4" />}
            disabled={disabled}
            onClick={() => bulk.mutate("unplayed")}
          >
            {t("Unwatched")}
          </BarButton>
          <BarButton
            icon={<Heart aria-hidden className="size-4" />}
            disabled={disabled}
            onClick={() => bulk.mutate("favorite")}
          >
            {t("Favourite")}
          </BarButton>
          <BarButton
            icon={<ListPlus aria-hidden className="size-4" />}
            disabled={disabled}
            onClick={() => setDialog("playlist")}
          >
            {t("Playlist")}
          </BarButton>
          {canManageCollections && (
            <BarButton
              icon={<FolderPlus aria-hidden className="size-4" />}
              disabled={disabled}
              onClick={() => setDialog("collection")}
            >
              {t("Collection")}
            </BarButton>
          )}
        </span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="h-9 shrink-0 rounded-full px-2 text-label-md text-on-surface-muted hover:bg-surface-raised hover:text-on-surface sm:px-3"
          >
            {t("Clear")}
          </button>
        )}
        <button
          type="button"
          onClick={onDone}
          aria-label={t("Stop selecting")}
          className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-muted hover:bg-surface-raised hover:text-on-surface"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {dialog && (
        <AddToDialog
          kind={dialog}
          items={items}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          onDone={onDone}
        />
      )}
    </>
  );
}

function BarButton({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={typeof children === "string" ? children : undefined}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-label-md text-on-surface hover:bg-surface-raised disabled:opacity-40 sm:px-3"
    >
      {icon}
      <span className="max-sm:sr-only">{children}</span>
    </button>
  );
}
