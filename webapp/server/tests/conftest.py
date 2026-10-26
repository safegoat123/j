import math
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vinyl_server.app import create_app  # noqa: E402
from vinyl_server.config import Settings  # noqa: E402


def make_wav(path: Path, seconds: float = 1.0, freq: float = 440.0, tags: dict | None = None) -> Path:
    """Generate a mono 8 kHz sine-wave WAV (no external audio needed)."""
    rate = 8000
    frames = b"".join(
        struct.pack("<h", int(8000 * math.sin(2 * math.pi * freq * i / rate))) for i in range(int(rate * seconds))
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames)
    if tags:
        from mutagen.id3 import APIC, TALB, TCON, TDRC, TIT2, TPE1, TRCK
        from mutagen.wave import WAVE

        audio = WAVE(str(path))
        audio.add_tags()
        mapping = {"title": TIT2, "artist": TPE1, "album": TALB, "genre": TCON, "date": TDRC, "track": TRCK}
        for k, frame in mapping.items():
            if k in tags:
                audio.tags.add(frame(encoding=3, text=str(tags[k])))
        if tags.get("cover"):
            audio.tags.add(APIC(encoding=3, mime="image/png", type=3, desc="cover", data=tags["cover"]))
        audio.save()
    return path


# 1x1 transparent PNG
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7"
    "d6a5bd0000000049454e44ae426082"
)

HAS_FFMPEG = shutil.which("ffmpeg") is not None


def make_ffmpeg(path: Path, codec_args: list[str], title: str, artist: str, album: str) -> Path | None:
    if not HAS_FFMPEG:
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=2",
           *codec_args, "-metadata", f"title={title}", "-metadata", f"artist={artist}",
           "-metadata", f"album={album}", "-metadata", "track=1", str(path)]
    subprocess.run(cmd, check=True)
    return path


@pytest.fixture()
def env(tmp_path: Path):
    music = tmp_path / "music"
    make_wav(music / "Artist A" / "Album X" / "01 a.wav",
             tags={"title": "Alpha", "artist": "Artist A", "album": "Album X", "genre": "Jazz", "date": "2001",
                   "track": "1/2", "cover": PNG})
    make_wav(music / "Artist A" / "Album X" / "02 b.wav", freq=550,
             tags={"title": "Beta", "artist": "Artist A", "album": "Album X", "genre": "Jazz", "date": "2001",
                   "track": "2/2"})
    # Exact duplicate of a.wav in another folder
    dup = music / "dupes" / "copy of a.wav"
    dup.parent.mkdir(parents=True)
    shutil.copy(music / "Artist A" / "Album X" / "01 a.wav", dup)
    # Untagged file → title falls back to stem
    make_wav(music / "loose" / "untitled-take.wav", freq=660)
    # AIFF-like file that is not browser playable (empty/corrupt content still indexed with error)
    (music / "loose" / "broken.aiff").write_bytes(b"not really aiff")

    data = tmp_path / "data"
    settings = Settings(data_dir=data, music_dir=None, cors_origins=["http://127.0.0.1:3000"])
    app = create_app(settings)
    client = TestClient(app)
    r = client.post("/api/folders", json={"path": str(music)})
    assert r.status_code == 201, r.text
    job = client.post("/api/scan?background=false").json()
    assert job["status"] == "finished", job
    yield client, music, tmp_path
    app.state.db.close()
