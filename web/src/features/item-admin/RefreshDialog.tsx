import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useRefreshItem, type RefreshMode } from "./api";

const MODES: { value: RefreshMode; label: string; hint: string }[] = [
  {
    value: "scan",
    label: "Scan for new and updated files",
    hint: "Quick; keeps existing metadata.",
  },
  {
    value: "missing",
    label: "Search for missing metadata",
    hint: "Fills empty fields from online providers.",
  },
  {
    value: "replace",
    label: "Replace all metadata",
    hint: "Downloads everything again. Locked fields are kept.",
  },
];

export function RefreshDialog({ item, onClose }: { item: BaseItemDto; onClose: () => void }) {
  const refresh = useRefreshItem(item);
  const [mode, setMode] = useState<RefreshMode>("missing");
  const [replaceImages, setReplaceImages] = useState(false);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Refresh metadata"
      description={item.Name ?? undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={refresh.isPending}
            onClick={() =>
              refresh.mutate(
                { mode, replaceImages },
                {
                  onSuccess: () => {
                    toast.success("Refresh started. Changes appear in a moment.");
                    onClose();
                  },
                  onError: () => toast.error("Couldn't start the refresh."),
                },
              )
            }
          >
            Refresh
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">Refresh mode</legend>
        {MODES.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-md p-3 hover:bg-surface-raised has-[:checked]:bg-surface-raised"
          >
            <input
              type="radio"
              name="refresh-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block text-label-md">{option.label}</span>
              <span className="block text-body-sm text-on-surface-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {mode !== "scan" && (
        <label className="mt-4 flex cursor-pointer items-center gap-3 px-3 text-body-md">
          <input
            type="checkbox"
            checked={replaceImages}
            onChange={(event) => setReplaceImages(event.target.checked)}
            className="size-4 accent-primary"
          />
          Replace existing images
        </label>
      )}
    </Sheet>
  );
}
