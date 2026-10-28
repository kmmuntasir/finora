import type {
  SubtitlePlaybackMode,
  UserConfiguration,
  UserDto,
} from "@jellyfin/sdk/lib/generated-client/models";
import { getUserApi } from "@jellyfin/sdk/lib/utils/api/user-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { useSession } from "@/features/auth/context";
import { useCultures } from "@/features/settings/queries";
import { languageOptions, SUBTITLE_MODES } from "@/features/settings/subtitle-options";

const KEEP = "__keep__";
const SELECT = "h-11 w-full rounded-md border border-border-strong bg-background px-3 text-body-md";

/** Sets subtitle mode and language in several users' Jellyfin settings at once. */
export function BulkSubtitleDialog({ users, onClose }: { users: UserDto[]; onClose: () => void }) {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const cultures = useCultures();
  const [mode, setMode] = useState(KEEP);
  const [language, setLanguage] = useState(KEEP);
  const ids = { mode: useId(), language: useId() };

  const apply = useMutation({
    mutationFn: async () => {
      const changes: Partial<UserConfiguration> = {};
      if (mode !== KEEP) changes.SubtitleMode = mode as SubtitlePlaybackMode;
      if (language !== KEEP) changes.SubtitleLanguagePreference = language || null;
      // One at a time: each save sends the user's whole configuration.
      for (const user of users) {
        await getUserApi(api).updateUserConfiguration({
          userId: user.Id!,
          userConfiguration: { ...user.Configuration, ...changes },
        });
      }
    },
    onSuccess: () => {
      toast.success(`Updated ${users.length} ${users.length === 1 ? "user" : "users"}.`);
      onClose();
    },
    onError: () => toast.error("Some users couldn't be updated."),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title="Subtitle settings"
      description={users.map((user) => user.Name).join(", ")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={apply.isPending || (mode === KEEP && language === KEEP)}
            onClick={() => apply.mutate()}
          >
            {apply.isPending ? "Saving…" : `Apply to ${users.length}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body-sm text-on-surface-muted">
          These are the users' own Jellyfin settings, so every app they use follows them. They can
          change them again in Settings.
        </p>
        <div>
          <label htmlFor={ids.mode} className="mb-1.5 block text-label-md">
            When to show subtitles
          </label>
          <select
            id={ids.mode}
            className={SELECT}
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value={KEEP}>Keep each user's choice</option>
            {SUBTITLE_MODES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.language} className="mb-1.5 block text-label-md">
            Preferred subtitle language
          </label>
          <select
            id={ids.language}
            className={SELECT}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value={KEEP}>Keep each user's choice</option>
            <option value="">Any language</option>
            {languageOptions(cultures.data).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Sheet>
  );
}
