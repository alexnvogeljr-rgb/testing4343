// Cloudflare Worker: CORS proxy for Baseball Savant.
//
// The browser can't call baseballsavant.mlb.com directly (no CORS headers),
// so this Worker mirrors the request path/query to Savant and adds permissive
// CORS headers. It only ever forwards to baseballsavant.mlb.com.
//
// Deploy: see worker/README.md. Then put the Worker URL in /config.js.

const ALLOWED_HOST = "baseballsavant.mlb.com";

function withCors(resp) {
  const r = new Response(resp.body, resp);
  r.headers.set("Access-Control-Allow-Origin", "*");
  r.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  r.headers.set("Access-Control-Allow-Headers", "*");
  return r;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }
    if (request.method !== "GET") {
      return withCors(new Response("Only GET is supported", { status: 405 }));
    }

    const url = new URL(request.url);
    const target = `https://${ALLOWED_HOST}${url.pathname}${url.search}`;

    try {
      const upstream = await fetch(target, {
        headers: { "User-Agent": "padres-tracker", Accept: "text/csv,application/json,*/*" },
        cf: { cacheTtl: 600, cacheEverything: true },
      });
      return withCors(upstream);
    } catch (err) {
      return withCors(new Response(`Proxy error: ${err.message}`, { status: 502 }));
    }
  },
};
