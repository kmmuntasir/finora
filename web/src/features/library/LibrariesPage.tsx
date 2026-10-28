import { Link } from "react-router";
import { posterImage } from "@/api/images";
import { Artwork } from "@/components/media/Artwork";
import { useUserViews } from "@/features/home/queries";
import { libraryHref } from "@/lib/routes";
import { viewIcon } from "./view-icons";
import { t } from "@/i18n";

/** All libraries as tiles (the mobile entry point to libraries). */
export function LibrariesPage() {
  const { data: views } = useUserViews();
  return (
    <div className="px-page-x-mobile pt-8 pb-24 md:px-page-x md:pt-10">
      <h1 className="text-headline-lg">{t("Libraries")}</h1>
      <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
        {views?.map((view) => {
          const Icon = viewIcon(view.CollectionType);
          return (
            <li key={view.Id}>
              <Link
                to={libraryHref(view)}
                className="group block overflow-hidden rounded-lg bg-surface"
              >
                <Artwork
                  image={posterImage(view)}
                  shape="landscape"
                  width={400}
                  title={view.Name ?? ""}
                />
                <span className="flex items-center gap-2 px-4 py-3 text-label-md">
                  <Icon aria-hidden className="size-4 text-on-surface-muted" />
                  {view.Name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
