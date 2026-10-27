import { Link } from "react-router";
import { MessageScreen } from "@/components/MessageScreen";

export function NotFoundPage() {
  return (
    <MessageScreen
      title="Page not found"
      actions={
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-label-md text-on-primary hover:bg-primary-hover"
        >
          Go home
        </Link>
      }
    >
      <p>This page does not exist or has moved.</p>
    </MessageScreen>
  );
}
