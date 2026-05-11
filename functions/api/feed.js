/**
 * Cloudflare Pages Function — XML feed proxy.
 *
 * Bound automatically to /api/feed by the file path. Same shape as
 * the Python `serve.py` proxy: server-side fetch, stream the bytes
 * straight back to the browser, no CORS wall, no buffering.
 *
 * Pages free tier:
 *   - 100,000 requests / day
 *   - No sleep / cold start (instant always)
 *   - Streaming responses with no wall-clock limit (I/O doesn't burn
 *     CPU time)  --> a 1 GB Joveo feed flows through fine.
 */
export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
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
          "Mozilla/5.0 (compatible; FeedToCsv/1.0; +https://feed-to-csv.pages.dev)",
        accept: "*/*",
      },
      // Cloudflare follows redirects by default.
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

  // Pipe the upstream body straight through — no buffering, no parsing.
  // The browser handles XML parsing client-side.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
