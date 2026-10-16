import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

port = int(os.environ.get("PORT", 3000))
random_string = str(uuid.uuid4())  # created once at startup, kept in memory


def status():
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "string": random_string,
    }


def log_loop():
    while True:
        s = status()
        print(f"{s['timestamp']}: {s['string']}", flush=True)
        time.sleep(5)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/status":
            body = json.dumps(status()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")


threading.Thread(target=log_loop, daemon=True).start()
print(f"Server started in port {port}", flush=True)
HTTPServer(("0.0.0.0", port), Handler).serve_forever()
