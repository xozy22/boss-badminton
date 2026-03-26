import { useState, useEffect } from "react";

/**
 * Zeigt die vergangene Zeit seit `startIso` als "MM:SS" oder "H:MM:SS".
 * Aktualisiert sich jede Sekunde.
 */
export function useTimer(startIso: string | null): string {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!startIso) {
      setElapsed("");
      return;
    }

    const start = new Date(startIso).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0) {
        setElapsed(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      } else {
        setElapsed(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startIso]);

  return elapsed;
}

/** Formatiert Sekunden als "MM:SS" oder "H:MM:SS" */
export function formatDuration(startIso: string | null, endIso?: string | null): string {
  if (!startIso) return "";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diff = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
