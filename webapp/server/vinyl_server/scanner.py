"""Library scanning with progress reporting and missing-file tracking."""

from __future__ import annotations

import os
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .db import Database
from .metadata import AUDIO_EXTENSIONS, BROWSER_PLAYABLE, file_fingerprint, normalize_key, read_metadata, store_cover
from .security import is_within


@dataclass
class ScanJob:
    id: str
    status: str = "pending"  # pending | running | finished | failed
    total: int = 0
    done: int = 0
    added: int = 0
    updated: int = 0
    unchanged: int = 0
    missing: int = 0
    errors: int = 0
    current: str | None = None
    message: str | None = None
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def iter_audio_files(root: Path):
    """Walk ``root`` without following directory symlinks."""
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.startswith("."):
                continue
            if Path(name).suffix.lower() in AUDIO_EXTENSIONS:
                yield Path(dirpath) / name


class Scanner:
    def __init__(self, db: Database, cover_dir: Path):
        self.db = db
        self.cover_dir = cover_dir
        self.jobs: dict[str, ScanJob] = {}
        self._lock = threading.Lock()
        self._running: str | None = None

    def roots(self) -> list[Path]:
        return [Path(r["path"]) for r in self.db.all("SELECT path FROM folders")]

    def start(self, background: bool = True) -> ScanJob:
        with self._lock:
            if self._running and self.jobs[self._running].status == "running":
                return self.jobs[self._running]
            job = ScanJob(id=uuid.uuid4().hex)
            self.jobs[job.id] = job
            self._running = job.id
        if background:
            threading.Thread(target=self._run, args=(job,), daemon=True).start()
        else:
            self._run(job)
        return job

    def index_file(self, path: Path, job: ScanJob | None = None) -> str:
        """Insert/update a single file. Returns 'added' | 'updated' | 'unchanged'."""
        rp = path.resolve()
        st = rp.stat()
        existing = self.db.one("SELECT id, modified_at, file_size FROM tracks WHERE path=?", (str(rp),))
        if existing and existing["modified_at"] == st.st_mtime and existing["file_size"] == st.st_size:
            self.db.execute("UPDATE tracks SET missing=0 WHERE id=?", (existing["id"],))
            return "unchanged"
        meta = read_metadata(rp)
        cover = None
        try:
            cover = store_cover(rp, self.cover_dir)
        except Exception:
            cover = None
        try:
            fingerprint = file_fingerprint(rp)
        except OSError as exc:
            fingerprint = None
            meta["error"] = meta["error"] or str(exc)
        album_artist = meta.get("album_artist") or meta.get("artist")
        values = {
            **meta,
            "path": str(rp),
            "album_key": normalize_key(meta.get("album"), album_artist) if meta.get("album") else None,
            "artist_key": normalize_key(meta.get("artist")) if meta.get("artist") else None,
            "file_size": st.st_size,
            "file_hash": fingerprint,
            "cover_file": cover[0] if cover else None,
            "cover_mime": cover[1] if cover else None,
            "modified_at": st.st_mtime,
            "missing": 0,
        }
        if existing:
            sets = ",".join(f"{k}=?" for k in values)
            self.db.execute(f"UPDATE tracks SET {sets} WHERE id=?", (*values.values(), existing["id"]))
            return "updated"
        values["added_at"] = time.time()
        cols = ",".join(values)
        ph = ",".join("?" for _ in values)
        self.db.execute(f"INSERT INTO tracks({cols}) VALUES({ph})", tuple(values.values()))
        return "added"

    def _run(self, job: ScanJob) -> None:
        job.status = "running"
        try:
            roots = [r for r in self.roots() if r.is_dir()]
            files: list[Path] = []
            for root in roots:
                for f in iter_audio_files(root):
                    try:
                        rp = f.resolve()
                    except OSError:
                        continue
                    # A file symlink pointing outside every allowed root is ignored.
                    if any(is_within(rp, r) for r in roots):
                        files.append(rp)
            files = sorted(set(files))
            job.total = len(files)
            seen: set[str] = set()
            for f in files:
                job.current = f.name
                seen.add(str(f))
                try:
                    result = self.index_file(f, job)
                    setattr(job, result, getattr(job, result) + 1)
                except Exception as exc:
                    job.errors += 1
                    job.message = f"{f.name}: {exc}"[:300]
                job.done += 1
            # Mark tracks that disappeared (or whose folder was removed) as missing.
            for row in self.db.all("SELECT id, path, missing FROM tracks"):
                p = Path(row["path"])
                gone = row["path"] not in seen and (not p.is_file() or not any(is_within(p, r) for r in roots))
                if gone and not row["missing"]:
                    self.db.execute("UPDATE tracks SET missing=1 WHERE id=?", (row["id"],))
                if gone:
                    job.missing += 1
            job.status = "finished"
        except Exception as exc:  # pragma: no cover - defensive
            job.status = "failed"
            job.message = str(exc)[:300]
        finally:
            job.current = None
            job.finished_at = time.time()
