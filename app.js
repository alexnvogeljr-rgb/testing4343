/* Padres Player Stats Tracker
 * Pulls comprehensive, player-by-player stats from the free public MLB Stats API.
 * No backend, no API key — your browser fetches the data directly.
 */
(() => {
  "use strict";

  const TEAM_ID = 135; // San Diego Padres
  const API = "https://statsapi.mlb.com/api/v1";

  // Build a headshot URL. This pattern auto-falls back to a generic
  // silhouette when a player has no portrait, so no error handling needed.
  const headshot = (id, w = 120) =>
    `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_${w},q_auto:best/v1/people/${id}/headshot/67/current`;

  // Column layouts per stat group: [statKey, columnLabel].
  const COLUMNS = {
    hitting: [
      ["gamesPlayed", "G"], ["atBats", "AB"], ["runs", "R"], ["hits", "H"],
      ["doubles", "2B"], ["triples", "3B"], ["homeRuns", "HR"], ["rbi", "RBI"],
      ["baseOnBalls", "BB"], ["strikeOuts", "SO"], ["stolenBases", "SB"],
      ["avg", "AVG"], ["obp", "OBP"], ["slg", "SLG"], ["ops", "OPS"],
    ],
    pitching: [
      ["wins", "W"], ["losses", "L"], ["era", "ERA"], ["gamesPlayed", "G"],
      ["gamesStarted", "GS"], ["saves", "SV"], ["inningsPitched", "IP"],
      ["hits", "H"], ["runs", "R"], ["earnedRuns", "ER"], ["homeRuns", "HR"],
      ["baseOnBalls", "BB"], ["strikeOuts", "SO"], ["whip", "WHIP"],
    ],
    fielding: [
      ["__position", "POS"], ["gamesPlayed", "G"], ["gamesStarted", "GS"],
      ["putOuts", "PO"], ["assists", "A"], ["errors", "E"],
      ["doublePlays", "DP"], ["fielding", "FLD%"],
    ],
  };
  const GROUP_TITLES = { hitting: "Hitting", pitching: "Pitching", fielding: "Fielding" };

  // --- DOM refs ---
  const els = {
    season: document.getElementById("seasonSelect"),
    roster: document.getElementById("rosterSelect"),
    search: document.getElementById("searchInput"),
    list: document.getElementById("rosterList"),
    count: document.getElementById("rosterCount"),
    placeholder: document.getElementById("detailPlaceholder"),
    content: document.getElementById("detailContent"),
    status: document.getElementById("statusBar"),
  };

  let currentRoster = [];   // [{id, name, number, position, posType}]
  let selectedId = null;
  const statsCache = new Map(); // key `${id}:${season}` -> {bio, statsByGroup}

  // --- Helpers ---
  const setStatus = (msg, isError = false) => {
    els.status.innerHTML = msg;
    els.status.classList.toggle("error", isError);
  };
  const loading = (msg) => setStatus(`<span class="spinner"></span>${msg}`);

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  }

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // --- Season dropdown ---
  function initSeasons() {
    const now = new Date().getFullYear();
    for (let y = now; y >= 2015; y--) {
      const o = document.createElement("option");
      o.value = String(y);
      o.textContent = String(y);
      els.season.appendChild(o);
    }
    // Default to the most recent completed-ish season if very early in the year.
    els.season.value = String(now);
  }

  // --- Roster ---
  async function loadRoster() {
    const season = els.season.value;
    const type = els.roster.value;
    selectedId = null;
    els.list.innerHTML = "";
    els.count.textContent = "";
    loading("Loading roster…");
    try {
      const data = await fetchJSON(
        `${API}/teams/${TEAM_ID}/roster?rosterType=${encodeURIComponent(type)}&season=${season}`
      );
      currentRoster = (data.roster || []).map((r) => ({
        id: r.person.id,
        name: r.person.fullName,
        number: r.jerseyNumber || "",
        position: r.position?.abbreviation || "",
        posType: r.position?.type || "",
      }));
      if (!currentRoster.length) {
        setStatus(`No players found for the ${season} ${type} roster.`);
      } else {
        setStatus(`Loaded ${currentRoster.length} players for ${season}.`);
      }
      renderRoster();
    } catch (err) {
      setStatus(`Could not load roster: ${esc(err.message)}. ` +
        `If you opened this file directly, serve it over http (see README).`, true);
    }
  }

  function renderRoster() {
    const q = els.search.value.trim().toLowerCase();
    const filtered = currentRoster.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.position.toLowerCase().includes(q)
    );
    els.count.textContent = String(filtered.length);

    const pitchers = filtered.filter((p) => p.posType === "Pitcher" || p.position === "P");
    const others = filtered.filter((p) => !(p.posType === "Pitcher" || p.position === "P"));
    const byNumThenName = (a, b) =>
      (parseInt(a.number, 10) || 999) - (parseInt(b.number, 10) || 999) ||
      a.name.localeCompare(b.name);
    pitchers.sort(byNumThenName);
    others.sort(byNumThenName);

    els.list.innerHTML = "";
    const addGroup = (label, players) => {
      if (!players.length) return;
      const head = document.createElement("div");
      head.className = "roster-group-label";
      head.textContent = `${label} (${players.length})`;
      els.list.appendChild(head);
      players.forEach((p) => els.list.appendChild(playerRow(p)));
    };
    addGroup("Position Players", others);
    addGroup("Pitchers", pitchers);

    if (!filtered.length) {
      els.list.innerHTML = `<div class="empty-note" style="padding:16px">No players match your filter.</div>`;
    }
  }

  function playerRow(p) {
    const btn = document.createElement("button");
    btn.className = "player-row" + (p.id === selectedId ? " active" : "");
    btn.setAttribute("role", "listitem");
    btn.innerHTML = `
      <img class="player-avatar" src="${headshot(p.id, 80)}" alt="" loading="lazy" />
      <span>
        <span class="name">${esc(p.name)}</span><br/>
        <span class="player-meta">${esc(p.position || "—")}</span>
      </span>
      <span class="player-num">${p.number ? "#" + esc(p.number) : ""}</span>`;
    btn.addEventListener("click", () => selectPlayer(p));
    return btn;
  }

  // --- Player detail ---
  async function selectPlayer(p) {
    selectedId = p.id;
    document.querySelectorAll(".player-row").forEach((el) => el.classList.remove("active"));
    [...els.list.querySelectorAll(".player-row")].forEach((el) => {
      if (el.querySelector(".name")?.textContent === p.name) el.classList.add("active");
    });

    const season = els.season.value;
    loading(`Loading ${p.name}'s ${season} stats…`);
    try {
      const detail = await getPlayerDetail(p.id, season);
      renderDetail(p, detail, season);
      setStatus(`Showing ${p.name} — ${season}.`);
    } catch (err) {
      setStatus(`Could not load stats for ${esc(p.name)}: ${esc(err.message)}`, true);
    }
  }

  async function getPlayerDetail(id, season) {
    const key = `${id}:${season}`;
    if (statsCache.has(key)) return statsCache.get(key);

    const [bioData, statsData] = await Promise.all([
      fetchJSON(`${API}/people/${id}`),
      fetchJSON(`${API}/people/${id}/stats?stats=season&season=${season}&group=hitting,pitching,fielding`),
    ]);

    const bio = bioData.people?.[0] || {};
    const statsByGroup = {};
    (statsData.stats || []).forEach((block) => {
      // The API reports the group name in lowercase ("hitting"); normalize so
      // lookups are case-insensitive regardless of how the API formats it.
      const group = block.group?.displayName?.toLowerCase();
      if (group && block.splits?.length) statsByGroup[group] = block.splits;
    });

    const detail = { bio, statsByGroup };
    statsCache.set(key, detail);
    return detail;
  }

  function bioStrip(bio) {
    const items = [
      ["Position", bio.primaryPosition?.abbreviation],
      ["Bats / Throws", `${bio.batSide?.code || "-"} / ${bio.pitchHand?.code || "-"}`],
      ["Height / Weight", `${bio.height || "-"}, ${bio.weight ? bio.weight + " lb" : "-"}`],
      ["Age", bio.currentAge],
      ["Born", bio.birthDate ? `${bio.birthDate}` : null],
      ["Birthplace", [bio.birthCity, bio.birthStateProvince, bio.birthCountry].filter(Boolean).join(", ")],
      ["MLB Debut", bio.mlbDebutDate],
    ].filter(([, v]) => v != null && v !== "" && v !== "- / -");
    return `<div class="bio-strip">${items
      .map(([k, v]) => `<div class="bio-item"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`)
      .join("")}</div>`;
  }

  function statValue(stat, key) {
    if (key === "__position") return stat.position?.abbreviation || "—";
    const v = stat[key];
    return v === undefined || v === null || v === "" ? "—" : v;
  }

  function statsTable(group, splits) {
    const cols = COLUMNS[group];
    if (!cols) return "";
    const showTeam = splits.length > 1; // multiple rows (e.g. fielding by position, or mid-season trades)
    const header =
      `<tr>${showTeam ? "<th>Split</th>" : ""}${cols.map(([, l]) => `<th>${l}</th>`).join("")}</tr>`;
    const rows = splits
      .map((s) => {
        const label = group === "fielding"
          ? (s.position?.abbreviation || s.team?.abbreviation || "")
          : (s.team?.abbreviation || s.team?.name || "");
        const firstCell = showTeam ? `<td class="stat-key">${esc(label || "—")}</td>` : "";
        const cells = cols
          .map(([key], i) => {
            const val = statValue(s.stat || {}, key);
            const cls = i === 0 && !showTeam ? ' class="stat-key"' : "";
            return `<td${cls}>${esc(val)}</td>`;
          })
          .join("");
        return `<tr>${firstCell}${cells}</tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="stats"><thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderDetail(p, detail, season) {
    const { bio, statsByGroup } = detail;
    const groupsOrder = ["hitting", "pitching", "fielding"];
    const present = groupsOrder.filter((g) => statsByGroup[g]?.length);

    let sections = "";
    if (!present.length) {
      sections = `<div class="stats-section"><p class="empty-note">No ${season} stats recorded for this player in the selected season.</p></div>`;
    } else {
      sections = present
        .map((g) => {
          const splits = statsByGroup[g];
          return `<div class="stats-section">
            <h3>${GROUP_TITLES[g]}<span class="ctx">${season} season</span></h3>
            ${statsTable(g, splits)}
          </div>`;
        })
        .join("");
    }

    els.content.innerHTML = `
      <div class="player-hero">
        <img src="${headshot(p.id, 240)}" alt="${esc(p.name)}" />
        <div>
          <p class="h-name">${esc(p.name)}</p>
          <p class="h-sub">${esc(bio.primaryPosition?.name || p.position || "")}${
            bio.primaryPosition?.abbreviation ? " &middot; " + esc(bio.primaryPosition.abbreviation) : ""
          } &middot; San Diego Padres</p>
        </div>
        <div class="h-num">${p.number ? "#" + esc(p.number) : ""}</div>
      </div>
      ${bioStrip(bio)}
      ${sections}`;
    els.placeholder.classList.add("hidden");
    els.content.classList.remove("hidden");
  }

  // --- Events ---
  els.season.addEventListener("change", () => {
    els.content.classList.add("hidden");
    els.placeholder.classList.remove("hidden");
    loadRoster();
  });
  els.roster.addEventListener("change", loadRoster);
  els.search.addEventListener("input", renderRoster);

  // --- Boot ---
  initSeasons();
  loadRoster();
})();
