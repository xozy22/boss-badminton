import { useEffect } from "react";

const BASE_TITLE = "BOSS";

/**
 * Set `document.title` while the component is mounted.
 * Pass a falsy value (null/undefined/"") to fall back to the bare app title.
 *
 * Previous title is NOT restored on unmount — the next page is expected to
 * call `useDocumentTitle` itself. If you need a scoped title (e.g. while a
 * modal is open), manage that yourself.
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${BASE_TITLE} — ${title}` : BASE_TITLE;
  }, [title]);
}
