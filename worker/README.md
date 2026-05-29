# Baseball Savant proxy (Cloudflare Worker)

This tiny Worker lets the browser fetch Baseball Savant data (which has no
CORS headers) so the Players page can show **Statcast percentile bars**.
It only forwards requests to `baseballsavant.mlb.com` and adds CORS headers.

## Deploy in ~5 minutes

### Option A — Cloudflare dashboard (no tools, copy-paste)

1. Sign in at <https://dash.cloudflare.com> (free account is fine).
2. **Workers & Pages → Create → Create Worker**. Give it a name like
   `padres-savant`. Click **Deploy**.
3. Click **Edit code**, delete the sample, and paste the contents of
   [`savant-proxy.js`](./savant-proxy.js). Click **Deploy**.
4. Copy your Worker URL (e.g. `https://padres-savant.YOUR-NAME.workers.dev`).

### Option B — Wrangler CLI

```bash
npm install -g wrangler
cd worker
wrangler deploy
```

## Wire it up

Open `/config.js` at the repo root and set your URL:

```js
window.SAVANT_PROXY = "https://padres-savant.YOUR-NAME.workers.dev";
```

Commit/push (or just re-deploy the site). Reload the Players page, click a
player, and the **Statcast Percentiles** section will appear.

## Quick test

Visit this in your browser — it should download/show CSV, not a CORS error:

```
https://padres-savant.YOUR-NAME.workers.dev/leaderboard/percentile-rankings?type=batter&year=2024&csv=true
```
