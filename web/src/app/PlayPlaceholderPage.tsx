import { useNavigate, useParams } from "react-router";
import { Button } from "@/components/Button";

/** Temporary target for Play buttons until the player lands in Phase 3. */
export function PlayPlaceholderPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  return (
    <div className="px-page-x-mobile py-12 md:px-page-x">
      <h1 className="text-headline-md">The player is on its way</h1>
      <p className="mt-2 max-w-xl text-body-md text-on-surface-muted">
        Playback arrives in the next phase of Finora. Until then, use another Jellyfin app to watch
        this item.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={() => void navigate(-1)}>
          Go back
        </Button>
        <Button variant="ghost" onClick={() => void navigate(`/items/${itemId}`)}>
          Item details
        </Button>
      </div>
    </div>
  );
}
