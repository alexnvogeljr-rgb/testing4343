# Padres Player Stats Tracker

A personal, no-backend web app that pulls and displays **comprehensive,
player-by-player stats for the San Diego Padres** using the free, public
[MLB Stats API](https://statsapi.mlb.com).

Your browser fetches the data directly — there's **no server to run, no API
key, and nothing to pay for.**

## Features

Four pages, switchable from the top nav:

**Home** (default)
- A **baseball-diamond view** of the Padres' **most recent completed game**:
  each starter's headshot is placed at the position they played, with their
  game line (e.g. `2-4, HR` for hitters; `6.0 IP, 7 K, 1 ER` for the starter).
- A score banner (result, opponent, date, venue) and a DH chip below the field.
- A **win-probability chart** for the game plus a **WPA leaderboard**
  ("who won the game") attributing win-probability swings to each player.
- Click any player to jump to their full stats on the Players page.

**Players**
- **Full roster** for any season (Active, 40-Man, or Full Season).
- **Player-by-player detail**: bio plus **standard**, **advanced**
  (ISO, BABIP, BB%, K%, K/9, BB/9…), **expected Statcast** stats
  (xBA, xSLG, xwOBA), **last 3 seasons**, and **splits** (vs LHP/RHP,
  home/away, RISP) plus **by-month** lines for hitting and pitching.
- **Roster ranked by OPS** (value shown), pitchers/no-OPS players after.
- **Live search/filter** by name or position.

**Schedule**
- Padres' **upcoming games** for the next 60 days, grouped by day, with
  opponent logos, home/away, first pitch (local time), venue, and probable pitchers.

**Standings**
- **All six MLB divisions** (AL & NL) for the selected season: W, L, PCT, GB,
  WCGB, L10, streak, runs scored/allowed, run differential — Padres row highlighted.
- **Pythagorean expected W-L** (exp 1.83) and a **Luck** delta (actual − expected),
  plus **wild-card seeds**, **magic numbers**, and **clinch** badges.

Plus a **season selector** (2015 → current year) and a Padres-themed, responsive UI.

## Running it

Because the app makes cross-origin requests to the MLB Stats API, open it over
`http://` rather than `file://` (browsers block cross-origin fetches from
`file://` pages). The simplest way:

```bash
# from this folder
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser.

Any static server works equally well, e.g.:

```bash
npx serve .
```

## How it works

| What | Endpoint |
|------|----------|
| Roster | `/api/v1/teams/135/roster?rosterType=…&season=…` |
| Player bio | `/api/v1/people/{id}` |
| Player stats | `/api/v1/people/{id}/stats?stats=season&season=…&group=hitting,pitching,fielding` |

`135` is the Padres' team ID. Player headshots come from
`img.mlbstatic.com` (with an automatic generic-silhouette fallback).

Stats are cached in memory per `(player, season)` so re-selecting a player is
instant.

## Files

- `index.html` — markup and layout
- `styles.css` — Padres-themed styling
- `app.js` — all data fetching and rendering logic

## Notes

Unofficial personal project. Data © MLB Advanced Media, accessed via the
public MLB Stats API. Not affiliated with or endorsed by MLB or the
San Diego Padres.
