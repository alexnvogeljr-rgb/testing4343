# Padres Player Stats Tracker

A personal, no-backend web app that pulls and displays **comprehensive,
player-by-player stats for the San Diego Padres** using the free, public
[MLB Stats API](https://statsapi.mlb.com).

Your browser fetches the data directly — there's **no server to run, no API
key, and nothing to pay for.**

## Features

Three pages, switchable from the top nav:

**Players**
- **Full roster** for any season (Active, 40-Man, or Full Season).
- **Player-by-player detail**: bio plus **standard**, **advanced**
  (ISO, BABIP, BB%, K%, K/9, BB/9…), and **expected Statcast** stats
  (xBA, xSLG, xwOBA) for hitting, pitching, and fielding.
- **Live search/filter** by name or position; grouped Position Players / Pitchers.

**Schedule**
- Padres' **upcoming games** for the next 60 days, grouped by day, with
  opponent logos, home/away, first pitch (local time), venue, and probable pitchers.

**Standings**
- **All six MLB divisions** (AL & NL) for the selected season: W, L, PCT, GB,
  WCGB, L10, streak, runs scored/allowed, run differential — Padres row highlighted.

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
