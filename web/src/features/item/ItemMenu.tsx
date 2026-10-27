import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Download, FolderPlus, ListPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MENU_CONTENT, MENU_ITEM, MENU_SEPARATOR } from "@/components/menu";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";
import { AddToDialog } from "@/features/collections/AddToDialog";
import {
  useCanManageCollections,
  useDeleteItem,
  usePlaylistEditable,
  useRenamePlaylist,
} from "@/features/collections/api";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { canAddToCollection, canAddToPlaylist } from "@/features/collections/eligibility";

interface ItemMenuProps {
  item: BaseItemDto;
  className: string;
  /** Extra entries (for example admin actions), shown after a separator. */
  children?: ReactNode;
}

/** The "More" button on detail pages: playlists, collections, download and delete. */
export function ItemMenu({ item, className, children }: ItemMenuProps) {
  const { api, user } = useSession();
  const { config } = useRuntimeConfig();
  const navigate = useNavigate();
  const canManageCollections = useCanManageCollections();
  const remove = useDeleteItem();
  const [dialog, setDialog] = useState<"playlist" | "collection" | "delete" | "rename" | null>(
    null,
  );
  const renamable = usePlaylistEditable(item).data ?? false;

  const playlist = canAddToPlaylist(item);
  const collection = canManageCollections && canAddToCollection(item);
  const download = Boolean(user.Policy?.EnableContentDownloading && item.CanDownload);
  const deletable = Boolean(item.CanDelete);
  const isContainer = item.Type === "Playlist" || item.Type === "BoxSet";
  if (!playlist && !collection && !download && !deletable && !renamable && !children) return null;

  const downloadUrl = `${config.jellyfinUrl}/Items/${item.Id}/Download?ApiKey=${encodeURIComponent(api.accessToken)}`;

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger aria-label="More actions" title="More" className={className}>
          <MoreHorizontal aria-hidden className="size-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CONTENT}>
            {playlist && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("playlist")}>
                <ListPlus aria-hidden className="size-4" />
                Add to playlist…
              </DropdownMenu.Item>
            )}
            {collection && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("collection")}>
                <FolderPlus aria-hidden className="size-4" />
                Add to collection…
              </DropdownMenu.Item>
            )}
            {renamable && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("rename")}>
                <Pencil aria-hidden className="size-4" />
                Rename…
              </DropdownMenu.Item>
            )}
            {download && (
              <DropdownMenu.Item asChild className={MENU_ITEM}>
                {/* Jellyfin answers with Content-Disposition: attachment, so the page stays put. */}
                <a href={downloadUrl} rel="noreferrer">
                  <Download aria-hidden className="size-4" />
                  Download
                </a>
              </DropdownMenu.Item>
            )}
            {children && (
              <>
                <DropdownMenu.Separator className={MENU_SEPARATOR} />
                {children}
              </>
            )}
            {deletable && (
              <>
                <DropdownMenu.Separator className={MENU_SEPARATOR} />
                <DropdownMenu.Item
                  className={`${MENU_ITEM} text-error`}
                  onSelect={() => setDialog("delete")}
                >
                  <Trash2 aria-hidden className="size-4" />
                  {isContainer
                    ? `Delete ${item.Type === "Playlist" ? "playlist" : "collection"}…`
                    : "Delete from server…"}
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {(dialog === "playlist" || dialog === "collection") && (
        <AddToDialog
          kind={dialog}
          items={[item]}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      {dialog === "rename" && <RenameDialog playlist={item} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete “${item.Name}”?`}
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onConfirm={() =>
          remove.mutate(item.Id!, {
            onSuccess: () => {
              setDialog(null);
              toast.success(`Deleted “${item.Name}”.`);
              void navigate(-1);
            },
            onError: () => toast.error("Couldn't delete it."),
          })
        }
      >
        {isContainer
          ? "Its items stay in your library."
          : "The media files are deleted from the server's disk for everyone. This can't be undone."}
      </ConfirmDialog>
    </>
  );
}

function RenameDialog({ playlist, onClose }: { playlist: BaseItemDto; onClose: () => void }) {
  const rename = useRenamePlaylist(playlist);
  const [name, setName] = useState(playlist.Name ?? "");
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title="Rename playlist">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          rename.mutate(name.trim(), {
            onSuccess: () => {
              toast.success("Playlist renamed.");
              onClose();
            },
            onError: () => toast.error("Couldn't rename the playlist."),
          });
        }}
      >
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          maxLength={200}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || rename.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
