#!/usr/bin/env python3
"""NGO Accounting System launcher.

Starts FastAPI backend + Vite frontend, opens the browser,
and shows a system-tray icon with a Stop option.
"""

import os
import sys
import time
import threading
import subprocess
import webbrowser
from pathlib import Path
import urllib.request

from PIL import Image, ImageDraw, ImageFont
import pystray

BASE_DIR = Path(__file__).parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_URL = "http://localhost:5173"
BACKEND_URL = "http://localhost:8000"

_procs: list[subprocess.Popen] = []
_started = threading.Event()


# ---------------------------------------------------------------------------
# Tray icon — green circle with white "N"
# ---------------------------------------------------------------------------

def _make_icon() -> Image.Image:
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, size - 4, size - 4], fill=(22, 163, 74))  # green-600
    # Draw "N" centred
    try:
        font = ImageFont.truetype("arialbd.ttf", 36)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "N", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - w) // 2 - bbox[0], (size - h) // 2 - bbox[1]), "N", fill="white", font=font)
    return img


# ---------------------------------------------------------------------------
# Process management
# ---------------------------------------------------------------------------

NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


def _wait_for_backend(timeout: int = 40) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"{BACKEND_URL}/docs", timeout=1)
            return True
        except Exception:
            time.sleep(0.5)
    return False


def _start_services() -> None:
    # Backend: uvicorn main:app --port 8000
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--port", "8000"],
        cwd=str(BACKEND_DIR),
        creationflags=NO_WINDOW,
    )
    _procs.append(backend)

    # Frontend: npm run dev
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        creationflags=NO_WINDOW,
    )
    _procs.append(frontend)

    _started.set()

    # Wait for backend, then open browser
    if _wait_for_backend():
        webbrowser.open(FRONTEND_URL)
    else:
        # Backend took too long — open anyway, it may still be starting
        webbrowser.open(FRONTEND_URL)


def _stop_services(icon: pystray.Icon | None = None, _item=None) -> None:
    for proc in _procs:
        try:
            proc.terminate()
        except Exception:
            pass

    if sys.platform == "win32":
        # Kill any surviving uvicorn / node processes on these ports
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID"] + [str(p.pid) for p in _procs if p.pid],
            capture_output=True,
        )

    if icon is not None:
        icon.stop()

    os._exit(0)


def _open_browser(_icon=None, _item=None) -> None:
    webbrowser.open(FRONTEND_URL)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # Launch services in a background thread so the tray starts immediately
    t = threading.Thread(target=_start_services, daemon=True)
    t.start()

    icon = pystray.Icon(
        name="NGO Accounting",
        icon=_make_icon(),
        title="NGO Accounting System",
        menu=pystray.Menu(
            pystray.MenuItem("NGO Accounting System", lambda: None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Open Browser", _open_browser),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Stop Server", _stop_services),
        ),
    )
    icon.run()


if __name__ == "__main__":
    main()
