import math, struct, wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import create_app, parse_range


def make_wav(p: Path, secs=1):
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
        w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * 440 * i / 8000)))
                               for i in range(8000 * secs)))


@pytest.fixture
def env(tmp_path):
    music = tmp_path / "music"; music.mkdir()
    make_wav(music / "a.wav"); make_wav(music / "b.wav")  # 내용이 같아 해시 중복
    (music / "notes.txt").write_text("x")
    c = TestClient(create_app(tmp_path / "data"))
    assert c.post("/api/folders", json={"path": str(music)}).status_code == 200
    assert c.post("/api/scan?background=false").json()["status"] == "finished"
    return c, music, tmp_path


def test_scan_lists_audio_only(env):
    c, _, _ = env
    t = c.get("/api/tracks").json()
    assert sorted(x["title"] for x in t) == ["a", "b"]
    assert all(x["playable"] == 1 and x["duration"] > 0.9 for x in t)


def test_parse_range():
    assert parse_range("bytes=0-9", 100) == (0, 9)
    assert parse_range("bytes=-10", 100) == (90, 99)
    assert parse_range("bytes=50-", 100) == (50, 99)
    for bad in ("bytes=100-", "bytes=9-1", "items=0-1"):
        with pytest.raises(ValueError):
            parse_range(bad, 100)


def test_range_206_and_416(env):
    c, _, _ = env
    tid = c.get("/api/tracks").json()[0]["id"]
    r = c.get(f"/api/stream/{tid}", headers={"Range": "bytes=100-199"})
    assert r.status_code == 206 and len(r.content) == 100
    assert r.headers["content-range"].startswith("bytes 100-199/")
    assert c.get(f"/api/stream/{tid}", headers={"Range": "bytes=999999-"}).status_code == 416
    assert c.get(f"/api/stream/{tid}").status_code == 200


def test_path_safety(env):
    c, music, tmp = env
    assert c.get("/api/stream/9999").status_code == 404
    assert c.post("/api/folders", json={"path": str(tmp / "nope")}).status_code == 400
    outside = tmp / "outside"; outside.mkdir(); make_wav(outside / "x.wav")
    try:
        (music / "link.wav").symlink_to(outside / "x.wav")
    except OSError:
        pytest.skip("symlink 권한 없음")
    c.post("/api/scan?background=false")
    assert len(c.get("/api/tracks").json()) == 2  # 허용 폴더 밖 심볼릭 링크는 등록되지 않음


def test_playlist_crud_order_and_validation(env):
    c, _, _ = env
    ids = [t["id"] for t in c.get("/api/tracks").json()]
    pid = c.post("/api/playlists", json={"name": "Mix"}).json()["id"]
    got = c.put(f"/api/playlists/{pid}/tracks", json={"track_ids": ids[::-1]}).json()
    assert [t["id"] for t in got] == ids[::-1]
    assert c.put(f"/api/playlists/{pid}/tracks", json={"track_ids": [ids[0], 9999]}).status_code == 404
    assert len(c.get(f"/api/playlists/{pid}/tracks").json()) == 2  # 실패한 교체는 기존 내용을 보존
    assert c.post("/api/playlists", json={"name": "  "}).status_code == 400
    assert c.patch(f"/api/playlists/{pid}", json={"name": "New"}).json()["name"] == "New"
    c.delete(f"/api/playlists/{pid}")
    assert c.get("/api/playlists").json() == []


def test_liked_and_history(env):
    c, _, _ = env
    tid = c.get("/api/tracks").json()[0]["id"]
    c.put(f"/api/liked/{tid}")
    assert c.get("/api/liked").json()[0]["id"] == tid
    c.delete(f"/api/liked/{tid}")
    assert c.get("/api/liked").json() == []
    c.post(f"/api/history/{tid}")
    assert c.get("/api/history").json()[0]["id"] == tid


def test_persistence_across_restart(env):
    c, _, tmp = env
    c2 = TestClient(create_app(tmp / "data"))
    assert len(c2.get("/api/tracks").json()) == 2


def test_missing_and_duplicates(env):
    c, music, _ = env
    assert len(c.get("/api/duplicates").json()["by_hash"]) == 1
    (music / "b.wav").unlink()
    c.post("/api/scan?background=false")
    assert len(c.get("/api/tracks/missing").json()) == 1
    assert len(c.get("/api/tracks").json()) == 1
