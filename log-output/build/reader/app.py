import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "3000"))
FILE = os.path.join(os.environ.get("FILES_DIR", "/usr/src/app/files"), "log.txt")

FILES_DIR = os.environ.get("FILES_DIR", "/usr/src/app/files")
PONGS_FILE = os.path.join(FILES_DIR, "pingpong.txt")

def read_pongs():
    try:
        with open(PONGS_FILE) as f:
            return f.read().strip()
    except FileNotFoundError:
        return "0"

def read_log_line():
    try:
        with open(FILE) as f:
            lines = [l.strip() for l in f if l.strip()]
        return lines[-1] if lines else ""
    except FileNotFoundError:
        return ""

class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes = b"") -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        body = f"{read_log_line()}\nPing / Pongs: {read_pongs()}".encode()
        self._send(200, body)

    def _not_allowed(self) -> None:
        self.send_response(405)
        self.send_header("Allow", "GET")
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_POST = do_PUT = do_PATCH = do_DELETE = _not_allowed



if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Server started in port {PORT}", flush=True)
    server.serve_forever()
