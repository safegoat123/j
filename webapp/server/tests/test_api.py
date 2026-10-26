import os
import sqlite3
from pathlib import Path

import pytest

from conftest import HAS_FFMPEG, PNG, make_ffmpeg, make_wav


def by_title(client, title):
    return next(t for t in client.get("/api/tracks").json() if t["title"] == title)


def test_health_and_sqlite_init(env):
    client, _, tmp = env
    r = client.get("/api/health").json()
    assert r["status"] == "ok" and r["tracks"] == 5
    con = sqlite3.connect(tmp / "data" / "library.db")
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"tracks", "folders", "playlists", "playlist_tracks", "liked_tracks", "playback_history",
            "settings", "quarantine"} <= tables


def test_scan_extracts_metadata(env):
    client, _, _ = env
    alpha = by_title(client, "Alpha")
    assert alpha["artist"] == "Artist A" and alpha["album"] == "Album X"
    assert alpha["genre"] == "Jazz" and alpha["year"] == 2001 and alpha["track_number"] == 1
    assert alpha["format"] == "wav" and alpha["mime"] == "audio/wav"
    assert abs(alpha["duration"] - 1.0) < 0.05
    assert alpha["sample_rate"] == 8000 and alpha["playable"] is True
    assert alpha["has_cover"] is True
    untitled = by_title(client, "untitled-take")
    assert untitled["artist"] is None
    broken = by_title(client, "broken")
    assert broken["playable"] is False and broken["error"]


def test_albums_artists_search_sort_filter(env):
    client, _, _ = env
    albums = client.get("/api/albums").json()
    album = next(a for a in albums if a["name"] == "Album X")
    assert album["track_count"] == 3  # 2 originals + tagged duplicate
    detail = client.get(f"/api/albums/{album['key']}").json()
    assert [t["track_number"] for t in detail["tracks"]][:2] == [1, 1] or detail["tracks"][0]["title"] == "Alpha"
    assert detail["cover_track_id"] is not None
    artists = client.get("/api/artists").json()
    assert artists[0]["name"] == "Artist A" and artists[0]["album_count"] == 1
    assert client.get(f"/api/artists/{artists[0]['key']}").json()["albums"][0]["name"] == "Album X"
    assert {t["title"] for t in client.get("/api/tracks", params={"q": "bet"}).json()} == {"Beta"}
    titles = [t["title"] for t in client.get("/api/tracks", params={"sort": "title", "order": "desc"}).json()]
    assert titles == sorted(titles, key=str.casefold, reverse=True)
    assert all(t["genre"] == "Jazz" for t in client.get("/api/tracks", params={"genre": "jazz"}).json())
    assert client.get("/api/tracks", params={"sort": "path; DROP TABLE tracks"}).status_code == 400
    s = client.get("/api/search", params={"q": "album x"}).json()
    assert s["albums"] and s["albums"][0]["name"] == "Album X"


def test_range_requests(env):
    client, _, _ = env
    tid = by_title(client, "Alpha")["id"]
    full = client.get(f"/api/stream/{tid}")
    assert full.status_code == 200 and full.headers["accept-ranges"] == "bytes"
    size = len(full.content)
    assert full.headers["content-length"] == str(size)
    r = client.get(f"/api/stream/{tid}", headers={"Range": "bytes=100-199"})
    assert r.status_code == 206 and len(r.content) == 100
    assert r.headers["content-range"] == f"bytes 100-199/{size}"
    assert r.headers["content-length"] == "100"
    assert r.content == full.content[100:200]
    tail = client.get(f"/api/stream/{tid}", headers={"Range": "bytes=-50"})
    assert tail.status_code == 206 and tail.content == full.content[-50:]
    open_end = client.get(f"/api/stream/{tid}", headers={"Range": f"bytes={size - 10}-"})
    assert open_end.status_code == 206 and len(open_end.content) == 10
    bad = client.get(f"/api/stream/{tid}", headers={"Range": f"bytes={size + 5}-"})
    assert bad.status_code == 416 and bad.headers["content-range"] == f"bytes */{size}"
    assert client.get(f"/api/stream/{tid}", headers={"Range": "items=0-1"}).status_code == 416


def test_cover(env):
    client, _, _ = env
    alpha = by_title(client, "Alpha")
    r = client.get(f"/api/covers/{alpha['id']}")
    assert r.status_code == 200 and r.content == PNG and r.headers["content-type"] == "image/png"
    assert client.get(f"/api/covers/{by_title(client, 'untitled-take')['id']}").status_code == 404


def test_path_traversal_blocked(env):
    client, music, tmp = env
    secret = tmp / "secret.wav"
    make_wav(secret)
    # No endpoint accepts a raw path to read; ids that do not exist are 404
    assert client.get("/api/stream/99999").status_code == 404
    assert client.get("/api/stream/..%2F..%2Fsecret.wav").status_code in (404, 422)
    assert client.post("/api/folders", json={"path": str(tmp / "nope")}).status_code == 400
    # A symlink inside the library pointing outside it is not indexed
    link = music / "loose" / "escape.wav"
    try:
        os.symlink(secret, link)
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not supported")
    client.post("/api/scan?background=false")
    assert all("secret" not in t["path"] and "escape" not in t["path"] for t in
               client.get("/api/tracks", params={"include_missing": True}).json())
    # Even if a row is forged in the DB pointing outside the roots, streaming is refused
    client.app.state.db.execute("INSERT INTO tracks(path, title, format, mime, missing) VALUES(?,?,?,?,0)",
                                (str(secret), "forged", "wav", "audio/wav"))
    forged = client.app.state.db.one("SELECT id FROM tracks WHERE title='forged'")["id"]
    assert client.get(f"/api/stream/{forged}").status_code == 403


def test_playlist_crud_and_order(env):
    client, _, _ = env
    ids = [t["id"] for t in client.get("/api/tracks", params={"sort": "title"}).json()][:3]
    pl = client.post("/api/playlists", json={"name": "  Mix  "}).json()
    assert pl["name"] == "Mix" and pl["track_count"] == 0
    assert client.post("/api/playlists", json={"name": ""}).status_code == 422
    got = client.post(f"/api/playlists/{pl['id']}/tracks", json={"track_ids": ids}).json()
    assert [t["id"] for t in got] == ids
    got = client.put(f"/api/playlists/{pl['id']}/tracks", json={"track_ids": ids[::-1]}).json()
    assert [t["id"] for t in got] == ids[::-1] and [t["position"] for t in got] == [0, 1, 2]
    got = client.put(f"/api/playlists/{pl['id']}/tracks", json={"track_ids": [ids[0]]}).json()
    assert [t["id"] for t in got] == [ids[0]]
    assert client.put(f"/api/playlists/{pl['id']}/tracks", json={"track_ids": [424242]}).status_code == 400
    renamed = client.patch(f"/api/playlists/{pl['id']}", json={"name": "New", "description": "d"}).json()
    assert renamed["name"] == "New" and renamed["description"] == "d"
    assert client.get(f"/api/playlists/{pl['id']}").json()["track_count"] == 1
    assert client.delete(f"/api/playlists/{pl['id']}").json()["ok"]
    assert client.get("/api/playlists").json() == []
    assert client.get(f"/api/playlists/{pl['id']}").status_code == 404


def test_liked_and_history(env):
    client, _, _ = env
    a, b = by_title(client, "Alpha")["id"], by_title(client, "Beta")["id"]
    client.put(f"/api/liked/{a}")
    client.put(f"/api/liked/{a}")  # idempotent
    liked = client.get("/api/liked").json()
    assert [t["id"] for t in liked] == [a] and liked[0]["liked"] is True
    assert by_title(client, "Alpha")["liked"] is True
    assert [t["id"] for t in client.get("/api/tracks", params={"liked": True}).json()] == [a]
    client.delete(f"/api/liked/{a}")
    assert client.get("/api/liked").json() == []
    assert client.put("/api/liked/99999").status_code == 404
    client.post(f"/api/history/{a}")
    client.post(f"/api/history/{b}")
    hist = client.get("/api/history").json()
    assert [t["id"] for t in hist] == [b, a]
    client.delete("/api/history")
    assert client.get("/api/history").json() == []


def test_missing_files_and_rescan(env):
    client, music, _ = env
    beta = by_title(client, "Beta")
    (music / "Artist A" / "Album X" / "02 b.wav").unlink()
    # Streaming a vanished file marks it missing immediately
    assert client.get(f"/api/stream/{beta['id']}").status_code == 404
    job = client.post("/api/scan?background=false").json()
    assert job["missing"] >= 1
    missing = client.get("/api/tracks/missing").json()
    assert [t["title"] for t in missing] == ["Beta"]
    assert all(t["title"] != "Beta" for t in client.get("/api/tracks").json())
    # Restore file → rescan clears missing flag
    make_wav(music / "Artist A" / "Album X" / "02 b.wav", tags={"title": "Beta", "artist": "Artist A"})
    client.post("/api/scan?background=false")
    assert client.get("/api/tracks/missing").json() == []
    # Unchanged files are not re-read
    job = client.post("/api/scan?background=false").json()
    assert job["unchanged"] == job["total"] and job["added"] == 0


def test_background_scan_progress(env):
    client, music, _ = env
    make_wav(music / "new" / "n.wav", tags={"title": "Newcomer"})
    job = client.post("/api/scan").json()
    import time
    for _ in range(100):
        status = client.get(f"/api/scan/{job['id']}").json()
        if status["status"] == "finished":
            break
        time.sleep(0.05)
    assert status["status"] == "finished" and status["done"] == status["total"] and status["added"] == 1
    assert client.get("/api/scan/does-not-exist").status_code == 404


def test_duplicates_dry_run_and_quarantine_restore(env):
    client, music, tmp = env
    dup = client.get("/api/duplicates").json()
    assert dup["dry_run"] is True and len(dup["by_hash"]) == 1
    group = dup["by_hash"][0]["tracks"]
    assert len(group) == 2
    copy = next(t for t in group if "copy of a" in t["path"])
    # Dry run moves nothing
    plan = client.post("/api/duplicates/quarantine", json={"track_ids": [copy["id"]]}).json()
    assert plan["dry_run"] is True and Path(copy["path"]).exists()
    # Confirmed run moves into quarantine with a manifest
    done = client.post("/api/duplicates/quarantine", json={"track_ids": [copy["id"]], "confirm": True}).json()
    assert done["items"][0]["status"] == "moved" and not Path(copy["path"]).exists()
    assert Path(done["manifest"]).is_file()
    assert client.get("/api/duplicates").json()["by_hash"] == []
    restored = client.post(f"/api/quarantine/{done['batch']}/restore").json()
    assert restored["restored"] == [copy["id"]] and Path(copy["path"]).exists()


def test_settings_and_import(env):
    client, _, tmp = env
    s = client.put("/api/settings", json={"values": {"theme": "album", "reduce_motion": True}}).json()
    assert s["theme"] == "album" and s["reduce_motion"] is True
    assert client.put("/api/settings", json={"values": {"evil": 1}}).status_code == 400
    src = make_wav(tmp / "upload.wav", tags={"title": "Uploaded"})
    with src.open("rb") as fh:
        r = client.post("/api/import", files=[("files", ("../../evil/upload.wav", fh, "audio/wav")),
                                              ("files", ("notes.txt", b"hi", "text/plain"))])
    assert r.status_code == 201
    results = r.json()["results"]
    assert results[0]["status"] == "added" and results[1]["status"] == "rejected"
    track = client.get(f"/api/tracks/{results[0]['track_id']}").json()
    assert track["title"] == "Uploaded" and "evil" not in track["path"]
    assert client.get(f"/api/stream/{track['id']}").status_code == 200


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg not installed")
def test_real_codecs_mp3_flac_ogg(env):
    client, music, _ = env
    make_ffmpeg(music / "codecs" / "t.mp3", ["-c:a", "libmp3lame", "-b:a", "128k"], "MP3 Song", "Enc", "Codecs")
    make_ffmpeg(music / "codecs" / "t.flac", ["-c:a", "flac"], "FLAC Song", "Enc", "Codecs")
    make_ffmpeg(music / "codecs" / "t.ogg", ["-c:a", "libvorbis"], "OGG Song", "Enc", "Codecs")
    make_ffmpeg(music / "codecs" / "t.aiff", ["-c:a", "pcm_s16be"], "AIFF Song", "Enc", "Codecs")
    client.post("/api/scan?background=false")
    rows = {t["format"]: t for t in client.get("/api/tracks").json() if "/codecs/" in t["path"].replace("\\", "/")}
    assert rows["mp3"]["title"] == "MP3 Song" and rows["mp3"]["mime"] == "audio/mpeg" and rows["mp3"]["bitrate"]
    assert rows["flac"]["title"] == "FLAC Song" and rows["flac"]["sample_rate"]
    assert rows["ogg"]["title"] == "OGG Song"
    assert rows["aiff"]["playable"] is False  # tags readable but not browser-playable
    for fmt in ("mp3", "flac", "ogg"):
        assert abs(rows[fmt]["duration"] - 2.0) < 0.2
        assert rows[fmt]["playable"] is True
