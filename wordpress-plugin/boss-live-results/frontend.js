/**
 * BOSS Live Results — frontend renderer.
 *
 * Polls the WP REST API every 15s and fills any [data-boss] container on
 * the page with the matching view. Multiple containers and multiple
 * tournament IDs on one page are all supported — the script groups by tid
 * and fans out one network request per unique id.
 *
 * Vanilla JS, no jQuery / no React. Assumes BOSS_LIVE is provided by
 * wp_localize_script with { rest_base, interval }.
 */
(function () {
  "use strict";

  const cfg = window.BOSS_LIVE || {};
  if (!cfg.rest_base) return;
  const POLL_MS = cfg.interval || 15000;

  // ---------- helpers --------------------------------------------------------

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (const c of children) node.appendChild(c);
    }
    return node;
  }

  function clear(container) {
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  function playerName(p) {
    if (!p) return "?";
    return p.last_name ? p.first_name + " " + p.last_name : p.first_name;
  }

  function teamLabel(match, players) {
    const t1 = playerName(players[match.team1_p1]);
    const t1b = match.team1_p2 ? " / " + playerName(players[match.team1_p2]) : "";
    const t2 = playerName(players[match.team2_p1]);
    const t2b = match.team2_p2 ? " / " + playerName(players[match.team2_p2]) : "";
    return { team1: t1 + t1b, team2: t2 + t2b };
  }

  function setsScore(matchId, allSets) {
    const mine = allSets.filter((s) => s.match_id === matchId);
    mine.sort((a, b) => a.set_number - b.set_number);
    return mine.map((s) => s.team1_score + ":" + s.team2_score).join(", ");
  }

  // ---------- renderers ------------------------------------------------------

  function renderStatus(container, data) {
    clear(container);
    const status = (data.tournament && data.tournament.status) || "";
    const isLive = status === "active";
    const label = isLive ? "Live" : status === "completed" ? "Final" : status;
    const badge = el("span", {
      class: "boss-badge boss-badge-" + (isLive ? "live" : "final"),
      text: label,
    });
    container.appendChild(badge);
    if (data.pushed_at) {
      const time = new Date(data.pushed_at);
      const t = el("span", {
        class: "boss-time",
        text: " — last update: " + time.toLocaleTimeString(),
      });
      container.appendChild(t);
    }
  }

  function renderMatches(container, data) {
    clear(container);
    if (!data.matches || data.matches.length === 0) {
      container.appendChild(el("div", { class: "boss-empty", text: "No matches yet." }));
      return;
    }

    // Find current round: highest round_number with at least one non-completed match,
    // else the highest round overall.
    const roundsById = {};
    for (const r of data.rounds || []) roundsById[r.id] = r;
    const matchesByRound = {};
    for (const m of data.matches) {
      const rn = roundsById[m.round_id] ? roundsById[m.round_id].round_number : 0;
      (matchesByRound[rn] = matchesByRound[rn] || []).push(m);
    }
    const roundNumbers = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);
    let currentRound = roundNumbers[roundNumbers.length - 1] || 0;
    for (let i = roundNumbers.length - 1; i >= 0; i--) {
      const rn = roundNumbers[i];
      if (matchesByRound[rn].some((m) => m.status !== "completed")) {
        currentRound = rn;
        break;
      }
    }

    const heading = el("h3", { class: "boss-h3", text: "Round " + currentRound });
    container.appendChild(heading);

    const table = el("table", { class: "boss-table" });
    const thead = el("thead");
    const trh = el("tr");
    ["Court", "Team 1", "Score", "Team 2", "Status"].forEach((h) =>
      trh.appendChild(el("th", { text: h })),
    );
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = el("tbody");
    const list = matchesByRound[currentRound] || [];
    list.sort((a, b) => (a.court || 99) - (b.court || 99));
    for (const m of list) {
      const tr = el("tr", { class: "boss-row-" + m.status });
      const labels = teamLabel(m, data.players || {});
      const score = setsScore(m.id, data.sets || []);
      tr.appendChild(el("td", { text: m.court ? String(m.court) : "—" }));
      tr.appendChild(
        el("td", {
          class: "boss-team" + (m.winner_team === 1 ? " boss-winner" : ""),
          text: labels.team1,
        }),
      );
      tr.appendChild(el("td", { class: "boss-score", text: score || "–" }));
      tr.appendChild(
        el("td", {
          class: "boss-team" + (m.winner_team === 2 ? " boss-winner" : ""),
          text: labels.team2,
        }),
      );
      let statusLabel = m.status;
      if (m.status === "active") statusLabel = "Live";
      else if (m.status === "completed") statusLabel = "Done";
      else if (m.status === "pending") statusLabel = "—";
      tr.appendChild(el("td", { text: statusLabel }));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function renderStandingsTable(rows, isTeam) {
    const table = el("table", { class: "boss-table" });
    const thead = el("thead");
    const trh = el("tr");
    const cols = isTeam
      ? ["#", "Team", "W", "L", "Sets", "Pts"]
      : ["#", "Player", "W", "L", "Sets", "Pts"];
    cols.forEach((h) => trh.appendChild(el("th", { text: h })));
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = el("tbody");
    rows.forEach((r, i) => {
      const tr = el("tr");
      tr.appendChild(el("td", { text: String(i + 1) }));
      const name = isTeam
        ? playerName(r.player1) + " / " + playerName(r.player2)
        : playerName(r.player);
      tr.appendChild(el("td", { text: name }));
      tr.appendChild(el("td", { text: String(r.wins) }));
      tr.appendChild(el("td", { text: String(r.losses) }));
      tr.appendChild(el("td", { text: r.setsWon + ":" + r.setsLost }));
      tr.appendChild(el("td", { text: r.pointsWon + ":" + r.pointsLost }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function renderStandings(container, data) {
    clear(container);
    const isTeam = data.tournament && data.tournament.mode !== "singles";

    // For group_ko show per-group sub-tables; otherwise the flat list.
    if (data.groups && data.groups.length > 0) {
      data.groups.forEach((g) => {
        container.appendChild(el("h3", { class: "boss-h3", text: "Group " + g.number }));
        container.appendChild(renderStandingsTable(g.standings || [], false));
      });
      return;
    }

    if (!data.standings || data.standings.length === 0) {
      container.appendChild(el("div", { class: "boss-empty", text: "No standings yet." }));
      return;
    }
    container.appendChild(renderStandingsTable(data.standings, isTeam));
  }

  function renderBracket(container, data) {
    clear(container);
    const format = data.tournament && data.tournament.format;
    if (format !== "elimination" && format !== "group_ko" && format !== "double_elimination") {
      container.appendChild(
        el("div", { class: "boss-empty", text: "No bracket for this tournament format." }),
      );
      return;
    }

    // Group KO matches by round_number.
    const roundsById = {};
    for (const r of data.rounds || []) {
      if (r.phase === "ko" || r.phase === "winners" || r.phase === "losers") {
        roundsById[r.id] = r;
      }
    }
    const byRound = {};
    for (const m of data.matches || []) {
      const r = roundsById[m.round_id];
      if (!r) continue;
      (byRound[r.round_number] = byRound[r.round_number] || []).push(m);
    }
    const rNums = Object.keys(byRound).map(Number).sort((a, b) => a - b);
    if (rNums.length === 0) {
      container.appendChild(
        el("div", { class: "boss-empty", text: "KO bracket not started yet." }),
      );
      return;
    }

    const wrap = el("div", { class: "boss-bracket" });
    rNums.forEach((rn) => {
      const col = el("div", { class: "boss-bracket-round" });
      col.appendChild(el("h4", { class: "boss-h4", text: "Round " + rn }));
      byRound[rn].forEach((m) => {
        const card = el("div", { class: "boss-match-card" });
        const labels = teamLabel(m, data.players || {});
        const score = setsScore(m.id, data.sets || []);
        const t1Class = "boss-team" + (m.winner_team === 1 ? " boss-winner" : "");
        const t2Class = "boss-team" + (m.winner_team === 2 ? " boss-winner" : "");
        card.appendChild(el("div", { class: t1Class, text: labels.team1 }));
        if (score) card.appendChild(el("div", { class: "boss-score", text: score }));
        card.appendChild(el("div", { class: t2Class, text: labels.team2 }));
        col.appendChild(card);
      });
      wrap.appendChild(col);
    });
    container.appendChild(wrap);
  }

  function renderList(container, list) {
    clear(container);
    if (!list || list.length === 0) {
      container.appendChild(el("div", { class: "boss-empty", text: "No live tournaments." }));
      return;
    }
    const ul = el("ul", { class: "boss-tournament-list" });
    list.forEach((t) => {
      const li = el("li");
      const status = el("span", {
        class: "boss-badge boss-badge-" + (t.status === "active" ? "live" : "final"),
        text: t.status === "active" ? "Live" : t.status === "completed" ? "Final" : t.status,
      });
      const link = el("a", {
        href: "?tid=" + t.id,
        class: "boss-tournament-link",
        text: t.name,
      });
      li.appendChild(status);
      li.appendChild(document.createTextNode(" "));
      li.appendChild(link);
      if (t.pushed_at) {
        const time = new Date(t.pushed_at);
        li.appendChild(el("span", { class: "boss-time", text: " — " + time.toLocaleString() }));
      }
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  // ---------- polling --------------------------------------------------------

  function collectByTid() {
    const map = new Map();
    document.querySelectorAll("[data-boss][data-tid]").forEach((node) => {
      const tid = node.dataset.tid;
      if (!tid || tid === "0") return; // 0 = unresolved, list-only flow handles this
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid).push(node);
    });
    return map;
  }

  function collectListNodes() {
    return document.querySelectorAll('[data-boss="tournaments"]');
  }

  function collectAutoNodes() {
    // Nodes with data-tid="0" want to auto-pick from the latest list.
    return document.querySelectorAll('[data-boss][data-tid="0"]');
  }

  async function fetchSnapshot(tid) {
    const r = await fetch(cfg.rest_base + "/snapshot/" + encodeURIComponent(tid), {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  async function fetchList() {
    const r = await fetch(cfg.rest_base + "/tournaments", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }

  function applySnapshot(node, data) {
    const kind = node.dataset.boss;
    if (!data || data.empty) {
      clear(node);
      node.appendChild(el("div", { class: "boss-empty", text: "No data yet." }));
      return;
    }
    if (kind === "matches") renderMatches(node, data);
    else if (kind === "standings") renderStandings(node, data);
    else if (kind === "bracket") renderBracket(node, data);
    else if (kind === "status") renderStatus(node, data);
  }

  async function tick() {
    const listNodes = collectListNodes();
    let liveList = null;
    if (listNodes.length > 0) {
      try {
        liveList = await fetchList();
        listNodes.forEach((n) => renderList(n, liveList));
      } catch (e) {
        console.warn("[boss-live] list fetch failed", e);
      }
    }

    // Auto-pick: nodes with tid=0 take the first active or first listed tournament.
    const autoNodes = collectAutoNodes();
    if (autoNodes.length > 0) {
      try {
        const list = liveList || (await fetchList());
        const pick = list.find((t) => t.status === "active") || list[0];
        if (pick) {
          autoNodes.forEach((n) => n.setAttribute("data-tid", String(pick.id)));
        }
      } catch (e) {
        console.warn("[boss-live] auto-pick failed", e);
      }
    }

    const byTid = collectByTid();
    const requests = [];
    byTid.forEach((nodes, tid) => {
      requests.push(
        fetchSnapshot(tid)
          .then((data) => nodes.forEach((n) => applySnapshot(n, data)))
          .catch((e) => console.warn("[boss-live] snapshot fetch failed for", tid, e)),
      );
    });
    await Promise.all(requests);
  }

  function start() {
    tick();
    setInterval(tick, POLL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
