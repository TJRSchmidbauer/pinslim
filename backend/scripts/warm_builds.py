"""Pre-build the ESP32 build trees so the first sketch of a lesson compiles fast.

A cold ESP-IDF build of the Arduino core takes 5-15 minutes on a small
server; after that every sketch for the same board compiles in seconds, because
only the sketch itself is rebuilt. This script compiles a minimal sketch once
per board right after the backend starts, so the waiting happens at boot and
not in front of a class.

    python scripts/warm_builds.py [fqbn ...]

Without arguments it warms PINSLIM_WARM_FQBNS (comma-separated) or the
defaults below. Started by the backend's systemd unit (ExecStartPost), it
waits for the API, then compiles one board after the other.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request

API = os.environ.get('PINSLIM_API', 'http://127.0.0.1:8001')
DEFAULT_FQBNS = ['esp32:esp32:esp32', 'esp32:esp32:lolin32-lite']

SKETCH = """void setup() { Serial.begin(115200); pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, !digitalRead(2)); delay(500); }
"""


def _wait_for_api(timeout_s: float = 300) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f'{API}/api/compile/boards', timeout=5)
            return True
        except Exception:
            time.sleep(3)
    return False


def _compile(fqbn: str) -> None:
    body = json.dumps({'code': SKETCH, 'board_fqbn': fqbn}).encode()
    # A cold build can exceed one ninja window; the backend resumes it on the
    # next request, so retry a few times.
    for attempt in range(1, 5):
        t0 = time.time()
        req = urllib.request.Request(
            f'{API}/api/compile/', body, {'Content-Type': 'application/json'}
        )
        try:
            result = json.load(urllib.request.urlopen(req, timeout=3600))
        except Exception as exc:  # network hiccup, backend restart
            print(f'[warm] {fqbn}: attempt {attempt} failed: {exc}', flush=True)
            time.sleep(10)
            continue
        took = time.time() - t0
        if result.get('success'):
            print(f'[warm] {fqbn}: ready ({took:.0f} s)', flush=True)
            return
        error = (result.get('error') or '')[:200]
        print(f'[warm] {fqbn}: attempt {attempt} not done ({took:.0f} s): {error}', flush=True)
    print(f'[warm] {fqbn}: giving up', flush=True)


def main(argv: list[str]) -> int:
    fqbns = argv or [
        f.strip()
        for f in os.environ.get('PINSLIM_WARM_FQBNS', ','.join(DEFAULT_FQBNS)).split(',')
        if f.strip()
    ]
    if not _wait_for_api():
        print('[warm] backend not reachable, skipping', flush=True)
        return 1
    for fqbn in fqbns:
        _compile(fqbn)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
