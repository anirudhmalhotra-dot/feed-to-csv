/**
 * Cloudflare Worker entry — routes /api/feed to the XML proxy,
 * delegates everything else to the static-asset binding (which serves
 * index.html and the rest of the site from the repo root).
 *
 * Required because Cloudflare's new Workers-with-Static-Assets product
 * doesn't pick up the legacy Pages `functions/api/*.js` convention —
 * a Worker has to declare its own routing.
 *
 * Wired via wrangler.jsonc:  assets.binding = "ASSETS",
 *                            main = "_worker.js"
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/feed") {
      return handleFeedProxy(url);
    }

    // Static assets (index.html, favicon, anything else in the repo root).
    // Wrap in a fresh Response so we can override the cache-control. The
    // default CF static-asset response has aggressive caching that made
    // the browser cling to old index.html builds for hours after a deploy
    // — operator reported the post-2026-05-13 CDATA fix wasn't taking
    // effect because their browser had the pre-fix HTML in cache. Force
    // no-store for HTML so future deploys land on the very next refresh.
    //
    // Match by BOTH path (the bare `/` and explicit `.html`) AND
    // content-type so we no-cache HTML even if the binding reports the
    // wrong MIME, and don't accidentally no-cache asset binaries.
    const assetResp = await env.ASSETS.fetch(request);
    const ct = (assetResp.headers.get("content-type") || "").toLowerCase();
    const isHtmlPath = url.pathname === "/" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");
    const isHtmlContent = ct.startsWith("text/html");
    if (isHtmlPath || isHtmlContent) {
      const headers = new Headers(assetResp.headers);
      headers.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
      headers.set("pragma", "no-cache");
      headers.set("expires", "0");
      // Force fresh on Cloudflare's edge cache too — without this the
      // edge serves the stale HTML body for up to 1h regardless of
      // browser cache. Edge-side no-cache means each request goes to
      // the worker which re-fetches the static binding.
      headers.set("cf-cache-status", "BYPASS");
      return new Response(assetResp.body, {
        status: assetResp.status,
        statusText: assetResp.statusText,
        headers,
      });
    }
    return assetResp;
  },
};

async function handleFeedProxy(reqUrl) {
  const target = (reqUrl.searchParams.get("url") || "").trim();
  if (!target) {
    return new Response("missing ?url=...", { status: 400 });
  }
  if (!/^https?:\/\//i.test(target)) {
    return new Response("url must be http:// or https://", { status: 400 });
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      headers: {
        // Real-looking UA so S3 / CDNs don't 403 us.
        "user-agent":
          "Mozilla/5.0 (compatible; FeedToCsv/1.0; +https://feed-to-csv.workers.dev)",
        accept: "*/*",
      },
    });
  } catch (e) {
    return new Response("upstream fetch failed: " + e.message, { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(
      `upstream returned ${upstream.status} ${upstream.statusText}`,
      { status: 502 },
    );
  }

  // Stream the body through — no buffering, no parsing. Browser-side
  // XML parsing handles records. Cloudflare's free tier doesn't have a
  // wall-clock cap on streaming I/O, so multi-GB feeds work fine.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
