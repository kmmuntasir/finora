import type { BaseItemPerson } from "@jellyfin/sdk/lib/generated-client/models";
import { Link } from "react-router";
import { Artwork } from "@/components/media/Artwork";
import { MediaRow } from "@/components/media/MediaRow";

export function CastRow({ people }: { people: BaseItemPerson[] }) {
  const shown = people.filter((person) => person.Id).slice(0, 30);
  if (!shown.length) return null;
  return (
    <MediaRow title="Cast & crew" itemClassName="w-28 md:w-32">
      {shown.map((person, index) => (
        <Link
          key={`${person.Id}-${index}`}
          to={`/items/${person.Id}`}
          className="group block text-center"
        >
          <Artwork
            image={
              person.PrimaryImageTag
                ? { itemId: person.Id!, kind: "Primary", tag: person.PrimaryImageTag }
                : null
            }
            shape="square"
            width={128}
            title={person.Name ?? ""}
            className="rounded-full"
          />
          <p className="mt-2 truncate text-label-md">{person.Name}</p>
          <p className="truncate text-caption text-on-surface-muted">
            {person.Role || person.Type}
          </p>
        </Link>
      ))}
    </MediaRow>
  );
}
