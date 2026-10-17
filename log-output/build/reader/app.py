import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "3000"))
FILE = os.path.join(os.environ.get("FILES_DIR", "/usr/src/app/files"), "log.txt")


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes = b"") -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        try:
            with open(FILE, "rb") as f:
                self._send(200, f.read())
        except FileNotFoundError:
            self._send(404, b"No log output yet\n")

    def _not_allowed(self) -> None:
        self.send_response(405)
        self.send_header("Allow", "GET")
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_POST = do_PUT = do_PATCH = do_DELETE = _not_allowed


if __name__ == "__main__":
    server = ThreadingHTTPServer(("", PORT), Handler)
    print(f"Log reader on port {PORT}", flush=True)
    server.serve_forever()
