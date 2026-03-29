import React, { useState } from "react";
import type { ThemeColors } from "../../lib/theme";
import type {
  Tournament,
  Player,
  Match,
  TournamentPlayerInfo,
  PaymentMethod,
} from "../../lib/types";
import { PAYMENT_METHOD_LABELS } from "../../lib/types";
import {
  getTournamentPlayersDetailed,
  updatePlayerPayment,
} from "../../lib/db";

interface VerwaltungTabProps {
  tournament: Tournament;
  players: Player[];
  allPlayers: Player[];
  paymentData: TournamentPlayerInfo[];
  theme: ThemeColors;
  collapsedClubs: Set<string>;
  showAddPlayer: boolean;
  allMatches: Match[];
  setShowAddPlayer: (show: boolean) => void;
  handleAddPlayer: (playerId: number) => void;
  handleRemovePlayer: (playerId: number) => void;
  setPaymentData: (data: TournamentPlayerInfo[]) => void;
  setCollapsedClubs: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRetireTarget: (target: { player: Player; partnerNote: string } | null) => void;
  playerName: (id: number | null) => string;
}

export default function VerwaltungTab({
  tournament,
  players,
  allPlayers,
  paymentData,
  theme,
  collapsedClubs,
  showAddPlayer,
  allMatches,
  setShowAddPlayer,
  handleAddPlayer,
  handleRemovePlayer,
  setPaymentData,
  setCollapsedClubs,
  setRetireTarget,
  playerName,
}: VerwaltungTabProps) {
  const [verwaltungSearch, setVerwaltungSearch] = useState("");
  const [verwaltungFilter, setVerwaltungFilter] = useState<"all" | "paid" | "unpaid">("all");

  return (
    <div className={`${theme.cardBg} rounded-2xl shadow-sm border ${theme.cardBorder} overflow-hidden`}>
      <div className={`px-5 py-3 border-b ${theme.cardBorder} ${theme.headerGradient} flex justify-between items-center`}>
        <span className={`font-semibold text-sm ${theme.standingsHeaderText}`}>
          {"\u{1F465}"} Teilnehmer ({players.length})
          {(tournament.entry_fee_single > 0 || tournament.entry_fee_double > 0) && (
            <span className={`ml-2 font-normal text-xs ${theme.textSecondary}`}>
              {"\u{1F4B0}"} {paymentData.filter((p) => p.payment_status === "paid").length}/{paymentData.length} bezahlt
              &middot; {paymentData.filter((p) => p.payment_status === "paid").length *
                (tournament.mode === "singles" ? tournament.entry_fee_single : tournament.entry_fee_double)
              } EUR
            </span>
          )}
        </span>
        {tournament.status === "draft" && (
          <button
            onClick={() => setShowAddPlayer(!showAddPlayer)}
            className={`text-xs font-medium ${theme.activeBadgeText} transition-colors`}
          >
            {showAddPlayer ? "Fertig" : "+ Spieler"}
          </button>
        )}
      </div>

      {/* Add Player Dropdown - only in draft */}
      {showAddPlayer && tournament.status === "draft" && (
        <div className={`p-3 border-b ${theme.cardBorder} ${theme.selectedBg}`}>
          <div className="text-xs text-gray-500 mb-2 font-medium">Spieler hinzufuegen:</div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {allPlayers
              .filter((ap) => !players.some((p) => p.id === ap.id))
              .map((ap) => (
                <button
                  key={ap.id}
                  onClick={() => handleAddPlayer(ap.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors text-left"
                >
                  <span className={theme.textPrimary}>{ap.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ap.gender === "m" ? "bg-blue-50 text-blue-500" : "bg-pink-50 text-pink-500"}`}>
                    {ap.gender === "m" ? "H" : "D"}
                  </span>
                </button>
              ))}
            {allPlayers.filter((ap) => !players.some((p) => p.id === ap.id)).length === 0 && (
              <div className="text-xs text-gray-400 py-2 text-center">Alle Spieler sind bereits dabei.</div>
            )}
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className={`px-4 py-2.5 border-b ${theme.cardBorder} flex items-center gap-3 flex-wrap`}>
        <div className="relative flex-1 min-w-[150px]">
          <input
            type="text"
            value={verwaltungSearch}
            onChange={(e) => setVerwaltungSearch(e.target.value)}
            placeholder="Spieler oder Verein suchen..."
            className={`w-full ${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded-lg pl-8 pr-3 py-1.5 text-sm ${theme.focusBorder} focus:ring-2 ${theme.focusRing} outline-none transition-all`}
          />
          <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${theme.textMuted} text-xs`}>{"\u{1F50D}"}</span>
          {verwaltungSearch && (
            <button onClick={() => setVerwaltungSearch("")} className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${theme.textMuted} hover:opacity-80 text-xs`}>{"\u2715"}</button>
          )}
        </div>
        {(tournament.entry_fee_single > 0 || tournament.entry_fee_double > 0) && (
          <div className={`flex rounded-lg border ${theme.inputBorder} overflow-hidden text-xs`}>
            {([
              { value: "all" as const, label: "Alle" },
              { value: "paid" as const, label: "Bezahlt" },
              { value: "unpaid" as const, label: "Offen" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setVerwaltungFilter(opt.value)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  verwaltungFilter === opt.value
                    ? `${theme.primaryBg} text-white`
                    : `${theme.textSecondary} hover:opacity-80`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {(() => {
        const hasPayment = tournament.entry_fee_single > 0 || tournament.entry_fee_double > 0;
        const fee = tournament.mode === "singles" ? tournament.entry_fee_single : tournament.entry_fee_double;
        const searchLower = verwaltungSearch.toLowerCase().trim();
        const filtered = paymentData.filter((pd) => {
          if (searchLower && !pd.player.name.toLowerCase().includes(searchLower) && !(pd.player.club ?? "").toLowerCase().includes(searchLower)) return false;
          if (verwaltungFilter === "paid" && pd.payment_status !== "paid") return false;
          if (verwaltungFilter === "unpaid" && pd.payment_status !== "unpaid") return false;
          return true;
        });
        const sorted = [...filtered].sort((a, b) => (a.player.club ?? "").localeCompare(b.player.club ?? "") || a.player.name.localeCompare(b.player.name));
        const groups = new Map<string, TournamentPlayerInfo[]>();
        for (const pd of sorted) {
          const club = pd.player.club || "Kein Verein";
          if (!groups.has(club)) groups.set(club, []);
          groups.get(club)!.push(pd);
        }

        return (
          <>
          {(searchLower || verwaltungFilter !== "all") && (
            <div className={`px-4 py-1.5 text-xs ${theme.textMuted} border-b ${theme.cardBorder}`}>
              {filtered.length} von {paymentData.length} Teilnehmern angezeigt
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${theme.cardBorder} text-xs ${theme.textMuted}`}>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-center px-2 py-2">Geschlecht</th>
                <th className="text-left px-2 py-2">Verein</th>
                {hasPayment && (
                  <>
                    <th className="text-center px-2 py-2">Startgeld</th>
                    <th className="text-center px-2 py-2">Zahlungsart</th>
                    <th className="text-center px-2 py-2">Datum</th>
                  </>
                )}
                <th className="text-right px-3 py-2">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(groups.entries()).map(([clubName, members]) => {
                const isCollapsed = collapsedClubs.has(clubName);
                const paidCount = members.filter((m) => m.payment_status === "paid").length;
                const colSpan = hasPayment ? 7 : 4;
                return (
                  <React.Fragment key={clubName}>
                    <tr
                      className={`${theme.headerGradient} cursor-pointer`}
                      onClick={() => setCollapsedClubs((prev) => {
                        const next = new Set(prev);
                        if (next.has(clubName)) next.delete(clubName);
                        else next.add(clubName);
                        return next;
                      })}
                    >
                      <td colSpan={colSpan} className={`px-3 py-2 text-xs font-semibold ${theme.standingsHeaderText}`}>
                        <span className="mr-1">{isCollapsed ? "\u25B6" : "\u25BC"}</span>
                        {clubName} ({members.length})
                        {hasPayment && (
                          <span className={`ml-2 font-normal ${theme.textMuted}`}>
                            {paidCount}/{members.length} bezahlt
                          </span>
                        )}
                      </td>
                    </tr>
                    {!isCollapsed && members.map((pd) => {
                      const isRetired = pd.retired;
                      return (
                        <tr key={pd.player.id} className={`border-b ${theme.cardBorder} last:border-0 group`}>
                          <td className={`px-3 py-2 pl-6 font-medium ${isRetired ? `${theme.textMuted} line-through` : theme.textPrimary}`}>
                            {pd.player.name}
                            {isRetired && <span className="ml-1.5 text-[10px] text-rose-400 no-underline inline-block">{"\u{1F3E5}"}</span>}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${pd.player.gender === "m" ? "bg-blue-50 text-blue-500" : "bg-pink-50 text-pink-500"}`}>
                              {pd.player.gender === "m" ? "H" : "D"}
                            </span>
                          </td>
                          <td className={`px-2 py-2 text-xs ${theme.textSecondary}`}>{pd.player.club ?? "-"}</td>
                          {hasPayment && (
                            <>
                              <td className="px-2 py-2 text-center">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  pd.payment_status === "paid"
                                    ? "bg-green-500/10 text-green-600"
                                    : "bg-orange-500/10 text-orange-600"
                                }`}>
                                  {pd.payment_status === "paid" ? `${fee} EUR` : "Offen"}
                                </span>
                              </td>
                              <td className={`px-2 py-2 text-center text-xs ${theme.textSecondary}`}>
                                {pd.payment_method ? PAYMENT_METHOD_LABELS[pd.payment_method] : "-"}
                              </td>
                              <td className={`px-2 py-2 text-center text-xs ${theme.textSecondary}`}>
                                {pd.payment_status === "paid" ? (
                                  <input
                                    type="text"
                                    value={pd.paid_date ?? ""}
                                    onChange={async (e) => {
                                      await updatePlayerPayment(tournament.id, pd.player.id, "paid", pd.payment_method, e.target.value || null);
                                      const updated = await getTournamentPlayersDetailed(tournament.id);
                                      setPaymentData(updated);
                                    }}
                                    className={`${theme.inputBg} ${theme.inputText} border ${theme.inputBorder} rounded px-1.5 py-0.5 text-xs text-center w-24`}
                                    placeholder="TT.MM.JJJJ"
                                  />
                                ) : "-"}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {hasPayment && pd.payment_status === "paid" ? (
                                <button
                                  onClick={async () => {
                                    await updatePlayerPayment(tournament.id, pd.player.id, "unpaid", null, null);
                                    const updated = await getTournamentPlayersDetailed(tournament.id);
                                    setPaymentData(updated);
                                  }}
                                  className={`text-xs ${theme.textMuted} hover:text-orange-600 transition-colors`}
                                >
                                  {"\u21A9"}
                                </button>
                              ) : hasPayment && pd.payment_status !== "paid" ? (
                                (["bar", "ueberweisung", "paypal"] as PaymentMethod[]).map((m) => (
                                  <button
                                    key={m}
                                    onClick={async () => {
                                      const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
                                      await updatePlayerPayment(tournament.id, pd.player.id, "paid", m, today);
                                      const updated = await getTournamentPlayersDetailed(tournament.id);
                                      setPaymentData(updated);
                                    }}
                                    className={`text-xs px-2 py-1 rounded-lg border ${theme.cardBorder} ${theme.textSecondary} hover:border-green-400 hover:text-green-600 transition-all`}
                                  >
                                    {PAYMENT_METHOD_LABELS[m]}
                                  </button>
                                ))
                              ) : null}
                              {tournament.status === "draft" && (
                                <button
                                  onClick={() => handleRemovePlayer(pd.player.id)}
                                  title="Aus Turnier entfernen"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-rose-400 hover:text-rose-600 ml-1"
                                >
                                  {"\u2715"}
                                </button>
                              )}
                              {tournament.status === "active" && !isRetired && (
                                <button
                                  onClick={() => {
                                    const p = pd.player;
                                    const isFixedTeam = tournament.format !== "random_doubles" && tournament.mode !== "singles";
                                    let partnerNote = "";
                                    if (isFixedTeam) {
                                      for (const m of allMatches) {
                                        if (m.team1_p1 === p.id && m.team1_p2) { partnerNote = `Da dies ein festes Team ist, scheidet auch ${playerName(m.team1_p2)} aus.`; break; }
                                        if (m.team1_p2 === p.id) { partnerNote = `Da dies ein festes Team ist, scheidet auch ${playerName(m.team1_p1)} aus.`; break; }
                                        if (m.team2_p1 === p.id && m.team2_p2) { partnerNote = `Da dies ein festes Team ist, scheidet auch ${playerName(m.team2_p2)} aus.`; break; }
                                        if (m.team2_p2 === p.id) { partnerNote = `Da dies ein festes Team ist, scheidet auch ${playerName(m.team2_p1)} aus.`; break; }
                                      }
                                    }
                                    setRetireTarget({ player: p, partnerNote });
                                  }}
                                  title="Verletzt / Aufgabe"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-amber-500 hover:text-amber-700 ml-1"
                                >
                                  {"\u{1F3E5}"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </>
        );
      })()}
    </div>
  );
}
