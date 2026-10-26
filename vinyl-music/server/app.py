"""Vinyl Music 로컬 백엔드 (FastAPI + SQLite + mutagen)."""
import hashlib, mimetypes, os, sqlite3, threading, time, uuid
from pathlib import Path
from typing import Optional

import mutagen
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

AUDIO_EXT = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".aiff", ".aif"}
BROWSER_PLAYABLE = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac"}  # AIFF는 대부분 브라우저 미지원


def default_data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local/share")
    return Path(base) / "vinyl-music"


DATA_DIR = Path(os.environ.get("DATA_DIR", default_data_dir()))
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:5173,http://localhost:5173"
).split(",")

SCHEMA = """
CREATE TABLE IF NOT EXISTS folders(id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS tracks(id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, title TEXT, artist TEXT,
 album TEXT, album_artist TEXT, duration REAL, track_number INTEGER, disc_number INTEGER, year INTEGER, genre TEXT,
 format TEXT, bitrate INTEGER, sample_rate INTEGER, bit_depth INTEGER, file_size INTEGER, file_hash TEXT,
 playable INTEGER, has_cover INTEGER DEFAULT 0, added_at REAL, modified_at REAL, missing INTEGER DEFAULT 0, error TEXT);
CREATE TABLE IF NOT EXISTS playlists(id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at REAL);
CREATE TABLE IF NOT EXISTS playlist_tracks(playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
 track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS liked_tracks(track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE, liked_at REAL);
CREATE TABLE IF NOT EXISTS playback_history(id INTEGER PRIMARY KEY, track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE, played_at REAL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_hash ON tracks(file_hash);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    c = sqlite3.connect(db_path, check_same_thread=False)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    c.executescript(SCHEMA)
    return c


class Res:
    """락 안에서 미리 가져온 쿼리 결과 (락 밖에서 커서를 쓰지 않기 위함)."""

    def __init__(self, rows, lastrowid, rowcount):
        self.rows, self.lastrowid, self.rowcount = rows, lastrowid, rowcount

    def fetchall(self): return self.rows
    def fetchone(self): return self.rows[0] if self.rows else None
    def __iter__(self): return iter(self.rows)


def first(tags, *keys):
    if not tags:
        return None
    for k in keys:
        v = tags.get(k)
        if v:
            return str(v[0]) if isinstance(v, list) else str(v)
    return None


def to_int(v):
    try:
        return int(str(v).split("/")[0].split("-")[0])
    except (TypeError, ValueError):
        return None


def extract_cover(p: Path) -> Optional[tuple[bytes, str]]:
    try:
        f = mutagen.File(p)
        if f is not None:
            if getattr(f, "pictures", None):
                return f.pictures[0].data, f.pictures[0].mime
            tags = f.tags or {}
            for k in list(tags.keys()):
                if str(k).startswith("APIC"):
                    return tags[k].data, tags[k].mime
            if "covr" in tags and tags["covr"]:
                c = tags["covr"][0]
                mime = "image/png" if getattr(c, "imageformat", None) == 14 else "image/jpeg"
                return bytes(c), mime
    except Exception:
        pass
    for name in ("cover.jpg", "folder.jpg", "cover.png"):
        q = p.parent / name
        if q.is_file():
            return q.read_bytes(), mimetypes.guess_type(q.name)[0] or "image/jpeg"
    return None


def read_meta(p: Path) -> dict:
    meta: dict = {"title": p.stem, "error": None, "has_cover": 0}
    try:
        easy = mutagen.File(p, easy=True)
        if easy is not None:
            t = easy.tags or {}
            meta.update(
                title=first(t, "title") or p.stem, artist=first(t, "artist"), album=first(t, "album"),
                album_artist=first(t, "albumartist"), genre=first(t, "genre"), year=to_int(first(t, "date")),
                track_number=to_int(first(t, "tracknumber")), disc_number=to_int(first(t, "discnumber")),
            )
            i = easy.info
            meta.update(duration=getattr(i, "length", None), bitrate=getattr(i, "bitrate", None),
                        sample_rate=getattr(i, "sample_rate", None), bit_depth=getattr(i, "bits_per_sample", None))
        meta["has_cover"] = int(extract_cover(p) is not None)
    except Exception as e:  # 메타데이터 읽기 실패해도 파일은 등록 (제목=파일명)
        meta["error"] = str(e)[:200]
    return meta


def quick_hash(p: Path) -> str:
    h = hashlib.sha1(str(p.stat().st_size).encode())
    with p.open("rb") as f:
        h.update(f.read(65536))
    return h.hexdigest()


def parse_range(header: str, size: int) -> tuple[int, int]:
    """'bytes=a-b' -> (start, end). 잘못되었거나 범위 밖이면 ValueError."""
    unit, spec = header.split("=", 1)
    if unit.strip() != "bytes":
        raise ValueError("unit")
    s, e = spec.split(",")[0].strip().split("-")
    if s == "":
        start, end = max(0, size - int(e)), size - 1
    else:
        start, end = int(s), min(int(e) if e else size - 1, size - 1)
    if start > end or start >= size:
        raise ValueError("range")
    return start, end


class FolderIn(BaseModel): path: str
class PlaylistIn(BaseModel): name: str
class TrackIds(BaseModel): track_ids: list[int]


def create_app(data_dir: Path = DATA_DIR) -> FastAPI:
    data_dir.mkdir(parents=True, exist_ok=True)
    db = connect(data_dir / "library.db")
    lock = threading.Lock()
    jobs: dict[str, dict] = {}
    app = FastAPI(title="Vinyl Music")
    app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"],
                       expose_headers=["Content-Range", "Accept-Ranges"])

    def q(sql, args=()) -> Res:
        with lock:
            cur = db.execute(sql, args)
            rows = cur.fetchall() if cur.description else []
            db.commit()
            return Res(rows, cur.lastrowid, cur.rowcount)

    def allowed_roots():
        return [Path(r["path"]) for r in q("SELECT path FROM folders")]

    def is_allowed(p: Path) -> bool:
        rp = p.resolve()
        return any(rp == r or r in rp.parents for r in allowed_roots())

    def track_row(tid: int):
        r = q("SELECT * FROM tracks WHERE id=?", (tid,)).fetchone()
        if not r:
            raise HTTPException(404, "track not found")
        return r

    def run_scan(job_id: str):
        job = jobs[job_id]
        try:
            files = [f for root in allowed_roots() if root.is_dir()
                     for f in root.rglob("*") if f.is_file() and f.suffix.lower() in AUDIO_EXT]
            job["total"] = len(files)
            seen = set()
            for f in files:
                rp = f.resolve()
                if not is_allowed(rp):  # 심볼릭 링크로 허용 폴더 밖을 가리키는 경우 차단
                    job["done"] += 1
                    continue
                seen.add(str(rp))
                st = rp.stat()
                old = q("SELECT modified_at FROM tracks WHERE path=?", (str(rp),)).fetchone()
                if old and old["modified_at"] == st.st_mtime:
                    q("UPDATE tracks SET missing=0 WHERE path=?", (str(rp),))
                else:
                    vals = dict(path=str(rp), format=rp.suffix.lower().lstrip("."), file_size=st.st_size,
                                file_hash=quick_hash(rp), playable=int(rp.suffix.lower() in BROWSER_PLAYABLE),
                                modified_at=st.st_mtime, added_at=time.time(), missing=0, **read_meta(rp))
                    cols = ",".join(vals)
                    ph = ",".join("?" * len(vals))
                    upd = ",".join(f"{k}=excluded.{k}" for k in vals if k != "added_at")
                    q(f"INSERT INTO tracks({cols}) VALUES({ph}) ON CONFLICT(path) DO UPDATE SET {upd}",
                      tuple(vals.values()))
                job["done"] += 1
            for r in q("SELECT id, path FROM tracks").fetchall():
                if r["path"] not in seen:
                    q("UPDATE tracks SET missing=1 WHERE id=?", (r["id"],))
            job["status"] = "finished"
        except Exception as e:
            job["status"], job["error"] = "failed", str(e)[:200]

    @app.get("/api/health")
    def health(): return {"status": "ok"}

    @app.get("/api/folders")
    def folders(): return [dict(r) for r in q("SELECT * FROM folders")]

    @app.post("/api/folders")
    def add_folder(body: FolderIn):
        p = Path(body.path).expanduser().resolve()
        if not p.is_dir():
            raise HTTPException(400, "folder does not exist")
        q("INSERT OR IGNORE INTO folders(path) VALUES(?)", (str(p),))
        return {"path": str(p)}

    @app.delete("/api/folders/{fid}")
    def del_folder(fid: int):
        q("DELETE FROM folders WHERE id=?", (fid,))
        return {"ok": True}

    @app.post("/api/scan")
    def scan(background: bool = True):
        jid = uuid.uuid4().hex
        jobs[jid] = {"id": jid, "status": "running", "done": 0, "total": 0}
        if background:
            threading.Thread(target=run_scan, args=(jid,), daemon=True).start()
        else:
            run_scan(jid)
        return jobs[jid]

    @app.get("/api/scan/{jid}")
    def scan_status(jid: str):
        if jid not in jobs:
            raise HTTPException(404, "job not found")
        return jobs[jid]

    SORTS = {"title", "artist", "album", "year", "added_at", "duration"}

    @app.get("/api/tracks")
    def tracks(search: str = "", sort: str = "artist", desc: bool = False, artist: Optional[str] = None,
               album: Optional[str] = None, genre: Optional[str] = None, include_missing: bool = False):
        if sort not in SORTS:
            raise HTTPException(400, "invalid sort")
        where, args = [], []
        if not include_missing:
            where.append("missing=0")
        if search:
            where.append("(title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?)")
            args += [f"%{search}%"] * 4
        for col, v in (("artist", artist), ("album", album), ("genre", genre)):
            if v is not None:
                where.append(f"{col}=?")
                args.append(v)
        sql = "SELECT t.*, (l.track_id IS NOT NULL) AS liked FROM tracks t LEFT JOIN liked_tracks l ON l.track_id=t.id"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += f" ORDER BY {sort} {'DESC' if desc else 'ASC'}, disc_number, track_number"
        return [dict(r) for r in q(sql, args)]

    @app.get("/api/albums")
    def albums():
        return [dict(r) for r in q("""SELECT album, COALESCE(album_artist, artist) AS artist, MIN(year) AS year,
          COUNT(*) AS track_count, SUM(duration) AS total_duration, MIN(id) AS cover_track_id FROM tracks
          WHERE missing=0 AND album IS NOT NULL GROUP BY album, COALESCE(album_artist, artist) ORDER BY album""")]

    @app.get("/api/artists")
    def artists():
        return [dict(r) for r in q("""SELECT artist, COUNT(*) AS track_count, COUNT(DISTINCT album) AS album_count
          FROM tracks WHERE missing=0 AND artist IS NOT NULL GROUP BY artist ORDER BY artist""")]

    @app.get("/api/tracks/missing")
    def missing(): return [dict(r) for r in q("SELECT * FROM tracks WHERE missing=1")]

    @app.get("/api/duplicates")
    def duplicates():  # dry-run 전용: 아무것도 삭제하거나 이동하지 않음
        by_hash = q("""SELECT GROUP_CONCAT(id) ids FROM tracks WHERE missing=0 AND file_hash IS NOT NULL
                       GROUP BY file_hash HAVING COUNT(*)>1""").fetchall()
        by_meta = q("""SELECT GROUP_CONCAT(id) ids FROM tracks WHERE missing=0
                       GROUP BY LOWER(title), LOWER(COALESCE(artist,'')) HAVING COUNT(*)>1""").fetchall()
        return {"dry_run": True, "by_hash": [[int(i) for i in r["ids"].split(",")] for r in by_hash],
                "by_metadata": [[int(i) for i in r["ids"].split(",")] for r in by_meta]}

    @app.get("/api/stream/{tid}")
    def stream(tid: int, request: Request):
        r = track_row(tid)
        p = Path(r["path"])
        if not p.is_file() or not is_allowed(p):
            q("UPDATE tracks SET missing=1 WHERE id=?", (tid,))
            raise HTTPException(404, "file missing")
        size = p.stat().st_size
        ctype = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        start, end, status = 0, size - 1, 200
        rng = request.headers.get("range")
        if rng:
            try:
                start, end = parse_range(rng, size)
            except ValueError:
                return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
            status = 206
        length = end - start + 1

        def body():
            with p.open("rb") as f:
                f.seek(start)
                left = length
                while left > 0:
                    chunk = f.read(min(65536, left))
                    if not chunk:
                        break
                    left -= len(chunk)
                    yield chunk

        headers = {"Accept-Ranges": "bytes", "Content-Length": str(length)}
        if status == 206:
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        return StreamingResponse(body(), status_code=status, media_type=ctype, headers=headers)

    @app.get("/api/covers/{tid}")
    def cover(tid: int):
        p = Path(track_row(tid)["path"])
        if not p.is_file() or not is_allowed(p):
            raise HTTPException(404, "file missing")
        c = extract_cover(p)
        if not c:
            raise HTTPException(404, "no cover")
        return Response(c[0], media_type=c[1], headers={"Cache-Control": "max-age=86400"})

    @app.get("/api/playlists")
    def playlists():
        return [dict(r) for r in q("""SELECT p.*, COUNT(pt.track_id) track_count FROM playlists p
          LEFT JOIN playlist_tracks pt ON pt.playlist_id=p.id GROUP BY p.id ORDER BY p.created_at""")]

    @app.post("/api/playlists")
    def create_pl(body: PlaylistIn):
        name = body.name.strip()
        if not name:
            raise HTTPException(400, "name required")
        cur = q("INSERT INTO playlists(name, created_at) VALUES(?,?)", (name, time.time()))
        return {"id": cur.lastrowid, "name": name}

    @app.patch("/api/playlists/{pid}")
    def rename_pl(pid: int, body: PlaylistIn):
        name = body.name.strip()
        if not name:
            raise HTTPException(400, "name required")
        if q("UPDATE playlists SET name=? WHERE id=?", (name, pid)).rowcount == 0:
            raise HTTPException(404, "playlist not found")
        return {"id": pid, "name": name}

    @app.delete("/api/playlists/{pid}")
    def delete_pl(pid: int):
        q("DELETE FROM playlists WHERE id=?", (pid,))
        return {"ok": True}

    def pl_tracks_rows(pid: int):
        return [dict(r) for r in q("""SELECT t.*, pt.position FROM playlist_tracks pt JOIN tracks t ON t.id=pt.track_id
          WHERE pt.playlist_id=? ORDER BY pt.position""", (pid,))]

    @app.get("/api/playlists/{pid}/tracks")
    def pl_tracks(pid: int):
        return pl_tracks_rows(pid)

    @app.put("/api/playlists/{pid}/tracks")  # 전체 순서를 교체 = 추가/삭제/재정렬
    def set_pl_tracks(pid: int, body: TrackIds):
        if not q("SELECT 1 FROM playlists WHERE id=?", (pid,)).fetchone():
            raise HTTPException(404, "playlist not found")
        for tid in body.track_ids:  # 먼저 전부 검증한 뒤 교체 (중간 실패로 데이터가 날아가지 않게)
            track_row(tid)
        q("DELETE FROM playlist_tracks WHERE playlist_id=?", (pid,))
        for i, tid in enumerate(body.track_ids):
            q("INSERT INTO playlist_tracks VALUES(?,?,?)", (pid, tid, i))
        return pl_tracks_rows(pid)

    @app.get("/api/liked")
    def liked():
        return [dict(r) for r in q("""SELECT t.*, 1 AS liked FROM liked_tracks l JOIN tracks t ON t.id=l.track_id
          ORDER BY l.liked_at DESC""")]

    @app.put("/api/liked/{tid}")
    def like(tid: int):
        track_row(tid)
        q("INSERT OR IGNORE INTO liked_tracks VALUES(?,?)", (tid, time.time()))
        return {"liked": True}

    @app.delete("/api/liked/{tid}")
    def unlike(tid: int):
        q("DELETE FROM liked_tracks WHERE track_id=?", (tid,))
        return {"liked": False}

    @app.post("/api/history/{tid}")
    def add_history(tid: int):
        track_row(tid)
        q("INSERT INTO playback_history(track_id, played_at) VALUES(?,?)", (tid, time.time()))
        return {"ok": True}

    @app.get("/api/history")
    def history(limit: int = Query(50, le=500)):
        return [dict(r) for r in q("""SELECT t.*, h.played_at FROM playback_history h JOIN tracks t ON t.id=h.track_id
          ORDER BY h.played_at DESC LIMIT ?""", (limit,))]

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", 8000)))
