import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import {
  Download,
  Link2,
  FileSearch,
  FolderPlus,
  ImageIcon,
  ListPlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  SquarePen,
  Trash2,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MENU_CONTENT, MENU_ITEM, MENU_SEPARATOR } from "@/components/menu";
import { useRuntimeConfig } from "@/config/context";
import { useSession } from "@/features/auth/context";
import { useAdminAccess } from "@/features/admin/access";
import { AddToDialog } from "@/features/collections/AddToDialog";
import { IDENTIFIABLE } from "@/features/item-admin/api";
import { IdentifyDialog } from "@/features/item-admin/IdentifyDialog";
import { ImageEditor } from "@/features/item-admin/ImageEditor";
import { MetadataEditor } from "@/features/item-admin/MetadataEditor";
import { RefreshDialog } from "@/features/item-admin/RefreshDialog";
import {
  useCanManageCollections,
  useDeleteItem,
  usePlaylistEditable,
  useRenamePlaylist,
} from "@/features/collections/api";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { TextField } from "@/components/TextField";
import { copyText } from "@/lib/clipboard";
import { canAddToCollection, canAddToPlaylist } from "@/features/collections/eligibility";
import { t } from "@/i18n";

interface ItemMenuProps {
  item: BaseItemDto;
  className: string;
}

type DialogName =
  "playlist" | "collection" | "delete" | "rename" | "refresh" | "metadata" | "images" | "identify";

/** The "More" button on detail pages: playlists, collections, download, admin tools and delete. */
export function ItemMenu({ item, className }: ItemMenuProps) {
  const { api, user } = useSession();
  const { config } = useRuntimeConfig();
  const navigate = useNavigate();
  const canManageCollections = useCanManageCollections();
  const remove = useDeleteItem();
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const admin = useAdminAccess().allowed;
  const renamable = usePlaylistEditable(item).data ?? false;

  const playlist = canAddToPlaylist(item);
  const collection = canManageCollections && canAddToCollection(item);
  const download = Boolean(user.Policy?.EnableContentDownloading && item.CanDownload);
  const deletable = Boolean(item.CanDelete);
  const isContainer = item.Type === "Playlist" || item.Type === "BoxSet";
  // For VLC and other players: the original file, untouched (like Jellyfin's "Copy stream URL").
  const streamable =
    Boolean(item.MediaSources?.length) &&
    (item.MediaType === "Video" || item.MediaType === "Audio");
  if (!playlist && !collection && !download && !deletable && !renamable && !admin && !streamable)
    return null;

  const streamUrl = `${config.jellyfinUrl}/${item.MediaType === "Audio" ? "Audio" : "Videos"}/${item.Id}/stream?static=true&mediaSourceId=${item.MediaSources?.[0]?.Id ?? item.Id}&ApiKey=${encodeURIComponent(api.accessToken)}`;
  const downloadUrl = `${config.jellyfinUrl}/Items/${item.Id}/Download?ApiKey=${encodeURIComponent(api.accessToken)}`;

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={t("More actions")}
          title={t("More")}
          className={className}
        >
          <MoreHorizontal aria-hidden className="size-5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className={MENU_CONTENT}>
            {playlist && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("playlist")}>
                <ListPlus aria-hidden className="size-4" />
                {t("Add to playlist…")}
              </DropdownMenu.Item>
            )}
            {collection && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("collection")}>
                <FolderPlus aria-hidden className="size-4" />
                {t("Add to collection…")}
              </DropdownMenu.Item>
            )}
            {renamable && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("rename")}>
                <Pencil aria-hidden className="size-4" />
                {t("Rename…")}
              </DropdownMenu.Item>
            )}
            {streamable && (
              <DropdownMenu.Item
                className={MENU_ITEM}
                onSelect={() =>
                  void copyText(streamUrl).then(
                    () =>
                      toast.success(t("Stream link copied."), {
                        description: t(
                          "It contains your sign-in, so share it only with people you trust. Signing out of this device ends it.",
                        ),
                      }),
                    () => toast.error(t("Couldn't copy the link.")),
                  )
                }
              >
                <Link2 aria-hidden className="size-4" />
                {t("Copy stream link")}
              </DropdownMenu.Item>
            )}
            {download && (
              <DropdownMenu.Item asChild className={MENU_ITEM}>
                {/* Jellyfin answers with Content-Disposition: attachment, so the page stays put. */}
                <a href={downloadUrl} rel="noreferrer">
                  <Download aria-hidden className="size-4" />
                  {t("Download")}
                </a>
              </DropdownMenu.Item>
            )}
            {admin && (
              <>
                <DropdownMenu.Separator className={MENU_SEPARATOR} />
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("refresh")}>
                  <RefreshCw aria-hidden className="size-4" />
                  {t("Refresh metadata…")}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("metadata")}>
                  <SquarePen aria-hidden className="size-4" />
                  {t("Edit metadata…")}
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("images")}>
                  <ImageIcon aria-hidden className="size-4" />
                  {t("Edit images…")}
                </DropdownMenu.Item>
                {IDENTIFIABLE[item.Type ?? ""] && (
                  <DropdownMenu.Item className={MENU_ITEM} onSelect={() => setDialog("identify")}>
                    <FileSearch aria-hidden className="size-4" />
                    {t("Identify…")}
                  </DropdownMenu.Item>
                )}
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
                    ? item.Type === "Playlist"
                      ? t("Delete playlist…")
                      : t("Delete collection…")
                    : t("Delete from server…")}
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
      {dialog === "refresh" && <RefreshDialog item={item} onClose={() => setDialog(null)} />}
      {dialog === "metadata" && <MetadataEditor item={item} onClose={() => setDialog(null)} />}
      {dialog === "images" && <ImageEditor item={item} onClose={() => setDialog(null)} />}
      {dialog === "identify" && <IdentifyDialog item={item} onClose={() => setDialog(null)} />}
      {dialog === "rename" && <RenameDialog playlist={item} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("Delete “{name}”?", { name: item.Name ?? "" })}
        confirmLabel={t("Delete")}
        destructive
        busy={remove.isPending}
        onConfirm={() =>
          remove.mutate(item.Id!, {
            onSuccess: () => {
              setDialog(null);
              toast.success(t("Deleted “{name}”.", { name: item.Name ?? "" }));
              void navigate(-1);
            },
            onError: () => toast.error(t("Couldn't delete it.")),
          })
        }
      >
        {isContainer
          ? t("Its items stay in your library.")
          : t(
              "The media files are deleted from the server's disk for everyone. This can't be undone.",
            )}
      </ConfirmDialog>
    </>
  );
}

function RenameDialog({ playlist, onClose }: { playlist: BaseItemDto; onClose: () => void }) {
  const rename = useRenamePlaylist(playlist);
  const [name, setName] = useState(playlist.Name ?? "");
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={t("Rename playlist")}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          rename.mutate(name.trim(), {
            onSuccess: () => {
              toast.success(t("Playlist renamed."));
              onClose();
            },
            onError: () => toast.error(t("Couldn't rename the playlist.")),
          });
        }}
      >
        <TextField
          label={t("Name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          maxLength={200}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={!name.trim() || rename.isPending}>
            {t("Save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
