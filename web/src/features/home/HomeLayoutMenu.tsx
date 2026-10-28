import { Check, LayoutTemplate } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useSetPreference, type HomeLayout } from "@/features/preferences/preferences";
import { msg, t } from "@/i18n";

const LAYOUTS: { id: HomeLayout; name: string; description: string }[] = [
  { id: "spotlight", name: msg("Spotlight"), description: msg("Featured new arrivals up top") },
  {
    id: "dashboard",
    name: msg("Dashboard"),
    description: msg("Libraries and progress at a glance"),
  },
  { id: "focus", name: msg("Focus"), description: msg("Pick up where you left off") },
];

export function HomeLayoutMenu({ current }: { current: HomeLayout }) {
  const setPreference = useSetPreference();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("Home layout")}
        className="grid size-10 place-items-center rounded-full bg-surface-overlay/80 text-on-surface-muted backdrop-blur transition-colors duration-[120ms] hover:text-on-surface data-[state=open]:text-on-surface"
      >
        <LayoutTemplate aria-hidden className="size-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-72 rounded-lg bg-surface-overlay p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.5)] ring-1 ring-border data-[state=open]:animate-[fade-in_150ms_ease-out]"
        >
          <DropdownMenu.Label className="px-3 pt-2 pb-1 text-label-sm text-on-surface-subtle">
            {t("Home layout")}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={current}
            onValueChange={(value) => setPreference.mutate({ homeLayout: value as HomeLayout })}
          >
            {LAYOUTS.map((layout) => (
              <DropdownMenu.RadioItem
                key={layout.id}
                value={layout.id}
                className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 outline-none select-none data-[highlighted]:bg-surface-raised"
              >
                <span className="mt-0.5 grid size-4 place-items-center">
                  <DropdownMenu.ItemIndicator>
                    <Check aria-hidden className="size-4 text-primary" />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span>
                  <span className="block text-label-md">{t(layout.name)}</span>
                  <span className="block text-caption text-on-surface-muted">
                    {t(layout.description)}
                  </span>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
