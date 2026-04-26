import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import PrintDialog from "../components/print/PrintDialog";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";
import TemplateExportModal from "../components/tournament/TemplateExportModal";
import DeleteTournamentModal from "../components/tournament/DeleteTournamentModal";
import RetirePlayerModal from "../components/tournament/RetirePlayerModal";
import RemovePlayerModal from "../components/tournament/RemovePlayerModal";
import AttendanceCheckModal from "../components/tournament/AttendanceCheckModal";
import UnpublishModal from "../components/tournament/UnpublishModal";
import RanglisteTab from "../components/tournament/RanglisteTab";
import GruppenTab from "../components/tournament/GruppenTab";
import GroupProgressBar from "../components/tournament/GroupProgressBar";
import VerwaltungTab from "../components/tournament/VerwaltungTab";
import CourtOverview from "../components/courts/CourtOverview";
import BracketView from "../components/bracket/BracketView";
import BronzeMatchPanel from "../components/bracket/BronzeMatchPanel";
import { CourtTimer } from "../components/courts/CourtTimer";
import RestIndicator from "../components/players/RestIndicator";
import { getRestingPlayers } from "../lib/restTime";
import {
  getRunningPlayerCourts,
  getMatchConflicts,
  type ConflictPlayer,
} from "../lib/courtConflicts";
import {
  getGroupProgress,
  getRemainingByGroup,
  getRoundToGroupMap,
} from "../lib/groupProgress";
import {
  getTournament,
  getTournamentPlayers,
  getPlayers,
  getRounds,
  getAllMatchesByTournament,
  getAllSetsByTournament,
  createRound,
  createMatch,
  upsertSet,
  updateMatchResult,
  updateMatchCourt,
  clearMatchCourt,
  reopenMatch,
  updateTournament,
  updateTournamentStatus,
  updateTournamentPhase,
  deleteTournament,
  addPlayerToTournament,
  removePlayerFromTournament,
  retirePlayerFromTournament,
  unretirePlayerFromTournament,
  deleteRound,
  getRetiredPlayerIds,
  getTournamentPlayersDetailed,
  isTauri,
  updateTournamentKoScoring,
} from "../lib/db";
import {
  generateRoundRobinSingles,
  generateRoundRobinDoubles,
  generateRandomDoublesRound,
  generateMixedDoublesRound,
  generateEliminationBracket,
  generateEliminationBracketDoubles,
  splitIntoGroups,
  formFixedDoubleTeams,
  formFixedMixedTeams,
  splitTeamsIntoGroups,
  getPreviousPairings,
  getPreviousPairingCounts,
  generateSwissFirstRound,
  generateSwissFirstRoundDoubles,
  generateSwissRound,
  generateSwissRoundDoubles,
  generateMonradRound,
  generateMonradRoundDoubles,
  generateKingOfCourtMatch,
  generateWaterfallRound,
  advanceWaterfall,
  shufflePlayers,
} from "../lib/draw";
import {
  calculateStandings,
  calculateTeamStandings,
  determineMatchWinner,
  isScoreValid,
  getMaxScore,
  autoFillOpponentScore,
  getScoringDescription,
  isSetComplete,
  SCORING_MODES,
  getScoringModeId,
  type ScoringModeId,
} from "../lib/scoring";
import type {
  Tournament,
  Player,
  Round,
  Match,
  GameSet,
  StandingEntry,
  TournamentMode,
  TournamentFormat,
  TournamentPlayerInfo,
} from "../lib/types";
import { parseHallConfig, playerDisplayName } from "../lib/types";
import type { LivePublishConfig } from "../lib/types";
import {
  LIVE_PUBLISH_SETTING_KEY,
  pushDelete,
  isTournamentLive,
  setTournamentLive,
  isTournamentPaused,
  setTournamentPaused,
} from "../lib/livePublish";
import { triggerImmediatePush, usePushStatus } from "../lib/useLivePublisher";
import { getAppSetting } from "../lib/db";
import { useT } from "../lib/I18nContext";
import { useToast } from "../lib/ToastContext";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const VALID_FORMATS: Record<TournamentMode, TournamentFormat[]> = {
  singles: ["round_robin", "elimination", "group_ko", "swiss", "monrad", "king_of_court", "waterfall", "double_elimination"],
  doubles: ["round_robin", "elimination", "random_doubles", "group_ko", "swiss", "monrad", "king_of_court", "waterfall", "double_elimination"],
  mixed: ["round_robin", "elimination", "random_doubles", "group_ko", "swiss", "monrad", "king_of_court", "waterfall", "double_elimination"],
};

/** Returns effective scoring for a given round phase. For group_ko format:
 *  - "group" phase → always tournament group settings
 *  - "ko" phase → ko_* settings if set, else group settings
 *  For all other formats, always returns the tournament settings. */
function getEffectiveScoring(tournament: Tournament, phase: string | null) {
  if (
    tournament.format === "group_ko" &&
    phase === "ko" &&
    tournament.ko_points_per_set != null
  ) {
    return {
      pointsPerSet: tournament.ko_points_per_set,
      setsToWin: tournament.ko_sets_to_win ?? tournament.sets_to_win,
      cap: tournament.ko_cap,
    };
  }
  return {
    pointsPerSet: tournament.points_per_set,
    setsToWin: tournament.sets_to_win,
    cap: tournament.cap,
  };
}

function StartKoModal({
  tournament,
  theme,
  onClose,
  onConfirm,
}: {
  tournament: Tournament;
  theme: ThemeColors;
  onClose: () => void;
  onConfirm: (koPointsPerSet: number | null, koSetsToWin: number | null, koCap: number | null) => void;
}) {
  const { t } = useT();
  const [useDifferent, setUseDifferent] = useState(false);
  const [scoringMode, setScoringMode] = useState<ScoringModeId>(
    getScoringModeId(tournament.points_per_set, tournament.cap)
  );
  const [setsToWin, setSetsToWin] = useState<number>(tournament.sets_to_win);
  const scoringPreset = SCORING_MODES.find((m) => m.id === scoringMode)!;

  const inputClass = `w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`;
  const labelClass = `block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`;

  const groupScoringLabel = `${t[`scoring_mode_${getScoringModeId(tournament.points_per_set, tournament.cap)}` as keyof typeof t] as string} · ${tournament.sets_to_win === 1 ? t.best_of_1 : tournament.sets_to_win === 2 ? t.best_of_3 : t.best_of_5}`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-md p-6 border ${theme.cardBorder}`}>
        <div className="flex justify-between items-center mb-5">
          <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
            🏆 {t.ko_modal_title}
          </h3>
          <button
            onClick={onClose}
            className={`${theme.textMuted} text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg transition-colors`}
          >
            ✕
          </button>
        </div>

        {/* Group phase scoring info */}
        <div className={`rounded-xl p-3 mb-4 border ${theme.cardBorder} ${theme.cardBg} bg-opacity-50`}>
          <div className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide mb-1`}>
            {t.ko_modal_group_phase_scoring}
          </div>
          <div className={`text-sm font-medium ${theme.textPrimary}`}>
            {groupScoringLabel}
          </div>
        </div>

        {/* Toggle for different KO scoring */}
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={useDifferent}
            onChange={(e) => setUseDifferent(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className={`text-sm ${theme.textSecondary}`}>{t.ko_modal_use_different}</span>
        </label>

        {/* KO scoring dropdowns */}
        {useDifferent && (
          <div className="space-y-4">
            <div className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide`}>
              {t.ko_modal_ko_scoring}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t.scoring_mode}</label>
                <select
                  value={scoringMode}
                  onChange={(e) => setScoringMode(e.target.value as ScoringModeId)}
                  className={inputClass}
                >
                  {SCORING_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {t[`scoring_mode_${m.id}` as keyof typeof t] as string}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.scoring_sets_to_win}</label>
                <select
                  value={setsToWin}
                  onChange={(e) => setSetsToWin(Number(e.target.value))}
                  className={inputClass}
                >
                  <option value={1}>{t.best_of_1}</option>
                  <option value={2}>{t.best_of_3}</option>
                  <option value={3}>{t.best_of_5}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className={`flex-1 ${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
          >
            {t.common_cancel}
          </button>
          <button
            onClick={() => onConfirm(
              useDifferent ? scoringPreset.points_per_set : null,
              useDifferent ? setsToWin : null,
              useDifferent ? scoringPreset.cap : null
            )}
            className="flex-1 bg-violet-600 text-white px-4 py-2.5 rounded-xl hover:bg-violet-700 shadow-sm transition-all text-sm font-medium"
          >
            🏆 {t.ko_modal_start_button}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTournamentModal({
  tournament,
  theme,
  onClose,
  onSave,
}: {
  tournament: Tournament;
  theme: ThemeColors;
  onClose: () => void;
  onSave: (data: {
    name: string;
    mode: TournamentMode;
    format: TournamentFormat;
    setsToWin: number;
    pointsPerSet: number;
    cap: number | null;
    courts: number;
    numGroups: number;
    qualifyPerGroup: number;
    entryFeeSingle: number;
    entryFeeDouble: number;
  }) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(tournament.name);
  const [mode, setMode] = useState<TournamentMode>(tournament.mode);
  const [format, setFormat] = useState<TournamentFormat>(tournament.format);
  const [scoringMode, setScoringMode] = useState<ScoringModeId>(
    getScoringModeId(tournament.points_per_set, tournament.cap)
  );
  const scoringPreset = SCORING_MODES.find((m) => m.id === scoringMode)!;
  const pointsPerSet = scoringPreset.points_per_set;
  const cap = scoringPreset.cap;
  const [setsToWin, setSetsToWin] = useState<number>(tournament.sets_to_win);
  const [courts, setCourts] = useState(tournament.courts);
  const [numGroups, setNumGroups] = useState(tournament.num_groups || 2);
  const [qualifyPerGroup, setQualifyPerGroup] = useState(tournament.qualify_per_group || 2);
  const [entryFeeSingle, setEntryFeeSingle] = useState(String(tournament.entry_fee_single || 0));
  const [entryFeeDouble, setEntryFeeDouble] = useState(String(tournament.entry_fee_double || 0));

  useEffect(() => {
    if (!VALID_FORMATS[mode].includes(format)) {
      setFormat(VALID_FORMATS[mode][0]);
    }
  }, [mode, format]);

  const inputClass = `w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-xl px-4 py-2.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`;
  const labelClass = `block text-xs font-medium ${theme.textSecondary} mb-1 uppercase tracking-wide`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${theme.cardBg} rounded-2xl shadow-2xl w-full max-w-lg p-6 border ${theme.cardBorder}`}>
        <div className="flex justify-between items-center mb-5">
          <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
            ✏️ {t.edit_tournament_title}
          </h3>
          <button
            onClick={onClose}
            className={`${theme.textMuted} text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg transition-colors`}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>{t.tournament_name}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t.tournament_mode}</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as TournamentMode)} className={inputClass}>
                {Object.entries({ singles: t.mode_singles, doubles: t.mode_doubles, mixed: t.mode_mixed }).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.tournament_format}</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as TournamentFormat)} className={inputClass}>
                {VALID_FORMATS[mode].map((f) => {
                  const fmtLabels: Record<string, string> = { round_robin: t.format_round_robin, elimination: t.format_elimination, random_doubles: t.format_random_doubles, group_ko: t.format_group_ko, swiss: t.format_swiss, double_elimination: t.format_double_elimination, monrad: t.format_monrad, king_of_court: t.format_king_of_court, waterfall: t.format_waterfall };
                  return <option key={f} value={f}>{fmtLabels[f]}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t.scoring_mode}</label>
              <select value={scoringMode} onChange={(e) => setScoringMode(e.target.value as ScoringModeId)} className={inputClass}>
                {SCORING_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{t[`scoring_mode_${m.id}` as keyof typeof t] as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.scoring_sets_to_win}</label>
              <select value={setsToWin} onChange={(e) => setSetsToWin(Number(e.target.value))} className={inputClass}>
                <option value={1}>{t.best_of_1}</option>
                <option value={2}>{t.best_of_3}</option>
                <option value={3}>{t.best_of_5}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t.edit_tournament_courts_label}</label>
              <select value={courts} onChange={(e) => setCourts(Number(e.target.value))} className={inputClass}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? t.common_field : t.common_fields}</option>
                ))}
              </select>
            </div>
          </div>

          {format === "group_ko" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t.edit_tournament_groups_count}</label>
                <select value={numGroups} onChange={(e) => setNumGroups(Number(e.target.value))} className={inputClass}>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{t.groups_count.replace("{count}", String(n))}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.tournament_ko_size}</label>
                <select value={qualifyPerGroup} onChange={(e) => setQualifyPerGroup(Number(e.target.value))} className={inputClass}>
                  {[4, 8, 16, 32].map((n) => (
                    <option key={n} value={n}>{t.tournament_qualify_ko_count.replace("{count}", String(n))}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(format === "swiss" || format === "monrad" || format === "waterfall") && (
            <div>
              <label className={labelClass}>{t.tournament_swiss_rounds}</label>
              <select value={numGroups} onChange={(e) => setNumGroups(Number(e.target.value))} className={inputClass}>
                {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n} {t.tournament_view_tab_matches.toLowerCase()}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t.edit_tournament_fee_single}</label>
              <input type="number" value={entryFeeSingle} onChange={(e) => setEntryFeeSingle(e.target.value)} className={inputClass} min={0} step="0.5" />
            </div>
            <div>
              <label className={labelClass}>{t.edit_tournament_fee_double}</label>
              <input type="number" value={entryFeeDouble} onChange={(e) => setEntryFeeDouble(e.target.value)} className={inputClass} min={0} step="0.5" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className={`flex-1 ${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:opacity-80 transition-all text-sm font-medium`}
          >
            {t.common_cancel}
          </button>
          <button
            onClick={() => onSave({ name, mode, format, setsToWin, pointsPerSet, cap, courts, numGroups, qualifyPerGroup, entryFeeSingle: Number(entryFeeSingle) || 0, entryFeeDouble: Number(entryFeeDouble) || 0 })}
            className={`flex-1 ${theme.primaryBg} text-white px-4 py-2.5 rounded-xl ${theme.primaryHoverBg} shadow-sm transition-all text-sm font-medium`}
          >
            {t.common_save}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TournamentView() {
  const { theme } = useTheme();
  const { t } = useT();
  const { showSuccess, showError } = useToast();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navSeeds = (location.state as any)?.seeds as number[] | undefined;
  const navTeamsFromState = (location.state as any)?.teams as [number, number][] | undefined;
  const navSavedSuccess = !!(location.state as any)?.savedSuccess;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  useDocumentTitle(tournament?.name ?? t.nav_tournaments);
  const navTeams = useMemo(() => {
    if (navTeamsFromState && navTeamsFromState.length > 0) return navTeamsFromState;
    if (tournament?.team_config) {
      try { return JSON.parse(tournament.team_config) as [number, number][]; } catch (err) { console.error("TournamentView: failed to parse team_config JSON:", err); }
    }
    return undefined;
  }, [navTeamsFromState, tournament?.team_config]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [matchesByRound, setMatchesByRound] = useState<
    Map<number, Match[]>
  >(new Map());
  const [setsByMatch, setSetsByMatch] = useState<Map<number, GameSet[]>>(
    new Map()
  );
  const [standings, setStandings] = useState<StandingEntry[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [retiredPlayerIds, setRetiredPlayerIds] = useState<Set<number>>(new Set());
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentData, setPaymentData] = useState<TournamentPlayerInfo[]>([]);
  const [collapsedClubs, setCollapsedClubs] = useState<Set<string>>(new Set());
  const [showTemplateExport, setShowTemplateExport] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [viewTab, setViewTab] = useState<"spiele" | "gruppen" | "bracket" | "rangliste" | "verwaltung">("spiele");
  const [retireTarget, setRetireTarget] = useState<{ player: Player; partnerNote: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Player | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<number>>(new Set());
  const [editingMatchIds, setEditingMatchIds] = useState<Set<number>>(new Set());
  const [showStartKoModal, setShowStartKoModal] = useState(false);
  const [restWarning, setRestWarning] = useState<{
    matchId: number;
    court: number;
    players: { id: number; name: string; minutesLeft: number }[];
  } | null>(null);
  // Hard player-overlap block: opens when the user tries to assign a match
  // whose players are still on another court. No bypass — only "close".
  const [playerConflict, setPlayerConflict] = useState<{
    matchId: number;
    players: { id: number; name: string; court: number }[];
  } | null>(null);
  const recentlyCompletedRef = React.useRef(recentlyCompleted)
  recentlyCompletedRef.current = recentlyCompleted;
  const activeRoundRef = React.useRef(activeRound);
  activeRoundRef.current = activeRound;

  const tournamentId = Number(id);

  // Phase-aware scoring: derive effective scoring based on the active round's phase
  const activeRoundPhase = rounds.find((r) => r.id === activeRound)?.phase ?? null;
  const effectiveScoring = tournament
    ? getEffectiveScoring(tournament, activeRoundPhase)
    : { pointsPerSet: 21, setsToWin: 2, cap: 30 };

  const loadAll = useCallback(async () => {
    const td = await getTournament(tournamentId);
    setTournament(td);

    const ap = await getPlayers();
    setAllPlayers(ap);

    const p = await getTournamentPlayers(tournamentId);
    setPlayers(p);

    const r = await getRounds(tournamentId);
    setRounds(r);

    // Bulk-load all matches and sets in 2 queries instead of N+1
    const allMatches = await getAllMatchesByTournament(tournamentId);
    const allSets = await getAllSetsByTournament(tournamentId);

    // Group matches by round
    const mbr = new Map<number, Match[]>();
    for (const match of allMatches) {
      const arr = mbr.get(match.round_id);
      if (arr) arr.push(match);
      else mbr.set(match.round_id, [match]);
    }

    // Group sets by match
    const sbm = new Map<number, GameSet[]>();
    for (const set of allSets) {
      const arr = sbm.get(set.match_id);
      if (arr) arr.push(set);
      else sbm.set(set.match_id, [set]);
    }

    setMatchesByRound(mbr);
    setSetsByMatch(sbm);
    setAllMatches(allMatches);

    const retiredIds = await getRetiredPlayerIds(tournamentId);
    setRetiredPlayerIds(new Set(retiredIds));

    const pd = await getTournamentPlayersDetailed(tournamentId);
    setPaymentData(pd);

    const s = calculateStandings(p, allMatches, sbm);
    setStandings(s);

    if (r.length > 0) {
      if (td.format === "group_ko" && r.some((rr) => rr.phase === "group")) {
        const koRs = r.filter((rr) => rr.phase === "ko");
        if (koRs.length > 0) {
          // KO rounds exist: preserve current round if still valid, otherwise auto-select first KO round
          setActiveRound((prev) => {
            const stillValid = prev !== null && r.some((rr) => rr.id === prev);
            return stillValid ? prev : koRs[0].id;
          });
          setShowAllGroups(false);
        } else {
          // Still in group phase: the unassigned-queue spans all groups
          // anyway (smart-queue), so the per-round buttons are now purely
          // a status display. Force the cross-group view permanently —
          // no per-round drill-down during the group phase.
          setShowAllGroups(true);
          setActiveRound(null);
        }
      } else {
        setActiveRound((prev) => prev ?? r[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Show save-success toast when arriving from edit wizard; clear nav state so refresh doesn't re-trigger.
  const savedSuccessShownRef = React.useRef(false);
  useEffect(() => {
    if (!navSavedSuccess || savedSuccessShownRef.current) return;
    savedSuccessShownRef.current = true;
    window.history.replaceState({}, document.title);
    showSuccess(t.edit_tournament_saved);
  }, [navSavedSuccess, showSuccess, t.edit_tournament_saved]);

  const playerName = (playerId: number | null): string => {
    if (playerId === null || playerId === undefined) return "-";
    const p = players.find((p) => p.id === playerId);
    return p ? playerDisplayName(p) : "?";
  };

  const handleStartTournament = async (playersOverride?: Player[]) => {
    if (!tournament) return;

    // Use override (from attendance check) or fall back to current state
    const ep = playersOverride ?? players;

    await updateTournamentStatus(tournamentId, "active");

    const numCourts = tournament.courts || 1;
    // Bei mehreren Feldern: kein Court vorbelegen, Timer startet erst bei manueller Zuweisung
    // Bei 1 Feld: automatisch Feld 1 zuweisen (kein Drag&Drop noetig)
    const autoAssign = numCourts === 1;

    if (tournament.format === "round_robin" && tournament.mode === "singles") {
      const allRounds = generateRoundRobinSingles(ep);
      for (let i = 0; i < allRounds.length; i++) {
        const roundId = await createRound(tournamentId, i + 1);
        for (let mi = 0; mi < allRounds[i].length; mi++) {
          const m = allRounds[i][mi];
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
        }
      }
    } else if (tournament.format === "elimination" && tournament.mode === "singles") {
      const matches = generateEliminationBracket(ep, navSeeds);
      const roundId = await createRound(tournamentId, 1);
      for (const m of matches) {
        if (m.team2_p1 !== -1) {
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
        }
      }
    } else if (tournament.format === "elimination" && tournament.mode !== "singles") {
      // Doppel/Mixed KO: Manuelle Teams oder automatisch bilden
      const teams = navTeams && navTeams.length > 0
        ? navTeams
        : tournament.mode === "mixed"
          ? formFixedMixedTeams(ep)
          : formFixedDoubleTeams(ep);
      const matches = generateEliminationBracketDoubles(teams);
      const roundId = await createRound(tournamentId, 1);
      for (const m of matches) {
        const court = autoAssign ? 1 : null;
        await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
      }
    } else if (tournament.format === "group_ko") {
      // Gruppenphase starten
      await updateTournamentPhase(tournamentId, "group");
      const groups = splitIntoGroups(ep, tournament.num_groups || 2, navSeeds);
      let roundCounter = 1;

      if (tournament.mode === "singles") {
        // Einzel: Round-Robin innerhalb jeder Gruppe
        for (let g = 0; g < groups.length; g++) {
          const groupPlayers = groups[g];
          if (groupPlayers.length < 2) continue;
          const groupRounds = generateRoundRobinSingles(groupPlayers);
          for (let r = 0; r < groupRounds.length; r++) {
            const roundId = await createRound(tournamentId, roundCounter++, "group", g + 1);
            for (const m of groupRounds[r]) {
              const court = autoAssign ? 1 : null;
              await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
            }
          }
        }
      } else {
        // Doppel/Mixed: Feste Teams, Round-Robin innerhalb jeder Gruppe
        // Erst Teams bilden, dann in Gruppen aufteilen
        const allTeams = navTeams && navTeams.length > 0
          ? navTeams
          : tournament.mode === "mixed"
            ? formFixedMixedTeams(ep)
            : formFixedDoubleTeams(ep);
        const teamGroups = splitTeamsIntoGroups(allTeams, tournament.num_groups || 2);

        for (let g = 0; g < teamGroups.length; g++) {
          const groupTeams = teamGroups[g];
          if (groupTeams.length < 2) continue;
          const groupRounds = generateRoundRobinDoubles(groupTeams);
          for (let r = 0; r < groupRounds.length; r++) {
            const roundId = await createRound(tournamentId, roundCounter++, "group", g + 1);
            for (const m of groupRounds[r]) {
              const court = autoAssign ? 1 : null;
              await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
            }
          }
        }
      }
    } else if (tournament.format === "round_robin" && tournament.mode !== "singles") {
      // Doppel/Mixed Round-Robin: Feste Teams
      const teams = navTeams && navTeams.length > 0
        ? navTeams
        : tournament.mode === "mixed"
          ? formFixedMixedTeams(ep)
          : formFixedDoubleTeams(ep);
      const allRounds = generateRoundRobinDoubles(teams);
      for (let i = 0; i < allRounds.length; i++) {
        const roundId = await createRound(tournamentId, i + 1);
        for (const m of allRounds[i]) {
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
        }
      }
    } else if (tournament.format === "random_doubles") {
      await generateNextRound();
    } else if (tournament.format === "swiss") {
      await updateTournamentPhase(tournamentId, "swiss");
      if (tournament.mode === "singles") {
        const matches = generateSwissFirstRound(ep);
        const roundId = await createRound(tournamentId, 1, "swiss");
        for (const m of matches) {
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
        }
      } else {
        const teams = navTeams && navTeams.length > 0
          ? navTeams
          : tournament.mode === "mixed"
            ? formFixedMixedTeams(ep)
            : formFixedDoubleTeams(ep);
        const matches = generateSwissFirstRoundDoubles(teams);
        const roundId = await createRound(tournamentId, 1, "swiss");
        for (const m of matches) {
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
        }
      }
    } else if (tournament.format === "monrad") {
      // Monrad: reuse Swiss infrastructure with random first round
      await updateTournamentPhase(tournamentId, "swiss");
      if (tournament.mode === "singles") {
        const matches = generateSwissFirstRound(ep);
        const roundId = await createRound(tournamentId, 1, "swiss");
        for (const m of matches) {
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
        }
      } else {
        const teams = navTeams && navTeams.length > 0
          ? navTeams
          : tournament.mode === "mixed"
            ? formFixedMixedTeams(ep)
            : formFixedDoubleTeams(ep);
        const matches = generateSwissFirstRoundDoubles(teams);
        const roundId = await createRound(tournamentId, 1, "swiss");
        for (const m of matches) {
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
        }
      }
    } else if (tournament.format === "king_of_court") {
      // King of the Court: shuffle players, generate first match
      const shuffled = shufflePlayers(ep.map((p) => p.id));
      if (shuffled.length < 2) return;
      const { team1_p1, team2_p1 } = generateKingOfCourtMatch(shuffled);
      const roundId = await createRound(tournamentId, 1);
      const court = autoAssign ? 1 : null;
      await createMatch(roundId, team1_p1, null, team2_p1, null, court);
    } else if (tournament.format === "waterfall") {
      // Waterfall: shuffle players, assign to courts, generate first round
      const shuffled = shufflePlayers(ep.map((p) => p.id));
      const waterfallMatches = generateWaterfallRound(shuffled);
      const roundId = await createRound(tournamentId, 1);
      for (const m of waterfallMatches) {
        await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, m.court);
      }
    } else if (tournament.format === "double_elimination") {
      await updateTournamentPhase(tournamentId, "winners");
      if (tournament.mode === "singles") {
        const matches = generateEliminationBracket(ep, navSeeds);
        const roundId = await createRound(tournamentId, 1, "winners");
        for (const m of matches) {
          if (m.team2_p1 !== -1) {
            const court = autoAssign ? 1 : null;
            await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
          }
        }
      } else {
        const teams = navTeams && navTeams.length > 0
          ? navTeams
          : tournament.mode === "mixed"
            ? formFixedMixedTeams(ep)
            : formFixedDoubleTeams(ep);
        const matches = generateEliminationBracketDoubles(teams);
        const roundId = await createRound(tournamentId, 1, "winners");
        for (const m of matches) {
          const court = autoAssign ? 1 : null;
          await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
        }
      }
    }

    loadAll();
  };

  const handleAttendanceConfirm = async (presentIds: Set<number>) => {
    setShowAttendance(false);
    // Remove absent players from the tournament before starting
    const absentIds = players.filter((p) => !presentIds.has(p.id)).map((p) => p.id);
    for (const id of absentIds) {
      await removePlayerFromTournament(tournamentId, id);
    }
    // Reload fresh player list and start with it
    const freshPlayers = await getTournamentPlayers(tournamentId);
    setPlayers(freshPlayers);
    await handleStartTournament(freshPlayers);
  };

  const generateNextRound = async () => {
    if (!tournament) return;

    // Remember if the current last round was fully complete BEFORE creating the new one.
    // If it was, we switch to the new round's tab automatically (existing behaviour).
    // If not (early draw), we stay on the current tab so ongoing matches stay visible.
    const lastRoundId = rounds.length > 0 ? rounds[rounds.length - 1].id : null;
    const wasFullyComplete = lastRoundId ? allRoundMatchesCompleted(lastRoundId) : true;

    const allMatchesLocal: Match[] = [];
    for (const [, matches] of matchesByRound) {
      allMatchesLocal.push(...matches);
    }
    const prevPairings = getPreviousPairings(allMatchesLocal);
    const pairingCounts = getPreviousPairingCounts(allMatchesLocal);
    const nextRoundNum = rounds.length + 1;

    // Filter out retired players for new round generation
    const activePlayers = players.filter((p) => !retiredPlayerIds.has(p.id));

    // Calculate match counts per player for fair bye rotation
    const matchCounts = new Map<number, number>();
    for (const m of allMatchesLocal) {
      for (const pid of [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2]) {
        if (pid !== null) {
          matchCounts.set(pid, (matchCounts.get(pid) ?? 0) + 1);
        }
      }
    }

    let newMatches: {
      team1_p1: number;
      team1_p2: number;
      team2_p1: number;
      team2_p2: number;
    }[] = [];

    if (tournament.mode === "mixed") {
      newMatches = generateMixedDoublesRound(activePlayers, prevPairings);
    } else {
      newMatches = generateRandomDoublesRound(activePlayers, prevPairings, matchCounts, pairingCounts);
    }

    if (newMatches.length === 0) return;

    const numCourts = tournament.courts || 1;
    const autoAssign = numCourts === 1;
    const roundId = await createRound(tournamentId, nextRoundNum);
    for (let mi = 0; mi < newMatches.length; mi++) {
      const m = newMatches[mi];
      const court = autoAssign ? 1 : null;
      await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
    }

    // Only auto-navigate to the new round tab if the previous round was already complete.
    // For early draws the user stays on the current round to keep ongoing matches visible.
    if (wasFullyComplete) {
      setActiveRound(roundId);
    }
    loadAll();
  };

  const generateNextSwissRound = async () => {
    if (!tournament || tournament.format !== "swiss") return;

    const swissRounds = rounds.filter((r) => r.phase === "swiss");
    const allSwissMatches: Match[] = [];
    const allSwissSets = new Map<number, GameSet[]>();
    for (const r of swissRounds) {
      const ms = matchesByRound.get(r.id) || [];
      allSwissMatches.push(...ms);
      for (const m of ms) allSwissSets.set(m.id, setsByMatch.get(m.id) || []);
    }

    // Build previousMatchups set
    const previousMatchups = new Set<string>();
    for (const m of allSwissMatches) {
      if (tournament.mode === "singles") {
        const ids = [m.team1_p1, m.team2_p1].sort((a, b) => a - b);
        previousMatchups.add(`${ids[0]}-${ids[1]}`);
      } else {
        const t1Key = [m.team1_p1, m.team1_p2!].sort((a, b) => a - b).join("-");
        const t2Key = [m.team2_p1, m.team2_p2!].sort((a, b) => a - b).join("-");
        const parts = [t1Key, t2Key].sort();
        previousMatchups.add(`${parts[0]}-${parts[1]}`);
      }
    }

    const activePlayers = players.filter((p) => !retiredPlayerIds.has(p.id));
    const numCourts = tournament.courts || 1;
    const autoAssign = numCourts === 1;
    const nextRoundNum = rounds.length + 1;

    if (tournament.mode === "singles") {
      const swissStandings = calculateStandings(activePlayers, allSwissMatches, allSwissSets);
      const newMatches = generateSwissRound(swissStandings, previousMatchups);
      if (newMatches.length === 0) return;
      const roundId = await createRound(tournamentId, nextRoundNum, "swiss");
      for (const m of newMatches) {
        const court = autoAssign ? 1 : null;
        await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
      }
    } else {
      const teamStandings = calculateTeamStandings(activePlayers, allSwissMatches, allSwissSets);
      const newMatches = generateSwissRoundDoubles(teamStandings, previousMatchups);
      if (newMatches.length === 0) return;
      const roundId = await createRound(tournamentId, nextRoundNum, "swiss");
      for (const m of newMatches) {
        const court = autoAssign ? 1 : null;
        await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
      }
    }

    loadAll();
  };

  const generateNextMonradRound = async () => {
    if (!tournament || tournament.format !== "monrad") return;

    const swissRoundsLocal = rounds.filter((r) => r.phase === "swiss");
    const allMonradMatches: Match[] = [];
    const allMonradSets = new Map<number, GameSet[]>();
    for (const r of swissRoundsLocal) {
      const ms = matchesByRound.get(r.id) || [];
      allMonradMatches.push(...ms);
      for (const m of ms) allMonradSets.set(m.id, setsByMatch.get(m.id) || []);
    }

    const activePlayers = players.filter((p) => !retiredPlayerIds.has(p.id));
    const numCourts = tournament.courts || 1;
    const autoAssign = numCourts === 1;
    const nextRoundNum = rounds.length + 1;

    if (tournament.mode === "singles") {
      const monradStandings = calculateStandings(activePlayers, allMonradMatches, allMonradSets);
      const newMatches = generateMonradRound(monradStandings);
      if (newMatches.length === 0) return;
      const roundId = await createRound(tournamentId, nextRoundNum, "swiss");
      for (const m of newMatches) {
        const court = autoAssign ? 1 : null;
        await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, court);
      }
    } else {
      const teamStandings = calculateTeamStandings(activePlayers, allMonradMatches, allMonradSets);
      const newMatches = generateMonradRoundDoubles(teamStandings);
      if (newMatches.length === 0) return;
      const roundId = await createRound(tournamentId, nextRoundNum, "swiss");
      for (const m of newMatches) {
        const court = autoAssign ? 1 : null;
        await createMatch(roundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
      }
    }

    loadAll();
  };

  const generateNextKingOfCourtMatch = async () => {
    if (!tournament || tournament.format !== "king_of_court") return;

    // Build queue from match history: winner stays (front), loser goes to back
    const allMatchesLocal: Match[] = [];
    for (const [, matches] of matchesByRound) {
      allMatchesLocal.push(...matches);
    }

    // Get the last completed match to determine new queue order
    const completedMatches = allMatchesLocal
      .filter((m) => m.status === "completed" && m.winner_team)
      .sort((a, b) => b.id - a.id); // most recent first

    if (completedMatches.length === 0) return;

    const lastMatch = completedMatches[0];
    const winner = lastMatch.winner_team === 1 ? lastMatch.team1_p1 : lastMatch.team2_p1;
    const loser = lastMatch.winner_team === 1 ? lastMatch.team2_p1 : lastMatch.team1_p1;

    // Build queue: winner first, then all other players who aren't winner/loser, then loser at back
    const allPlayerIds = players.filter((p) => !retiredPlayerIds.has(p.id)).map((p) => p.id);
    const inMatch = new Set([winner, loser]);
    const others = allPlayerIds.filter((id) => !inMatch.has(id));

    // Reconstruct remaining queue from previous state
    // The queue order is: winner (stays), then others in previous order, then loser at back
    const newQueue = [winner, ...others, loser];

    if (newQueue.length < 2) return;

    const { team1_p1, team2_p1 } = generateKingOfCourtMatch(newQueue);
    const numCourts = tournament.courts || 1;
    const autoAssign = numCourts === 1;
    const nextRoundNum = rounds.length + 1;
    const roundId = await createRound(tournamentId, nextRoundNum);
    const court = autoAssign ? 1 : null;
    await createMatch(roundId, team1_p1, null, team2_p1, null, court);

    loadAll();
  };

  const generateNextWaterfallRound = async () => {
    if (!tournament || tournament.format !== "waterfall") return;

    // Get the last round's matches to determine results
    const lastRound = rounds[rounds.length - 1];
    if (!lastRound) return;
    const lastMatches = matchesByRound.get(lastRound.id) || [];

    // Build results from last round
    const results: { court: number; winner: number; loser: number }[] = [];
    for (const m of lastMatches) {
      if (!m.winner_team || !m.court) continue;
      results.push({
        court: m.court,
        winner: m.winner_team === 1 ? m.team1_p1 : m.team2_p1,
        loser: m.winner_team === 1 ? m.team2_p1 : m.team1_p1,
      });
    }

    if (results.length === 0) return;

    // Reconstruct current court assignments from last round
    const currentAssignments: number[] = [];
    const sortedMatches = [...lastMatches].sort((a, b) => (a.court || 0) - (b.court || 0));
    for (const m of sortedMatches) {
      currentAssignments.push(m.team1_p1);
      currentAssignments.push(m.team2_p1);
    }
    // Add any sitting-out players
    const inMatch = new Set(currentAssignments);
    for (const p of players) {
      if (!inMatch.has(p.id) && !retiredPlayerIds.has(p.id)) {
        currentAssignments.push(p.id);
      }
    }

    // Advance
    const newAssignments = advanceWaterfall(currentAssignments, results);
    const waterfallMatches = generateWaterfallRound(newAssignments);

    const nextRoundNum = rounds.length + 1;
    const roundId = await createRound(tournamentId, nextRoundNum);
    for (const m of waterfallMatches) {
      await createMatch(roundId, m.team1_p1, null, m.team2_p1, null, m.court);
    }

    loadAll();
  };

  // Helper: collect matches/sets for a group
  const getGroupData = (groupNum: number) => {
    const gRounds = rounds.filter((r) => r.phase === "group" && r.group_number === groupNum);
    const gMatches: Match[] = [];
    const gSets = new Map<number, GameSet[]>();
    for (const r of gRounds) {
      const ms = matchesByRound.get(r.id) || [];
      gMatches.push(...ms);
      for (const m of ms) gSets.set(m.id, setsByMatch.get(m.id) || []);
    }
    const pIds = new Set<number>();
    for (const m of gMatches) {
      pIds.add(m.team1_p1); if (m.team1_p2) pIds.add(m.team1_p2);
      pIds.add(m.team2_p1); if (m.team2_p2) pIds.add(m.team2_p2);
    }
    return { gMatches, gSets, pIds };
  };

  // Start KO phase after group phase is complete
  // Helper: next power of 2 (e.g. 6 → 8, 5 → 8, 8 → 8)
  const nextPowerOf2 = (n: number): number => {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  };

  const startKoPhase = async () => {
    if (!tournament || tournament.format !== "group_ko") return;

    const numGroups = tournament.num_groups || 2;
    const isDoubles = tournament.mode !== "singles";
    // qualify_per_group now stores the total KO size (power of 2), e.g. 8
    // Fall back to old behavior: if value is small (1-4), it's the old "per group" count
    const rawQualify = tournament.qualify_per_group || 2;
    const koSize = rawQualify >= 4 && (rawQualify & (rawQualify - 1)) === 0
      ? rawQualify  // power of 2 → new format (total KO size)
      : rawQualify * numGroups; // old format (per group) → calculate total
    const qualifyPerGroup = Math.floor(koSize / numGroups);

    await updateTournamentPhase(tournamentId, "ko");

    const numCourts = tournament.courts || 1;
    const autoAssign = numCourts === 1;
    const koRoundId = await createRound(tournamentId, rounds.length + 1, "ko", null);

    if (isDoubles) {
      // Doppel/Mixed: Qualifizierte TEAMS sammeln
      const qualifiedTeams: [number, number][] = [];
      const runnersUp: { team: [number, number]; wins: number; losses: number; setsWon: number; setsLost: number; pointsWon: number; pointsLost: number }[] = [];

      for (let g = 1; g <= numGroups; g++) {
        const { gMatches, gSets, pIds } = getGroupData(g);
        const gPlayers = players.filter((p) => pIds.has(p.id));
        const teamStandings = calculateTeamStandings(gPlayers, gMatches, gSets);
        for (let i = 0; i < teamStandings.length; i++) {
          const ts = teamStandings[i];
          if (i < qualifyPerGroup) {
            qualifiedTeams.push([ts.player1.id, ts.player2.id]);
          } else {
            runnersUp.push({
              team: [ts.player1.id, ts.player2.id],
              wins: ts.wins, losses: ts.losses, setsWon: ts.setsWon, setsLost: ts.setsLost,
              pointsWon: ts.pointsWon, pointsLost: ts.pointsLost,
            });
          }
        }
      }

      // Fill up with best runners-up, sorted by percentage-based criteria
      const target = koSize > qualifiedTeams.length ? koSize : nextPowerOf2(qualifiedTeams.length);
      if (qualifiedTeams.length < target && runnersUp.length > 0) {
        runnersUp.sort((a, b) => {
          // 1. Match win percentage (wins / total matches)
          const matchPctA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
          const matchPctB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
          if (matchPctB !== matchPctA) return matchPctB - matchPctA;
          // 2. Set win percentage (setsWon / total sets)
          const setPctA = (a.setsWon + a.setsLost) > 0 ? a.setsWon / (a.setsWon + a.setsLost) : 0;
          const setPctB = (b.setsWon + b.setsLost) > 0 ? b.setsWon / (b.setsWon + b.setsLost) : 0;
          if (setPctB !== setPctA) return setPctB - setPctA;
          // 3. Point win percentage (pointsWon / total points)
          const ptPctA = (a.pointsWon + a.pointsLost) > 0 ? a.pointsWon / (a.pointsWon + a.pointsLost) : 0;
          const ptPctB = (b.pointsWon + b.pointsLost) > 0 ? b.pointsWon / (b.pointsWon + b.pointsLost) : 0;
          return ptPctB - ptPctA;
        });
        const needed = target - qualifiedTeams.length;
        for (let i = 0; i < Math.min(needed, runnersUp.length); i++) {
          qualifiedTeams.push(runnersUp[i].team);
        }
      }

      if (qualifiedTeams.length < 2) return;
      const koMatches = generateEliminationBracketDoubles(qualifiedTeams);
      for (const m of koMatches) {
        const court = autoAssign ? 1 : null;
        await createMatch(koRoundId, m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2, court);
      }
    } else {
      // Einzel: Qualifizierte SPIELER sammeln
      const qualified: number[] = [];
      const runnersUp: { playerId: number; wins: number; losses: number; setsWon: number; setsLost: number; pointsWon: number; pointsLost: number }[] = [];

      for (let g = 1; g <= numGroups; g++) {
        const { gMatches, gSets, pIds } = getGroupData(g);
        const gPlayers = players.filter((p) => pIds.has(p.id));
        const gStandings = calculateStandings(gPlayers, gMatches, gSets);
        for (let i = 0; i < gStandings.length; i++) {
          if (i < qualifyPerGroup) {
            qualified.push(gStandings[i].player.id);
          } else {
            const s = gStandings[i];
            runnersUp.push({
              playerId: s.player.id,
              wins: s.wins, losses: s.losses, setsWon: s.setsWon, setsLost: s.setsLost,
              pointsWon: s.pointsWon, pointsLost: s.pointsLost,
            });
          }
        }
      }

      // Fill up with best runners-up, sorted by percentage-based criteria
      const target = koSize > qualified.length ? koSize : nextPowerOf2(qualified.length);
      if (qualified.length < target && runnersUp.length > 0) {
        runnersUp.sort((a, b) => {
          // 1. Match win percentage
          const matchPctA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
          const matchPctB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
          if (matchPctB !== matchPctA) return matchPctB - matchPctA;
          // 2. Set win percentage
          const setPctA = (a.setsWon + a.setsLost) > 0 ? a.setsWon / (a.setsWon + a.setsLost) : 0;
          const setPctB = (b.setsWon + b.setsLost) > 0 ? b.setsWon / (b.setsWon + b.setsLost) : 0;
          if (setPctB !== setPctA) return setPctB - setPctA;
          // 3. Point win percentage
          const ptPctA = (a.pointsWon + a.pointsLost) > 0 ? a.pointsWon / (a.pointsWon + a.pointsLost) : 0;
          const ptPctB = (b.pointsWon + b.pointsLost) > 0 ? b.pointsWon / (b.pointsWon + b.pointsLost) : 0;
          return ptPctB - ptPctA;
        });
        const needed = target - qualified.length;
        for (let i = 0; i < Math.min(needed, runnersUp.length); i++) {
          qualified.push(runnersUp[i].playerId);
        }
      }

      if (qualified.length < 2) return;
      const qualifiedPlayers = qualified
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);
      const koMatches = generateEliminationBracket(qualifiedPlayers);
      for (const m of koMatches) {
        if (m.team2_p1 !== -1) {
          const court = autoAssign ? 1 : null;
          await createMatch(koRoundId, m.team1_p1, null, m.team2_p1, null, court);
        }
      }
    }

    setActiveRound(koRoundId);
    loadAll();
  };

  const advanceDoubleElimination = async () => {
    if (!tournament || tournament.format !== "double_elimination") return;

    const winnersRounds = rounds.filter((r) => r.phase === "winners");
    const losersRounds = rounds.filter((r) => r.phase === "losers");

    const numCourts = tournament.courts || 1;
    const autoAssign = numCourts === 1;
    const nextRoundNum = rounds.length + 1;

    // Find last completed round in each bracket
    const lastCompletedWinners = [...winnersRounds].reverse().find((r) => allRoundMatchesCompleted(r.id));
    const lastCompletedLosers = [...losersRounds].reverse().find((r) => allRoundMatchesCompleted(r.id));

    // Check if we already created the next round for each bracket
    const lastWinnersRound = winnersRounds[winnersRounds.length - 1];
    const lastLosersRound = losersRounds.length > 0 ? losersRounds[losersRounds.length - 1] : null;

    // Process completed winners round: winners go to next winners round, losers drop to losers bracket
    if (lastCompletedWinners && lastCompletedWinners === lastWinnersRound) {
      const wMatches = matchesByRound.get(lastCompletedWinners.id) || [];

      const winners: { p1: number; p2: number | null }[] = [];
      const losers: { p1: number; p2: number | null }[] = [];

      for (const m of wMatches) {
        if (!m.winner_team) continue;
        if (m.winner_team === 1) {
          winners.push({ p1: m.team1_p1, p2: m.team1_p2 });
          losers.push({ p1: m.team2_p1, p2: m.team2_p2 });
        } else {
          winners.push({ p1: m.team2_p1, p2: m.team2_p2 });
          losers.push({ p1: m.team1_p1, p2: m.team1_p2 });
        }
      }

      // Create next winners round (if more than 1 winner)
      if (winners.length >= 2) {
        const wRoundId = await createRound(tournamentId, nextRoundNum, "winners");
        for (let i = 0; i < winners.length - 1; i += 2) {
          const w1 = winners[i];
          const w2 = winners[i + 1];
          const court = autoAssign ? 1 : null;
          await createMatch(wRoundId, w1.p1, w1.p2, w2.p1, w2.p2, court);
        }
      }

      // Create losers bracket round from dropped players
      if (losers.length >= 2) {
        // If losers bracket already has players waiting, combine them
        // For simplicity: losers from winners bracket form new losers round
        const lRoundId = await createRound(tournamentId, nextRoundNum + 1, "losers");
        for (let i = 0; i < losers.length - 1; i += 2) {
          const l1 = losers[i];
          const l2 = losers[i + 1];
          const court = autoAssign ? 1 : null;
          await createMatch(lRoundId, l1.p1, l1.p2, l2.p1, l2.p2, court);
        }
      } else if (losers.length === 1 && winners.length === 1) {
        // Grand Final: last winner vs last loser bracket winner (or this loser)
        // Check if losers bracket has a remaining player
        const lastLosersMatches = lastLosersRound ? matchesByRound.get(lastLosersRound.id) || [] : [];
        const losersComplete = lastLosersRound ? allRoundMatchesCompleted(lastLosersRound.id) : true;
        let losersChampion: { p1: number; p2: number | null } | null = null;

        if (losersComplete && lastLosersMatches.length === 1 && lastLosersMatches[0].winner_team) {
          const lm = lastLosersMatches[0];
          losersChampion = lm.winner_team === 1
            ? { p1: lm.team1_p1, p2: lm.team1_p2 }
            : { p1: lm.team2_p1, p2: lm.team2_p2 };
        }

        if (losersChampion) {
          // Grand Final
          const gfRoundId = await createRound(tournamentId, nextRoundNum, "winners");
          const court = autoAssign ? 1 : null;
          await createMatch(gfRoundId, winners[0].p1, winners[0].p2, losersChampion.p1, losersChampion.p2, court);
        }
      }
    }

    // Process completed losers round: winners advance, losers eliminated
    if (lastCompletedLosers && lastCompletedLosers === lastLosersRound) {
      const lMatches = matchesByRound.get(lastCompletedLosers.id) || [];

      const losersWinners: { p1: number; p2: number | null }[] = [];
      for (const m of lMatches) {
        if (!m.winner_team) continue;
        if (m.winner_team === 1) {
          losersWinners.push({ p1: m.team1_p1, p2: m.team1_p2 });
        } else {
          losersWinners.push({ p1: m.team2_p1, p2: m.team2_p2 });
        }
      }

      if (losersWinners.length >= 2) {
        const lRoundId = await createRound(tournamentId, nextRoundNum, "losers");
        for (let i = 0; i < losersWinners.length - 1; i += 2) {
          const w1 = losersWinners[i];
          const w2 = losersWinners[i + 1];
          const court = autoAssign ? 1 : null;
          await createMatch(lRoundId, w1.p1, w1.p2, w2.p1, w2.p2, court);
        }
      } else if (losersWinners.length === 1) {
        // Check if winners bracket also has 1 remaining player for Grand Final
        const lastWinnersMatches = lastWinnersRound ? matchesByRound.get(lastWinnersRound.id) || [] : [];
        const winnersComplete = lastWinnersRound ? allRoundMatchesCompleted(lastWinnersRound.id) : false;

        if (winnersComplete && lastWinnersMatches.length === 1 && lastWinnersMatches[0].winner_team) {
          // Bronze playoff (only if toggle enabled and an LB-semifinal exists):
          // pair LB-final-loser with LB-semifinal-loser, played alongside the GF.
          if (tournament.enable_third_place === 1) {
            // LB-final-loser: from the just-completed lMatches (reuse from above scope)
            let lbFinalLoser: { p1: number; p2: number | null } | null = null;
            for (const m of lMatches) {
              if (!m.winner_team) continue;
              lbFinalLoser = m.winner_team === 1
                ? { p1: m.team2_p1, p2: m.team2_p2 }
                : { p1: m.team1_p1, p2: m.team1_p2 };
              break;
            }
            // LB-semifinal-loser: from the previous LB round (if any)
            const lbRounds = rounds.filter((r) => r.phase === "losers");
            const lbSemiRound = lbRounds.length >= 2 ? lbRounds[lbRounds.length - 2] : null;
            const lbSemiMatches = lbSemiRound ? matchesByRound.get(lbSemiRound.id) || [] : [];
            let lbSemiLoser: { p1: number; p2: number | null } | null = null;
            for (const m of lbSemiMatches) {
              if (!m.winner_team) continue;
              lbSemiLoser = m.winner_team === 1
                ? { p1: m.team2_p1, p2: m.team2_p2 }
                : { p1: m.team1_p1, p2: m.team1_p2 };
              break;
            }
            if (lbFinalLoser && lbSemiLoser) {
              const bronzeRoundId = await createRound(tournamentId, nextRoundNum, "third_place", null);
              const court = autoAssign ? 1 : null;
              await createMatch(
                bronzeRoundId,
                lbFinalLoser.p1, lbFinalLoser.p2,
                lbSemiLoser.p1, lbSemiLoser.p2,
                court,
              );
            }
          }

          const wm = lastWinnersMatches[0];
          const winnersChampion = wm.winner_team === 1
            ? { p1: wm.team1_p1, p2: wm.team1_p2 }
            : { p1: wm.team2_p1, p2: wm.team2_p2 };

          // Grand Final
          const gfRoundId = await createRound(tournamentId, nextRoundNum, "winners");
          const court = autoAssign ? 1 : null;
          await createMatch(gfRoundId, winnersChampion.p1, winnersChampion.p2, losersWinners[0].p1, losersWinners[0].p2, court);
        }
      }
    }

    loadAll();
  };

  // onChange: Nur den eingegebenen Wert speichern, KEIN Auto-Fill
  const handleScoreChange = async (
    matchId: number,
    setNumber: number,
    team: 1 | 2,
    value: number
  ) => {
    if (!tournament) return;
    const currentSets = setsByMatch.get(matchId) || [];
    const existing = currentSets.find((s) => s.set_number === setNumber);

    const t1 = team === 1 ? value : existing?.team1_score ?? 0;
    const t2 = team === 2 ? value : existing?.team2_score ?? 0;

    const maxScore = getMaxScore(effectiveScoring.pointsPerSet, effectiveScoring.cap);
    const clampedT1 = Math.min(Math.max(t1, 0), maxScore);
    const clampedT2 = Math.min(Math.max(t2, 0), maxScore);

    await upsertSet(matchId, setNumber, clampedT1, clampedT2);
    loadAll();
  };

  // onBlur: Auto-Fill + Match-Entscheidung erst wenn Feld verlassen wird
  const handleScoreBlur = async (
    matchId: number,
    setNumber: number,
    team: 1 | 2
  ) => {
    if (!tournament) return;
    const currentSets = setsByMatch.get(matchId) || [];
    const existing = currentSets.find((s) => s.set_number === setNumber);
    if (!existing) return;

    let t1 = existing.team1_score;
    let t2 = existing.team2_score;

    // Auto-Fill: Gegner-Score automatisch setzen
    // Only auto-fill if the OTHER team's score is still 0 (truly fresh entry)
    // This prevents overwriting when tabbing through already-filled fields
    const enteredScore = team === 1 ? t1 : t2;
    const currentOther = team === 1 ? t2 : t1;
    if (enteredScore > 0 && currentOther === 0) {
      const autoScore = autoFillOpponentScore(
        enteredScore,
        effectiveScoring.pointsPerSet,
        effectiveScoring.cap,
        true
      );
      if (autoScore !== null) {
        if (team === 1) t2 = autoScore;
        else t1 = autoScore;
        await upsertSet(matchId, setNumber, t1, t2);
      }
    }

    // Match-Entscheidung pruefen
    const updatedSets = [...currentSets.filter((s) => s.set_number !== setNumber)];
    updatedSets.push({
      id: existing.id ?? 0,
      match_id: matchId,
      set_number: setNumber,
      team1_score: t1,
      team2_score: t2,
    });
    updatedSets.sort((a, b) => a.set_number - b.set_number);

    const winner = determineMatchWinner(
      updatedSets,
      effectiveScoring.setsToWin,
      effectiveScoring.pointsPerSet,
      effectiveScoring.cap
    );
    const currentMatch = allMatches.find(m => m.id === matchId);
    if (winner) {
      await updateMatchResult(matchId, winner);
      const wasEditing = editingMatchIds.has(matchId);
      // Remove from editing set
      setEditingMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
      // 3s delay only for fresh completions, not for re-edited matches
      if (!wasEditing) {
        setRecentlyCompleted((prev) => new Set(prev).add(matchId));
        setTimeout(() => {
          setRecentlyCompleted((prev) => {
            const next = new Set(prev);
            next.delete(matchId);
            return next;
          });
        }, 3000);
      }
    } else if (currentMatch && currentMatch.winner_team !== null) {
      // Match was completed but scores were changed so no winner anymore — reset
      await updateMatchResult(matchId, null);
    }

    loadAll();
  };

  const handleCourtChange = async (matchId: number, court: number | null, bypassRestCheck = false) => {
    // Player-overlap check — HARD block, no bypass. A player who is currently
    // running on another court cannot be on a second court at the same time.
    // Runs even when `bypassRestCheck=true` (the rest-warning "assign anyway"
    // path must NOT also bypass this physical impossibility).
    if (court !== null) {
      const targetMatch = allMatches.find((m) => m.id === matchId);
      if (targetMatch) {
        const conflicts = getMatchConflicts(targetMatch, runningPlayerCourts);
        if (conflicts.length > 0) {
          setPlayerConflict({
            matchId,
            players: conflicts.map((c) => ({
              id: c.playerId,
              name: playerName(c.playerId),
              court: c.court,
            })),
          });
          return;
        }
      }
    }

    // Rest-time check: only when assigning (not clearing) and tournament has min_rest configured
    if (!bypassRestCheck && court !== null && tournament && tournament.min_rest_minutes > 0) {
      const targetMatch = allMatches.find((m) => m.id === matchId);
      if (targetMatch) {
        const restingMap = getRestingPlayers(
          allMatches,
          tournament.min_rest_minutes,
          Date.now(),
          matchId,
        );
        const playerIds = [
          targetMatch.team1_p1,
          targetMatch.team1_p2,
          targetMatch.team2_p1,
          targetMatch.team2_p2,
        ].filter((pid): pid is number => pid !== null && pid !== undefined && pid > 0);

        const resting: { id: number; name: string; minutesLeft: number }[] = [];
        for (const pid of playerIds) {
          const s = restingMap.get(pid);
          if (s) {
            resting.push({ id: pid, name: playerName(pid), minutesLeft: s.minutesLeft });
          }
        }

        if (resting.length > 0) {
          setRestWarning({ matchId, court, players: resting });
          return;
        }
      }
    }

    await updateMatchCourt(matchId, court);
    loadAll();
  };

  const handleAnnounce = (court: number, team1: string, team2: string) => {
    try {
      const bc = new BroadcastChannel(`tournament-${tournamentId}`);
      bc.postMessage({ type: "announce", court, team1, team2 });
      bc.close();
    } catch (err) {
      console.error("TournamentView: failed to send announcement via BroadcastChannel:", err);
    }
  };

  const handleReopenMatch = async (matchId: number) => {
    setEditingMatchIds((prev) => new Set(prev).add(matchId));
    // Clear court (but keep court_assigned_at) so it doesn't show on a field
    await clearMatchCourt(matchId);
    await reopenMatch(matchId);
    loadAll();
  };

  const handleAddPlayer = async (playerId: number) => {
    await addPlayerToTournament(tournamentId, playerId);
    setShowAddPlayer(false);
    loadAll();
  };

  /** Opens the confirmation modal; actual removal happens in `confirmRemovePlayer`. */
  const handleRemovePlayer = (playerId: number) => {
    const p = players.find((p) => p.id === playerId);
    if (!p) return;
    setRemoveTarget(p);
  };

  const confirmRemovePlayer = async (playerId: number) => {
    await removePlayerFromTournament(tournamentId, playerId);
    loadAll();
  };

  // Check if player has any pending (unfinished) matches
  const getPlayerPendingMatches = (playerId: number): Match[] => {
    const pending: Match[] = [];
    for (const [, matches] of matchesByRound) {
      for (const m of matches) {
        if (m.status === "completed") continue;
        const matchPlayers = [m.team1_p1, m.team1_p2, m.team2_p1, m.team2_p2];
        if (matchPlayers.includes(playerId)) pending.push(m);
      }
    }
    return pending;
  };

  // Mark player as injured/retired for the entire tournament
  // - Persists in DB so future rounds exclude the player
  // - All pending matches become walkovers for the opponent
  // - For fixed teams (not random_doubles): partner is also retired
  const handlePlayerRetire = async (playerId: number) => {
    if (!tournament) return;

    // Determine players to retire
    const playersToRetire: number[] = [playerId];

    // For fixed-team modes (not random_doubles), also retire the partner
    if (tournament.format !== "random_doubles") {
      // Find partner from any match
      for (const m of allMatches) {
        if (m.team1_p1 === playerId && m.team1_p2) {
          if (!playersToRetire.includes(m.team1_p2)) playersToRetire.push(m.team1_p2);
          break;
        }
        if (m.team1_p2 === playerId) {
          if (!playersToRetire.includes(m.team1_p1)) playersToRetire.push(m.team1_p1);
          break;
        }
        if (m.team2_p1 === playerId && m.team2_p2) {
          if (!playersToRetire.includes(m.team2_p2)) playersToRetire.push(m.team2_p2);
          break;
        }
        if (m.team2_p2 === playerId) {
          if (!playersToRetire.includes(m.team2_p1)) playersToRetire.push(m.team2_p1);
          break;
        }
      }
    }

    // Persist retired status in DB
    for (const pid of playersToRetire) {
      await retirePlayerFromTournament(tournamentId, pid);
    }

    // Walk over all pending matches involving any retired player
    for (const pid of playersToRetire) {
      const pendingMatches = getPlayerPendingMatches(pid);
      for (const m of pendingMatches) {
        // Skip if already completed (may have been handled by partner retirement)
        if (m.status === "completed") continue;

        const isTeam1 = m.team1_p1 === pid || m.team1_p2 === pid;
        const winnerTeam: 1 | 2 = isTeam1 ? 2 : 1;

        const maxSets = effectiveScoring.setsToWin;
        for (let s = 1; s <= maxSets; s++) {
          await upsertSet(
            m.id, s,
            isTeam1 ? 0 : effectiveScoring.pointsPerSet,
            isTeam1 ? effectiveScoring.pointsPerSet : 0
          );
        }
        await updateMatchResult(m.id, winnerTeam);
      }
    }

    loadAll();
  };

  const handlePlayerUnretire = async (playerId: number) => {
    if (!tournament) return;
    // Unretire the player (and partner for fixed teams)
    const playersToUnretire: number[] = [playerId];
    if (tournament.format !== "random_doubles" && tournament.mode !== "singles") {
      for (const m of allMatches) {
        if (m.team1_p1 === playerId && m.team1_p2) { playersToUnretire.push(m.team1_p2); break; }
        if (m.team1_p2 === playerId) { playersToUnretire.push(m.team1_p1); break; }
        if (m.team2_p1 === playerId && m.team2_p2) { playersToUnretire.push(m.team2_p2); break; }
        if (m.team2_p2 === playerId) { playersToUnretire.push(m.team2_p1); break; }
      }
    }
    for (const pid of playersToUnretire) {
      await unretirePlayerFromTournament(tournamentId, pid);
    }
    loadAll();
  };

  const handleCompleteTournament = async () => {
    await updateTournamentStatus(tournamentId, "completed");
    loadAll();
  };

  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const handleReopenTournament = async () => {
    await updateTournamentStatus(tournamentId, "active");
    setShowReopenConfirm(false);
    loadAll();
  };

  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  // Whether THIS tournament is currently opted into live publishing.
  // Default off — only flips on when user clicks "Live aktivieren".
  const [liveActive, setLiveActive] = useState(false);
  // Whether THIS tournament is currently paused (opt-in still in place,
  // pushes suppressed). Mutually exclusive UI-wise with the inactive state.
  const [livePaused, setLivePaused] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  // Live push status (lastPushAt, lastError, backoff state) for the inline
  // indicator next to the Live button. Updates in-place when the global
  // publisher pushes / fails.
  const livePushStatus = usePushStatus(tournamentId);
  // Tick once per second so the inline "Push 12s ago" / "Fehler vor X Min"
  // text refreshes without waiting for an actual push event.
  const [liveStatusNow, setLiveStatusNow] = useState(() => Date.now());
  useEffect(() => {
    if (!liveActive) return;
    const id = setInterval(() => setLiveStatusNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [liveActive]);
  // Load opt-in state on mount + whenever the tournament id changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [on, paused] = await Promise.all([
          isTournamentLive(tournamentId),
          isTournamentPaused(tournamentId),
        ]);
        if (cancelled) return;
        setLiveActive(on);
        setLivePaused(paused);
      } catch (err) {
        console.error("isTournamentLive/Paused failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  const [showUndoRound, setShowUndoRound] = useState(false);

  /**
   * Memoized "what does the next undo step delete?" computation. Returns
   * null when there's nothing to undo. The result is used both to disable
   * the Undo button (no target → no click) and to drive the rich confirm
   * modal (preview of what will be lost).
   *
   * Strategy:
   *   1. Pick the round with the largest id — that's the most-recently
   *      created one in DB-insertion order.
   *   2. Bronze + Final pairing: when the head is a `third_place` round,
   *      look for the Final/winners round with the same `round_number`
   *      and bundle them. Same the other way around. Both get deleted in
   *      one logical undo step.
   *   3. Aggregate stats over the involved rounds so the modal can show
   *      what data the user is about to lose.
   *   4. Predict the post-undo phase transition (full reset / back-to-
   *      group / no change) — see decision matrix in plan.
   */
  const undoTarget = useMemo(() => {
    if (!tournament || rounds.length === 0) return null;

    // Newest-first by insertion order. round.id is auto-increment so
    // largest id == most-recently created round.
    const byIdDesc = [...rounds].sort((a, b) => b.id - a.id);
    const head = byIdDesc[0];

    // Bronze + Final pairing — both share round_number, were created in
    // the same SF→Final transition.
    const pair: Round[] = [head];
    if (head.phase === "third_place") {
      const finalSibling = rounds.find(
        (r) =>
          r.id !== head.id &&
          r.round_number === head.round_number &&
          (r.phase === "ko" || r.phase === "winners" || r.phase == null),
      );
      if (finalSibling) pair.unshift(finalSibling);   // Final first, Bronze second
    } else if (head.phase === "ko" || head.phase === "winners" || head.phase == null) {
      const bronzeSibling = rounds.find(
        (r) =>
          r.id !== head.id &&
          r.round_number === head.round_number &&
          r.phase === "third_place",
      );
      if (bronzeSibling) pair.push(bronzeSibling);
    }

    // Stats across the involved rounds.
    let matchCount = 0,
      completedCount = 0,
      activeOnCourtCount = 0,
      setCount = 0;
    for (const r of pair) {
      const ms = matchesByRound.get(r.id) ?? [];
      matchCount += ms.length;
      for (const m of ms) {
        if (m.status === "completed") completedCount++;
        if (m.status === "active" || (m.court != null && m.status !== "completed")) {
          activeOnCourtCount++;
        }
        setCount += (setsByMatch.get(m.id) ?? []).length;
      }
    }

    // Round label. Keep it short and descriptive; bronze pairing appends
    // the trophy marker so the user sees both deletions at once.
    const primary = pair[0];
    const labelForRound = (r: Round): string => {
      if (r.phase === "third_place") return `🥉 ${t.bracket_third_place_short}`;
      if (r.phase === "group" && r.group_number != null) {
        // Local round-index within the group (handles non-contiguous round_numbers).
        const groupRounds = rounds
          .filter((rr) => rr.phase === "group" && rr.group_number === r.group_number)
          .sort((a, b) => a.round_number - b.round_number);
        const idx = groupRounds.findIndex((rr) => rr.id === r.id);
        const label = t.tournament_view_round_label.replace("{n}", String(idx + 1));
        return `${t.group_progress_label.replace("{n}", String(r.group_number))} · ${label}`;
      }
      if (r.phase === "winners") return `W · ${t.tournament_view_round_label.replace("{n}", String(r.round_number))}`;
      if (r.phase === "losers")  return `L · ${t.tournament_view_round_label.replace("{n}", String(r.round_number))}`;
      return t.tournament_view_round_label.replace("{n}", String(r.round_number));
    };
    let label = labelForRound(primary);
    if (pair.length > 1 && pair.some((r) => r.phase === "third_place")) {
      label += ` + 🥉 ${t.bracket_third_place_short}`;
    }

    // Phase transition prediction.
    const remaining = rounds.filter((r) => !pair.some((p) => p.id === r.id));
    const resetStatusToDraft = remaining.length === 0;
    const remainingKo = remaining.filter(
      (r) => r.phase === "ko" || r.phase === "winners" || r.phase === "losers",
    );
    const remainingGroup = remaining.filter((r) => r.phase === "group");
    const isGroupKoBackToGroup =
      tournament.format === "group_ko" &&
      remainingKo.length === 0 &&
      remainingGroup.length > 0 &&
      pair.some((r) => r.phase === "ko" || r.phase === "third_place");

    return {
      rounds: pair,
      label,
      matchCount,
      completedCount,
      activeOnCourtCount,
      setCount,
      resetStatusToDraft,
      isGroupKoBackToGroup,
    };
  }, [tournament, rounds, matchesByRound, setsByMatch, t]);

  /**
   * Execute the undo step previewed by the modal. Idempotent against
   * stale clicks (re-reads `undoTarget` at call time; if it's null,
   * silently no-ops). Cleanup order: delete rounds first (FK cascades to
   * matches/sets), then apply phase transition, then reload + toast.
   */
  const performUndo = async () => {
    const target = undoTarget;
    if (!target) {
      setShowUndoRound(false);
      return;
    }

    // Delete by descending id so the youngest-inserted round goes first.
    // Order doesn't matter for correctness (FK cascade handles dependents)
    // but it keeps the DB state predictable during the operation.
    for (const r of [...target.rounds].sort((a, b) => b.id - a.id)) {
      await deleteRound(r.id);
    }

    if (target.resetStatusToDraft) {
      await updateTournamentStatus(tournamentId, "draft");
      await updateTournamentPhase(tournamentId, "ready");
    } else if (target.isGroupKoBackToGroup) {
      await updateTournamentPhase(tournamentId, "group");
      await updateTournamentKoScoring(tournamentId, null, null, null);
    }

    setShowUndoRound(false);
    showSuccess(
      t.tournament_view_undo_done
        .replace("{label}", target.label)
        .replace("{matches}", String(target.matchCount))
        .replace("{sets}", String(target.setCount)),
    );
    loadAll();
  };

  const allRoundMatchesCompleted = (roundId: number): boolean => {
    const matches = matchesByRound.get(roundId) || [];
    return matches.length > 0 && matches.every((m) => m.status === "completed");
  };

  const atLeastOneMatchCompleted = (roundId: number): boolean => {
    const matches = matchesByRound.get(roundId) || [];
    return matches.some((m) => m.status === "completed");
  };

  // Global occupied courts: across ALL rounds, not just active round
  const globalOccupiedCourts = React.useMemo(() => {
    const occupied = new Set<number>();
    for (const [, matches] of matchesByRound) {
      for (const m of matches) {
        if (m.court && m.status !== "completed") {
          occupied.add(m.court);
        }
      }
    }
    return occupied;
  }, [matchesByRound]);

  // Player-court conflict map. Built from allMatches so it spans every round
  // currently in memory — important once early-drawn future rounds are also
  // visible in the queue.
  const runningPlayerCourts = useMemo(
    () => getRunningPlayerCourts(allMatches),
    [allMatches],
  );

  // Per-waiting-match list of player conflicts. Empty => match is safe to
  // assign. Used by the queue render (visual marker) and the MatchCard
  // dropdown (disable courts).
  const conflictedMatches = useMemo(() => {
    const map = new Map<number, ConflictPlayer[]>();
    for (const m of allMatches) {
      if (m.court !== null) continue;       // already assigned — skip
      if (m.status === "completed") continue;
      const conflicts = getMatchConflicts(m, runningPlayerCourts);
      if (conflicts.length > 0) map.set(m.id, conflicts);
    }
    return map;
  }, [allMatches, runningPlayerCourts]);

  // Bronze playoff round (phase = "third_place") if it exists. Filtered out
  // of the main bracket layout — rendered separately as <BronzeMatchPanel>.
  const thirdPlaceRound = useMemo(
    () => rounds.find((r) => r.phase === "third_place") ?? null,
    [rounds],
  );

  // Group-phase progress + smart-queue prerequisites. Active only during
  // the group phase of a `group_ko` tournament; everything else falls
  // back to the existing default behavior.
  const isGroupPhaseActive =
    tournament?.format === "group_ko" &&
    tournament?.current_phase === "group";

  // Computed for the WHOLE group_ko format, not just the active group
  // phase, so the bar can act as a history reference once KO has started
  // (everything 100% / all ✓). The smart-queue maps below stay scoped
  // to the active group phase — KO matches must not be reordered by
  // group remaining counts.
  const groupProgress = useMemo(
    () => tournament?.format === "group_ko" ? getGroupProgress(rounds, matchesByRound) : [],
    [tournament?.format, rounds, matchesByRound],
  );

  const remainingByGroup = useMemo(
    () => isGroupPhaseActive ? getRemainingByGroup(rounds, matchesByRound) : undefined,
    [isGroupPhaseActive, rounds, matchesByRound],
  );

  const roundToGroup = useMemo(
    () => isGroupPhaseActive ? getRoundToGroupMap(rounds) : undefined,
    [isGroupPhaseActive, rounds],
  );

  // Map<playerId, seedRank> derived from the persisted seed_rank column.
  // Consumed by GruppenTab + VerwaltungTab to render <SeedBadge>.
  const seedRankByPlayer = useMemo(() => {
    const map = new Map<number, number>();
    for (const pd of paymentData) {
      if (pd.seed_rank != null && pd.seed_rank > 0) {
        map.set(pd.player.id, pd.seed_rank);
      }
    }
    return map;
  }, [paymentData]);

  // Early draw: compute pending matches from rounds AFTER the currently viewed round.
  // Used to show next-round matches in the CourtOverview queue with a round label.
  const futureRoundQueues = React.useMemo(() => {
    if (!activeRound || showAllGroups) return undefined;
    const activeRoundObj = rounds.find((r) => r.id === activeRound);
    if (!activeRoundObj) return undefined;
    return rounds
      .filter((r) => r.round_number > activeRoundObj.round_number)
      .map((r) => ({ round: r, matches: matchesByRound.get(r.id) || [] }))
      .filter(({ matches }) => matches.some((m) => !m.court && m.status !== "completed"));
  }, [activeRound, showAllGroups, rounds, matchesByRound]);

  const canGenerateNextRound =
    tournament?.status === "active" &&
    tournament.format !== "group_ko" &&
    tournament.format !== "elimination" &&
    tournament.format !== "swiss" &&
    tournament.format !== "monrad" &&
    tournament.format !== "king_of_court" &&
    tournament.format !== "waterfall" &&
    tournament.format !== "double_elimination" &&
    (tournament.format === "random_doubles" ||
      (tournament.format === "round_robin" && tournament.mode !== "singles")) &&
    rounds.length > 0 &&
    atLeastOneMatchCompleted(rounds[rounds.length - 1].id);

  // KO: Check if current KO round is complete and more rounds needed
  // third_place rounds are excluded so the bronze playoff doesn't influence
  // SF detection, "next round needed" logic, or bracket layout columns.
  const isElimination = tournament?.format === "elimination";
  const koRoundsForBracket = isElimination
    ? rounds.filter((r) => r.phase !== "third_place")
    : rounds.filter((r) => r.phase === "ko");
  const lastKoRound = koRoundsForBracket.length > 0 ? koRoundsForBracket[koRoundsForBracket.length - 1] : null;
  const lastKoMatches = lastKoRound ? matchesByRound.get(lastKoRound.id) || [] : [];
  const lastKoRoundComplete = lastKoRound ? allRoundMatchesCompleted(lastKoRound.id) : false;
  const needsNextKoRound = lastKoRoundComplete && lastKoMatches.length > 1;

  const generateNextKoRound = async () => {
    if (!tournament || !lastKoRound || !needsNextKoRound) return;

    // Collect winners from last KO round
    const winners: { p1: number; p2: number | null }[] = [];
    for (const m of lastKoMatches) {
      if (!m.winner_team) continue;
      if (m.winner_team === 1) {
        winners.push({ p1: m.team1_p1, p2: m.team1_p2 });
      } else {
        winners.push({ p1: m.team2_p1, p2: m.team2_p2 });
      }
    }

    if (winners.length < 2) return;

    const numCourts = tournament.courts || 1;
    const autoAssign = numCourts === 1;
    const nextRoundNum = rounds.length + 1;
    const phase = isElimination ? null : "ko";

    // SF -> Final transition: if the just-completed KO round had exactly 2
    // matches (i.e. the semi-finals) and the per-tournament toggle is
    // enabled, create the bronze playoff alongside the Final.
    const isSfToFinal = lastKoMatches.length === 2;
    const wantsBronze = tournament.enable_third_place === 1 && isSfToFinal;
    if (wantsBronze) {
      const sfLosers: { p1: number; p2: number | null }[] = [];
      for (const m of lastKoMatches) {
        if (!m.winner_team) continue;
        if (m.winner_team === 1) {
          sfLosers.push({ p1: m.team2_p1, p2: m.team2_p2 });
        } else {
          sfLosers.push({ p1: m.team1_p1, p2: m.team1_p2 });
        }
      }
      if (sfLosers.length === 2) {
        const bronzeRoundId = await createRound(tournamentId, nextRoundNum, "third_place", null);
        const court = autoAssign ? 1 : null;
        await createMatch(
          bronzeRoundId,
          sfLosers[0].p1, sfLosers[0].p2,
          sfLosers[1].p1, sfLosers[1].p2,
          court,
        );
      }
    }

    const roundId = await createRound(tournamentId, nextRoundNum, phase, null);

    // Pair winners: 1v2, 3v4, etc.
    for (let i = 0; i < winners.length - 1; i += 2) {
      const w1 = winners[i];
      const w2 = winners[i + 1];
      const court = autoAssign ? 1 : null;
      await createMatch(roundId, w1.p1, w1.p2, w2.p1, w2.p2, court);
    }

    setActiveRound(roundId);
    loadAll();
  };

  // Group-KO: Check if group phase is complete and KO can start
  const isGroupKo = tournament?.format === "group_ko";
  const groupRounds = rounds.filter((r) => r.phase === "group");
  const koRounds = rounds.filter((r) => r.phase === "ko");
  const groupPhaseComplete = isGroupKo && groupRounds.length > 0 &&
    groupRounds.every((r) => allRoundMatchesCompleted(r.id));
  const canStartKo = isGroupKo &&
    tournament?.status === "active" &&
    tournament?.current_phase === "group" &&
    groupPhaseComplete &&
    koRounds.length === 0;

  // Swiss: Check if next round can be generated
  const isSwiss = tournament?.format === "swiss";
  const swissRounds = rounds.filter((r) => r.phase === "swiss");
  const swissMaxRounds = tournament?.num_groups || 5; // num_groups stores swiss round count
  const lastSwissRound = swissRounds.length > 0 ? swissRounds[swissRounds.length - 1] : null;
  const lastSwissRoundComplete = lastSwissRound ? allRoundMatchesCompleted(lastSwissRound.id) : false;
  const canGenerateNextSwissRound = isSwiss &&
    tournament?.status === "active" &&
    swissRounds.length > 0 &&
    lastSwissRoundComplete &&
    swissRounds.length < swissMaxRounds;

  // Monrad: Check if next round can be generated (reuses swiss phase)
  const isMonrad = tournament?.format === "monrad";
  const monradRounds = isMonrad ? rounds.filter((r) => r.phase === "swiss") : [];
  const monradMaxRounds = isMonrad ? (tournament?.num_groups || 5) : 0;
  const lastMonradRound = monradRounds.length > 0 ? monradRounds[monradRounds.length - 1] : null;
  const lastMonradRoundComplete = lastMonradRound ? allRoundMatchesCompleted(lastMonradRound.id) : false;
  const canGenerateNextMonradRound = isMonrad &&
    tournament?.status === "active" &&
    monradRounds.length > 0 &&
    lastMonradRoundComplete &&
    monradRounds.length < monradMaxRounds;

  // King of the Court: Check if next match can be generated
  const isKingOfCourt = tournament?.format === "king_of_court";
  const lastKotcRound = isKingOfCourt && rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const lastKotcMatches = lastKotcRound ? matchesByRound.get(lastKotcRound.id) || [] : [];
  const lastKotcComplete = lastKotcRound ? allRoundMatchesCompleted(lastKotcRound.id) : false;
  const canGenerateNextKotcMatch = isKingOfCourt &&
    tournament?.status === "active" &&
    rounds.length > 0 &&
    lastKotcComplete &&
    lastKotcMatches.length > 0;

  // Waterfall: Check if next round can be generated
  const isWaterfall = tournament?.format === "waterfall";
  const waterfallMaxRounds = isWaterfall ? (tournament?.num_groups || 5) : 0;
  const lastWaterfallRound = isWaterfall && rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const lastWaterfallComplete = lastWaterfallRound ? allRoundMatchesCompleted(lastWaterfallRound.id) : false;
  const canGenerateNextWaterfallRound = isWaterfall &&
    tournament?.status === "active" &&
    rounds.length > 0 &&
    lastWaterfallComplete &&
    rounds.length < waterfallMaxRounds;

  // Double Elimination: Check if bracket can be advanced
  const isDoubleElimination = tournament?.format === "double_elimination";
  const winnersRounds = rounds.filter((r) => r.phase === "winners");
  const losersRounds = rounds.filter((r) => r.phase === "losers");
  const canAdvanceDoubleElimination = (() => {
    if (!isDoubleElimination || tournament?.status !== "active" || rounds.length === 0) return false;
    const lastWR = winnersRounds.length > 0 ? winnersRounds[winnersRounds.length - 1] : null;
    const lastLR = losersRounds.length > 0 ? losersRounds[losersRounds.length - 1] : null;
    const winnersComplete = lastWR ? allRoundMatchesCompleted(lastWR.id) : false;
    const losersComplete = lastLR ? allRoundMatchesCompleted(lastLR.id) : false;
    const lastWMatches = lastWR ? matchesByRound.get(lastWR.id) || [] : [];
    const lastLMatches = lastLR ? matchesByRound.get(lastLR.id) || [] : [];
    // Can advance if winners bracket last round is complete and has more than final match
    // or losers bracket last round is complete and has more than one match
    if (winnersComplete && lastWMatches.length > 1) return true;
    if (winnersComplete && losersRounds.length === 0 && lastWMatches.length >= 1) return true; // need to create losers bracket
    if (losersComplete && lastLMatches.length >= 1) return true;
    return false;
  })();

  // Pruefe ob noch offene Spiele existieren (ueber alle Runden)
  const hasOpenMatches = (() => {
    for (const [, matches] of matchesByRound) {
      if (matches.some((m) => m.status !== "completed")) return true;
    }
    return false;
  })();

  if (!tournament) return <div>{t.common_loading}</div>;

  const handleArchive = async () => {
    await updateTournamentStatus(tournamentId, "archived");
    loadAll();
  };

  /**
   * Opt this tournament into live publishing. Just registers intent in
   * app_settings — the global LivePublisherHost picks it up on its next
   * 30s discovery tick and starts pushing snapshots. Errors out with a
   * helpful message if no connection is configured yet.
   */
  const handleEnableLive = async () => {
    setLiveBusy(true);
    try {
      const raw = await getAppSetting(LIVE_PUBLISH_SETTING_KEY);
      if (!raw) {
        showError(t.tournament_live_publish_no_config);
        return;
      }
      const config = JSON.parse(raw) as LivePublishConfig;
      if (!config.endpoint || !config.secret) {
        showError(t.tournament_live_publish_no_config);
        return;
      }
      await setTournamentLive(tournamentId, true);
      setLiveActive(true);
      showSuccess(t.tournament_live_publish_enabled);
    } catch (err) {
      showError(String(err));
    } finally {
      setLiveBusy(false);
    }
  };

  /**
   * Pause / resume live publishing for this tournament. Pause keeps the
   * opt-in in place so the user can quickly resume without re-enabling
   * from scratch. The publisher's discovery loop (~30s) drops paused
   * tournaments from its active set, so the next push happens on resume.
   */
  const handleTogglePause = async () => {
    setLiveBusy(true);
    try {
      const next = !livePaused;
      await setTournamentPaused(tournamentId, next);
      setLivePaused(next);
    } catch (err) {
      showError(String(err));
    } finally {
      setLiveBusy(false);
    }
  };

  /**
   * Force an immediate push regardless of debounce / heartbeat / backoff.
   * No-op when no Publisher is currently running (tournament not active+
   * opted-in+unpaused, or discovery hasn't picked it up yet).
   */
  const handlePushNow = () => {
    const triggered = triggerImmediatePush(tournamentId);
    if (triggered) {
      showSuccess(t.tournament_live_publish_pushed_now);
    }
  };

  /**
   * Stop publishing this tournament: remove it from the opt-in set AND
   * send a delete-request so the WP page also drops the snapshot. Local
   * data is untouched. The confirm step is owned by `<UnpublishModal />`.
   */
  const handleUnpublish = async () => {
    try {
      // Always drop from opt-in first — even if the WP delete fails, the
      // user clearly wants this tournament off, and we don't want the
      // publisher to keep pushing. Clear paused state too so re-enabling
      // later doesn't carry over a stale pause.
      await setTournamentLive(tournamentId, false);
      await setTournamentPaused(tournamentId, false);
      setLiveActive(false);
      setLivePaused(false);

      const raw = await getAppSetting(LIVE_PUBLISH_SETTING_KEY);
      if (!raw) {
        // No connection saved — nothing to delete remotely. Still counts
        // as "off" locally, no error shown.
        showSuccess(t.tournament_unpublish_done);
        return;
      }
      const config = JSON.parse(raw) as LivePublishConfig;
      if (!config.endpoint || !config.secret) {
        showSuccess(t.tournament_unpublish_done);
        return;
      }
      const result = await pushDelete(config, tournamentId);
      if (result.ok) {
        showSuccess(t.tournament_unpublish_done);
      } else {
        showError(t.tournament_unpublish_failed.replace("{error}", result.error));
      }
    } catch (err) {
      showError(t.tournament_unpublish_failed.replace("{error}", String(err)));
    }
  };

  const statusStyle =
    tournament.status === "active"
      ? `${theme.activeBadgeBg} ${theme.activeBadgeText}`
      : tournament.status === "completed"
      ? "bg-gray-100 text-gray-500"
      : tournament.status === "archived"
      ? "bg-violet-100 text-violet-600"
      : "bg-amber-100 text-amber-700";

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className={`text-2xl font-extrabold ${theme.textPrimary} tracking-tight`}>
            {tournament.name}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs font-medium ${theme.cardBg} ${theme.textSecondary} border ${theme.cardBorder} px-2.5 py-1 rounded-full`}>
              {({singles: t.mode_singles, doubles: t.mode_doubles, mixed: t.mode_mixed} as Record<string, string>)[tournament.mode]}
            </span>
            <span className={`text-xs font-medium ${theme.cardBg} ${theme.textSecondary} border ${theme.cardBorder} px-2.5 py-1 rounded-full`}>
              {({round_robin: t.format_round_robin, elimination: t.format_elimination, random_doubles: t.format_random_doubles, group_ko: t.format_group_ko, swiss: t.format_swiss, double_elimination: t.format_double_elimination, monrad: t.format_monrad, king_of_court: t.format_king_of_court, waterfall: t.format_waterfall} as Record<string, string>)[tournament.format]}
            </span>
            <span className={`text-xs font-medium ${theme.cardBg} ${theme.textSecondary} border ${theme.cardBorder} px-2.5 py-1 rounded-full`}>
              {isGroupKo && tournament.ko_points_per_set != null
                ? `${t.ko_modal_group_phase_scoring}: ${getScoringDescription(tournament.points_per_set, tournament.cap)}`
                : getScoringDescription(tournament.points_per_set, tournament.cap)}
            </span>
            {isGroupKo && tournament.ko_points_per_set != null && (
              <span className={`text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200 px-2.5 py-1 rounded-full`}>
                KO: {getScoringDescription(tournament.ko_points_per_set, tournament.ko_cap)}
              </span>
            )}
            {tournament.courts > 1 && (
              <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
                {tournament.courts} {t.common_fields}
              </span>
            )}
            {isGroupKo && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                tournament.current_phase === "ko"
                  ? "bg-violet-100 text-violet-700"
                  : `${theme.activeBadgeBg} ${theme.activeBadgeText}`
              }`}>
                {tournament.current_phase === "ko" ? t.tournament_view_ko_phase : t.tournament_view_groups_label.replace("{count}", String(tournament.num_groups))}
              </span>
            )}
            {isSwiss && swissRounds.length > 0 && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${theme.activeBadgeBg} ${theme.activeBadgeText}`}>
                {t.tournament_view_swiss_round_counter.replace("{current}", String(swissRounds.length)).replace("{total}", String(swissMaxRounds))}
              </span>
            )}
            {isMonrad && monradRounds.length > 0 && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${theme.activeBadgeBg} ${theme.activeBadgeText}`}>
                {t.tournament_view_monrad_round_counter.replace("{current}", String(monradRounds.length)).replace("{total}", String(monradMaxRounds))}
              </span>
            )}
            {isWaterfall && rounds.length > 0 && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${theme.activeBadgeBg} ${theme.activeBadgeText}`}>
                {t.tournament_view_waterfall_round_counter.replace("{current}", String(rounds.length)).replace("{total}", String(waterfallMaxRounds))}
              </span>
            )}
            {isDoubleElimination && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                {t.format_double_elimination}
              </span>
            )}
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle}`}
            >
              {({draft: t.status_draft, active: t.status_active, completed: t.status_completed, archived: t.status_archived} as Record<string, string>)[tournament.status]}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {tournament.status === "draft" && (
            <>
              <button
                onClick={() => navigate(`/tournaments/${tournament.id}/edit`)}
                className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl ${theme.cardHoverBorder} transition-all text-sm font-medium`}
              >
                ✏️ {t.tournament_view_edit}
              </button>
              <button
                onClick={() => setShowTemplateExport(true)}
                className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl ${theme.cardHoverBorder} transition-all text-sm font-medium`}
              >
                📋 {t.tournament_view_template}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:border-rose-300 hover:text-rose-600 transition-all text-sm font-medium`}
              >
                🗑️ {t.tournament_view_delete}
              </button>
              <button
                onClick={() => setShowAttendance(true)}
                disabled={tournament.current_phase !== "ready"}
                title={tournament.current_phase !== "ready" ? t.tournament_view_not_started_hint : t.tournament_view_start}
                className={`${theme.primaryBg} ${theme.primaryText} px-5 py-2.5 rounded-xl ${theme.primaryHoverBg} shadow-sm hover:shadow-md transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
              >
                🚀 {t.tournament_view_start}
              </button>
            </>
          )}
          {canGenerateNextRound && (
            <button
              onClick={generateNextRound}
              className="bg-amber-500 text-white px-5 py-2.5 rounded-xl hover:bg-amber-600 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              🎲 {t.tournament_view_next_round}
            </button>
          )}
          {canStartKo && (
            <button
              onClick={() => setShowStartKoModal(true)}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-xl hover:bg-violet-700 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              🏆 {t.tournament_view_start_ko}
            </button>
          )}
          {needsNextKoRound && tournament.status === "active" && (
            <button
              onClick={generateNextKoRound}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-xl hover:bg-violet-700 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              ➡️ {t.tournament_view_next_ko_round}
            </button>
          )}
          {canGenerateNextSwissRound && (
            <button
              onClick={generateNextSwissRound}
              className="bg-amber-500 text-white px-5 py-2.5 rounded-xl hover:bg-amber-600 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              🔄 {t.tournament_view_next_swiss_round}
            </button>
          )}
          {canGenerateNextMonradRound && (
            <button
              onClick={generateNextMonradRound}
              className="bg-amber-500 text-white px-5 py-2.5 rounded-xl hover:bg-amber-600 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              🔄 {t.tournament_view_next_monrad_round}
            </button>
          )}
          {canGenerateNextKotcMatch && (
            <button
              onClick={generateNextKingOfCourtMatch}
              className="bg-amber-500 text-white px-5 py-2.5 rounded-xl hover:bg-amber-600 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              🎯 {t.tournament_view_next_kotc_match}
            </button>
          )}
          {canGenerateNextWaterfallRound && (
            <button
              onClick={generateNextWaterfallRound}
              className="bg-amber-500 text-white px-5 py-2.5 rounded-xl hover:bg-amber-600 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              🔄 {t.tournament_view_next_waterfall_round}
            </button>
          )}
          {canAdvanceDoubleElimination && (
            <button
              onClick={advanceDoubleElimination}
              className="bg-violet-600 text-white px-5 py-2.5 rounded-xl hover:bg-violet-700 shadow-sm hover:shadow-md transition-all text-sm font-medium"
            >
              ➡️ {t.tournament_view_advance_bracket}
            </button>
          )}
          {tournament.status === "active" && rounds.length > 0 && (
            <button
              onClick={() => setShowUndoRound(true)}
              disabled={!undoTarget}
              className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:border-amber-300 hover:text-amber-600 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              ↩️ {t.tournament_view_undo_round}
            </button>
          )}
          {tournament.status === "active" && (
            <button
              onClick={handleCompleteTournament}
              disabled={hasOpenMatches}
              title={hasOpenMatches ? t.tournament_view_has_open_matches : t.tournament_view_end}
              className={`px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${
                hasOpenMatches
                  ? `${theme.cardBg} border ${theme.cardBorder} ${theme.textMuted} cursor-not-allowed opacity-50`
                  : `${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} hover:border-rose-300 hover:text-rose-600`
              }`}
            >
              {t.tournament_view_end}
            </button>
          )}
          {tournament.status === "completed" && (
            <button
              onClick={() => setShowReopenConfirm(true)}
              className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:border-emerald-300 hover:text-emerald-600 transition-all text-sm font-medium`}
            >
              🔓 {t.tournament_view_reopen}
            </button>
          )}
          {tournament.status === "completed" && (
            <button
              onClick={handleArchive}
              className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all text-sm font-medium`}
            >
              📦 {t.tournament_view_archive}
            </button>
          )}
          {rounds.length > 0 && (
            <button
              onClick={() => setShowPrint(true)}
              className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl ${theme.cardHoverBorder} transition-all text-sm font-medium`}
            >
              🖨️ {t.tournament_view_print}
            </button>
          )}
          {/* Per-tournament Live publishing controls. Three UI states:
                - Inactive: "Live aktivieren" (disabled while tournament is a draft)
                - Active:   "Live aktiv" + Pause + "Push jetzt" buttons + inline status
                - Paused:   "Live pausiert" + Resume + Stop, no push activity
              The active-state button stays clickable on drafts (rare reopen
              scenario) so a stale opt-in can still be cleared. */}
          {liveActive ? (() => {
            // Compact button group: the main pill carries the label + ID;
            // the two secondary actions (pause/resume and push-now) are
            // attached as 32×32 icon squares to keep horizontal space tight.
            // The status text wraps below on narrow viewports.
            const statusText = (() => {
              if (livePaused) return t.tournament_live_status_paused_hint;
              const fmtRel = (iso: string | null): string | null => {
                if (!iso) return null;
                const diffSec = Math.max(0, Math.floor((liveStatusNow - new Date(iso).getTime()) / 1000));
                if (diffSec < 60) return `${diffSec}s`;
                const m = Math.floor(diffSec / 60);
                if (m < 60) return `${m} min`;
                const h = Math.floor(m / 60);
                return `${h} h`;
              };
              if (livePushStatus?.backoffUntil && livePushStatus.backoffUntil > liveStatusNow) {
                return t.tournament_live_status_backoff;
              }
              if (livePushStatus?.lastError) {
                const rel = fmtRel(livePushStatus.lastPushAt);
                return t.tournament_live_status_error_ago.replace("{time}", rel ?? "?");
              }
              if (livePushStatus?.lastPushAt) {
                const rel = fmtRel(livePushStatus.lastPushAt);
                return rel ? t.tournament_live_status_pushed_ago.replace("{time}", rel) : "";
              }
              return t.tournament_live_status_never_pushed;
            })();
            return (
              <div className="inline-flex items-center gap-1 flex-wrap">
                {/* Main pill — opens UnpublishModal on click */}
                <button
                  onClick={() => setShowUnpublishConfirm(true)}
                  title={t.tournament_live_publish_id_hint.replace("{id}", String(tournamentId))}
                  disabled={liveBusy}
                  className={`${
                    livePaused
                      ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                      : "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  } border px-4 py-2.5 rounded-xl transition-all text-sm font-medium disabled:opacity-50`}
                >
                  📡 {livePaused ? t.tournament_live_publish_paused_label : t.tournament_live_publish_active}
                  <span className={`ml-2 px-1.5 py-0.5 rounded-md ${livePaused ? "bg-amber-100 dark:bg-amber-800/40 border-amber-200 dark:border-amber-700/50" : "bg-emerald-100 dark:bg-emerald-800/40 border-emerald-200 dark:border-emerald-700/50"} border text-[11px] font-mono opacity-90`}>
                    ID: {tournamentId}
                  </span>
                </button>
                {/* Compact icon controls — tooltips carry the action label */}
                <button
                  onClick={handleTogglePause}
                  disabled={liveBusy}
                  title={livePaused ? t.tournament_live_publish_resume : t.tournament_live_publish_pause}
                  aria-label={livePaused ? t.tournament_live_publish_resume : t.tournament_live_publish_pause}
                  className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} w-8 h-8 flex items-center justify-center rounded-lg hover:border-amber-300 hover:text-amber-600 transition-all text-sm disabled:opacity-50`}
                >
                  {livePaused ? "▶️" : "⏸️"}
                </button>
                {!livePaused && (
                  <button
                    onClick={handlePushNow}
                    disabled={liveBusy}
                    title={t.tournament_live_publish_push_now}
                    aria-label={t.tournament_live_publish_push_now}
                    className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} w-8 h-8 flex items-center justify-center rounded-lg hover:border-emerald-300 hover:text-emerald-600 transition-all text-sm disabled:opacity-50`}
                  >
                    🔄
                  </button>
                )}
                {/* Status — small, muted, follows the buttons */}
                <span className={`text-[10px] ${theme.textMuted} self-center ml-1.5 whitespace-nowrap`}>
                  {statusText}
                </span>
              </div>
            );
          })() : (() => {
            const isDraft = tournament.status === "draft";
            const tooltip = isDraft
              ? t.tournament_live_publish_disabled_draft
              : t.tournament_live_publish_id_hint.replace("{id}", String(tournamentId));
            return (
              <button
                onClick={handleEnableLive}
                title={tooltip}
                disabled={liveBusy || isDraft}
                className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl hover:border-emerald-300 hover:text-emerald-600 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                📡 {t.tournament_live_publish_enable}
                <span className={`ml-2 px-1.5 py-0.5 rounded-md ${theme.inputBg} border ${theme.inputBorder} text-[11px] font-mono opacity-80`}>
                  ID: {tournamentId}
                </span>
              </button>
            );
          })()}
          {tournament.status === "active" && (
            <button
              onClick={async () => {
                if (isTauri()) {
                  try {
                    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
                    const tvWin = new WebviewWindow(`tv-${tournamentId}`, {
                      url: `/tv/${tournamentId}`,
                      title: `${t.tournament_view_tv_mode}: ${tournament.name}`,
                      width: 1920,
                      height: 1080,
                      fullscreen: false,
                      maximized: true,
                      decorations: true,
                      dragDropEnabled: false,
                    });
                    tvWin.once("tauri://error", (e) => {
                      console.error("TV window error:", e);
                    });
                  } catch (err) {
                    console.error("Failed to open TV window:", err);
                  }
                } else {
                  const url = `${window.location.origin}/tv/${tournamentId}`;
                  window.open(url, `tv-${tournamentId}`, "width=1920,height=1080,menubar=no,toolbar=no");
                }
              }}
              className={`${theme.cardBg} border ${theme.cardBorder} ${theme.textSecondary} px-4 py-2.5 rounded-xl ${theme.cardHoverBorder} transition-all text-sm font-medium`}
            >
              📺 {t.tournament_view_tv_mode}
            </button>
          )}
        </div>
      </div>

      {/* Print Dialog */}
      {showPrint && (
        <PrintDialog
          tournament={tournament}
          players={players}
          rounds={rounds}
          matchesByRound={matchesByRound}
          setsByMatch={setsByMatch}
          standings={standings}
          activeRoundId={activeRound}
          onClose={() => setShowPrint(false)}
        />
      )}

      {/* Edit Tournament Modal */}
      {showEditModal && tournament && (
        <EditTournamentModal
          tournament={tournament}
          theme={theme}
          onClose={() => setShowEditModal(false)}
          onSave={async (data) => {
            await updateTournament(
              tournament.id,
              data.name,
              data.mode,
              data.format,
              data.setsToWin,
              data.pointsPerSet,
              data.courts,
              data.numGroups,
              data.qualifyPerGroup,
              data.entryFeeSingle,
              data.entryFeeDouble,
              data.cap
            );
            setShowEditModal(false);
            loadAll();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && tournament && (
        <DeleteTournamentModal
          tournament={tournament}
          theme={theme}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            await deleteTournament(tournament.id);
            navigate("/");
          }}
        />
      )}

      {/* Template Export Modal */}
      {showTemplateExport && tournament && (
        <TemplateExportModal
          tournament={tournament}
          players={players}
          theme={theme}
          onClose={() => setShowTemplateExport(false)}
        />
      )}

      {/* Attendance Check Modal */}
      {showAttendance && (
        <AttendanceCheckModal
          players={players}
          theme={theme}
          onConfirm={handleAttendanceConfirm}
          onClose={() => setShowAttendance(false)}
        />
      )}

      {/* Retire/Injured Modal */}
      {retireTarget && (
        <RetirePlayerModal
          retireTarget={retireTarget}
          theme={theme}
          onClose={() => setRetireTarget(null)}
          onConfirm={handlePlayerRetire}
        />
      )}

      {/* Remove-Player Confirm Modal (draft status only) */}
      {removeTarget && (
        <RemovePlayerModal
          target={removeTarget}
          theme={theme}
          onClose={() => setRemoveTarget(null)}
          onConfirm={confirmRemovePlayer}
        />
      )}

      {/* Rest Time Warning Modal */}
      {restWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.cardBg} rounded-2xl shadow-xl border ${theme.cardBorder} max-w-md w-full p-6`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">⏱️</div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${theme.textPrimary}`}>{t.rest_warning_title}</h3>
                <p className={`text-sm ${theme.textMuted} mt-1`}>{t.rest_warning_body}</p>
              </div>
            </div>
            <ul className={`mb-5 space-y-1.5 pl-1`}>
              {restWarning.players.map((p) => (
                <li key={p.id} className={`text-sm ${theme.textPrimary} flex items-start gap-2`}>
                  <span className="text-amber-500">•</span>
                  <span>
                    {t.rest_warning_player_row
                      .replace("{player}", p.name)
                      .replace("{minutes}", String(p.minutesLeft))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRestWarning(null)}
                className={`px-4 py-2 rounded-xl border ${theme.cardBorder} ${theme.textPrimary} text-sm font-medium hover:opacity-80 transition-opacity`}
              >
                {t.rest_warning_cancel}
              </button>
              <button
                onClick={async () => {
                  const w = restWarning;
                  setRestWarning(null);
                  await handleCourtChange(w.matchId, w.court, true);
                }}
                className={`px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors`}
              >
                {t.rest_warning_confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player-Conflict Modal — HARD block (no bypass) */}
      {playerConflict && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.cardBg} rounded-2xl shadow-xl border ${theme.cardBorder} max-w-md w-full p-6`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">🚫</div>
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${theme.textPrimary}`}>{t.player_conflict_title}</h3>
                <p className={`text-sm ${theme.textMuted} mt-1`}>{t.player_conflict_body}</p>
              </div>
            </div>
            <ul className={`mb-5 space-y-1.5 pl-1`}>
              {playerConflict.players.map((p) => (
                <li key={p.id} className={`text-sm ${theme.textPrimary} flex items-start gap-2`}>
                  <span className="text-rose-500">•</span>
                  <span>
                    {t.player_conflict_row
                      .replace("{player}", p.name)
                      .replace("{court}", String(p.court))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPlayerConflict(null)}
                className={`px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors`}
              >
                {t.common_close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start KO Modal */}
      {showStartKoModal && tournament && (
        <StartKoModal
          tournament={tournament}
          theme={theme}
          onClose={() => setShowStartKoModal(false)}
          onConfirm={async (koPointsPerSet, koSetsToWin, koCap) => {
            await updateTournamentKoScoring(tournament.id, koPointsPerSet, koSetsToWin, koCap);
            await loadAll();
            setShowStartKoModal(false);
            await startKoPhase();
          }}
        />
      )}

      {showReopenConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${theme.cardBg} rounded-2xl shadow-2xl p-6 max-w-sm border ${theme.cardBorder} text-center`}>
            <div className="text-4xl mb-3">🔓</div>
            <h3 className={`font-bold text-lg ${theme.textPrimary} mb-2`}>{t.tournament_view_reopen}</h3>
            <p className={`text-sm ${theme.textSecondary} mb-5`}>{t.tournament_view_reopen_confirm}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowReopenConfirm(false)} className={`px-4 py-2 rounded-xl text-sm ${theme.textSecondary} border ${theme.cardBorder} hover:opacity-80`}>{t.common_cancel}</button>
              <button onClick={handleReopenTournament} className={`${theme.primaryBg} text-white px-4 py-2 rounded-xl text-sm font-medium ${theme.primaryHoverBg}`}>{t.tournament_view_reopen}</button>
            </div>
          </div>
        </div>
      )}

      <UnpublishModal
        open={showUnpublishConfirm}
        tournamentName={tournament.name}
        theme={theme}
        onClose={() => setShowUnpublishConfirm(false)}
        onConfirm={handleUnpublish}
      />


      {/* Rich preview modal for the undo step. Shows exactly what will be
          deleted (round label + match/completed/sets/active counts) plus
          a hint about the resulting phase transition (back to group / back
          to draft / no change). Confirm-button turns rose-red whenever
          completed-result data is about to be lost, otherwise stays
          amber as a softer signal. */}
      {showUndoRound && undoTarget && (() => {
        const tgt = undoTarget;
        const dangerous = tgt.completedCount > 0 || tgt.activeOnCourtCount > 0;
        const phaseHint = tgt.resetStatusToDraft
          ? t.tournament_view_undo_phase_to_draft
          : tgt.isGroupKoBackToGroup
          ? t.tournament_view_undo_phase_to_group
          : null;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${theme.cardBg} rounded-2xl shadow-2xl p-6 max-w-md w-full border ${theme.cardBorder}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl">↩️</div>
                <h3 className={`font-bold text-lg ${theme.textPrimary}`}>
                  {t.tournament_view_undo_round_title}
                </h3>
              </div>

              <p className={`text-sm ${theme.textSecondary} mb-3`}>
                {t.tournament_view_undo_target_label}
              </p>

              <div className={`rounded-xl border-2 ${dangerous ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/20" : `${theme.cardBorder} ${theme.cardBg}`} p-4 mb-4`}>
                <div className={`font-semibold ${theme.textPrimary} mb-2`}>{tgt.label}</div>
                <ul className={`text-sm space-y-1 ${theme.textSecondary}`}>
                  <li>• {t.tournament_view_undo_match_count.replace("{n}", String(tgt.matchCount))}</li>
                  {tgt.completedCount > 0 && (
                    <li className="text-amber-700 dark:text-amber-300 font-medium">
                      • {t.tournament_view_undo_completed_count.replace("{n}", String(tgt.completedCount))} ⚠
                    </li>
                  )}
                  {tgt.setCount > 0 && (
                    <li>• {t.tournament_view_undo_set_count.replace("{n}", String(tgt.setCount))}</li>
                  )}
                  {tgt.activeOnCourtCount > 0 && (
                    <li className="text-amber-700 dark:text-amber-300 font-medium">
                      • {t.tournament_view_undo_active_count.replace("{n}", String(tgt.activeOnCourtCount))} ⚠
                    </li>
                  )}
                </ul>
              </div>

              {phaseHint && (
                <p className={`text-xs ${theme.textMuted} mb-4 flex items-start gap-1.5`}>
                  <span>ⓘ</span><span>{phaseHint}</span>
                </p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowUndoRound(false)}
                  className={`px-4 py-2 rounded-xl text-sm ${theme.textSecondary} border ${theme.cardBorder} hover:opacity-80`}
                >
                  {t.common_cancel}
                </button>
                <button
                  onClick={performUndo}
                  className={`${
                    dangerous
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-amber-500 hover:bg-amber-600"
                  } text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors`}
                >
                  {t.tournament_view_undo_confirm}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Round Tabs - above everything */}
      {rounds.length === 0 && tournament.status === "draft" && (
        <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} p-8 mb-6`}>
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🏸</div>
            <div className={`text-lg font-semibold ${theme.textPrimary}`}>
              {t.tournament_view_not_started}
            </div>
            <div className={`text-sm ${theme.textMuted} mt-1`}>
              {t.tournament_view_not_started_hint}
            </div>
          </div>

          {/* Tournament Summary */}
          <div className={`${theme.inputBg} rounded-xl p-5 border ${theme.inputBorder}`}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className={`${theme.textMuted} text-xs uppercase tracking-wide`}>{t.tournament_mode}</span>
                <div className={`font-medium ${theme.textPrimary} mt-0.5`}>
                  {{ singles: t.mode_singles, doubles: t.mode_doubles, mixed: t.mode_mixed }[tournament.mode]}
                </div>
              </div>
              <div>
                <span className={`${theme.textMuted} text-xs uppercase tracking-wide`}>{t.tournament_format}</span>
                <div className={`font-medium ${theme.textPrimary} mt-0.5`}>
                  {{ round_robin: t.format_round_robin, elimination: t.format_elimination, random_doubles: t.format_random_doubles, group_ko: t.format_group_ko, swiss: t.format_swiss, double_elimination: t.format_double_elimination, monrad: t.format_monrad, king_of_court: t.format_king_of_court, waterfall: t.format_waterfall }[tournament.format]}
                </div>
              </div>
              <div>
                <span className={`${theme.textMuted} text-xs uppercase tracking-wide`}>{t.tournament_sets_to_win}</span>
                <div className={`font-medium ${theme.textPrimary} mt-0.5`}>Best of {tournament.sets_to_win * 2 - 1}</div>
              </div>
              <div>
                <span className={`${theme.textMuted} text-xs uppercase tracking-wide`}>{t.tournament_points_per_set}</span>
                <div className={`font-medium ${theme.textPrimary} mt-0.5`}>{tournament.points_per_set}</div>
              </div>
              <div>
                <span className={`${theme.textMuted} text-xs uppercase tracking-wide`}>{t.common_courts}</span>
                <div className={`font-medium ${theme.textPrimary} mt-0.5`}>{tournament.courts}</div>
              </div>
              <div>
                <span className={`${theme.textMuted} text-xs uppercase tracking-wide`}>{t.stats_player}</span>
                <div className={`font-medium ${theme.textPrimary} mt-0.5`}>{players.length}</div>
              </div>
            </div>
            {players.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className={`${theme.textMuted} text-xs uppercase tracking-wide`}>{t.management_participants.replace("{count}", String(players.length))}</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {players.map(p => (
                    <span key={p.id} className={`text-xs px-2 py-0.5 rounded-full ${
                      p.gender === "m" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                    }`}>
                      {playerDisplayName(p)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Tabs */}
      {rounds.length > 0 && (
        <div className={`flex border-b-2 ${theme.inputBorder} mb-5`}>
          {(() => {
            const hasBracket = koRoundsForBracket.length > 0 && (isElimination || (isGroupKo && tournament.current_phase === "ko"));
            const hasDoubleElimBracket = isDoubleElimination && (winnersRounds.length > 0 || losersRounds.length > 0);
            const showRangliste = !isGroupKo || koRounds.length > 0;
            const viewTabs = [
              { key: "spiele" as const, label: t.tournament_view_tab_matches, icon: "🏸" },
              ...(isGroupKo && groupRounds.length > 0 ? [{ key: "gruppen" as const, label: t.tournament_view_tab_groups, icon: "📋" }] : []),
              ...(hasBracket || hasDoubleElimBracket ? [{ key: "bracket" as const, label: t.tournament_view_tab_bracket, icon: "🏆" }] : []),
              ...(showRangliste ? [{ key: "rangliste" as const, label: t.tournament_view_tab_standings, icon: "📊" }] : []),
              { key: "verwaltung" as const, label: t.tournament_view_tab_management, icon: "👥" },
            ];
            return viewTabs;
          })().map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewTab(tab.key)}
              className={`px-6 py-3 text-sm font-semibold transition-all duration-200 relative rounded-t-lg ${
                viewTab === tab.key
                  ? `${theme.textPrimary}`
                  : `${theme.textMuted} hover:${theme.textPrimary} hover:bg-black/[0.03]`
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {viewTab === tab.key ? (
                <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${theme.primaryBg} rounded-t-full`} />
              ) : (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-transparent group-hover:bg-gray-200 rounded-t-full transition-all" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab: Spiele */}
      {viewTab === "spiele" && (
        <div>
          {/* Per-group progress with embedded round-status pills.
              Visible whenever there are group rounds — during the
              active group phase (live) AND afterwards (history). */}
          {groupProgress.length > 0 && (
            <GroupProgressBar progress={groupProgress} />
          )}

          {rounds.length > 0 && (
            <div className="mb-4 space-y-2">
              {/* Per-group round status is now embedded inside the
                  GroupProgressBar above (round pills next to the bar)
                  — no separate read-only G1/G2/G3 rows here. */}
              {/* KO rounds */}
              {koRounds.length > 0 && (
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs font-bold text-violet-400 uppercase tracking-wide w-8">KO</span>
                  {koRounds.map((r) => {
                    const colorClass = activeRound === r.id
                      ? "bg-violet-600 text-white shadow-md"
                      : `${theme.cardBg} text-violet-600 hover:bg-violet-500/10 border border-violet-500/30 hover:border-violet-400`;
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setActiveRound(r.id); setShowAllGroups(false); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${colorClass}`}
                      >
                        R{koRounds.indexOf(r) + 1}
                        {allRoundMatchesCompleted(r.id) && <span className="ml-1.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Double Elimination rounds (winners + losers) */}
              {isDoubleElimination && (
                <>
                  {winnersRounds.length > 0 && (
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-wide w-8">W</span>
                      {winnersRounds.map((r, idx) => {
                        const colorClass = activeRound === r.id
                          ? "bg-emerald-600 text-white shadow-md"
                          : `${theme.cardBg} text-emerald-600 hover:bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400`;
                        return (
                          <button
                            key={r.id}
                            onClick={() => { setActiveRound(r.id); setShowAllGroups(false); }}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${colorClass}`}
                          >
                            R{idx + 1}
                            {allRoundMatchesCompleted(r.id) && <span className="ml-1.5">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {losersRounds.length > 0 && (
                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wide w-8">L</span>
                      {losersRounds.map((r, idx) => {
                        const colorClass = activeRound === r.id
                          ? "bg-rose-600 text-white shadow-md"
                          : `${theme.cardBg} text-rose-600 hover:bg-rose-500/10 border border-rose-500/30 hover:border-rose-400`;
                        return (
                          <button
                            key={r.id}
                            onClick={() => { setActiveRound(r.id); setShowAllGroups(false); }}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${colorClass}`}
                          >
                            R{idx + 1}
                            {allRoundMatchesCompleted(r.id) && <span className="ml-1.5">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              {/* Normal rounds (non group_ko, non double_elimination).
                  third_place rounds are excluded here and rendered as a
                  dedicated bronze button below so they don't read as a
                  generic "Runde N" alongside the Final. */}
              {!isGroupKo && !isDoubleElimination && (
                <div className="flex gap-2 flex-wrap">
              {rounds.filter((r) => r.phase !== "third_place").map((r) => {
                const label = t.tournament_view_round_label.replace("{n}", String(r.round_number));
                const colorClass = activeRound === r.id
                  ? `${theme.roundActiveBg} ${theme.roundActiveText} shadow-md`
                  : `${theme.cardBg} ${theme.textSecondary} hover:opacity-80 border ${theme.cardBorder} ${theme.cardHoverBorder}`;

                return (
                  <button
                    key={r.id}
                    onClick={() => { setActiveRound(r.id); setShowAllGroups(false); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${colorClass}`}
                  >
                      {label}
                      {allRoundMatchesCompleted(r.id) && (
                        <span className="ml-1.5">✓</span>
                      )}
                    </button>
                );
              })}
                </div>
              )}
              {/* Dedicated bronze playoff button (any KO format) */}
              {thirdPlaceRound && (
                <div className="flex gap-2 flex-wrap items-center">
                  <span className="text-xs font-bold text-orange-500 uppercase tracking-wide w-8" aria-hidden="true">🥉</span>
                  <button
                    onClick={() => { setActiveRound(thirdPlaceRound.id); setShowAllGroups(false); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeRound === thirdPlaceRound.id
                        ? "bg-orange-600 text-white shadow-md"
                        : `${theme.cardBg} text-orange-600 hover:bg-orange-500/10 border border-orange-500/30 hover:border-orange-400`
                    }`}
                  >
                    {t.bracket_third_place_short}
                    {allRoundMatchesCompleted(thirdPlaceRound.id) && (
                      <span className="ml-1.5">✓</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Court Overview */}
          {rounds.length > 0 && (activeRound || showAllGroups) && tournament.status === "active" && (
            <CourtOverview
              courts={Math.max(tournament.courts || 1, 1)}
              matches={allMatches}
              // During an active group phase the unassigned-queue ALWAYS spans
              // every group's pending matches — even when the user has clicked
              // a single-round button — so the smart-queue can promote the
              // lagging group's matches above the others. Without this, the
              // queue would only ever show the round you're currently viewing
              // and the smart-sort would have nothing to reorder.
              activeRoundMatches={(isGroupPhaseActive || showAllGroups)
                ? groupRounds.flatMap((r) => matchesByRound.get(r.id) || [])
                : activeRound ? matchesByRound.get(activeRound) : undefined}
              futureRoundQueues={futureRoundQueues}
              playerName={playerName}
              hallConfig={tournament.hall_config ? parseHallConfig(tournament.hall_config) : undefined}
              minRestMinutes={tournament.min_rest_minutes}
              tournamentStatus={tournament.status}
              conflictedMatches={conflictedMatches}
              remainingByGroup={remainingByGroup}
              roundToGroup={roundToGroup}
              onDrop={(matchId, court) => handleCourtChange(matchId, court)}
              onMatchClick={(matchId) => {
                const match = allMatches.find((m) => m.id === matchId);
                if (!match) return;
                // When the next round has already been drawn, the target match
                // may live in a round tab that isn't currently rendered. Switch
                // to that tab first so the DOM node exists when we try to scroll.
                const renderedInCurrentTab = showAllGroups
                  ? groupRounds.some((r) => r.id === match.round_id)
                  : match.round_id === activeRound;
                if (!renderedInCurrentTab) {
                  setActiveRound(match.round_id);
                  setShowAllGroups(false);
                }
                const scrollAndFocus = () => {
                  const el = document.querySelector(`[data-match-id="${matchId}"]`);
                  if (!el) return;
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("ring-2", "ring-amber-400");
                  setTimeout(() => el.classList.remove("ring-2", "ring-amber-400"), 2000);
                  setTimeout(() => {
                    const input = el.querySelector('input[type="number"]:not(:disabled)') as HTMLInputElement | null;
                    if (input) input.focus();
                  }, 400);
                };
                if (renderedInCurrentTab) {
                  scrollAndFocus();
                } else {
                  // Defer until React has committed the round switch and the
                  // MatchCard for this id is mounted.
                  setTimeout(scrollAndFocus, 100);
                }
              }}
            />
          )}

          {rounds.length > 0 && (
            <div>
              {/* Matches - sorted: on court → open → completed */}
              {(activeRound || showAllGroups) &&
                (() => {
                  const raw = showAllGroups
                    ? groupRounds.flatMap((r) => matchesByRound.get(r.id) || [])
                    : matchesByRound.get(activeRound!) || [];
                  // Recently completed matches stay in their original section for 3s
                  const isRecent = (m: Match) => recentlyCompleted.has(m.id);
                  const isEditing = (m: Match) => editingMatchIds.has(m.id);
                  const onCourt = raw.filter((m) =>
                    ((m.court && m.status !== "completed") || (isRecent(m) && m.court)) && !isEditing(m)
                  );
                  const completed = raw.filter((m) =>
                    (m.status === "completed" && !isRecent(m)) || isEditing(m)
                  );
                  return (
                    <>
                      {onCourt.length > 0 && (
                        <div className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider mb-2`}>
                          {t.tournament_view_on_court.replace("{count}", String(onCourt.length))}
                        </div>
                      )}
                      {onCourt.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          sets={setsByMatch.get(match.id) || []}
                          setsToWin={effectiveScoring.setsToWin}
                          pointsPerSet={effectiveScoring.pointsPerSet}
                          cap={effectiveScoring.cap}
                          courts={tournament.courts || 1}
                          occupiedCourts={globalOccupiedCourts}
                          conflictedMatches={conflictedMatches}
                          playerName={playerName}
                          onScoreChange={handleScoreChange}
                          onScoreBlur={handleScoreBlur}
                          onCourtChange={handleCourtChange}
                          onAnnounce={handleAnnounce}
                          onReset={handleReopenMatch}
                          isActive={tournament.status === "active"}
                          theme={theme}
                          allMatches={allMatches}
                          minRestMinutes={tournament.min_rest_minutes}
                        />
                      ))}

                      {completed.length > 0 && (
                        <CompletedMatchesSection
                          matches={completed}
                          setsByMatch={setsByMatch}
                          setsToWin={effectiveScoring.setsToWin}
                          pointsPerSet={effectiveScoring.pointsPerSet}
                          cap={effectiveScoring.cap}
                          courts={tournament.courts || 1}
                          occupiedCourts={globalOccupiedCourts}
                          conflictedMatches={conflictedMatches}
                          playerName={playerName}
                          onScoreChange={handleScoreChange}
                          onScoreBlur={handleScoreBlur}
                          onCourtChange={handleCourtChange}
                          onAnnounce={handleAnnounce}
                          onReset={handleReopenMatch}
                          isActive={tournament.status === "active"}
                          theme={theme}
                          hasOtherMatches={onCourt.length > 0}
                          editingMatchIds={editingMatchIds}
                          allMatches={allMatches}
                          minRestMinutes={tournament.min_rest_minutes}
                          roundToGroup={roundToGroup}
                        />
                      )}
                    </>
                  );
                })()}
            </div>
          )}
        </div>
      )}

      {/* Tab: Gruppen */}
      {viewTab === "gruppen" && isGroupKo && (
        <GruppenTab
          tournament={tournament}
          players={players}
          theme={theme}
          rounds={rounds}
          getGroupData={getGroupData}
          seedRankByPlayer={seedRankByPlayer}
        />
      )}

      {/* Tab: Bracket */}
      {viewTab === "bracket" && koRoundsForBracket.length > 0 && (isElimination || (isGroupKo && tournament.current_phase === "ko")) && (
        <>
          <BracketView
            rounds={koRoundsForBracket}
            matchesByRound={matchesByRound}
            setsByMatch={setsByMatch}
            playerName={playerName}
            pointsPerSet={isGroupKo && tournament.ko_points_per_set != null ? tournament.ko_points_per_set : tournament.points_per_set}
            cap={isGroupKo && tournament.ko_points_per_set != null ? tournament.ko_cap : tournament.cap}
            allMatches={allMatches}
            minRestMinutes={tournament.min_rest_minutes}
            tournamentStatus={tournament.status}
          />
          {thirdPlaceRound && (
            <BronzeMatchPanel
              bronzeRound={thirdPlaceRound}
              matches={matchesByRound.get(thirdPlaceRound.id) || []}
              setsByMatch={setsByMatch}
              playerName={playerName}
              pointsPerSet={isGroupKo && tournament.ko_points_per_set != null ? tournament.ko_points_per_set : tournament.points_per_set}
              cap={isGroupKo && tournament.ko_points_per_set != null ? tournament.ko_cap : tournament.cap}
              allMatches={allMatches}
              minRestMinutes={tournament.min_rest_minutes}
              tournamentStatus={tournament.status}
            />
          )}
        </>
      )}

      {/* Tab: Bracket (Double Elimination) */}
      {viewTab === "bracket" && isDoubleElimination && (winnersRounds.length > 0 || losersRounds.length > 0) && (
        <div>
          {winnersRounds.length > 0 && (
            <>
              <h3 className={`text-lg font-bold ${theme.textPrimary} mb-3`}>{t.bracket_winners_bracket}</h3>
              <BracketView
                rounds={winnersRounds}
                matchesByRound={matchesByRound}
                setsByMatch={setsByMatch}
                playerName={playerName}
                pointsPerSet={tournament.points_per_set}
                cap={tournament.cap}
                allMatches={allMatches}
                minRestMinutes={tournament.min_rest_minutes}
                tournamentStatus={tournament.status}
              />
            </>
          )}
          {losersRounds.length > 0 && (
            <>
              <h3 className={`text-lg font-bold ${theme.textPrimary} mb-3 mt-6`}>{t.bracket_losers_bracket}</h3>
              <BracketView
                rounds={losersRounds}
                matchesByRound={matchesByRound}
                setsByMatch={setsByMatch}
                playerName={playerName}
                pointsPerSet={tournament.points_per_set}
                cap={tournament.cap}
                allMatches={allMatches}
                minRestMinutes={tournament.min_rest_minutes}
                tournamentStatus={tournament.status}
              />
            </>
          )}
          {thirdPlaceRound && (
            <BronzeMatchPanel
              bronzeRound={thirdPlaceRound}
              matches={matchesByRound.get(thirdPlaceRound.id) || []}
              setsByMatch={setsByMatch}
              playerName={playerName}
              pointsPerSet={tournament.points_per_set}
              cap={tournament.cap}
              allMatches={allMatches}
              minRestMinutes={tournament.min_rest_minutes}
              tournamentStatus={tournament.status}
            />
          )}
        </div>
      )}

      {/* Tab: Rangliste */}
      {viewTab === "rangliste" && (
        <RanglisteTab
          tournament={tournament}
          players={players}
          standings={standings}
          theme={theme}
        />
      )}

      {/* Tab: Verwaltung (Teilnehmer + Startgeld kombiniert) */}
      {viewTab === "verwaltung" && tournament && (
        <VerwaltungTab
          tournament={tournament}
          players={players}
          allPlayers={allPlayers}
          paymentData={paymentData}
          theme={theme}
          collapsedClubs={collapsedClubs}
          showAddPlayer={showAddPlayer}
          allMatches={allMatches}
          setShowAddPlayer={setShowAddPlayer}
          handleAddPlayer={handleAddPlayer}
          handleRemovePlayer={handleRemovePlayer}
          setPaymentData={setPaymentData}
          setCollapsedClubs={setCollapsedClubs}
          setRetireTarget={setRetireTarget}
          onUnretire={handlePlayerUnretire}
          playerName={playerName}
        />
      )}
    </div>
  );
}

function CompletedMatchesSection({
  matches,
  setsByMatch,
  setsToWin,
  pointsPerSet,
  cap,
  courts,
  occupiedCourts,
  conflictedMatches,
  playerName,
  onScoreChange,
  onScoreBlur,
  onCourtChange,
  onAnnounce,
  onReset,
  isActive,
  theme,
  hasOtherMatches,
  editingMatchIds,
  allMatches,
  minRestMinutes,
  roundToGroup,
}: {
  matches: Match[];
  setsByMatch: Map<number, GameSet[]>;
  setsToWin: number;
  pointsPerSet: number;
  cap: number | null;
  courts: number;
  occupiedCourts: Set<number>;
  conflictedMatches?: Map<number, ConflictPlayer[]>;
  playerName: (id: number | null) => string;
  onScoreChange: (matchId: number, setNumber: number, team: 1 | 2, value: number) => void;
  onScoreBlur: (matchId: number, setNumber: number, team: 1 | 2) => void;
  onCourtChange: (matchId: number, court: number | null) => void;
  onAnnounce: (court: number, team1: string, team2: string) => void;
  onReset: (matchId: number) => void;
  isActive: boolean;
  theme: any;
  hasOtherMatches: boolean;
  editingMatchIds: Set<number>;
  allMatches: Match[];
  minRestMinutes: number;
  /**
   * When provided (group_ko in active group phase), completed matches are
   * segmented into per-group sections — same structuring approach as the
   * unassigned queue. Falls back to a single flat section otherwise (KO,
   * round_robin, etc.).
   */
  roundToGroup?: Map<number, number>;
}) {
  const { t } = useT();
  // The toggle simply shows/hides the completed-match list. Default is
  // collapsed so the page emphasises running/waiting matches by default —
  // completed ones are reference/history. Editing matches stay visible
  // either way (the user is mid-edit and would lose the input UI).
  const [isOpen, setIsOpen] = useState(false);

  const teamLabel = (m: Match) => {
    const t1 = m.team1_p2
      ? `${playerName(m.team1_p1)} / ${playerName(m.team1_p2)}`
      : playerName(m.team1_p1);
    const t2 = m.team2_p2
      ? `${playerName(m.team2_p1)} / ${playerName(m.team2_p2)}`
      : playerName(m.team2_p1);
    return { t1, t2 };
  };

  return (
    <div className={hasOtherMatches ? "mt-4" : ""}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider mb-2 flex items-center gap-2 hover:opacity-80 transition-opacity`}
      >
        <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ▾
        </span>
        {t.tournament_view_completed_matches.replace("{count}", String(matches.length))}
      </button>

      {/* Editing matches: always show as full MatchCard */}
      {matches.filter((m) => editingMatchIds.has(m.id)).map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          sets={setsByMatch.get(match.id) || []}
          setsToWin={setsToWin}
          pointsPerSet={pointsPerSet}
          cap={cap}
          courts={courts}
          occupiedCourts={occupiedCourts}
          conflictedMatches={conflictedMatches}
          playerName={playerName}
          onScoreChange={onScoreChange}
          onScoreBlur={onScoreBlur}
          onCourtChange={onCourtChange}
          onAnnounce={onAnnounce}
          onReset={onReset}
          isActive={isActive}
          theme={theme}
          allMatches={allMatches}
          minRestMinutes={minRestMinutes}
        />
      ))}

      {/* Non-editing matches — only rendered when the section is open.
          Editing matches above always show regardless of the toggle. */}
      {isOpen && (() => {
        const nonEditing = matches.filter((m) => !editingMatchIds.has(m.id));
        if (nonEditing.length === 0) return null;

        // Build per-group buckets when group context is available. Sorted
        // ascending by group_number so the section order matches the
        // standings table in GruppenTab. Returns null when there's nothing
        // to group (KO matches, non-group_ko formats) — render path falls
        // back to a single flat section.
        const buildGroups = (): { group: number; matches: Match[] }[] | null => {
          if (!roundToGroup) return null;
          const byGroup = new Map<number, Match[]>();
          for (const m of nonEditing) {
            const g = roundToGroup.get(m.round_id);
            if (g == null) continue;
            const arr = byGroup.get(g) ?? [];
            arr.push(m);
            byGroup.set(g, arr);
          }
          if (byGroup.size === 0) return null;
          return Array.from(byGroup.entries())
            .map(([group, ms]) => ({ group, matches: ms }))
            .sort((a, b) => a.group - b.group);
        };

        const groups = buildGroups();

        // One compact one-line row per match — used inside both flat and
        // grouped rendering paths.
        const renderCompactRow = (m: Match, i: number, n: number) => {
          const { t1, t2 } = teamLabel(m);
          const sets = setsByMatch.get(m.id) || [];
          let s1 = 0, s2 = 0;
          for (const s of sets) {
            if (isSetComplete(s, pointsPerSet, cap)) {
              if (s.team1_score > s.team2_score) s1++;
              else s2++;
            }
          }
          return (
            <div
              key={m.id}
              className={`flex items-center justify-between px-4 py-2 text-sm ${
                i > 0 && i < n ? `border-t ${theme.cardBorder}` : ""
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`font-medium truncate ${
                  m.winner_team === 1 ? theme.activeBadgeText : theme.textSecondary
                }`}>
                  {t1}
                </span>
                <span className={`${theme.textMuted} text-xs shrink-0`}>{t.common_vs}</span>
                <span className={`font-medium truncate ${
                  m.winner_team === 2 ? theme.activeBadgeText : theme.textSecondary
                }`}>
                  {t2}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className={`font-mono font-bold text-sm ${theme.textPrimary}`}>
                  {s1}:{s2}
                </span>
                <span className={`font-mono text-xs ${theme.textMuted}`}>
                  ({sets.filter(s => s.team1_score > 0 || s.team2_score > 0).map(s => `${s.team1_score}:${s.team2_score}`).join(", ")})
                </span>
                {isActive && (
                  <button
                    onClick={() => onReset(m.id)}
                    className="text-xs text-amber-500 hover:text-amber-700 transition-colors"
                  >
                    {t.tournament_view_edit_results}
                  </button>
                )}
              </div>
            </div>
          );
        };

        const groupHeader = (group: number, count: number) => (
          <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide mb-1 mt-2 first:mt-0 text-violet-600`}>
            <span>{t.group_progress_label.replace("{n}", String(group))}</span>
            <span className={`font-mono font-normal ${theme.textMuted}`}>
              {t.groups_matches_count.replace("{count}", String(count))}
            </span>
          </div>
        );

        if (groups) {
          return (
            <div className="space-y-2">
              {groups.map(({ group, matches: gm }) => (
                <div key={group}>
                  {groupHeader(group, gm.length)}
                  <div className={`${theme.cardBg} rounded-2xl border ${theme.cardBorder} overflow-hidden`}>
                    {gm.map((m, i) => renderCompactRow(m, i, gm.length))}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div className={`${theme.cardBg} rounded-2xl border ${theme.cardBorder} overflow-hidden`}>
            {nonEditing.map((m, i) => renderCompactRow(m, i, nonEditing.length))}
          </div>
        );
      })()}
    </div>
  );
}

function MatchCard({
  match,
  sets,
  setsToWin,
  pointsPerSet,
  cap,
  courts,
  occupiedCourts,
  conflictedMatches,
  playerName,
  onScoreChange,
  onScoreBlur,
  onCourtChange,
  onAnnounce,
  onReset,
  isActive,
  theme,
  allMatches,
  minRestMinutes,
}: {
  match: Match;
  sets: GameSet[];
  setsToWin: number;
  pointsPerSet: number;
  cap: number | null;
  courts: number;
  occupiedCourts: Set<number>;
  conflictedMatches?: Map<number, ConflictPlayer[]>;
  playerName: (id: number | null) => string;
  onScoreChange: (
    matchId: number,
    setNumber: number,
    team: 1 | 2,
    value: number
  ) => void;
  onScoreBlur: (
    matchId: number,
    setNumber: number,
    team: 1 | 2
  ) => void;
  onCourtChange: (matchId: number, court: number | null) => void;
  onAnnounce?: (court: number, team1: string, team2: string) => void;
  onReset: (matchId: number) => void;
  isActive: boolean;
  theme: ThemeColors;
  allMatches: Match[];
  minRestMinutes: number;
}) {
  const { t } = useT();
  const maxSets = setsToWin * 2 - 1;
  const maxScore = getMaxScore(pointsPerSet, cap);
  const team1Label = match.team1_p2
    ? `${playerName(match.team1_p1)} / ${playerName(match.team1_p2)}`
    : playerName(match.team1_p1);
  const team2Label = match.team2_p2
    ? `${playerName(match.team2_p1)} / ${playerName(match.team2_p2)}`
    : playerName(match.team2_p1);

  // JSX renderer that inlines RestIndicator after each player name. Only renders
  // clocks when the tournament is active AND has rest time configured AND the
  // match itself isn't completed yet (a completed match has no scheduling value).
  const showRestIcons =
    isActive && minRestMinutes > 0 && match.status !== "completed";
  const renderTeam = (p1: number, p2: number | null) => (
    <>
      <span>{playerName(p1)}</span>
      {showRestIcons && (
        <RestIndicator
          playerId={p1}
          matches={allMatches}
          minRestMinutes={minRestMinutes}
          excludeMatchId={match.id}
        />
      )}
      {p2 != null && (
        <>
          <span className="mx-1 text-gray-400">/</span>
          <span>{playerName(p2)}</span>
          {showRestIcons && (
            <RestIndicator
              playerId={p2}
              matches={allMatches}
              minRestMinutes={minRestMinutes}
              excludeMatchId={match.id}
            />
          )}
        </>
      )}
    </>
  );

  // Count sets won for display
  let team1SetsWon = 0;
  let team2SetsWon = 0;
  for (const s of sets) {
    if (isSetComplete(s, pointsPerSet, cap)) {
      if (s.team1_score > s.team2_score) team1SetsWon++;
      else team2SetsWon++;
    }
  }

  const borderColor =
    match.status === "completed"
      ? theme.completedBorder
      : team1SetsWon > 0 || team2SetsWon > 0
      ? "border-l-amber-400"
      : "border-l-gray-200";

  const isDraggable = isActive && !match.court && match.status !== "completed" && courts > 1;
  // notStarted: only if match was NEVER assigned to a court (no court_assigned_at history)
  // Matches being edited (reopened) had a court before, so they should remain editable
  const notStarted = courts > 1 && !match.court && !match.court_assigned_at;
  const inputsDisabled = !isActive || match.status === "completed" || notStarted;

  return (
    <div
      data-match-id={match.id}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (isDraggable) {
          e.dataTransfer.setData("matchId", String(match.id));
          e.dataTransfer.effectAllowed = "move";
        }
      }}
      className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} border-l-4 ${borderColor} p-5 mb-3 transition-all duration-200 ${
        match.status === "completed" ? "opacity-80" : ""
      } ${isDraggable ? "cursor-grab active:cursor-grabbing hover:shadow-md" : ""}`}
    >
      {/* Teams + Court */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3 text-sm">
          {/* Court Badge + Timer */}
          {courts > 1 && (
            <>
              {isActive && match.status !== "completed" ? (
                <select
                  value={match.court ?? ""}
                  onChange={(e) =>
                    onCourtChange(match.id, e.target.value ? Number(e.target.value) : null)
                  }
                  className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-2 py-1 outline-none cursor-pointer hover:bg-amber-100 transition-colors"
                  title={t.court_choose_court}
                >
                  <option value="">{t.tournament_view_court_question}</option>
                  {(() => {
                    const matchHasConflict = conflictedMatches?.has(match.id) ?? false;
                    return Array.from({ length: courts }, (_, i) => i + 1).map((c) => {
                      const busy = occupiedCourts.has(c) && match.court !== c;
                      const blocked = matchHasConflict && match.court !== c;
                      return (
                        <option key={c} value={c} disabled={busy || blocked}>
                          {t.common_field} {c}
                          {busy ? ` (${t.common_occupied})` : blocked ? ` (${t.match_player_busy_short})` : ""}
                        </option>
                      );
                    });
                  })()}
                </select>
              ) : match.court ? (
                <span className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg">
                  {t.common_field} {match.court}
                </span>
              ) : null}
              {match.court && (
                <CourtTimer
                  assignedAt={match.court_assigned_at}
                  completed={match.status === "completed"}
                />
              )}
            </>
          )}
          <div>
            <span
              className={`font-semibold ${
                match.winner_team === 1 ? "text-emerald-600" : theme.textPrimary
              }`}
            >
              {renderTeam(match.team1_p1, match.team1_p2)}
            </span>
            <span className="text-gray-300 mx-3 font-light">{t.common_vs}</span>
            <span
              className={`font-semibold ${
                match.winner_team === 2 ? "text-emerald-600" : theme.textPrimary
              }`}
            >
              {renderTeam(match.team2_p1, match.team2_p2)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(team1SetsWon > 0 || team2SetsWon > 0) && (
            <span className={`text-sm font-bold font-mono ${theme.cardBg} ${theme.textPrimary} border ${theme.cardBorder} px-2.5 py-1 rounded-lg`}>
              {team1SetsWon}:{team2SetsWon}
            </span>
          )}
          {match.status === "completed" && (
            <span className={`text-xs font-medium ${theme.activeBadgeBg} ${theme.activeBadgeText} px-2.5 py-1 rounded-full`}>
              {t.tournament_view_match_completed}
            </span>
          )}
          {isActive && match.status === "completed" && (
            <button
              onClick={() => onReset(match.id)}
              className="text-xs text-amber-500 hover:text-amber-700 font-medium transition-colors"
              title={t.tournament_view_edit_results}
            >
              {t.tournament_view_edit_results}
            </button>
          )}
          {/* Announce to TV */}
          {isActive && match.court && match.status !== "completed" && onAnnounce && (
            <button
              onClick={() => onAnnounce(match.court!, team1Label, team2Label)}
              className="text-xs text-gray-400 hover:text-amber-600 font-medium transition-colors"
              title={t.tournament_view_announce_title}
            >
              📢
            </button>
          )}
        </div>
      </div>

      {/* Not started hint */}
      {notStarted && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3 inline-block">
          ⏳ {t.tournament_view_assign_court_first}
        </div>
      )}

      {/* Sets */}
      <div className="flex gap-5">
        {Array.from({ length: maxSets }, (_, i) => i + 1).map((setNum) => {
          const setData = sets.find((s) => s.set_number === setNum);
          const score1 = setData?.team1_score ?? 0;
          const score2 = setData?.team2_score ?? 0;

          const validation =
            score1 > 0 || score2 > 0
              ? isScoreValid(score1, score2, pointsPerSet, cap)
              : { valid: true };

          const complete = setData
            ? isSetComplete(setData, pointsPerSet, cap)
            : false;

          const handleScoreKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, setNum: number, team: 1 | 2) => {
            if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
              e.preventDefault();
              // Trigger blur on current field first (for auto-fill)
              (e.target as HTMLInputElement).blur();
              // Find next input: team1→team2 same set, team2→team1 next set
              const card = (e.target as HTMLElement).closest("[data-match-id]");
              if (!card) return;
              let nextTeam: 1 | 2;
              let nextSet: number;
              if (team === 1) {
                nextTeam = 2; nextSet = setNum;
              } else {
                nextTeam = 1; nextSet = setNum + 1;
              }
              const next = card.querySelector(`[data-score="${nextSet}-${nextTeam}"]`) as HTMLInputElement | null;
              if (next && !next.disabled) {
                setTimeout(() => { next.focus(); next.select(); }, 50);
              } else {
                // No more fields in this match - jump to next match's first input
                const allCards = document.querySelectorAll("[data-match-id]");
                const cardArr = Array.from(allCards);
                const idx = cardArr.indexOf(card);
                if (idx >= 0 && idx < cardArr.length - 1) {
                  const nextCard = cardArr[idx + 1];
                  const firstInput = nextCard.querySelector('input[type="number"]:not(:disabled)') as HTMLInputElement | null;
                  if (firstInput) setTimeout(() => { firstInput.focus(); firstInput.select(); }, 50);
                }
              }
            }
          };

          return (
            <div key={setNum} className="text-center">
              <div className="text-[11px] font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                {t.common_set} {setNum}
                {complete && (
                  <span className="text-emerald-500 ml-1">✓</span>
                )}
              </div>
              <div className="flex gap-1.5 items-center">
                <input
                  type="number"
                  min={0}
                  max={maxScore}
                  data-score={`${setNum}-1`}
                  value={setData?.team1_score ?? ""}
                  onChange={(e) =>
                    onScoreChange(
                      match.id,
                      setNum,
                      1,
                      Number(e.target.value) || 0
                    )
                  }
                  onBlur={() => onScoreBlur(match.id, setNum, 1)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => handleScoreKeyDown(e, setNum, 1)}
                  disabled={inputsDisabled}
                  className={`w-14 h-10 border-2 rounded-xl text-center text-base font-mono font-bold ${theme.inputBg} ${theme.inputText} disabled:opacity-60 outline-none transition-all ${
                    !validation.valid
                      ? "border-rose-300 bg-rose-50 text-rose-600"
                      : complete && score1 > score2
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : `${theme.inputBorder} ${theme.focusBorder} focus:ring-2 ${theme.focusRing}`
                  }`}
                />
                <span className="text-gray-300 font-bold">:</span>
                <input
                  type="number"
                  min={0}
                  max={maxScore}
                  data-score={`${setNum}-2`}
                  value={setData?.team2_score ?? ""}
                  onChange={(e) =>
                    onScoreChange(
                      match.id,
                      setNum,
                      2,
                      Number(e.target.value) || 0
                    )
                  }
                  onBlur={() => onScoreBlur(match.id, setNum, 2)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => handleScoreKeyDown(e, setNum, 2)}
                  disabled={inputsDisabled}
                  className={`w-14 h-10 border-2 rounded-xl text-center text-base font-mono font-bold ${theme.inputBg} ${theme.inputText} disabled:opacity-60 outline-none transition-all ${
                    !validation.valid
                      ? "border-rose-300 bg-rose-50 text-rose-600"
                      : complete && score2 > score1
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : `${theme.inputBorder} ${theme.focusBorder} focus:ring-2 ${theme.focusRing}`
                  }`}
                />
              </div>
              {!validation.valid && (
                <div className="text-[10px] text-rose-500 mt-1 max-w-[130px]">
                  {validation.error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
