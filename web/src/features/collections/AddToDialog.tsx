import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";
import { TextField } from "@/components/TextField";
import { useAddToContainer, useContainers, useCreateContainer, type Container } from "./api";
import { msg, t, tn } from "@/i18n";

interface AddToDialogProps {
  kind: Container;
  items: BaseItemDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const TEXT = {
  playlist: {
    title: msg("Add to playlist"),
    created: msg("Added to the new playlist “{name}”."),
    createFailed: msg("Couldn't create the playlist."),
    nameLabel: msg("New playlist name"),
    create: msg("New playlist"),
    loadFailed: msg("Couldn't load your playlists."),
    empty: msg("You have no playlists yet."),
  },
  collection: {
    title: msg("Add to collection"),
    created: msg("Added to the new collection “{name}”."),
    createFailed: msg("Couldn't create the collection."),
    nameLabel: msg("New collection name"),
    create: msg("New collection"),
    loadFailed: msg("Couldn't load your collections."),
    empty: msg("You have no collections yet."),
  },
} as const;

function describe(items: BaseItemDto[]): string {
  return items.length === 1
    ? (items[0]?.Name ?? tn(1, "{count} item", "{count} items"))
    : tn(items.length, "{count} item", "{count} items");
}

/** Pick an existing playlist or collection, or create a new one, for one or more items. */
export function AddToDialog({ kind, items, open, onOpenChange, onDone }: AddToDialogProps) {
  const containers = useContainers(kind, open);
  const add = useAddToContainer(kind);
  const create = useCreateContainer(kind);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const ids = items.map((item) => item.Id!).filter(Boolean);
  const text = TEXT[kind];

  const finish = (message: string) => {
    toast.success(message);
    setName("");
    setCreating(false);
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!value) setCreating(false);
        onOpenChange(value);
      }}
      title={t(text.title)}
      description={describe(items)}
    >
      {creating ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            create.mutate(
              { name: trimmed, ids },
              {
                onSuccess: () => finish(t(text.created, { name: trimmed })),
                onError: () => toast.error(t(text.createFailed)),
              },
            );
          }}
        >
          <TextField
            label={t(text.nameLabel)}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={200}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              {t("Back")}
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? t("Creating…") : t("Create and add")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-label-md text-primary hover:bg-surface-raised"
          >
            <Plus aria-hidden className="size-5" />
            {t(text.create)}
          </button>
          {containers.isPending ? (
            <Spinner className="flex justify-center py-6" />
          ) : containers.isError ? (
            <p role="alert" className="px-3 py-4 text-body-sm text-error">
              {t(text.loadFailed)}
            </p>
          ) : containers.data.length === 0 ? (
            <p className="px-3 py-4 text-body-sm text-on-surface-muted">{t(text.empty)}</p>
          ) : (
            <ul>
              {containers.data.map((container) => (
                <li key={container.Id}>
                  <button
                    type="button"
                    disabled={add.isPending}
                    onClick={() =>
                      add.mutate(
                        { containerId: container.Id!, ids },
                        {
                          onSuccess: () =>
                            finish(t("Added to “{name}”.", { name: container.Name ?? "" })),
                          onError: () =>
                            toast.error(
                              t("Couldn't add to “{name}”.", { name: container.Name ?? "" }),
                            ),
                        },
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left hover:bg-surface-raised disabled:opacity-60"
                  >
                    <span className="min-w-0 truncate text-body-md">{container.Name}</span>
                    {add.isPending && add.variables?.containerId === container.Id ? (
                      <Spinner />
                    ) : (
                      <span className="text-caption text-on-surface-muted tabular-nums">
                        {container.ChildCount ?? ""}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}
