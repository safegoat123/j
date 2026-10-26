"""Runtime configuration for the Vinyl Music local server.

Everything can be overridden with environment variables:

* ``VINYL_DATA_DIR``  – where the SQLite database, cover cache, imports and the
  duplicate quarantine live. Defaults to an OS-appropriate per-user directory.
* ``VINYL_MUSIC_DIR`` – optional music folder registered automatically on start.
* ``VINYL_HOST`` / ``VINYL_PORT`` – bind address. Defaults to loopback only
  (127.0.0.1:8000) so the library is never exposed to the LAN unless asked.
* ``VINYL_CORS_ORIGINS`` – comma separated list of allowed frontend origins.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path


def default_data_dir() -> Path:
    if sys.platform.startswith("win"):
        base = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(base) / "VinylMusic"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "VinylMusic"
    base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / "vinyl-music"


DEFAULT_ORIGINS = (
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
)


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("VINYL_DATA_DIR") or default_data_dir()))
    music_dir: Path | None = field(
        default_factory=lambda: Path(os.environ["VINYL_MUSIC_DIR"]) if os.environ.get("VINYL_MUSIC_DIR") else None
    )
    host: str = field(default_factory=lambda: os.environ.get("VINYL_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: int(os.environ.get("VINYL_PORT", "8000")))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip() for o in os.environ.get("VINYL_CORS_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",") if o.strip()
        ]
    )
    # Upload limit for the import endpoint (bytes per file).
    max_import_bytes: int = 1024 * 1024 * 1024

    @property
    def db_path(self) -> Path:
        return self.data_dir / "library.db"

    @property
    def cover_dir(self) -> Path:
        return self.data_dir / "covers"

    @property
    def import_dir(self) -> Path:
        return self.data_dir / "imports"

    @property
    def quarantine_dir(self) -> Path:
        return self.data_dir / "quarantine"
