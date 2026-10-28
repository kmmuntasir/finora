import { ServerStatus } from "@/features/server/ServerStatus";
import { t } from "@/i18n";

export function ServerPage() {
  return (
    <div className="max-w-2xl px-page-x-mobile py-8 md:px-page-x md:py-10">
      <h1 className="text-headline-lg">{t("Server")}</h1>
      <div className="mt-8">
        <ServerStatus />
      </div>
    </div>
  );
}
