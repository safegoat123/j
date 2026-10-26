"""Vinyl Music local API (FastAPI + SQLite + Mutagen)."""

from __future__ import annotations

import json
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from .config import Settings
from .db import Database
from .metadata import AUDIO_EXTENSIONS, BROWSER_PLAYABLE
from .scanner import Scanner
from .security import is_within, safe_filename

CHUNK = 64 * 1024

TRACK_COLUMNS = (
    "t.id, t.path, t.title, t.artist, t.album, t.album_artist, t.album_key, t.artist_key, t.duration, "
    "t.track_number, t.disc_number, t.year, t.genre, t.format, t.mime, t.bitrate, t.sample_rate, t.bit_depth, "
    "t.channels, t.file_size, t.file_hash, (t.cover_file IS NOT NULL) AS has_cover, t.added_at, t.modified_at, "
    "t.missing, t.error, (l.track_id IS NOT NULL) AS liked"
)
TRACK_FROM = " FROM tracks t LEFT JOIN liked_tracks l ON l.track_id=t.id "

SORTS = {
    "title": "t.title COLLATE NOCASE",
    "artist": "t.artist COLLATE NOCASE",
    "album": "t.album COLLATE NOCASE",
    "year": "t.year",
    "added_at": "t.added_at",
    "duration": "t.duration",
    "genre": "t.genre COLLATE NOCASE",
}


def _track(row: dict) -> dict:
    row["playable"] = (("." + (row.get("format") or "")) in BROWSER_PLAYABLE) and not row.get("missing")
    row["has_cover"] = bool(row.get("has_cover"))
    row["liked"] = bool(row.get("liked"))
    row["missing"] = bool(row.get("missing"))
    return row


class FolderIn(BaseModel):
    path: str = Field(min_length=1)


class PlaylistIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class PlaylistPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)


class TrackIds(BaseModel):
    track_ids: list[int]


class SettingsIn(BaseModel):
    values: dict[str, Any]


class QuarantineIn(BaseModel):
    track_ids: list[int] = Field(min_length=1)
    confirm: bool = False


ALLOWED_SETTINGS = {"theme", "reduce_motion", "language", "crossfade"}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db = Database(settings.db_path)
    scanner = Scanner(db, settings.cover_dir)

    if settings.music_dir and settings.music_dir.is_dir():
        db.execute(
            "INSERT OR IGNORE INTO folders(path, added_at) VALUES(?,?)",
            (str(settings.music_dir.resolve()), time.time()),
        )

    app = FastAPI(title="Vinyl Music API", version="1.0.0")
    app.state.db = db
    app.state.scanner = scanner
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
    )

    # ------------------------------------------------------------------ helpers
    def roots() -> list[Path]:
        return scanner.roots() + [settings.import_dir]

    def allowed(p: Path) -> bool:
        return any(is_within(p, r) for r in roots())

    def get_track(tid: int) -> dict:
        row = db.one(f"SELECT {TRACK_COLUMNS}{TRACK_FROM}WHERE t.id=?", (tid,))
        if not row:
            raise HTTPException(404, "Track not found")
        return _track(row)

    def tracks_where(where: list[str], args: list[Any], order: str = "") -> list[dict]:
        sql = f"SELECT {TRACK_COLUMNS}{TRACK_FROM}"
        if where:
            sql += "WHERE " + " AND ".join(where) + " "
        sql += order
        return [_track(r) for r in db.all(sql, args)]

    # ------------------------------------------------------------------ health
    @app.get("/api/health")
    def health():
        stats = db.one("SELECT COUNT(*) AS tracks, SUM(missing) AS missing FROM tracks") or {}
        return {"status": "ok", "tracks": stats.get("tracks") or 0, "missing": stats.get("missing") or 0}

    # ------------------------------------------------------------------ folders + scan
    @app.get("/api/folders")
    def list_folders():
        out = []
        for r in db.all("SELECT * FROM folders ORDER BY id"):
            r["exists"] = Path(r["path"]).is_dir()
            out.append(r)
        return out

    @app.post("/api/folders", status_code=201)
    def add_folder(body: FolderIn):
        try:
            p = Path(body.path).expanduser().resolve()
        except (OSError, RuntimeError):
            raise HTTPException(400, "Invalid path")
        if not p.is_dir():
            raise HTTPException(400, "Folder does not exist")
        if p == Path(p.anchor):
            raise HTTPException(400, "Refusing to register a filesystem root")
        db.execute("INSERT OR IGNORE INTO folders(path, added_at) VALUES(?,?)", (str(p), time.time()))
        return db.one("SELECT * FROM folders WHERE path=?", (str(p),))

    @app.delete("/api/folders/{fid}")
    def delete_folder(fid: int):
        if db.execute("DELETE FROM folders WHERE id=?", (fid,)).rowcount == 0:
            raise HTTPException(404, "Folder not found")
        return {"ok": True, "hint": "Run a rescan to mark tracks from this folder as missing."}

    @app.post("/api/scan")
    def start_scan(background: bool = True):
        return scanner.start(background=background).to_dict()

    @app.get("/api/scan/{job_id}")
    def scan_status(job_id: str):
        job = scanner.jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Scan job not found")
        return job.to_dict()

    # ------------------------------------------------------------------ import (user-chosen files)
    @app.post("/api/import", status_code=201)
    async def import_files(files: list[UploadFile] = File(...)):
        settings.import_dir.mkdir(parents=True, exist_ok=True)
        results = []
        for up in files:
            name = safe_filename(up.filename or "upload")
            ext = Path(name).suffix.lower()
            if ext not in AUDIO_EXTENSIONS:
                results.append({"file": name, "status": "rejected", "reason": "Not a supported audio file"})
                continue
            target = settings.import_dir / name
            n = 1
            while target.exists():
                target = settings.import_dir / f"{Path(name).stem} ({n}){ext}"
                n += 1
            size = 0
            with target.open("wb") as fh:
                while chunk := await up.read(CHUNK):
                    size += len(chunk)
                    if size > settings.max_import_bytes:
                        break
                    fh.write(chunk)
            if size > settings.max_import_bytes:
                target.unlink(missing_ok=True)
                results.append({"file": name, "status": "rejected", "reason": "File too large"})
                continue
            status = scanner.index_file(target)
            row = db.one("SELECT id FROM tracks WHERE path=?", (str(target.resolve()),))
            results.append({"file": target.name, "status": status, "track_id": row["id"] if row else None})
        return {"results": results}

    # ------------------------------------------------------------------ library browsing
    @app.get("/api/tracks")
    def list_tracks(
        q: str = "",
        sort: str = "artist",
        order: Literal["asc", "desc"] = "asc",
        artist: Optional[str] = None,
        album: Optional[str] = None,
        album_key: Optional[str] = None,
        artist_key: Optional[str] = None,
        genre: Optional[str] = None,
        format: Optional[str] = None,
        liked: Optional[bool] = None,
        include_missing: bool = False,
        limit: int = Query(5000, ge=1, le=20000),
        offset: int = Query(0, ge=0),
    ):
        if sort not in SORTS:
            raise HTTPException(400, f"Invalid sort. Use one of: {', '.join(sorted(SORTS))}")
        where: list[str] = []
        args: list[Any] = []
        if not include_missing:
            where.append("t.missing=0")
        if q.strip():
            like = f"%{q.strip()}%"
            where.append("(t.title LIKE ? OR t.artist LIKE ? OR t.album LIKE ? OR t.album_artist LIKE ? OR t.genre LIKE ?)")
            args += [like] * 5
        for col, val in (("artist", artist), ("album", album), ("genre", genre), ("format", format),
                         ("album_key", album_key), ("artist_key", artist_key)):
            if val is not None:
                where.append(f"t.{col}=? COLLATE NOCASE" if col in ("artist", "album", "genre", "format") else f"t.{col}=?")
                args.append(val)
        if liked is not None:
            where.append("l.track_id IS NOT NULL" if liked else "l.track_id IS NULL")
        direction = "DESC" if order == "desc" else "ASC"
        order_sql = (
            f"ORDER BY {SORTS[sort]} IS NULL, {SORTS[sort]} {direction}, t.album COLLATE NOCASE, "
            f"t.disc_number, t.track_number, t.title COLLATE NOCASE LIMIT ? OFFSET ?"
        )
        return tracks_where(where, args + [limit, offset], order_sql)

    @app.get("/api/tracks/missing")
    def missing_tracks():
        return tracks_where(["t.missing=1"], [], "ORDER BY t.path")

    @app.get("/api/tracks/errors")
    def error_tracks():
        return tracks_where(["t.error IS NOT NULL", "t.missing=0"], [], "ORDER BY t.path")

    @app.get("/api/tracks/{tid}")
    def track_detail(tid: int):
        return get_track(tid)

    @app.get("/api/albums")
    def list_albums(q: str = ""):
        where = "t.missing=0 AND t.album_key IS NOT NULL"
        args: list[Any] = []
        if q.strip():
            where += " AND (t.album LIKE ? OR t.album_artist LIKE ? OR t.artist LIKE ?)"
            args += [f"%{q.strip()}%"] * 3
        return db.all(
            f"""SELECT t.album_key AS key, MIN(t.album) AS name,
                       COALESCE(MIN(t.album_artist), MIN(t.artist)) AS artist,
                       MIN(t.artist_key) AS artist_key, MAX(t.year) AS year,
                       COUNT(*) AS track_count, SUM(COALESCE(t.duration,0)) AS duration,
                       (SELECT id FROM tracks c WHERE c.album_key=t.album_key AND c.cover_file IS NOT NULL
                          AND c.missing=0 ORDER BY c.disc_number, c.track_number LIMIT 1) AS cover_track_id
                FROM tracks t WHERE {where}
                GROUP BY t.album_key ORDER BY name COLLATE NOCASE""",
            args,
        )

    @app.get("/api/albums/{key}")
    def album_detail(key: str):
        rows = tracks_where(["t.album_key=?", "t.missing=0"], [key],
                            "ORDER BY t.disc_number, t.track_number, t.title COLLATE NOCASE")
        if not rows:
            raise HTTPException(404, "Album not found")
        first = rows[0]
        cover = next((r["id"] for r in rows if r["has_cover"]), None)
        return {
            "key": key,
            "name": first["album"],
            "artist": first["album_artist"] or first["artist"],
            "artist_key": first["artist_key"],
            "year": max((r["year"] or 0) for r in rows) or None,
            "genre": first["genre"],
            "track_count": len(rows),
            "duration": sum(r["duration"] or 0 for r in rows),
            "cover_track_id": cover,
            "tracks": rows,
        }

    @app.get("/api/artists")
    def list_artists(q: str = ""):
        where = "t.missing=0 AND t.artist_key IS NOT NULL"
        args: list[Any] = []
        if q.strip():
            where += " AND t.artist LIKE ?"
            args.append(f"%{q.strip()}%")
        return db.all(
            f"""SELECT t.artist_key AS key, MIN(t.artist) AS name, COUNT(*) AS track_count,
                       COUNT(DISTINCT t.album_key) AS album_count,
                       (SELECT id FROM tracks c WHERE c.artist_key=t.artist_key AND c.cover_file IS NOT NULL
                          AND c.missing=0 LIMIT 1) AS cover_track_id
                FROM tracks t WHERE {where} GROUP BY t.artist_key ORDER BY name COLLATE NOCASE""",
            args,
        )

    @app.get("/api/artists/{key}")
    def artist_detail(key: str):
        rows = tracks_where(["t.artist_key=?", "t.missing=0"], [key],
                            "ORDER BY t.year IS NULL, t.year DESC, t.album COLLATE NOCASE, t.disc_number, t.track_number")
        if not rows:
            raise HTTPException(404, "Artist not found")
        albums: dict[str, dict] = {}
        for r in rows:
            if not r["album_key"]:
                continue
            a = albums.setdefault(r["album_key"], {"key": r["album_key"], "name": r["album"], "year": r["year"],
                                                   "track_count": 0, "cover_track_id": None})
            a["track_count"] += 1
            if r["has_cover"] and a["cover_track_id"] is None:
                a["cover_track_id"] = r["id"]
        return {
            "key": key,
            "name": rows[0]["artist"],
            "track_count": len(rows),
            "cover_track_id": next((r["id"] for r in rows if r["has_cover"]), None),
            "albums": list(albums.values()),
            "tracks": rows,
        }

    @app.get("/api/genres")
    def list_genres():
        return db.all("""SELECT genre AS name, COUNT(*) AS track_count FROM tracks
                         WHERE missing=0 AND genre IS NOT NULL GROUP BY genre COLLATE NOCASE ORDER BY name COLLATE NOCASE""")

    @app.get("/api/search")
    def search(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=200)):
        return {
            "tracks": list_tracks(q=q, sort="title", order="asc", artist=None, album=None, album_key=None,
                                  artist_key=None, genre=None, format=None, liked=None, include_missing=False,
                                  limit=limit, offset=0),
            "albums": list_albums(q)[:limit],
            "artists": list_artists(q)[:limit],
        }

    # ------------------------------------------------------------------ stream + covers
    @app.get("/api/stream/{tid}")
    def stream(tid: int, request: Request):
        row = db.one("SELECT path, mime, format FROM tracks WHERE id=?", (tid,))
        if not row:
            raise HTTPException(404, "Track not found")
        p = Path(row["path"])
        if not allowed(p):
            raise HTTPException(403, "Track is outside the allowed library folders")
        if not p.is_file():
            db.execute("UPDATE tracks SET missing=1 WHERE id=?", (tid,))
            raise HTTPException(404, "File is missing on disk")
        size = p.stat().st_size
        media_type = row["mime"] or "application/octet-stream"
        range_header = request.headers.get("range")
        start, end, status = 0, size - 1, 200
        if range_header:
            try:
                unit, _, spec = range_header.partition("=")
                if unit.strip().lower() != "bytes" or not spec:
                    raise ValueError
                first_range = spec.split(",")[0].strip()
                s, _, e = first_range.partition("-")
                if s == "":
                    length = int(e)
                    if length <= 0:
                        raise ValueError
                    start, end = max(0, size - length), size - 1
                else:
                    start = int(s)
                    end = min(int(e), size - 1) if e else size - 1
                if start >= size or start > end or start < 0:
                    raise ValueError
            except ValueError:
                return Response(status_code=416, headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"})
            status = 206
        length = end - start + 1

        def body():
            with p.open("rb") as fh:
                fh.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = fh.read(min(CHUNK, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {"Accept-Ranges": "bytes", "Content-Length": str(length), "Cache-Control": "no-cache"}
        if status == 206:
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        return StreamingResponse(body(), status_code=status, media_type=media_type, headers=headers)

    @app.get("/api/covers/{tid}")
    def cover(tid: int):
        row = db.one("SELECT cover_file, cover_mime FROM tracks WHERE id=?", (tid,))
        if not row or not row["cover_file"]:
            raise HTTPException(404, "No cover")
        f = (settings.cover_dir / row["cover_file"]).resolve()
        if not is_within(f, settings.cover_dir) or not f.is_file():
            raise HTTPException(404, "No cover")
        return FileResponse(f, media_type=row["cover_mime"] or "image/jpeg",
                            headers={"Cache-Control": "public, max-age=604800"})

    # ------------------------------------------------------------------ playlists
    def playlist_or_404(pid: int) -> dict:
        p = db.one("""SELECT p.*, COUNT(pt.track_id) AS track_count,
                        (SELECT pt2.track_id FROM playlist_tracks pt2 JOIN tracks t2 ON t2.id=pt2.track_id
                          WHERE pt2.playlist_id=p.id AND t2.cover_file IS NOT NULL ORDER BY pt2.position LIMIT 1)
                          AS cover_track_id
                      FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id=p.id
                      WHERE p.id=? GROUP BY p.id""", (pid,))
        if not p:
            raise HTTPException(404, "Playlist not found")
        return p

    @app.get("/api/playlists")
    def list_playlists():
        return db.all("""SELECT p.*, COUNT(pt.track_id) AS track_count,
                           (SELECT pt2.track_id FROM playlist_tracks pt2 JOIN tracks t2 ON t2.id=pt2.track_id
                             WHERE pt2.playlist_id=p.id AND t2.cover_file IS NOT NULL ORDER BY pt2.position LIMIT 1)
                             AS cover_track_id
                         FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id=p.id
                         GROUP BY p.id ORDER BY p.created_at""")

    @app.post("/api/playlists", status_code=201)
    def create_playlist(body: PlaylistIn):
        name = body.name.strip()
        if not name:
            raise HTTPException(400, "Name is required")
        now = time.time()
        cur = db.execute("INSERT INTO playlists(name, description, created_at, updated_at) VALUES(?,?,?,?)",
                         (name, body.description, now, now))
        return playlist_or_404(cur.lastrowid)

    @app.get("/api/playlists/{pid}")
    def get_playlist(pid: int):
        p = playlist_or_404(pid)
        p["tracks"] = playlist_tracks(pid)
        return p

    @app.patch("/api/playlists/{pid}")
    def update_playlist(pid: int, body: PlaylistPatch):
        playlist_or_404(pid)
        if body.name is not None:
            if not body.name.strip():
                raise HTTPException(400, "Name is required")
            db.execute("UPDATE playlists SET name=?, updated_at=? WHERE id=?", (body.name.strip(), time.time(), pid))
        if body.description is not None:
            db.execute("UPDATE playlists SET description=?, updated_at=? WHERE id=?", (body.description, time.time(), pid))
        return playlist_or_404(pid)

    @app.delete("/api/playlists/{pid}")
    def delete_playlist(pid: int):
        if db.execute("DELETE FROM playlists WHERE id=?", (pid,)).rowcount == 0:
            raise HTTPException(404, "Playlist not found")
        return {"ok": True}

    @app.get("/api/playlists/{pid}/tracks")
    def playlist_tracks(pid: int):
        playlist_or_404(pid)
        rows = db.all(f"SELECT {TRACK_COLUMNS}, pt.position{TRACK_FROM}JOIN playlist_tracks pt ON pt.track_id=t.id "
                      "WHERE pt.playlist_id=? ORDER BY pt.position", (pid,))
        return [_track(r) for r in rows]

    def _validate_ids(ids: list[int]) -> None:
        if not ids:
            return
        found = {r["id"] for r in db.all(f"SELECT id FROM tracks WHERE id IN ({','.join('?' * len(set(ids)))})", list(set(ids)))}
        missing = sorted(set(ids) - found)
        if missing:
            raise HTTPException(400, f"Unknown track ids: {missing[:10]}")

    @app.put("/api/playlists/{pid}/tracks")
    def replace_playlist_tracks(pid: int, body: TrackIds):
        """Replace full order – used for reorder and remove."""
        playlist_or_404(pid)
        _validate_ids(body.track_ids)
        with db.transaction() as conn:
            conn.execute("DELETE FROM playlist_tracks WHERE playlist_id=?", (pid,))
            conn.executemany("INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?,?,?)",
                             [(pid, tid, i) for i, tid in enumerate(body.track_ids)])
            conn.execute("UPDATE playlists SET updated_at=? WHERE id=?", (time.time(), pid))
        return playlist_tracks(pid)

    @app.post("/api/playlists/{pid}/tracks")
    def append_playlist_tracks(pid: int, body: TrackIds):
        playlist_or_404(pid)
        _validate_ids(body.track_ids)
        with db.transaction() as conn:
            pos = conn.execute("SELECT COALESCE(MAX(position)+1, 0) FROM playlist_tracks WHERE playlist_id=?",
                               (pid,)).fetchone()[0]
            conn.executemany("INSERT INTO playlist_tracks(playlist_id, track_id, position) VALUES(?,?,?)",
                             [(pid, tid, pos + i) for i, tid in enumerate(body.track_ids)])
            conn.execute("UPDATE playlists SET updated_at=? WHERE id=?", (time.time(), pid))
        return playlist_tracks(pid)

    # ------------------------------------------------------------------ likes + history
    @app.get("/api/liked")
    def liked_tracks():
        rows = db.all(f"SELECT {TRACK_COLUMNS}, l.liked_at{TRACK_FROM}WHERE l.track_id IS NOT NULL "
                      "ORDER BY l.liked_at DESC")
        return [_track(r) for r in rows]

    @app.put("/api/liked/{tid}")
    def like(tid: int):
        get_track(tid)
        db.execute("INSERT OR IGNORE INTO liked_tracks(track_id, liked_at) VALUES(?,?)", (tid, time.time()))
        return {"track_id": tid, "liked": True}

    @app.delete("/api/liked/{tid}")
    def unlike(tid: int):
        db.execute("DELETE FROM liked_tracks WHERE track_id=?", (tid,))
        return {"track_id": tid, "liked": False}

    @app.post("/api/history/{tid}", status_code=201)
    def add_history(tid: int):
        get_track(tid)
        db.execute("INSERT INTO playback_history(track_id, played_at) VALUES(?,?)", (tid, time.time()))
        return {"ok": True}

    @app.get("/api/history")
    def history(limit: int = Query(50, ge=1, le=500)):
        rows = db.all(f"SELECT {TRACK_COLUMNS}, h.played_at, h.id AS history_id FROM playback_history h "
                      "JOIN tracks t ON t.id=h.track_id LEFT JOIN liked_tracks l ON l.track_id=t.id "
                      "ORDER BY h.played_at DESC, h.id DESC LIMIT ?", (limit,))
        return [_track(r) for r in rows]

    @app.delete("/api/history")
    def clear_history():
        db.execute("DELETE FROM playback_history")
        return {"ok": True}

    # ------------------------------------------------------------------ settings
    @app.get("/api/settings")
    def get_settings():
        out = {r["key"]: json.loads(r["value"]) for r in db.all("SELECT key, value FROM settings")}
        out["data_dir"] = str(settings.data_dir)
        out["import_dir"] = str(settings.import_dir)
        return out

    @app.put("/api/settings")
    def put_settings(body: SettingsIn):
        unknown = set(body.values) - ALLOWED_SETTINGS
        if unknown:
            raise HTTPException(400, f"Unknown settings: {sorted(unknown)}")
        for k, v in body.values.items():
            db.execute("INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                       (k, json.dumps(v)))
        return get_settings()

    # ------------------------------------------------------------------ duplicates (dry-run) + quarantine
    @app.get("/api/duplicates")
    def duplicates():
        """Dry-run only: lists candidate groups. Nothing is moved or deleted."""
        by_hash = []
        for g in db.all("""SELECT file_hash, COUNT(*) AS n FROM tracks WHERE missing=0 AND file_hash IS NOT NULL
                           GROUP BY file_hash HAVING n>1"""):
            by_hash.append({"reason": "identical file contents",
                            "tracks": tracks_where(["t.file_hash=?", "t.missing=0"], [g["file_hash"]], "ORDER BY t.path")})
        by_meta = []
        for g in db.all("""SELECT LOWER(TRIM(title)) AS ti, LOWER(TRIM(COALESCE(artist,''))) AS ar,
                                  CAST(ROUND(COALESCE(duration,0)) AS INTEGER) AS du, COUNT(*) AS n,
                                  COUNT(DISTINCT file_hash) AS hashes
                           FROM tracks WHERE missing=0 GROUP BY ti, ar, du HAVING n>1 AND hashes>1"""):
            by_meta.append({"reason": "same title, artist and duration",
                            "tracks": tracks_where(
                                ["LOWER(TRIM(t.title))=?", "LOWER(TRIM(COALESCE(t.artist,'')))=?",
                                 "CAST(ROUND(COALESCE(t.duration,0)) AS INTEGER)=?", "t.missing=0"],
                                [g["ti"], g["ar"], g["du"]], "ORDER BY t.path")})
        return {"dry_run": True, "by_hash": by_hash, "by_metadata": by_meta}

    @app.post("/api/duplicates/quarantine")
    def quarantine(body: QuarantineIn):
        """Move selected files into a quarantine folder with a manifest.

        Without ``confirm=true`` this is a dry run that only reports the plan.
        Files are never deleted; use ``/api/quarantine/{id}/restore`` to undo.
        """
        rows = db.all(f"SELECT id, path FROM tracks WHERE id IN ({','.join('?' * len(body.track_ids))})",
                      body.track_ids)
        plan = []
        batch = uuid.uuid4().hex[:12]
        dest_root = settings.quarantine_dir / batch
        for r in rows:
            src = Path(r["path"])
            if not allowed(src) or not src.is_file():
                plan.append({"track_id": r["id"], "source": r["path"], "status": "skipped",
                             "reason": "missing or outside library"})
                continue
            plan.append({"track_id": r["id"], "source": str(src), "destination": str(dest_root / f"{r['id']}_{src.name}"),
                         "status": "planned"})
        if not body.confirm:
            return {"dry_run": True, "batch": None, "items": plan}
        dest_root.mkdir(parents=True, exist_ok=True)
        for item in plan:
            if item["status"] != "planned":
                continue
            shutil.move(item["source"], item["destination"])
            item["status"] = "moved"
            db.execute("UPDATE tracks SET missing=1 WHERE id=?", (item["track_id"],))
        manifest = dest_root / "manifest.json"
        manifest.write_text(json.dumps({"batch": batch, "created_at": time.time(), "items": plan}, indent=2),
                            encoding="utf-8")
        db.execute("INSERT INTO quarantine(id, created_at, manifest_path) VALUES(?,?,?)",
                   (batch, time.time(), str(manifest)))
        return {"dry_run": False, "batch": batch, "manifest": str(manifest), "items": plan}

    @app.get("/api/quarantine")
    def list_quarantine():
        out = []
        for r in db.all("SELECT * FROM quarantine ORDER BY created_at DESC"):
            try:
                r["items"] = json.loads(Path(r["manifest_path"]).read_text(encoding="utf-8"))["items"]
            except (OSError, ValueError):
                r["items"] = []
            out.append(r)
        return out

    @app.post("/api/quarantine/{batch}/restore")
    def restore_quarantine(batch: str):
        r = db.one("SELECT * FROM quarantine WHERE id=?", (batch,))
        if not r:
            raise HTTPException(404, "Quarantine batch not found")
        manifest = Path(r["manifest_path"])
        data = json.loads(manifest.read_text(encoding="utf-8"))
        restored = []
        for item in data["items"]:
            if item.get("status") != "moved":
                continue
            src, dst = Path(item["destination"]), Path(item["source"])
            if src.is_file() and not dst.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dst))
                item["status"] = "restored"
                db.execute("UPDATE tracks SET missing=0 WHERE id=?", (item["track_id"],))
                restored.append(item["track_id"])
        manifest.write_text(json.dumps(data, indent=2), encoding="utf-8")
        db.execute("UPDATE quarantine SET restored=1 WHERE id=?", (batch,))
        return {"restored": restored}

    return app
