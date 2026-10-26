"""Metadata and cover extraction using Mutagen.

Reading tags and *playing* a file are different concerns: Mutagen can read
AIFF tags, but most browsers cannot decode AIFF. ``BROWSER_PLAYABLE`` marks the
formats that the frontend is allowed to stream to an ``<audio>`` element.
"""

from __future__ import annotations

import base64
import hashlib
import mimetypes
from pathlib import Path
from typing import Any

import mutagen
from mutagen.flac import Picture

AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".aiff", ".aif", ".wma"}
# Formats commonly decodable by Chromium/Firefox/Safari through <audio>.
BROWSER_PLAYABLE = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus"}

MIME_BY_EXT = {
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/ogg",
    ".aiff": "audio/aiff",
    ".aif": "audio/aiff",
    ".wma": "audio/x-ms-wma",
}

FOLDER_COVER_NAMES = ("cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.png", "front.jpg", "album.jpg")


# Easy-key -> ID3 frame, used when Mutagen's easy mode returns raw ID3 frames
# (it does for WAV and AIFF containers).
ID3_FRAMES = {
    "title": "TIT2", "artist": "TPE1", "album": "TALB", "albumartist": "TPE2", "genre": "TCON",
    "date": "TDRC", "year": "TYER", "originaldate": "TDOR", "tracknumber": "TRCK", "discnumber": "TPOS",
}


def _first(tags: Any, *keys: str) -> str | None:
    if not tags:
        return None
    if hasattr(tags, "getall"):  # raw ID3 container
        for key in keys:
            frame = ID3_FRAMES.get(key)
            if not frame:
                continue
            frames = tags.getall(frame)
            if frames and frames[0].text:
                s = str(frames[0].text[0]).strip()
                if s:
                    return s
        return None
    for key in keys:
        try:
            value = tags.get(key)
        except Exception:  # some tag containers raise on unknown keys
            value = None
        if value:
            v = value[0] if isinstance(value, (list, tuple)) else value
            s = str(v).strip()
            if s:
                return s
    return None


def _to_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value).split("/")[0].strip())
    except (TypeError, ValueError):
        return None


def _year(value: str | None) -> int | None:
    if not value:
        return None
    digits = "".join(ch for ch in str(value)[:4] if ch.isdigit())
    return int(digits) if len(digits) == 4 else None


def normalize_key(*parts: str | None) -> str:
    """Stable, URL-safe grouping key for albums/artists (case-insensitive)."""
    raw = "\x1f".join((p or "").strip().casefold() for p in parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def read_metadata(path: Path) -> dict[str, Any]:
    """Return a dict of tag/stream info. Never raises: errors go into ``error``."""
    ext = path.suffix.lower()
    meta: dict[str, Any] = {
        "title": path.stem,
        "artist": None,
        "album": None,
        "album_artist": None,
        "genre": None,
        "year": None,
        "track_number": None,
        "disc_number": None,
        "duration": None,
        "bitrate": None,
        "sample_rate": None,
        "bit_depth": None,
        "channels": None,
        "format": ext.lstrip("."),
        "mime": MIME_BY_EXT.get(ext) or mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        "error": None,
    }
    try:
        audio = mutagen.File(str(path), easy=True)
        if audio is None:
            meta["error"] = "Unrecognised audio container"
            return meta
        tags = audio.tags
        meta.update(
            title=_first(tags, "title") or path.stem,
            artist=_first(tags, "artist"),
            album=_first(tags, "album"),
            album_artist=_first(tags, "albumartist", "album artist", "album_artist"),
            genre=_first(tags, "genre"),
            year=_year(_first(tags, "date", "year", "originaldate")),
            track_number=_to_int(_first(tags, "tracknumber")),
            disc_number=_to_int(_first(tags, "discnumber")),
        )
        info = getattr(audio, "info", None)
        if info is not None:
            meta.update(
                duration=float(getattr(info, "length", 0) or 0) or None,
                bitrate=int(getattr(info, "bitrate", 0) or 0) or None,
                sample_rate=int(getattr(info, "sample_rate", 0) or 0) or None,
                bit_depth=int(getattr(info, "bits_per_sample", 0) or 0) or None,
                channels=int(getattr(info, "channels", 0) or 0) or None,
            )
    except Exception as exc:  # corrupt files must not abort a scan
        meta["error"] = f"{type(exc).__name__}: {exc}"[:300]
    return meta


def _embedded_cover(path: Path) -> tuple[bytes, str] | None:
    try:
        audio = mutagen.File(str(path))
    except Exception:
        return None
    if audio is None:
        return None
    # FLAC
    pictures = getattr(audio, "pictures", None)
    if pictures:
        pic = sorted(pictures, key=lambda p: 0 if p.type == 3 else 1)[0]
        return pic.data, pic.mime or "image/jpeg"
    tags = audio.tags
    if not tags:
        return None
    try:
        keys = list(tags.keys())
    except Exception:
        keys = []
    # ID3 (MP3, AIFF, WAV)
    for key in keys:
        if str(key).startswith("APIC"):
            frame = tags[key]
            return frame.data, frame.mime or "image/jpeg"
    # MP4
    if "covr" in keys:
        covr = tags["covr"]
        if covr:
            img = covr[0]
            fmt = getattr(img, "imageformat", None)
            return bytes(img), "image/png" if fmt == 14 else "image/jpeg"
    # Vorbis / Opus
    if "metadata_block_picture" in keys:
        for b64 in tags["metadata_block_picture"]:
            try:
                pic = Picture(base64.b64decode(b64))
                return pic.data, pic.mime or "image/jpeg"
            except Exception:
                continue
    return None


def extract_cover(path: Path) -> tuple[bytes, str] | None:
    """Embedded artwork first, then a cover image next to the file."""
    found = _embedded_cover(path)
    if found and found[0]:
        return found
    try:
        siblings = {p.name.lower(): p for p in path.parent.iterdir() if p.is_file()}
    except OSError:
        return None
    for name in FOLDER_COVER_NAMES:
        p = siblings.get(name)
        if p is not None:
            try:
                return p.read_bytes(), mimetypes.guess_type(p.name)[0] or "image/jpeg"
            except OSError:
                return None
    return None


def store_cover(path: Path, cover_dir: Path) -> tuple[str, str] | None:
    """Extract and cache a cover; returns (file name in cache, mime)."""
    cover = extract_cover(path)
    if not cover:
        return None
    data, mime = cover
    ext = ".png" if "png" in mime else ".webp" if "webp" in mime else ".jpg"
    name = hashlib.sha1(data).hexdigest() + ext
    cover_dir.mkdir(parents=True, exist_ok=True)
    target = cover_dir / name
    if not target.exists():
        target.write_bytes(data)
    return name, mime


def file_fingerprint(path: Path, chunk: int = 1024 * 1024) -> str:
    """Full SHA-1 of file contents (used for exact-duplicate detection)."""
    h = hashlib.sha1()
    with path.open("rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()
