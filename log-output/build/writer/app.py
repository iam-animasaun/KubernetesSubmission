import os
import time
import uuid
from datetime import datetime, timezone

DIR = os.environ.get("FILES_DIR", "/usr/src/app/files")
FILE = os.path.join(DIR, "log.txt")
INTERVAL_SECONDS = 5

# generated once, on startup
random_id = str(uuid.uuid4())


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def write_line() -> None:
    line = f"{timestamp()}: {random_id}\n"
    try:
        with open(FILE, "a", encoding="utf-8") as f:
            f.write(line)
        print(line.strip(), flush=True)
    except OSError as err:
        print(f"Write failed: {err}", flush=True)


if __name__ == "__main__":
    os.makedirs(DIR, exist_ok=True)
    while True:
        write_line()
        time.sleep(INTERVAL_SECONDS)
