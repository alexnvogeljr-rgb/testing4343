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

  const teamLogo = (id) => `https://www.mlbstatic.com/team-logos/${id}.svg`;

  // Format an OPS-like value the baseball way: 0.850 -> ".850", 1.020 -> "1.020".
  function formatOps(v) {
    const n = parseFloat(v);
    if (Number.isNaN(n)) return null;
    let s = n.toFixed(3);
    if (s.startsWith("0.")) s = s.slice(1);
    return s;
  }

  // Division id -> {league, name, order} for grouping standings (fallback if hydrate is absent).
  const DIVISIONS = {
    201: { league: "AL", name: "AL East", order: 0 },
    202: { league: "AL", name: "AL Central", order: 1 },
    200: { league: "AL", name: "AL West", order: 2 },
    204: { league: "NL", name: "NL East", order: 0 },
    205: { league: "NL", name: "NL Central", order: 1 },
    203: { league: "NL", name: "NL West", order: 2 },
  };

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

  // Compact column sets used for split / monthly tables.
  const SPLIT_COLUMNS = {
    hitting: [
      ["atBats", "AB"], ["hits", "H"], ["homeRuns", "HR"], ["rbi", "RBI"],
      ["baseOnBalls", "BB"], ["strikeOuts", "SO"], ["avg", "AVG"],
      ["obp", "OBP"], ["slg", "SLG"], ["ops", "OPS"],
    ],
    pitching: [
      ["gamesPlayed", "G"], ["inningsPitched", "IP"], ["hits", "H"], ["earnedRuns", "ER"],
      ["baseOnBalls", "BB"], ["strikeOuts", "SO"], ["avg", "AVG"], ["era", "ERA"], ["whip", "WHIP"],
    ],
  };
  const MONTHS = { 3: "Mar", 4: "Apr", 5: "May", 6: "Jun", 7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov" };
  const monthName = (m) => MONTHS[Number(m)] || (m != null ? String(m) : "—");

  // Friendly labels for advanced (seasonAdvanced) stat fields.
  const LABELS = {
    // hitting (advanced)
    plateAppearances: "PA", totalBases: "TB", extraBaseHits: "XBH", hitByPitch: "HBP",
    intentionalWalks: "IBB", sacBunts: "SAC", sacFlies: "SF", groundIntoDoublePlay: "GIDP",
    numberOfPitches: "Pit", pitchesPerPlateAppearance: "P/PA", walksPerPlateAppearance: "BB%",
    strikeoutsPerPlateAppearance: "K%", homeRunsPerPlateAppearance: "HR/PA",
    walksPerStrikeout: "BB/K", iso: "ISO", babip: "BABIP", groundOutsToAirouts: "GO/AO",
    atBatsPerHomeRun: "AB/HR", stolenBasePercentage: "SB%", reachedOnError: "ROE",
    flyOuts: "FO", groundOuts: "GO", lineOuts: "LO", popOuts: "PU", catchersInterference: "CI",
    // pitching (advanced)
    strikeoutsPer9Inn: "K/9", walksPer9Inn: "BB/9", hitsPer9Inn: "H/9", homeRunsPer9: "HR/9",
    runsScoredPer9: "R/9", strikeoutWalkRatio: "K/BB", strikePercentage: "Strike%",
    pitchesPerInning: "P/IP", battersFaced: "BF", strikes: "Strikes", balls: "Balls",
    winPercentage: "W%", outs: "Outs", inheritedRunners: "IR", inheritedRunnersScored: "IRS",
    wildPitches: "WP", balks: "BK", hitBatsmen: "HB", pickoffs: "PK",
  };
  // For the Statcast "expectedStatistics" block, the generic keys mean expected values.
  const EXPECTED_LABELS = {
    avg: "xBA", slg: "xSLG", obp: "xOBP", woba: "xwOBA", wobaCon: "xwOBAcon",
    era: "xERA", plateAppearances: "PA", battersFaced: "BF",
  };
  // Preferred leading order for the expected-stats table.
  const EXPECTED_ORDER = ["plateAppearances", "battersFaced", "avg", "obp", "slg", "woba", "wobaCon", "era"];

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
    schedule: document.getElementById("scheduleContent"),
    standings: document.getElementById("standingsContent"),
    standingsLabel: document.getElementById("standingsSeasonLabel"),
    home: document.getElementById("homeContent"),
    homeSub: document.getElementById("homeGameSub"),
  };

  let currentRoster = [];   // [{id, name, number, position, posType}]
  let selectedId = null;
  const statsCache = new Map(); // key `${id}:${season}` -> {bio, groups}

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
        `${API}/teams/${TEAM_ID}/roster?rosterType=${encodeURIComponent(type)}&season=${season}` +
        `&hydrate=person(stats(group=[hitting],type=[season],season=${season}))`
      );
      currentRoster = (data.roster || []).map((r) => {
        // Pull season OPS from the hydrated hitting stats, if any.
        const hit = (r.person?.stats || []).find(
          (b) => b.group?.displayName?.toLowerCase() === "hitting"
        );
        const opsRaw = hit?.splits?.[0]?.stat?.ops;
        const ops = opsRaw != null && opsRaw !== "" && !Number.isNaN(parseFloat(opsRaw))
          ? parseFloat(opsRaw)
          : null;
        return {
          id: r.person.id,
          name: r.person.fullName,
          number: r.jerseyNumber || "",
          position: r.position?.abbreviation || "",
          posType: r.position?.type || "",
          ops,
          opsStr: ops != null ? formatOps(opsRaw) : null,
        };
      });
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

    // Eligible = has a season OPS; rank those high → low. The rest follow,
    // ordered by jersey number then name.
    const byNumThenName = (a, b) =>
      (parseInt(a.number, 10) || 999) - (parseInt(b.number, 10) || 999) ||
      a.name.localeCompare(b.name);
    const eligible = filtered.filter((p) => p.ops != null).sort((a, b) => b.ops - a.ops);
    const ineligible = filtered.filter((p) => p.ops == null).sort(byNumThenName);

    els.list.innerHTML = "";
    const addGroup = (label, players) => {
      if (!players.length) return;
      const head = document.createElement("div");
      head.className = "roster-group-label";
      head.textContent = `${label} (${players.length})`;
      els.list.appendChild(head);
      players.forEach((p) => els.list.appendChild(playerRow(p)));
    };
    addGroup("Ranked by OPS", eligible);
    addGroup("Pitchers / No OPS", ineligible);

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
        <span class="player-meta">${esc(p.position || "—")}${
          p.opsStr ? ` &middot; <span class="meta-ops">OPS ${esc(p.opsStr)}</span>` : ""
        }</span>
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
      // Optional Statcast percentile bars (only if a Savant proxy is configured).
      const isPitcher = (detail.bio?.primaryPosition?.abbreviation || p.position) === "P";
      addStatcastPercentiles(p, season, isPitcher);
    } catch (err) {
      setStatus(`Could not load stats for ${esc(p.name)}: ${esc(err.message)}`, true);
    }
  }

  async function getPlayerDetail(id, season) {
    const key = `${id}:${season}`;
    if (statsCache.has(key)) return statsCache.get(key);

    const [bioData, statsData] = await Promise.all([
      fetchJSON(`${API}/people/${id}`),
      fetchJSON(
        `${API}/people/${id}/stats?stats=season,seasonAdvanced,expectedStatistics,yearByYear,statSplits,byMonth` +
        `&season=${season}&group=hitting,pitching,fielding&sitCodes=vl,vr,h,a,risp`
      ),
    ]);

    const bio = bioData.people?.[0] || {};
    // groups[group][type] = splits[]  e.g. groups.hitting.season, groups.hitting.seasonAdvanced
    const groups = {};
    (statsData.stats || []).forEach((block) => {
      // The API reports the group name in lowercase ("hitting"); normalize so
      // lookups are case-insensitive regardless of how the API formats it.
      const group = block.group?.displayName?.toLowerCase();
      const type = block.type?.displayName; // "season" | "seasonAdvanced" | "expectedStatistics"
      if (!group || !type || !block.splits?.length) return;
      (groups[group] ||= {})[type] = block.splits;
    });

    const detail = { bio, groups };
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

  // Turn an unknown camelCase key into a readable label, e.g. "rbiWithRunners" -> "Rbi With Runners".
  const humanize = (k) =>
    k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();

  const labelFor = (type, key) =>
    (type === "expectedStatistics" && EXPECTED_LABELS[key]) || LABELS[key] || humanize(key);

  // Build column keys from a stat object: drop empty/structural values, lead with preferred order.
  function advColumns(stat, type) {
    const skip = new Set(["__position"]);
    const keys = Object.entries(stat)
      .filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== "" && typeof v !== "object")
      .map(([k]) => k);
    const lead = type === "expectedStatistics" ? EXPECTED_ORDER : [];
    return keys.sort((a, b) => {
      const ia = lead.indexOf(a), ib = lead.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }

  // Generic table for advanced / expected stat blocks (columns derived from the data).
  function advTable(type, splits) {
    const stat0 = splits[0]?.stat || {};
    const cols = advColumns(stat0, type);
    if (!cols.length) return "";
    const showTeam = splits.length > 1;
    const header = `<tr>${showTeam ? "<th>Split</th>" : ""}${cols
      .map((k) => `<th>${esc(labelFor(type, k))}</th>`)
      .join("")}</tr>`;
    const rows = splits
      .map((s) => {
        const st = s.stat || {};
        const teamCell = showTeam
          ? `<td class="stat-key">${esc(s.team?.abbreviation || s.position?.abbreviation || "—")}</td>`
          : "";
        const cells = cols.map((k) => `<td>${esc(statValue(st, k))}</td>`).join("");
        return `<tr>${teamCell}${cells}</tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="stats"><thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
  }

  // Year-by-year table for the 3 seasons immediately before the selected one.
  function recentTable(group, splits, selectedSeason) {
    const cols = COLUMNS[group];
    if (!cols || group === "fielding") return ""; // recent view for hitting & pitching only
    const seasons = [...new Set(splits.map((s) => Number(s.season)).filter((y) => y < selectedSeason))]
      .sort((a, b) => b - a)
      .slice(0, 3);
    if (!seasons.length) return "";

    const rows = splits
      .filter((s) => seasons.includes(Number(s.season)))
      .sort((a, b) => Number(b.season) - Number(a.season))
      .map((s) => {
        const cells = cols.map(([key]) => `<td>${esc(statValue(s.stat || {}, key))}</td>`).join("");
        return `<tr>
          <td class="stat-key">${esc(s.season)}</td>
          <td>${esc(s.team?.abbreviation || "—")}</td>
          ${cells}
        </tr>`;
      })
      .join("");

    const header = `<tr><th>Yr</th><th>Tm</th>${cols.map(([, l]) => `<th>${l}</th>`).join("")}</tr>`;
    return `<div class="table-wrap"><table class="stats"><thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
  }

  // Table for split rows (vs L/R, home/away, RISP) or monthly rows.
  function splitsTable(group, splits, getLabel) {
    const cols = SPLIT_COLUMNS[group];
    if (!cols || !splits?.length) return "";
    const rows = splits
      .map((s) => {
        const label = getLabel(s);
        if (!label) return "";
        const cells = cols.map(([key]) => `<td>${esc(statValue(s.stat || {}, key))}</td>`).join("");
        return `<tr><td class="stat-key">${esc(label)}</td>${cells}</tr>`;
      })
      .join("");
    if (!rows) return "";
    const header = `<tr><th>Split</th>${cols.map(([, l]) => `<th>${l}</th>`).join("")}</tr>`;
    return `<div class="table-wrap"><table class="stats"><thead>${header}</thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderDetail(p, detail, season) {
    const { bio, groups } = detail;
    const groupsOrder = ["hitting", "pitching", "fielding"];
    const present = groupsOrder.filter((g) => groups[g] && Object.keys(groups[g]).length);

    let sections = "";
    if (!present.length) {
      sections = `<div class="stats-section"><p class="empty-note">No ${season} stats recorded for this player in the selected season.</p></div>`;
    } else {
      sections = present
        .map((g) => {
          const byType = groups[g];
          const standard = byType.season ? statsTable(g, byType.season) : "";
          const advanced = byType.seasonAdvanced
            ? `<h4 class="stat-sub">Advanced</h4>${advTable("seasonAdvanced", byType.seasonAdvanced)}`
            : "";
          const expected = byType.expectedStatistics
            ? `<h4 class="stat-sub">Expected Stats <span class="tag">Statcast</span></h4>` +
              advTable("expectedStatistics", byType.expectedStatistics)
            : "";
          let recent = "";
          if (byType.yearByYear) {
            const t = recentTable(g, byType.yearByYear, Number(season));
            if (t) recent = `<h4 class="stat-sub">Last 3 Seasons</h4>${t}`;
          }
          let splits = "";
          if (byType.statSplits) {
            const t = splitsTable(g, byType.statSplits, (s) => s.split?.description || "");
            if (t) splits = `<h4 class="stat-sub">Splits</h4>${t}`;
          }
          let months = "";
          if (byType.byMonth) {
            const t = splitsTable(g, byType.byMonth, (s) => s.split?.description || monthName(s.month));
            if (t) months = `<h4 class="stat-sub">By Month</h4>${t}`;
          }
          return `<div class="stats-section">
            <h3>${GROUP_TITLES[g]}<span class="ctx">${season} season</span></h3>
            ${standard}${advanced}${expected}${recent}${splits}${months}
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

  // ===================== STATCAST PERCENTILES (via Savant proxy) =====================
  const SAVANT_LABELS = {
    xwoba: "xwOBA", xba: "xBA", xslg: "xSLG", xobp: "xOBP", xwobacon: "xwOBAcon", xera: "xERA",
    brl: "Barrels", brl_percent: "Barrel %", exit_velocity_avg: "Avg Exit Velo",
    max_exit_velocity: "Max Exit Velo", hard_hit_percent: "Hard-Hit %",
    k_percent: "K %", bb_percent: "BB %", whiff_percent: "Whiff %", chase_percent: "Chase %",
    sprint_speed: "Sprint Speed", oaa: "Outs Above Avg", arm_strength: "Arm Strength",
    fb_velocity: "Fastball Velo", fastball_velocity: "Fastball Velo", fb_spin: "Fastball Spin",
    curve_spin: "Curveball Spin", extension: "Extension", pop_2b_sba: "Pop Time",
  };
  const BATTER_PCT_ORDER = [
    "xwoba", "xba", "xslg", "xobp", "brl_percent", "exit_velocity_avg", "max_exit_velocity",
    "hard_hit_percent", "k_percent", "bb_percent", "whiff_percent", "chase_percent",
    "sprint_speed", "oaa", "arm_strength",
  ];
  const PITCHER_PCT_ORDER = [
    "xwoba", "xera", "xba", "xslg", "brl_percent", "exit_velocity_avg", "hard_hit_percent",
    "k_percent", "bb_percent", "whiff_percent", "chase_percent", "fb_velocity", "fastball_velocity",
    "fb_spin", "curve_spin", "extension",
  ];

  // Minimal CSV parser that respects quoted fields.
  function splitCSVLine(line) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }
  function parseCSV(text) {
    const lines = text.replace(/^﻿/, "").replace(/\r/g, "").split("\n").filter((l) => l.length);
    if (!lines.length) return [];
    const header = splitCSVLine(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const cells = splitCSVLine(line);
      const obj = {};
      header.forEach((h, i) => (obj[h] = cells[i]));
      return obj;
    });
  }

  const savantCache = new Map(); // `${type}:${year}` -> Map(player_id -> row)
  async function getSavantPercentiles(isPitcher, year) {
    if (!window.SAVANT_PROXY) return null;
    const type = isPitcher ? "pitcher" : "batter";
    const cacheKey = `${type}:${year}`;
    if (savantCache.has(cacheKey)) return savantCache.get(cacheKey);
    const base = String(window.SAVANT_PROXY).replace(/\/$/, "");
    const res = await fetch(`${base}/leaderboard/percentile-rankings?type=${type}&year=${year}&csv=true`);
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const rows = parseCSV(await res.text());
    const map = new Map(rows.map((r) => [String(r.player_id), r]));
    savantCache.set(cacheKey, map);
    return map;
  }

  // red (low) -> blue (high), Savant-style.
  const pctColor = (v) => `rgb(${Math.round(210 - v * 1.5)},80,${Math.round(60 + v * 1.5)})`;

  function percentileBars(row, isPitcher) {
    const order = isPitcher ? PITCHER_PCT_ORDER : BATTER_PCT_ORDER;
    const seen = new Set();
    const bars = order
      .filter((k) => k in row && !seen.has(SAVANT_LABELS[k]) && seen.add(SAVANT_LABELS[k]))
      .map((k) => ({ k, v: parseFloat(row[k]) }))
      .filter((x) => !Number.isNaN(x.v) && x.v >= 0 && x.v <= 100)
      .map(({ k, v }) => `
        <div class="pct-row">
          <span class="pct-label">${esc(SAVANT_LABELS[k] || k)}</span>
          <div class="pct-track"><span class="pct-dot" style="left:${v}%;background:${pctColor(v)}">${Math.round(v)}</span></div>
        </div>`)
      .join("");
    return bars;
  }

  async function addStatcastPercentiles(p, season, isPitcher) {
    if (!window.SAVANT_PROXY) return;
    try {
      const map = await getSavantPercentiles(isPitcher, season);
      if (!map || selectedId !== p.id) return; // selection changed while loading
      const row = map.get(String(p.id));
      if (!row) return;
      const bars = percentileBars(row, isPitcher);
      if (!bars) return;
      els.content.insertAdjacentHTML("beforeend", `
        <div class="stats-section">
          <h3>Statcast Percentiles <span class="tag">Savant</span><span class="ctx">${season} &middot; rank vs MLB</span></h3>
          <div class="pct-wrap">${bars}</div>
        </div>`);
    } catch { /* optional enrichment */ }
  }

  // ===================== HOME (last game lineup) =====================
  // Defensive position -> [left%, top%] on the field diagram (outfield at top).
  const POS_COORDS = {
    P: [50, 60], C: [50, 89],
    "1B": [72, 62], "2B": [61, 49], "3B": [28, 62], SS: [39, 49],
    LF: [23, 26], CF: [50, 14], RF: [77, 26],
  };

  // Build a lineup chip from a boxscore player entry.
  function chipFor(pl, kind) {
    const c = {
      id: pl.person?.id,
      name: pl.person?.fullName || "",
      num: pl.jerseyNumber || "",
      pos: pl.position?.abbreviation || "",
      line: "",
    };
    if (kind === "pit") {
      const s = pl.stats?.pitching || {};
      c.line = [
        s.inningsPitched != null ? `${s.inningsPitched} IP` : null,
        s.strikeOuts != null ? `${s.strikeOuts} K` : null,
        s.earnedRuns != null ? `${s.earnedRuns} ER` : null,
      ].filter(Boolean).join(", ");
    } else {
      const s = pl.stats?.batting || {};
      const parts = [];
      if (s.atBats != null) parts.push(`${s.hits ?? 0}-${s.atBats}`);
      if (s.homeRuns) parts.push(`${s.homeRuns} HR`);
      if (s.rbi) parts.push(`${s.rbi} RBI`);
      c.line = parts.join(", ");
    }
    return c;
  }

  let homeLoaded = false;
  async function loadHome() {
    const season = els.season.value;
    loading("Finding the last game…");
    els.home.innerHTML = "";
    els.homeSub.textContent = "";
    try {
      const sched = await fetchJSON(
        `${API}/schedule?sportId=1&teamId=${TEAM_ID}&season=${season}&hydrate=team,linescore`
      );
      const games = [];
      (sched.dates || []).forEach((d) => (d.games || []).forEach((g) => games.push(g)));
      const now = new Date();
      const game = games
        .filter((g) => g.status?.abstractGameState === "Final" && new Date(g.gameDate) <= now)
        .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate) || b.gamePk - a.gamePk)[0];

      if (!game) {
        els.home.innerHTML = `<p class="empty-note">No completed games found for ${season}. Pick a different season from the dropdown.</p>`;
        setStatus(`No completed ${season} games yet.`);
        homeLoaded = true;
        return;
      }
      const box = await fetchJSON(`${API}/game/${game.gamePk}/boxscore`);
      // Win probability + play-by-play power the WPA leaderboard and chart (best-effort).
      let wp = null, pbp = null;
      try {
        [wp, pbp] = await Promise.all([
          fetchJSON(`${API}/game/${game.gamePk}/winProbability`),
          fetchJSON(`${API}/game/${game.gamePk}/playByPlay`),
        ]);
      } catch { /* chart/WPA are optional */ }
      renderHome(game, box, wp, pbp);
      homeLoaded = true;
      setStatus("Last game lineup loaded.");
    } catch (err) {
      setStatus(`Could not load last game: ${esc(err.message)}`, true);
    }
  }

  function renderHome(game, box, wp, pbp) {
    const padKey = game.teams?.home?.team?.id === TEAM_ID ? "home" : "away";
    const oppKey = padKey === "home" ? "away" : "home";
    const pad = game.teams[padKey] || {};
    const opp = game.teams[oppKey] || {};
    const padScore = pad.score ?? 0, oppScore = opp.score ?? 0;
    const win = padScore > oppScore;
    const dt = new Date(game.gameDate);
    const dateStr = dt.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const homeAway = padKey === "home" ? "Home" : "Away";

    const banner = `
      <div class="game-banner">
        <div class="gb-team"><img src="${teamLogo(TEAM_ID)}" alt=""/>Padres</div>
        <div class="gb-score">${padScore}</div>
        <div class="gb-result ${win ? "win" : "loss"}">${win ? "W" : "L"}</div>
        <div class="gb-score">${oppScore}</div>
        <div class="gb-team">${opp.team?.id ? `<img src="${teamLogo(opp.team.id)}" alt=""/>` : ""}${esc(opp.team?.name || "Opponent")}</div>
        <div class="gb-date">${esc(dateStr)} &middot; ${homeAway} &middot; ${esc(game.venue?.name || "")}</div>
      </div>`;

    // Pull the Padres' starters from the boxscore.
    const boxPad = box.teams?.home?.team?.id === TEAM_ID ? box.teams.home : box.teams.away;
    const players = boxPad?.players || {};
    const onField = {};
    const bench = [];
    Object.values(players).forEach((pl) => {
      const bo = pl.battingOrder;
      if (!bo || !bo.endsWith("00")) return; // starters end in "00"
      const pos = pl.position?.abbreviation;
      const chip = chipFor(pl, "bat");
      if (pos === "DH") bench.push(chip);
      else if (POS_COORDS[pos] && !onField[pos]) onField[pos] = chip;
    });
    // Starting pitcher (first pitcher used); overrides any P slot.
    const spId = boxPad?.pitchers?.[0];
    const sp = spId != null ? players[`ID${spId}`] : null;
    if (sp) onField["P"] = chipFor(sp, "pit");

    const chips = Object.entries(onField)
      .map(([pos, c]) => {
        const [left, top] = POS_COORDS[pos] || [];
        if (left == null) return "";
        const title = esc(c.name + (c.line ? ` — ${c.line}` : ""));
        return `<button class="fld-chip" style="left:${left}%;top:${top}%"
            data-id="${c.id}" data-name="${esc(c.name)}" data-num="${esc(c.num)}" data-pos="${esc(c.pos)}" title="${title}">
          <img src="${headshot(c.id, 80)}" alt=""/>
          <span class="pos">${esc(pos)}</span>
          <span class="nm">${esc(c.name)}</span>
          ${c.line ? `<span class="ln">${esc(c.line)}</span>` : ""}
        </button>`;
      })
      .join("");

    const benchHtml = bench.length
      ? `<div class="bench"><div class="bench-label">Designated Hitter</div>${bench
          .map((c) => `<button class="bench-chip fld-chip-link" data-id="${c.id}" data-name="${esc(c.name)}" data-num="${esc(c.num)}" data-pos="${esc(c.pos)}">
              <img src="${headshot(c.id, 80)}" alt=""/>
              <span class="pos">${esc(c.pos)}</span>
              <span class="nm">${esc(c.name)}</span>
              ${c.line ? `<span class="ln">${esc(c.line)}</span>` : ""}
            </button>`)
          .join("")}</div>`
      : "";

    const winProb = winProbSection(wp, pbp, padKey === "home");

    els.homeSub.textContent = `Padres ${padScore}–${oppScore} ${win ? "W" : "L"} vs ${opp.team?.name || ""}`;
    els.home.innerHTML = `${banner}
      <div class="field"><div class="infield"></div><div class="mound"></div>${chips}</div>
      ${benchHtml}
      ${winProb}`;

    // Clicking a player jumps to the Players page with their detail open.
    els.home.querySelectorAll(".fld-chip, .bench-chip, .wpa-row").forEach((el) => {
      el.addEventListener("click", () => {
        const d = el.dataset;
        if (!d.id) return;
        showView("players");
        selectPlayer({ id: Number(d.id), name: d.name, number: d.num, position: d.pos, posType: "" });
      });
    });
  }

  // Win-probability chart (SVG) + per-player WPA leaderboard for the last game.
  function winProbSection(wp, pbp, padresHome) {
    const wpArr = Array.isArray(wp) ? wp : [];
    if (!wpArr.length) return "";

    // From the Padres' perspective: their win prob over the course of the game.
    const series = wpArr
      .map((e) => (padresHome ? e.homeTeamWinProbability : e.awayTeamWinProbability))
      .filter((v) => typeof v === "number");
    let chart = "";
    if (series.length > 1) {
      const W = 600, H = 150;
      const pts = series
        .map((v, i) => `${(i / (series.length - 1) * W).toFixed(1)},${((100 - v) / 100 * H).toFixed(1)}`)
        .join(" ");
      const last = series[series.length - 1];
      chart = `
        <svg class="wp-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Padres win probability">
          <rect x="0" y="0" width="${W}" height="${H}" fill="#fbf8f3"/>
          <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#d8cdbb" stroke-dasharray="4 4"/>
          <polyline points="${pts}" fill="none" stroke="#2f241d" stroke-width="2.5"/>
        </svg>
        <div class="wp-caption">Padres win probability &middot; ended at <b>${last.toFixed(0)}%</b></div>`;
    }

    // WPA per Padres player: join win-prob deltas to the play's batter/pitcher.
    let board = "";
    const plays = pbp?.allPlays || [];
    if (plays.length) {
      const byIdx = new Map(plays.map((p) => [p.about?.atBatIndex, p]));
      const padresAway = !padresHome;
      const wpa = new Map();
      wpArr.forEach((e) => {
        const add = Number(e.homeTeamWinProbabilityAdded);
        if (Number.isNaN(add)) return;
        const play = byIdx.get(e.atBatIndex);
        if (!play) return;
        const padBatting = play.about?.isTopInning === padresAway;
        const person = padBatting ? play.matchup?.batter : play.matchup?.pitcher;
        if (!person?.id) return;
        const padWPA = padresHome ? add : -add; // change in Padres win prob
        const cur = wpa.get(person.id) || { name: person.fullName, role: padBatting ? "bat" : "pit", total: 0 };
        cur.total += padWPA;
        wpa.set(person.id, cur);
      });
      const ranked = [...wpa.entries()].sort((a, b) => b[1].total - a[1].total);
      if (ranked.length) {
        const row = ([id, c]) => {
          const v = c.total / 100; // to win units
          const sign = v >= 0 ? "+" : "";
          return `<button class="wpa-row" data-id="${id}" data-name="${esc(c.name)}" data-pos="${c.role === "pit" ? "P" : ""}">
            <img src="${headshot(id, 80)}" alt=""/>
            <span class="wpa-name">${esc(c.name)}</span>
            <span class="wpa-val ${v >= 0 ? "pos" : "neg"}">${sign}${v.toFixed(3)}</span>
          </button>`;
        };
        const top = ranked.slice(0, 5).map(row).join("");
        const worst = ranked.length > 5 ? `<div class="wpa-sub">Lowest</div>${row(ranked[ranked.length - 1])}` : "";
        board = `<div class="wpa-board">
          <div class="wpa-sub">Top WPA — who won the game</div>${top}${worst}
        </div>`;
      }
    }

    if (!chart && !board) return "";
    return `<div class="wp-section">
      <h3 class="wp-title">Win Probability</h3>
      ${chart}${board}
    </div>`;
  }

  // ===================== SCHEDULE =====================
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let scheduleLoaded = false;
  async function loadSchedule() {
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 60);
    loading("Loading schedule…");
    els.schedule.innerHTML = "";
    try {
      const data = await fetchJSON(
        `${API}/schedule?sportId=1&teamId=${TEAM_ID}` +
        `&startDate=${ymd(today)}&endDate=${ymd(end)}&hydrate=probablePitcher,team`
      );
      renderSchedule(data, today);
      scheduleLoaded = true;
      setStatus("Schedule loaded.");
    } catch (err) {
      setStatus(`Could not load schedule: ${esc(err.message)}`, true);
    }
  }

  function renderSchedule(data, today) {
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const games = [];
    (data.dates || []).forEach((d) => (d.games || []).forEach((g) => games.push(g)));
    const upcoming = games
      .filter((g) => g.status?.abstractGameState !== "Final" && new Date(g.gameDate) >= startOfToday)
      .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));

    if (!upcoming.length) {
      els.schedule.innerHTML = `<p class="empty-note">No upcoming games in the next 60 days (the season may be over or not yet started).</p>`;
      return;
    }

    // Group by calendar day.
    const byDay = new Map();
    upcoming.forEach((g) => {
      const day = new Date(g.gameDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(g);
    });

    els.schedule.innerHTML = [...byDay.entries()]
      .map(([day, gs]) => `
        <div class="sched-day">
          <div class="sched-day-label">${esc(day)}</div>
          ${gs.map(gameCard).join("")}
        </div>`)
      .join("");
  }

  function gameCard(g) {
    const home = g.teams?.home || {}, away = g.teams?.away || {};
    const padresHome = home.team?.id === TEAM_ID;
    const opp = padresHome ? away : home;
    const side = padresHome ? "vs" : "@";
    const oppName = opp.team?.name || "TBD";
    const oppId = opp.team?.id;

    const dt = new Date(g.gameDate);
    const isTBD = g.status?.startTimeTBD;
    const time = isTBD ? "TBD" : dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const dayShort = dt.toLocaleDateString(undefined, { weekday: "short" });

    const state = g.status?.abstractGameState;
    const statusTag = state === "Live" ? `<span class="tag-status">LIVE</span>` : "";
    const dh = g.doubleHeader === "Y" ? ` <span class="game-meta">(DH G${g.gameNumber})</span>` : "";

    const sdPitcher = (padresHome ? home : away).probablePitcher?.fullName;
    const oppPitcher = opp.probablePitcher?.fullName;
    const probables = (sdPitcher || oppPitcher)
      ? `<div class="game-probables">Prob: <b>SD</b> ${esc(sdPitcher || "TBD")} &middot; <b>${esc(oppName.split(" ").pop())}</b> ${esc(oppPitcher || "TBD")}</div>`
      : "";

    return `
      <div class="game-card">
        <div class="game-side">${side}</div>
        ${oppId ? `<img class="opp-logo" src="${teamLogo(oppId)}" alt="" loading="lazy" />` : ""}
        <div class="game-main">
          <div class="game-matchup">${esc(oppName)}${statusTag}${dh}</div>
          <div class="game-meta">${esc(g.venue?.name || "")}</div>
          ${probables}
        </div>
        <div class="game-time"><span class="day">${esc(dayShort)}</span><br/>${esc(time)}</div>
      </div>`;
  }

  // ===================== STANDINGS =====================
  const SCOLS = [
    ["wins", "W"], ["losses", "L"], ["winningPercentage", "PCT"], ["gamesBack", "GB"],
    ["wildCardGamesBack", "WCGB"], ["__l10", "L10"], ["__streak", "STRK"],
    ["runsScored", "RS"], ["runsAllowed", "RA"], ["__diff", "DIFF"],
    ["__xwl", "xW-L"], ["__luck", "LUCK"],
  ];

  // Pythagorean expected wins (exponent 1.83). Returns null if not computable.
  function pythagW(tr) {
    const rs = Number(tr.runsScored), ra = Number(tr.runsAllowed);
    const g = Number(tr.wins) + Number(tr.losses);
    if (!rs || !ra || !g) return null;
    const exp = Math.pow(rs, 1.83) / (Math.pow(rs, 1.83) + Math.pow(ra, 1.83));
    return Math.round(exp * g);
  }

  function srVal(tr, key) {
    switch (key) {
      case "__xwl": {
        const xw = pythagW(tr);
        return xw == null ? "—" : `${xw}-${Number(tr.wins) + Number(tr.losses) - xw}`;
      }
      case "__luck": {
        const xw = pythagW(tr);
        if (xw == null) return "—";
        const d = Number(tr.wins) - xw;
        return d > 0 ? `+${d}` : String(d);
      }
      case "__l10": {
        const s = (tr.records?.splitRecords || []).find((r) => r.type === "lastTen");
        return s ? `${s.wins}-${s.losses}` : "—";
      }
      case "__streak": return tr.streak?.streakCode || "—";
      case "__diff": {
        const d = tr.runDifferential ?? (Number(tr.runsScored) - Number(tr.runsAllowed));
        if (Number.isNaN(d) || d == null) return "—";
        return d > 0 ? `+${d}` : String(d);
      }
      default: {
        const v = tr[key];
        return v === undefined || v === null || v === "" ? "—" : v;
      }
    }
  }

  let standingsLoadedSeason = null;
  async function loadStandings() {
    const season = els.season.value;
    els.standingsLabel.textContent = `${season} regular season`;
    loading("Loading standings…");
    els.standings.innerHTML = "";
    try {
      const data = await fetchJSON(
        `${API}/standings?leagueId=103,104&season=${season}` +
        `&standingsType=regularSeason&hydrate=team,division`
      );
      renderStandings(data);
      standingsLoadedSeason = season;
      setStatus("Standings loaded.");
    } catch (err) {
      setStatus(`Could not load standings: ${esc(err.message)}`, true);
    }
  }

  function renderStandings(data) {
    const records = data.records || [];
    if (!records.length) {
      els.standings.innerHTML = `<p class="empty-note">No standings available for this season.</p>`;
      return;
    }
    // Attach division metadata and group by league.
    const leagues = { AL: [], NL: [] };
    records.forEach((rec) => {
      const meta = DIVISIONS[rec.division?.id] || { league: "AL", name: rec.division?.name || "Division", order: 9 };
      const name = rec.division?.name || meta.name;
      (leagues[meta.league] || (leagues[meta.league] = [])).push({ name, order: meta.order, rec });
    });

    // Derive wild-card positions per league: non-division-leaders ranked by win%.
    const wcMarks = new Map();
    Object.values(leagues).forEach((divs) => {
      const contenders = [];
      divs.forEach((d) => (d.rec.teamRecords || []).forEach((tr) => {
        if (String(tr.divisionRank) !== "1") contenders.push(tr);
      }));
      contenders
        .sort((a, b) => parseFloat(b.winningPercentage || 0) - parseFloat(a.winningPercentage || 0))
        .slice(0, 3)
        .forEach((tr, i) => wcMarks.set(tr.team?.id, `WC${i + 1}`));
    });

    const leagueBlock = (label, divs) => {
      if (!divs.length) return "";
      divs.sort((a, b) => a.order - b.order);
      return `<div class="league-block"><h3>${label}</h3>${divs.map((d) => divisionTable(d, wcMarks)).join("")}</div>`;
    };

    els.standings.innerHTML = `<div class="standings-leagues">
      ${leagueBlock("American League", leagues.AL)}
      ${leagueBlock("National League", leagues.NL)}
    </div>
    <p class="standings-legend">Bold tags: ✓ = clinched · <b>M#</b> = magic number · <b>WC#</b> = wild-card seed.
    xW-L = Pythagorean expected record (exp 1.83); LUCK = actual wins − expected wins.</p>`;
  }

  // Small clinch / magic-number / wild-card badge for a team.
  function teamBadge(tr, wcMarks) {
    if (tr.clinchIndicator) return `<span class="tm-badge clinch">✓${esc(tr.clinchIndicator)}</span>`;
    if (tr.magicNumber != null && tr.magicNumber !== "" && tr.magicNumber !== "-")
      return `<span class="tm-badge">M${esc(tr.magicNumber)}</span>`;
    const wc = wcMarks.get(tr.team?.id);
    return wc ? `<span class="tm-badge wc">${esc(wc)}</span>` : "";
  }

  function divisionTable({ name, rec }, wcMarks) {
    const teams = [...(rec.teamRecords || [])].sort(
      (a, b) => (Number(a.divisionRank) || 99) - (Number(b.divisionRank) || 99)
    );
    const header = `<tr><th>Team</th>${SCOLS.map(([, l]) => `<th>${l}</th>`).join("")}</tr>`;
    const rows = teams
      .map((tr) => {
        const isPad = tr.team?.id === TEAM_ID;
        const cells = SCOLS.map(([k]) => `<td>${esc(srVal(tr, k))}</td>`).join("");
        return `<tr class="${isPad ? "is-padres" : ""}">
          <td><span class="team-cell">${tr.team?.id ? `<img src="${teamLogo(tr.team.id)}" alt="" loading="lazy"/>` : ""}${esc(tr.team?.name || "—")}${teamBadge(tr, wcMarks)}</span></td>
          ${cells}
        </tr>`;
      })
      .join("");
    return `<div class="division-table">
      <div class="division-name">${esc(name)}</div>
      <table class="standings-tbl"><thead>${header}</thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  // ===================== VIEW SWITCHING =====================
  function showView(view) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
    document.body.classList.toggle("hide-players-controls", view !== "players");

    if (view === "home" && !homeLoaded) loadHome();
    if (view === "schedule" && !scheduleLoaded) loadSchedule();
    if (view === "standings" && standingsLoadedSeason !== els.season.value) loadStandings();
  }

  // --- Events ---
  els.season.addEventListener("change", () => {
    // Season affects home, players, and standings; invalidate their caches.
    els.content.classList.add("hidden");
    els.placeholder.classList.remove("hidden");
    homeLoaded = false;
    standingsLoadedSeason = null;
    loadRoster();
    const active = document.querySelector(".tab.active")?.dataset.view;
    if (active === "home") loadHome();
    else if (active === "standings") loadStandings();
  });
  els.roster.addEventListener("change", loadRoster);
  els.search.addEventListener("input", renderRoster);
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => showView(t.dataset.view))
  );

  // --- Boot ---
  initSeasons();
  loadRoster();      // ready the Players roster in the background
  showView("home");  // default landing: last game's lineup on the field
})();
