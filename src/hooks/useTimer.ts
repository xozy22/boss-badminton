import { useState, useEffect } from "react";

/**
 * Zeigt die vergangene Zeit seit `startIso` als "MM:SS" oder "H:MM:SS".
 * Aktualisiert sich jede Sekunde.
 * Gibt auch die Gesamtsekunden zurueck fuer Threshold-Checks.
 */
export function useTimer(startIso: string | null): { display: string; totalSeconds: number } {
  const [state, setState] = useState<{ display: string; totalSeconds: number }>({ display: "", totalSeconds: 0 });

  useEffect(() => {
    if (!startIso) {
      setState({ display: "", totalSeconds: 0 });
      return;
    }

    const start = new Date(startIso).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const display = h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      setState({ display, totalSeconds: diff });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startIso]);

  return state;
}
