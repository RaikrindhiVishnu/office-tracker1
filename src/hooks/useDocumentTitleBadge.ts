import { useEffect } from "react";

export function useDocumentTitleBadge(unreadCount: number) {
  useEffect(() => {
    // Only run in the browser
    if (typeof document === "undefined") return;

    // Get the base title by removing any existing badge
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [unreadCount]);
}
