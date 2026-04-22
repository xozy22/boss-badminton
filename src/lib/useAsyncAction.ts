import { useCallback, useRef, useState } from "react";

/**
 * Wraps an async callback so that the UI can show a pending state and
 * concurrent invocations are coalesced — the second click is dropped while
 * the first is still in flight.
 *
 * Usage:
 *   const [doSave, saving] = useAsyncAction(async () => {
 *     await updateTournament(id, ...);
 *   });
 *   <button onClick={doSave} disabled={saving}>Save</button>
 */
export function useAsyncAction<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>
): [(...args: Args) => Promise<R | undefined>, boolean] {
  const [pending, setPending] = useState(false);
  const inFlightRef = useRef(false);

  const run = useCallback(
    async (...args: Args): Promise<R | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      setPending(true);
      try {
        return await fn(...args);
      } finally {
        inFlightRef.current = false;
        setPending(false);
      }
    },
    [fn]
  );

  return [run, pending];
}
