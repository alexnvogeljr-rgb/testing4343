// ---------------------------------------------------------------------------
// Optional configuration for the Padres Tracker.
//
// SAVANT_PROXY enables the Statcast "percentile" bars on the Players page.
// Baseball Savant has no public CORS-friendly API, so a tiny proxy is needed.
// Deploy the Cloudflare Worker in /worker (see worker/README.md), then paste
// its URL below. Leave it empty to keep the Statcast section hidden.
//
//   window.SAVANT_PROXY = "https://padres-savant.YOUR-NAME.workers.dev";
// ---------------------------------------------------------------------------
window.SAVANT_PROXY = "";
