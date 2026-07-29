"""Install Mediator 2 requirements and launch its single Electron instance."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    """Run a command from the application directory with useful console output."""
    print(f"[Mediator 2] {' '.join(command)}", flush=True)
    return subprocess.run(command, cwd=ROOT, check=check, text=True)


def install_python_requirements() -> None:
    """Install declared Python packages into the currently active environment."""
    requirements = ROOT / "requirements.txt"
    if requirements.exists() and requirements.read_text(encoding="utf-8").strip():
        run([sys.executable, "-m", "pip", "install", "-r", str(requirements)])
    else:
        print("[Mediator 2] No Python packages are currently required.")


def npm_command() -> str:
    executable = "npm.cmd" if os.name == "nt" else "npm"
    path = shutil.which(executable)
    if not path:
        raise SystemExit(
            "Node.js and npm are required to run Mediator 2. Install the current "
            "Node.js LTS release, then launch main.py again."
        )
    return path


def terminate_electron_instances() -> None:
    """Enforce a clean desktop session before Electron's own instance lock."""
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/IM", "electron.exe"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        subprocess.run(
            ["pkill", "-f", "[e]lectron"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def install_electron_requirements(npm: str) -> None:
    """Install exact npm dependencies when the local Electron binary is absent."""
    electron = ROOT / "node_modules" / ".bin" / (
        "electron.cmd" if os.name == "nt" else "electron"
    )
    if not electron.exists():
        run([npm, "install", "--no-audit", "--no-fund"])
    else:
        print("[Mediator 2] Electron requirements are already installed.")


def main() -> int:
    terminate_electron_instances()
    install_python_requirements()
    npm = npm_command()
    install_electron_requirements(npm)
    return run([npm, "start"], check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
