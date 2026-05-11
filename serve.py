"""Single-file server for the feed -> csv tool.

Serves index.html plus an /api/feed?url=... endpoint that streams an
XML feed through to the browser (no CORS wall, no memory bloat).
Same shape as `requests.get(stream=True)` — bytes flow through in
64 KB chunks.

Run locally:
    python serve.py            # http://localhost:8000
    python serve.py 8765       # custom port

On Render / Railway / Fly: the platform sets $PORT — picked up
automatically.
"""
from __future__ import annotations

import os
import sys
import urllib.parse
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler


HERE = os.path.dirname(os.path.abspath(__file__))

# Mimic a real browser UA so S3 / CDNs don't 403 us. urllib's default
# UA is often blocked.
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36"
)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HERE, **kwargs)

    def do_GET(self):  # noqa: N802
        if self.path.startswith("/api/feed"):
            return self._proxy_feed()
        return super().do_GET()

    def _proxy_feed(self):
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        url = (params.get("url") or [""])[0].strip()
        if not url:
            return self._send_text(400, "missing ?url=...")
        if not (url.startswith("http://") or url.startswith("https://")):
            return self._send_text(400, "url must be http:// or https://")

        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            upstream = urllib.request.urlopen(req, timeout=60)
        except Exception as e:  # noqa: BLE001
            return self._send_text(502, f"upstream fetch failed: {e}")

        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/xml; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            while True:
                chunk = upstream.read(65536)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
        finally:
            try:
                upstream.close()
            except Exception:
                pass

    def _send_text(self, code: int, msg: str):
        body = msg.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):  # noqa: A002
        # Print only proxy hits + errors. Suppress 200/304 static noise.
        try:
            status = int(args[1])
        except (IndexError, ValueError):
            status = 200
        request_line = args[0] if args else ""
        if status >= 400 or "/api/feed" in request_line:
            sys.stderr.write(
                "[%s] %s\n" % (self.log_date_time_string(), format % args)
            )


def main(argv):
    # Render / Railway / Fly set $PORT. CLI arg wins if given.
    port = int(os.environ.get("PORT", "8000"))
    if len(argv) > 1:
        try:
            port = int(argv[1])
        except ValueError:
            pass
    httpd = HTTPServer(("0.0.0.0", port), Handler)
    print(f"feed -> csv server on http://0.0.0.0:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main(sys.argv)
