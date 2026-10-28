import type { BaseItemDto, ImageInfo, ImageType } from "@jellyfin/sdk/lib/generated-client/models";
import { ArrowLeft, Search, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";
import { useRuntimeConfig } from "@/config/context";
import { useImageMutations, useItemImages, useRemoteImages } from "./api";
import { msg, t } from "@/i18n";

const TYPES: { type: ImageType; label: string }[] = [
  { type: "Primary", label: msg("Poster") },
  { type: "Backdrop", label: msg("Backdrop") },
  { type: "Logo", label: msg("Logo") },
  { type: "Thumb", label: msg("Thumbnail") },
  { type: "Banner", label: msg("Banner") },
  { type: "Art", label: msg("Clear art") },
  { type: "Disc", label: msg("Disc") },
];

/** Shows the item's images; replace them from providers or an upload, or delete them. */
export function ImageEditor({ item, onClose }: { item: BaseItemDto; onClose: () => void }) {
  const images = useItemImages(item.Id!, true);
  const [browsing, setBrowsing] = useState<ImageType | null>(null);

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        browsing
          ? t("Choose {image}", {
              image: t(TYPES.find((entry) => entry.type === browsing)?.label ?? "").toLowerCase(),
            })
          : t("Edit images")
      }
      description={item.Name ?? undefined}
      className="md:w-[min(56rem,calc(100%-2rem))]"
    >
      {browsing ? (
        <RemoteImages item={item} type={browsing} onBack={() => setBrowsing(null)} />
      ) : images.isPending ? (
        <Spinner className="flex justify-center py-8" />
      ) : images.isError ? (
        <p role="alert" className="text-body-md text-error">
          {t("Couldn't load the images.")}
        </p>
      ) : (
        <div className="space-y-6">
          {TYPES.map(({ type, label }) => (
            <ImageTypeRow
              key={type}
              item={item}
              type={type}
              label={t(label)}
              images={images.data.filter((image) => image.ImageType === type)}
              onBrowse={() => setBrowsing(type)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function ImageTypeRow({
  item,
  type,
  label,
  images,
  onBrowse,
}: {
  item: BaseItemDto;
  type: ImageType;
  label: string;
  images: ImageInfo[];
  onBrowse: () => void;
}) {
  const { config } = useRuntimeConfig();
  const { remove, upload } = useImageMutations(item.Id!);
  const fileInput = useRef<HTMLInputElement>(null);
  const tall =
    type === "Primary" && !["MusicAlbum", "Audio", "MusicArtist"].includes(item.Type ?? "");

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-label-md">{label}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onBrowse}>
            <Search aria-hidden className="size-4" />
            {t("Search online")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
          >
            <Upload aria-hidden className="size-4" />
            {t("Upload")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              upload.mutate(
                { type, file },
                {
                  onSuccess: () => toast.success(t("{image} uploaded.", { image: label })),
                  onError: () => toast.error(t("Upload failed.")),
                },
              );
            }}
          />
        </div>
      </div>
      {images.length === 0 ? (
        <p className="text-body-sm text-on-surface-subtle">{t("None")}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {images.map((image) => (
            <li key={`${image.ImageIndex ?? 0}-${image.ImageTag}`} className="relative">
              <img
                src={`${config.jellyfinUrl}/Items/${item.Id}/Images/${type}/${image.ImageIndex ?? 0}?tag=${image.ImageTag}&maxWidth=320`}
                alt={t("{image} {number}", { image: label, number: (image.ImageIndex ?? 0) + 1 })}
                className={`${tall ? "h-40" : "h-24"} max-w-72 rounded-md bg-surface-raised object-contain`}
              />
              {image.Width && image.Height ? (
                <span className="absolute bottom-1 left-1 rounded-sm bg-scrim px-1.5 text-caption">
                  {image.Width}×{image.Height}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={t("Delete {image} {number}", {
                  image: label.toLowerCase(),
                  number: (image.ImageIndex ?? 0) + 1,
                })}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { type, index: image.ImageIndex ?? 0 },
                    { onError: () => toast.error(t("Couldn't delete the image.")) },
                  )
                }
                className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-scrim text-on-surface hover:bg-error hover:text-background"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RemoteImages({
  item,
  type,
  onBack,
}: {
  item: BaseItemDto;
  type: ImageType;
  onBack: () => void;
}) {
  const remote = useRemoteImages(item.Id!, type);
  const { download } = useImageMutations(item.Id!);
  return (
    <div>
      <Button size="sm" variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft aria-hidden className="size-4" />
        {t("Back")}
      </Button>
      {remote.isPending ? (
        <Spinner className="flex justify-center py-8" label={t("Searching providers")} />
      ) : remote.isError ? (
        <p role="alert" className="text-body-md text-error">
          {t("The image search failed.")}
        </p>
      ) : !remote.data.Images?.length ? (
        <p className="text-body-md text-on-surface-muted">
          {t("No images found. The item may need to be identified first.")}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {remote.data.Images.map((image) => (
            <li key={image.Url}>
              <button
                type="button"
                disabled={download.isPending}
                onClick={() =>
                  download.mutate(
                    { type, url: image.Url! },
                    {
                      onSuccess: () => {
                        toast.success(t("Image saved."));
                        onBack();
                      },
                      onError: () => toast.error(t("Couldn't download the image.")),
                    },
                  )
                }
                className="block w-full rounded-md text-left ring-primary hover:ring-2 disabled:opacity-60"
              >
                <img
                  src={image.ThumbnailUrl ?? image.Url ?? ""}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full rounded-md bg-surface-raised object-contain"
                />
                <span className="mt-1 block text-caption text-on-surface-muted">
                  {image.ProviderName}
                  {image.Width && image.Height ? ` · ${image.Width}×${image.Height}` : ""}
                  {image.Language ? ` · ${image.Language}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
