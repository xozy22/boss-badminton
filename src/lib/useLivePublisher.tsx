/**
 * Global live publisher host — runs once at app root, parallel to the router.
 *
 * Responsibilities:
 *  1. Read live_publish_config (connection params) from app_settings; reload
 *     every 30s so that endpoint/secret changes in Settings take effect
 *     without an app restart.
 *  2. Read live_publish_tournament_ids (per-tournament opt-in set) every 30s.
 *  3. Discover all tournaments with status="active" every 30s.
 *  4. The intersection of (active && opted-in) gets a <TournamentPublisher/>
 *     child that polls its own state every 5s and pushes a snapshot whenever
 *     the stable signature changes (debounced 1.5s) or every 60s as a
 *     heartbeat.
 *  5. Track success/error state in a shared Map for the Settings status line.
 *
 * Default off: an empty opt-in set means nothing is pushed, even when a
 * connection is configured. Users enable live publishing per tournament
 * from the tournament detail page.
 *
 * Multi-tournament: each child has its own debounce slot keyed by tournament
 * id, so a flurry of score edits in tournament A never cancels a pending
 * push for tournament B.
 */
/* eslint-disable react-refresh/only-export-components */

import { useEffect, useRef, useState } from "react";
import {
  getAppSetting,
  getTournaments,
  getTournament,
  getTournamentPlayers,
  getRounds,
  getAllMatchesByTournament,
  getAllSetsByTournament,
  setAppSetting,
} from "./db";
import {
  buildSnapshot,
  pushSnapshot,
  snapshotSignature,
  getLiveTournamentIds,
  LIVE_PUBLISH_SETTING_KEY,
} from "./livePublish";
import type { LivePublishConfig, Tournament } from "./types";

// Injected by Vite from tauri.conf.json — see src/globals.d.ts.
declare const __APP_VERSION__: string;

const DISCOVERY_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 60_000;
const DEBOUNCE_MS = 1_500;

/** Per-tournament push status, used by Settings to show "2 OK / 1 error". */
export interface TournamentPushStatus {
  tournamentId: number;
  tournamentName: string;
  lastPushAt: string | null;
  lastError: string | null;
}

const pushStatuses = new Map<number, TournamentPushStatus>();
const pushStatusListeners = new Set<() => void>();
function notifyPushStatusListeners() {
  for (const fn of pushStatusListeners) fn();
}

/** External hook for Settings page to display per-tournament status. */
export function usePushStatuses(): TournamentPushStatus[] {
  const [snapshot, setSnapshot] = useState<TournamentPushStatus[]>(() =>
    Array.from(pushStatuses.values()),
  );
  useEffect(() => {
    const refresh = () => setSnapshot(Array.from(pushStatuses.values()));
    pushStatusListeners.add(refresh);
    return () => {
      pushStatusListeners.delete(refresh);
    };
  }, []);
  return snapshot;
}

function recordPush(
  tournamentId: number,
  tournamentName: string,
  ok: boolean,
  error?: string,
) {
  const now = new Date().toISOString();
  const entry: TournamentPushStatus = {
    tournamentId,
    tournamentName,
    lastPushAt: ok ? now : pushStatuses.get(tournamentId)?.lastPushAt ?? null,
    lastError: ok ? null : error ?? "unknown",
  };
  pushStatuses.set(tournamentId, entry);
  notifyPushStatusListeners();
}

function clearPushStatus(tournamentId: number) {
  if (pushStatuses.delete(tournamentId)) notifyPushStatusListeners();
}

// --- Live config loader -----------------------------------------------------

function useLiveConfig(): LivePublishConfig | null {
  const [cfg, setCfg] = useState<LivePublishConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const raw = await getAppSetting(LIVE_PUBLISH_SETTING_KEY);
        if (cancelled) return;
        if (!raw) {
          setCfg(null);
          return;
        }
        const parsed = JSON.parse(raw) as LivePublishConfig;
        setCfg(parsed);
      } catch (err) {
        console.error("useLiveConfig: failed to load config:", err);
        if (!cancelled) setCfg(null);
      }
    };
    load();
    const id = setInterval(load, DISCOVERY_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return cfg;
}

// --- Active tournament discovery -------------------------------------------

/**
 * Returns the list of tournaments that should be currently pushed: status
 * is "active" AND the user has opted them in via TournamentView. Polls
 * both the tournaments table and the opt-in set every DISCOVERY_INTERVAL_MS.
 */
function useActiveOptedInTournaments(connected: boolean): Tournament[] {
  const [list, setList] = useState<Tournament[]>([]);
  useEffect(() => {
    // When connection is not configured, stop polling. Parent renders nothing.
    if (!connected) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [all, optedIn] = await Promise.all([
          getTournaments(),
          getLiveTournamentIds(),
        ]);
        if (cancelled) return;
        const optedSet = new Set(optedIn);
        const target = all.filter(
          (t) => t.status === "active" && optedSet.has(t.id),
        );
        setList((prev) => {
          // Avoid re-render if list didn't actually change.
          if (
            prev.length === target.length &&
            prev.every((t, i) => t.id === target[i].id)
          ) {
            return prev;
          }
          return target;
        });
      } catch (err) {
        console.error("useActiveOptedInTournaments: failed to load:", err);
      }
    };
    tick();
    const id = setInterval(tick, DISCOVERY_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected]);
  return list;
}

// --- Per-tournament publisher ----------------------------------------------

interface TournamentPublisherProps {
  tournamentId: number;
  config: LivePublishConfig;
}

function TournamentPublisher({ tournamentId, config }: TournamentPublisherProps) {
  // Bulk state for snapshot — refreshed every POLL_INTERVAL_MS.
  const dataRef = useRef<{
    tournament: Tournament;
    players: import("./types").Player[];
    rounds: import("./types").Round[];
    matches: import("./types").Match[];
    sets: import("./types").GameSet[];
  } | null>(null);

  const lastSig = useRef<string>("");
  const debounceTimer = useRef<number | null>(null);
  const tournamentName = useRef<string>("");

  // Push helper bound to this tournament — keeps push logic in one place.
  const doPush = useRef(async (reason: "event" | "heartbeat") => {
    if (!dataRef.current) return;
    const snap = buildSnapshot(
      dataRef.current.tournament,
      dataRef.current.players,
      dataRef.current.rounds,
      dataRef.current.matches,
      dataRef.current.sets,
      __APP_VERSION__,
    );
    const sig = snapshotSignature(snap);
    // Skip heartbeats when nothing changed AND we already pushed at least once.
    if (reason === "heartbeat" && sig === lastSig.current && lastSig.current !== "") {
      return;
    }
    lastSig.current = sig;
    const result = await pushSnapshot(config, snap);
    if (result.ok) {
      recordPush(tournamentId, tournamentName.current, true);
      // Mirror "last successful push" globally for the Settings header line.
      try {
        const updated: LivePublishConfig = {
          ...config,
          lastPushAt: new Date().toISOString(),
          lastError: undefined,
        };
        await setAppSetting(LIVE_PUBLISH_SETTING_KEY, JSON.stringify(updated));
      } catch {
        /* non-fatal */
      }
    } else {
      recordPush(tournamentId, tournamentName.current, false, result.error);
      try {
        const updated: LivePublishConfig = { ...config, lastError: result.error };
        await setAppSetting(LIVE_PUBLISH_SETTING_KEY, JSON.stringify(updated));
      } catch {
        /* non-fatal */
      }
    }
  });

  // Polling loop: reloads tournament state every 5s, kicks debounced push
  // when the signature changed.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [tournament, players, rounds, matches, sets] = await Promise.all([
          getTournament(tournamentId),
          getTournamentPlayers(tournamentId),
          getRounds(tournamentId),
          getAllMatchesByTournament(tournamentId),
          getAllSetsByTournament(tournamentId),
        ]);
        if (cancelled) return;
        dataRef.current = { tournament, players, rounds, matches, sets };
        tournamentName.current = tournament.name;

        // Build snapshot just to compute signature — cheap (no network).
        const snap = buildSnapshot(
          tournament,
          players,
          rounds,
          matches,
          sets,
          __APP_VERSION__,
        );
        const sig = snapshotSignature(snap);
        if (sig !== lastSig.current) {
          // Debounce: schedule push, replacing any pending one.
          if (debounceTimer.current !== null) {
            clearTimeout(debounceTimer.current);
          }
          debounceTimer.current = window.setTimeout(() => {
            debounceTimer.current = null;
            doPush.current("event");
          }, DEBOUNCE_MS);
        }
      } catch (err) {
        console.error(`TournamentPublisher(${tournamentId}): poll failed:`, err);
      }
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [tournamentId]);

  // Heartbeat loop: every 60s, push regardless of changes (acts as a
  // liveness signal so the WP page can show "still active" / handles
  // downstream restarts).
  useEffect(() => {
    const id = setInterval(() => {
      doPush.current("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}

// --- Host component ---------------------------------------------------------

/**
 * Mount once at app root. Coordinates discovery + per-tournament publishers.
 * Renders nothing visible.
 */
export default function LivePublisherHost() {
  const config = useLiveConfig();
  // "Connected" simply means: the user has saved a usable endpoint+secret.
  // Whether anything actually pushes depends on the per-tournament opt-in.
  const connected = !!config?.endpoint && !!config?.secret;
  const active = useActiveOptedInTournaments(connected);

  // Drop status entries for tournaments that are no longer active+opted-in.
  useEffect(() => {
    const activeIds = new Set(active.map((t) => t.id));
    for (const id of Array.from(pushStatuses.keys())) {
      if (!activeIds.has(id)) clearPushStatus(id);
    }
  }, [active]);

  if (!connected || !config) return null;

  return (
    <>
      {active.map((t) => (
        <TournamentPublisher
          key={t.id}
          tournamentId={t.id}
          config={config}
        />
      ))}
    </>
  );
}
