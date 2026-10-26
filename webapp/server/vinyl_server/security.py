"""Path safety helpers: only files inside user-approved folders are served."""

from __future__ import annotations

import os
import re
from pathlib import Path


def is_within(path: Path, root: Path) -> bool:
    """True if the *resolved* path is ``root`` or located beneath it."""
    try:
        rp = path.resolve()
        rr = root.resolve()
    except OSError:
        return False
    try:
        rp.relative_to(rr)
        return True
    except ValueError:
        return False


_UNSAFE = re.compile(r"[^\w.\- ()\[\]&,'!]+", re.UNICODE)


def safe_filename(name: str) -> str:
    """Strip directory components and dangerous characters from an uploaded name."""
    base = os.path.basename(name.replace("\\", "/")).strip()
    base = _UNSAFE.sub("_", base).strip(". ")
    return base[:200] or "upload"
