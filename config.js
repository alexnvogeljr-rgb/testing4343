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
window.SAVANT_PROXY = "https://padres-savant.alexnvogeljr.workers.dev";

// ---------------------------------------------------------------------------
// Home-page field background.
//
// FIELD_IMAGE: an overhead/aerial image used behind the lineup on the Home
// page. Defaults to a public Esri World Imagery aerial of Petco Park (no key).
// Set to "" to use the drawn green diamond instead, or point it at your own
// screenshot committed to the repo (e.g. "petco.jpg").
//
// Because aerials are north-up and the real diamond is angled, use these
// knobs to line the infield up with the player chips (no code needed):
//   ROTATE  – spin the photo (degrees) so the outfield points up
//   SCALE   – zoom in/out (1 = fit, >1 zooms in)
//   OFFSET_X / OFFSET_Y – pan the photo left/right and up/down (in %)
// ---------------------------------------------------------------------------
// Default: drawn outfield outline (set a URL here to overlay an aerial instead).
window.FIELD_IMAGE = "";
window.FIELD_IMAGE_ROTATE = 0;
window.FIELD_IMAGE_SCALE = 1.2;
window.FIELD_IMAGE_OFFSET_X = 0;
window.FIELD_IMAGE_OFFSET_Y = 0;
