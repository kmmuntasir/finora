import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";
import { TextField } from "@/components/TextField";
import { useAddToContainer, useContainers, useCreateContainer, type Container } from "./api";

interface AddToDialogProps {
  kind: Container;
  items: BaseItemDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const NOUN = { playlist: "playlist", collection: "collection" } as const;

function describe(items: BaseItemDto[]): string {
  return items.length === 1 ? (items[0]?.Name ?? "1 item") : `${items.length} items`;
}

/** Pick an existing playlist or collection, or create a new one, for one or more items. */
export function AddToDialog({ kind, items, open, onOpenChange, onDone }: AddToDialogProps) {
  const containers = useContainers(kind, open);
  const add = useAddToContainer(kind);
  const create = useCreateContainer(kind);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const ids = items.map((item) => item.Id!).filter(Boolean);
  const noun = NOUN[kind];

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
      title={`Add to ${noun}`}
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
                onSuccess: () => finish(`Added to the new ${noun} “${trimmed}”.`),
                onError: () => toast.error(`Couldn't create the ${noun}.`),
              },
            );
          }}
        >
          <TextField
            label={`New ${noun} name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={200}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Back
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create and add"}
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
            New {noun}
          </button>
          {containers.isPending ? (
            <Spinner className="flex justify-center py-6" />
          ) : containers.isError ? (
            <p role="alert" className="px-3 py-4 text-body-sm text-error">
              Couldn't load your {noun}s.
            </p>
          ) : containers.data.length === 0 ? (
            <p className="px-3 py-4 text-body-sm text-on-surface-muted">You have no {noun}s yet.</p>
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
                          onSuccess: () => finish(`Added to “${container.Name}”.`),
                          onError: () => toast.error(`Couldn't add to “${container.Name}”.`),
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
