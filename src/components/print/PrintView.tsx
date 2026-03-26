import { forwardRef } from "react";
import type {
  Tournament,
  Player,
  Round,
  Match,
  GameSet,
  StandingEntry,
} from "../../lib/types";
import { MODE_LABELS, FORMAT_LABELS } from "../../lib/types";
import { isSetComplete, getScoringDescription } from "../../lib/scoring";
import { calculateHighlights } from "../../lib/highlights";

export type PrintMode = "schedule" | "round" | "standings" | "full" | "report";

interface PrintViewProps {
  tournament: Tournament;
  players: Player[];
  rounds: Round[];
  matchesByRound: Map<number, Match[]>;
  setsByMatch: Map<number, GameSet[]>;
  standings: StandingEntry[];
  mode: PrintMode;
  activeRoundId?: number | null;
}

const PrintView = forwardRef<HTMLDivElement, PrintViewProps>(
  (
    {
      tournament,
      players,
      rounds,
      matchesByRound,
      setsByMatch,
      standings,
      mode,
      activeRoundId,
    },
    ref
  ) => {
    const playerName = (id: number | null): string => {
      if (!id) return "-";
      return players.find((p) => p.id === id)?.name ?? "?";
    };

    const teamLabel = (m: Match, team: 1 | 2): string => {
      const p1 = team === 1 ? m.team1_p1 : m.team2_p1;
      const p2 = team === 1 ? m.team1_p2 : m.team2_p2;
      return p2 ? `${playerName(p1)} / ${playerName(p2)}` : playerName(p1);
    };

    const now = new Date().toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const renderHeader = () => (
      <div style={{ marginBottom: 20, borderBottom: "2px solid #059669", paddingBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              🏸 {tournament.name}
            </h1>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
              {MODE_LABELS[tournament.mode]} &middot;{" "}
              {FORMAT_LABELS[tournament.format]} &middot; Best of{" "}
              {tournament.sets_to_win * 2 - 1} &middot;{" "}
              {getScoringDescription(tournament.points_per_set)}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#999", textAlign: "right" }}>
            {now}
            <br />
            {players.length} Teilnehmer &middot; {rounds.length} Runden
            {tournament.courts > 1 && <><br />{tournament.courts} Felder</>}
          </div>
        </div>
      </div>
    );

    const renderMatchRow = (m: Match, idx: number) => {
      const sets = setsByMatch.get(m.id) || [];
      const maxSets = tournament.sets_to_win * 2 - 1;

      let t1Sets = 0;
      let t2Sets = 0;
      for (const s of sets) {
        if (isSetComplete(s, tournament.points_per_set)) {
          if (s.team1_score > s.team2_score) t1Sets++;
          else t2Sets++;
        }
      }

      return (
        <tr key={m.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
          <td style={{ padding: "6px 8px", fontSize: 11, color: "#999", width: 30 }}>
            {idx + 1}
          </td>
          {tournament.courts > 1 && (
            <td style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "#b45309", textAlign: "center", width: 50 }}>
              {m.court ? `Feld ${m.court}` : ""}
            </td>
          )}
          <td
            style={{
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: m.winner_team === 1 ? 700 : 400,
              color: m.winner_team === 1 ? "#059669" : "#111",
            }}
          >
            {teamLabel(m, 1)}
          </td>
          <td style={{ padding: "6px 8px", fontSize: 11, color: "#999", textAlign: "center", width: 30 }}>
            vs
          </td>
          <td
            style={{
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: m.winner_team === 2 ? 700 : 400,
              color: m.winner_team === 2 ? "#059669" : "#111",
            }}
          >
            {teamLabel(m, 2)}
          </td>
          {/* Set scores */}
          {Array.from({ length: maxSets }, (_, i) => {
            const setData = sets.find((s) => s.set_number === i + 1);
            return (
              <td
                key={i}
                style={{
                  padding: "6px 8px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  textAlign: "center",
                  width: 60,
                  color: setData ? "#111" : "#ccc",
                }}
              >
                {setData
                  ? `${setData.team1_score}:${setData.team2_score}`
                  : m.status === "completed" ? "-" : "__ : __"}
              </td>
            );
          })}
          <td
            style={{
              padding: "6px 8px",
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: 700,
              textAlign: "center",
              width: 50,
            }}
          >
            {(t1Sets > 0 || t2Sets > 0) ? `${t1Sets}:${t2Sets}` : ""}
          </td>
        </tr>
      );
    };

    const renderRound = (round: Round) => {
      const matches = matchesByRound.get(round.id) || [];
      const maxSets = tournament.sets_to_win * 2 - 1;

      return (
        <div key={round.id} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#059669" }}>
            Runde {round.round_number}
          </h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #d1d5db",
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0fdf4", borderBottom: "2px solid #d1d5db" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>#</th>
                {tournament.courts > 1 && (
                  <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 50 }}>Feld</th>
                )}
                <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>Team 1</th>
                <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, width: 30 }}></th>
                <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>Team 2</th>
                {Array.from({ length: maxSets }, (_, i) => (
                  <th key={i} style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 60 }}>
                    Satz {i + 1}
                  </th>
                ))}
                <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 50 }}>
                  Saetze
                </th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, idx) => renderMatchRow(m, idx))}
            </tbody>
          </table>
        </div>
      );
    };

    const renderStandings = () => (
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#059669" }}>
          Rangliste
        </h3>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid #d1d5db",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f0fdf4", borderBottom: "2px solid #d1d5db" }}>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 40 }}>Platz</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, fontWeight: 600 }}>Spieler</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 50 }}>Siege</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 60 }}>Niederl.</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 70 }}>Saetze</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, width: 80 }}>Punkte</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
              return (
                <tr
                  key={s.player.id}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    backgroundColor: i < 3 ? "#fffbeb" : "transparent",
                  }}
                >
                  <td style={{ padding: "6px 8px", textAlign: "center", fontSize: 13 }}>{medal}</td>
                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>{s.player.name}</td>
                  <td style={{ padding: "6px 8px", textAlign: "center", color: "#059669", fontWeight: 700 }}>
                    {s.wins}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "center", color: "#e11d48" }}>
                    {s.losses}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace" }}>
                    {s.setsWon}:{s.setsLost}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace" }}>
                    {s.pointsWon}:{s.pointsLost}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

    const renderHighlights = () => {
      const allMatches: Match[] = [];
      for (const [, matches] of matchesByRound) {
        allMatches.push(...matches);
      }

      const highlights = calculateHighlights(
        players,
        allMatches,
        setsByMatch,
        tournament.points_per_set,
        playerName,
        (m) => [teamLabel(m, 1), teamLabel(m, 2)]
      );

      const highlightItems: { icon: string; label: string; value: string }[] = [];

      if (highlights.mostWins) {
        highlightItems.push({
          icon: "🏆",
          label: "Meiste Siege",
          value: `${highlights.mostWins.player.name} (${highlights.mostWins.wins} Siege)`,
        });
      }
      if (highlights.topScorer) {
        highlightItems.push({
          icon: "🎯",
          label: "Meiste Punkte",
          value: `${highlights.topScorer.player.name} (${highlights.topScorer.totalPoints} Punkte)`,
        });
      }
      if (highlights.closestMatch) {
        highlightItems.push({
          icon: "🔥",
          label: "Knappstes Spiel",
          value: highlights.closestMatch.description,
        });
      }
      if (highlights.biggestWin) {
        highlightItems.push({
          icon: "💪",
          label: "Deutlichster Sieg",
          value: highlights.biggestWin.description,
        });
      }
      if (highlights.highestScoringMatch) {
        highlightItems.push({
          icon: "📈",
          label: "Punktreichstes Spiel",
          value: highlights.highestScoringMatch.description,
        });
      }
      if (highlights.mostSetsMatch && tournament.sets_to_win > 1) {
        highlightItems.push({
          icon: "⏱️",
          label: "Laengstes Spiel",
          value: highlights.mostSetsMatch.description,
        });
      }

      return (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#059669" }}>
            Highlights
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            {highlightItems.map((item, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: "#f0fdf4",
                  borderRadius: 8,
                  padding: "10px 14px",
                  border: "1px solid #d1fae5",
                }}
              >
                <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>
                  {item.icon} {item.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Stats summary */}
          <div style={{
            marginTop: 10,
            display: "flex",
            gap: 20,
            fontSize: 11,
            color: "#666",
            borderTop: "1px solid #e5e7eb",
            paddingTop: 8,
          }}>
            <span>{highlights.completedMatches} von {highlights.totalMatches} Spielen abgeschlossen</span>
            <span>{highlights.totalSets} Saetze gespielt</span>
            <span>{highlights.totalPoints} Punkte gesamt</span>
          </div>
        </div>
      );
    };

    const renderParticipants = () => (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#059669" }}>
          Teilnehmer ({players.length})
        </h3>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 4,
          fontSize: 11,
        }}>
          {players.map((p) => (
            <div key={p.id} style={{ padding: "3px 8px", display: "flex", justifyContent: "space-between" }}>
              <span>{p.name}</span>
              <span style={{ color: "#999", fontSize: 10 }}>
                {p.gender === "m" ? "H" : "D"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div
        ref={ref}
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "#111",
          padding: 30,
          maxWidth: 800,
          margin: "0 auto",
          backgroundColor: "white",
        }}
      >
        {renderHeader()}

        {/* Report mode: Highlights + Standings + Participants + All Rounds */}
        {mode === "report" && (
          <>
            {renderHighlights()}
            {renderStandings()}
            {renderParticipants()}
            <div style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#059669" }}>
                Alle Ergebnisse
              </h3>
            </div>
            {rounds.map((r) => renderRound(r))}
          </>
        )}

        {/* Schedule: all rounds */}
        {(mode === "schedule" || mode === "full") &&
          rounds.map((r) => renderRound(r))}

        {/* Single round */}
        {mode === "round" &&
          activeRoundId &&
          rounds
            .filter((r) => r.id === activeRoundId)
            .map((r) => renderRound(r))}

        {/* Standings */}
        {(mode === "standings" || mode === "full") && renderStandings()}

        {/* Footer */}
        <div
          style={{
            marginTop: 30,
            paddingTop: 10,
            borderTop: "1px solid #e5e7eb",
            fontSize: 9,
            color: "#aaa",
            textAlign: "center",
          }}
        >
          Badminton Turnierplaner &middot; {tournament.name} &middot; Erstellt am {now}
        </div>
      </div>
    );
  }
);

PrintView.displayName = "PrintView";
export default PrintView;
