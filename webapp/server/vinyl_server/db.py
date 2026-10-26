"""SQLite access layer (single connection guarded by a lock – fine for a local app)."""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any, Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS folders(
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  added_at REAL
);
CREATE TABLE IF NOT EXISTS tracks(
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  title TEXT, artist TEXT, album TEXT, album_artist TEXT,
  album_key TEXT, artist_key TEXT,
  duration REAL, track_number INTEGER, disc_number INTEGER, year INTEGER, genre TEXT,
  format TEXT, mime TEXT, bitrate INTEGER, sample_rate INTEGER, bit_depth INTEGER, channels INTEGER,
  file_size INTEGER, file_hash TEXT,
  cover_file TEXT, cover_mime TEXT,
  added_at REAL, modified_at REAL,
  missing INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_tracks_album_key ON tracks(album_key);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_key ON tracks(artist_key);
CREATE INDEX IF NOT EXISTS idx_tracks_hash ON tracks(file_hash);
CREATE TABLE IF NOT EXISTS playlists(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at REAL,
  updated_at REAL
);
CREATE TABLE IF NOT EXISTS playlist_tracks(
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pt_playlist ON playlist_tracks(playlist_id, position);
CREATE TABLE IF NOT EXISTS liked_tracks(
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  liked_at REAL
);
CREATE TABLE IF NOT EXISTS playback_history(
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at REAL
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS quarantine(
  id TEXT PRIMARY KEY,
  created_at REAL,
  manifest_path TEXT NOT NULL,
  restored INTEGER NOT NULL DEFAULT 0
);
"""


class Database:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._lock:
            self._conn.execute("PRAGMA foreign_keys=ON")
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def execute(self, sql: str, args: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self._lock:
            cur = self._conn.execute(sql, tuple(args))
            self._conn.commit()
            return cur

    def all(self, sql: str, args: Iterable[Any] = ()) -> list[dict]:
        with self._lock:
            return [dict(r) for r in self._conn.execute(sql, tuple(args)).fetchall()]

    def one(self, sql: str, args: Iterable[Any] = ()) -> dict | None:
        with self._lock:
            r = self._conn.execute(sql, tuple(args)).fetchone()
            return dict(r) if r else None

    def transaction(self):
        """Context manager that holds the lock and commits/rolls back atomically."""
        db = self

        class _Tx:
            def __enter__(self):
                db._lock.acquire()
                return db._conn

            def __exit__(self, exc_type, exc, tb):
                try:
                    if exc_type is None:
                        db._conn.commit()
                    else:
                        db._conn.rollback()
                finally:
                    db._lock.release()
                return False

        return _Tx()

    def close(self) -> None:
        with self._lock:
            self._conn.close()
