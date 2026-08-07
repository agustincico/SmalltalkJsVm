/*
 * CORS proxy for the SqueakJS launcher — deploy as a Cloudflare Worker (free tier).
 *
 * Why it exists: files.pharo.org and files.squeak.org serve their images without
 * `access-control-allow-origin`, so a browser refuses to let a page on another domain
 * fetch them. Mirroring the images is one way out (and costs hundreds of MB of hosting);
 * proxying them is the other, and it is what squeak.js.org does. SqueakJS even ships a
 * default proxy (`Squeak.defaultCORSProxy`, cors.codefrau.workers.dev), but that one
 * only answers for its own origins — run this to have your own.
 *
 * Usage from the launcher, exactly like any other zip URL:
 *   #zip=[https://<worker-host>/https://files.pharo.org/image/100/latest-64.zip,
 *         https://<your-site>/compat64.zip]
 *
 * Deploy:
 *   npx wrangler deploy utils/cors-worker.js --name smalltalk-cors
 *   (or paste it into the Workers editor at dash.cloudflare.com)
 *
 * Both allowlists below matter. ORIGINS keeps other sites from spending your quota;
 * UPSTREAM keeps this from being an open proxy that anyone can point anywhere — an open
 * one attracts abuse and gets the account suspended.
 */

const ORIGINS = [
  "https://smalltalkjsvm.com.ar",
  "https://www.smalltalkjsvm.com.ar",
  "https://smalltalkjsvm.pages.dev", // Pages keeps this one working as a staging URL
  "http://localhost:8091",
  "http://localhost:8095", // local preview of a mk-site.py build
];

const UPSTREAM = [
  "files.pharo.org",
  "files.squeak.org",
  "raw.githubusercontent.com",
  "github.com",
  "objects.githubusercontent.com", // where GitHub release assets redirect to
];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin");
    // Requests without an Origin (curl, a direct tab visit) are not the browser
    // cross-origin case this exists for, so let them through unrestricted.
    if (origin && !ORIGINS.includes(origin)) {
      return new Response("Origin not allowed: " + origin, { status: 403 });
    }

    const target = new URL(request.url).pathname.slice(1) + new URL(request.url).search;
    let url;
    try {
      url = new URL(target);
    } catch {
      return new Response("Usage: /<full-url-to-proxy>", { status: 400 });
    }
    if (!UPSTREAM.includes(url.hostname)) {
      return new Response("Upstream not allowed: " + url.hostname, { status: 403 });
    }

    const cors = {
      "access-control-allow-origin": origin || "*",
      "access-control-allow-headers": "range",
      "access-control-expose-headers": "content-length, content-range, accept-ranges",
      "vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...cors, "access-control-allow-methods": "GET, HEAD, OPTIONS" } });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    // Forward Range so the browser can resume/stream, and let Cloudflare cache the
    // response at the edge: these images never change, and a cached copy means the
    // upstream (and your request quota) is not hit again for every visitor.
    const upstream = await fetch(url.toString(), {
      method: request.method,
      headers: request.headers.has("Range") ? { Range: request.headers.get("Range") } : {},
      cf: { cacheEverything: true, cacheTtl: 86400 },
    });

    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    headers.set("cache-control", "public, max-age=86400");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
