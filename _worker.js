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
    return env.ASSETS.fetch(request);
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
