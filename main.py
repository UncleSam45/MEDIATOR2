"""Bootstrap and launch the MEDIATOR 2 desktop application."""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def run(command: list[str], **kwargs: object) -> None:
    """Run a setup command and stop with a useful error if it fails."""
    print(f"[MEDIATOR 2] {' '.join(command)}")
    subprocess.run(command, cwd=ROOT, check=True, **kwargs)


def install_python_dependencies() -> None:
    requirements = ROOT / "requirements.txt"
    if requirements.exists() and requirements.read_text(encoding="utf-8").strip():
        run([sys.executable, "-m", "pip", "install", "-r", str(requirements)])


def install_electron_dependencies() -> None:
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit(
            "Node.js/npm is required to run MEDIATOR 2. Install the current Node.js LTS "
            "release, then launch main.py again."
        )
    command = [npm, "install"]
    if (ROOT / "package-lock.json").exists():
        command = [npm, "ci"]
    run(command)


def terminate_electron_instances() -> None:
    """Enforce a clean, single Electron session before starting the app."""
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/IM", "electron.exe", "/T"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return

    # Match the executable name rather than command arguments (which may contain
    # the word "electron" for unrelated processes).
    subprocess.run(
        ["pkill", "-TERM", "-x", "electron"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def launch() -> None:
    terminate_electron_instances()
    install_python_dependencies()
    install_electron_dependencies()
    npm = shutil.which("npm")
    assert npm is not None
    process = subprocess.Popen([npm, "start"], cwd=ROOT)

    def forward_signal(signum: int, _frame: object) -> None:
        if process.poll() is None:
            process.send_signal(signum)

    signal.signal(signal.SIGINT, forward_signal)
    signal.signal(signal.SIGTERM, forward_signal)
    raise SystemExit(process.wait())


if __name__ == "__main__":
    launch()
