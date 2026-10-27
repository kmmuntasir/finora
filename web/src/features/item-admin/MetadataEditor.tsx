import type { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";
import { useMetadataEditorInfo, useUpdateItem } from "./api";

const INPUT =
  "h-11 w-full rounded-md border border-border-strong bg-background px-3 text-body-md disabled:opacity-60";

function list(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: (id: string) => ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="mb-1.5 block text-label-md">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** Edits the common metadata fields. Jellyfin replaces the whole item, so edits are merged onto the full item. */
export function MetadataEditor({ item, onClose }: { item: BaseItemDto; onClose: () => void }) {
  const info = useMetadataEditorInfo(item.Id!, true);
  const update = useUpdateItem(item.Id!);
  const episode = item.Type === "Episode";
  const [form, setForm] = useState(() => ({
    name: item.Name ?? "",
    originalTitle: item.OriginalTitle ?? "",
    sortName: item.ForcedSortName ?? "",
    year: item.ProductionYear?.toString() ?? "",
    premiere: item.PremiereDate?.slice(0, 10) ?? "",
    rating: item.OfficialRating ?? "",
    community: item.CommunityRating?.toString() ?? "",
    critic: item.CriticRating?.toString() ?? "",
    tagline: item.Taglines?.[0] ?? "",
    overview: item.Overview ?? "",
    genres: (item.Genres ?? []).join(", "),
    tags: (item.Tags ?? []).join(", "),
    studios: (item.Studios ?? []).map((studio) => studio.Name).join(", "),
    season: item.ParentIndexNumber?.toString() ?? "",
    episode: item.IndexNumber?.toString() ?? "",
    providerIds: { ...(item.ProviderIds ?? {}) } as Record<string, string>,
    locked: Boolean(item.LockData),
  }));
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const ratings = [
    ...new Set([
      ...(info.data?.ParentalRatingOptions ?? []).map((option) => option.Name ?? ""),
      form.rating,
    ]),
  ].filter(Boolean);
  const externalIds = (info.data?.ExternalIdInfos ?? []).filter(
    (external, index, all) => all.findIndex((other) => other.Key === external.Key) === index,
  );

  const save = () => {
    const providerIds = Object.fromEntries(
      Object.entries(form.providerIds).filter(([, value]) => value.trim()),
    );
    update.mutate(
      {
        ...item,
        Name: form.name.trim() || item.Name,
        OriginalTitle: form.originalTitle.trim() || null,
        ForcedSortName: form.sortName.trim() || null,
        ProductionYear: numberOrNull(form.year),
        PremiereDate: form.premiere ? `${form.premiere}T00:00:00.000Z` : null,
        OfficialRating: form.rating || null,
        CommunityRating: numberOrNull(form.community),
        CriticRating: numberOrNull(form.critic),
        Taglines: form.tagline.trim() ? [form.tagline.trim()] : [],
        Overview: form.overview,
        Genres: list(form.genres),
        Tags: list(form.tags),
        Studios: list(form.studios).map((name) => ({ Name: name })),
        ...(episode
          ? {
              ParentIndexNumber: numberOrNull(form.season),
              IndexNumber: numberOrNull(form.episode),
            }
          : {}),
        ProviderIds: providerIds,
        LockData: form.locked,
      },
      {
        onSuccess: () => {
          toast.success("Metadata saved.");
          onClose();
        },
        onError: () => toast.error("Couldn't save the metadata."),
      },
    );
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit metadata"
      description={item.Name ?? undefined}
      className="md:w-[min(48rem,calc(100%-2rem))]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" wide>
          {(id) => (
            <input
              id={id}
              className={INPUT}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          )}
        </Field>
        <Field label="Original title">
          {(id) => (
            <input
              id={id}
              className={INPUT}
              value={form.originalTitle}
              onChange={(e) => set("originalTitle", e.target.value)}
            />
          )}
        </Field>
        <Field label="Sort title">
          {(id) => (
            <input
              id={id}
              className={INPUT}
              value={form.sortName}
              onChange={(e) => set("sortName", e.target.value)}
            />
          )}
        </Field>
        {episode && (
          <>
            <Field label="Season number">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  className={INPUT}
                  value={form.season}
                  onChange={(e) => set("season", e.target.value)}
                />
              )}
            </Field>
            <Field label="Episode number">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  className={INPUT}
                  value={form.episode}
                  onChange={(e) => set("episode", e.target.value)}
                />
              )}
            </Field>
          </>
        )}
        <Field label="Year">
          {(id) => (
            <input
              id={id}
              type="number"
              min={1800}
              max={2200}
              className={INPUT}
              value={form.year}
              onChange={(e) => set("year", e.target.value)}
            />
          )}
        </Field>
        <Field label="Release date">
          {(id) => (
            <input
              id={id}
              type="date"
              className={INPUT}
              value={form.premiere}
              onChange={(e) => set("premiere", e.target.value)}
            />
          )}
        </Field>
        <Field label="Age rating">
          {(id) =>
            info.isPending ? (
              <Spinner />
            ) : (
              <select
                id={id}
                className={INPUT}
                value={form.rating}
                onChange={(e) => set("rating", e.target.value)}
              >
                <option value="">None</option>
                {ratings.map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </select>
            )
          }
        </Field>
        <Field label="Community rating (0–10)">
          {(id) => (
            <input
              id={id}
              type="number"
              step="0.1"
              min={0}
              max={10}
              className={INPUT}
              value={form.community}
              onChange={(e) => set("community", e.target.value)}
            />
          )}
        </Field>
        <Field label="Critic rating (0–100)">
          {(id) => (
            <input
              id={id}
              type="number"
              min={0}
              max={100}
              className={INPUT}
              value={form.critic}
              onChange={(e) => set("critic", e.target.value)}
            />
          )}
        </Field>
        <Field label="Tagline" wide>
          {(id) => (
            <input
              id={id}
              className={INPUT}
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
            />
          )}
        </Field>
        <Field label="Overview" wide>
          {(id) => (
            <textarea
              id={id}
              rows={5}
              className="w-full rounded-md border border-border-strong bg-background px-3 py-2 text-body-md"
              value={form.overview}
              onChange={(e) => set("overview", e.target.value)}
            />
          )}
        </Field>
        <Field label="Genres (comma-separated)" wide>
          {(id) => (
            <input
              id={id}
              className={INPUT}
              value={form.genres}
              onChange={(e) => set("genres", e.target.value)}
            />
          )}
        </Field>
        <Field label="Tags (comma-separated)">
          {(id) => (
            <input
              id={id}
              className={INPUT}
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          )}
        </Field>
        <Field label="Studios (comma-separated)">
          {(id) => (
            <input
              id={id}
              className={INPUT}
              value={form.studios}
              onChange={(e) => set("studios", e.target.value)}
            />
          )}
        </Field>
        {externalIds.map((external) => (
          <Field key={external.Key} label={`${external.Name} ID`}>
            {(id) => (
              <input
                id={id}
                className={INPUT}
                value={form.providerIds[external.Key ?? ""] ?? ""}
                onChange={(e) =>
                  set("providerIds", { ...form.providerIds, [external.Key ?? ""]: e.target.value })
                }
              />
            )}
          </Field>
        ))}
        <label className="flex cursor-pointer items-center gap-3 text-body-md sm:col-span-2">
          <input
            type="checkbox"
            checked={form.locked}
            onChange={(e) => set("locked", e.target.checked)}
            className="size-4 accent-primary"
          />
          Lock this item so metadata refreshes don't change it
        </label>
      </div>
    </Sheet>
  );
}
