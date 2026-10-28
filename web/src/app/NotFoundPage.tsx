import { Link } from "react-router";
import { MessageScreen } from "@/components/MessageScreen";
import { t } from "@/i18n";

export function NotFoundPage() {
  return (
    <MessageScreen
      title={t("Page not found")}
      actions={
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-label-md text-on-primary hover:bg-primary-hover"
        >
          {t("Go home")}
        </Link>
      }
    >
      <p>{t("This page does not exist or has moved.")}</p>
    </MessageScreen>
  );
}
