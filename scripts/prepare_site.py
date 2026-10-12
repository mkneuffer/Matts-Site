#!/usr/bin/env python3
"""Stage this buildless site's tracked public files, using only Python's stdlib."""

import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".deploy" / "site"
ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".ico"}


def safe_path(name):
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or ".." in path.parts
            or any(part.startswith(".") and part != ".htaccess" for part in path.parts)
            or not re.fullmatch(r"[A-Za-z0-9 _./()\-]+", name)):
        raise ValueError(f"Unsafe public path: {name!r}")
    if any(part in {"node_modules", "vendor", "uploads", "config"} for part in path.parts):
        raise ValueError(f"Private or server-managed path in public manifest: {name}")
    return path


def public_files(root=ROOT):
    tracked = set(subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=root).decode().rstrip("\0").split("\0"))
    selected = set()
    for line in (root / "deployment/public-files.txt").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        optional = line.startswith("? ")
        name = line[2:] if optional else line
        safe_path(name.rstrip("/"))
        matches = {p for p in tracked if p.startswith(name)} if name.endswith("/") else {name} & tracked
        if not matches and not optional:
            raise ValueError(f"Required public manifest entry is missing from Git: {name}")
        for match in matches:
            path = safe_path(match)
            if path.parts[0] == "images" and path.suffix.lower() not in ASSET_EXTENSIONS:
                raise ValueError(f"Unexpected non-image asset: {match}")
            if path.parts[0] == "Resume" and path.suffix.lower() != ".pdf":
                raise ValueError(f"Unexpected non-PDF résumé asset: {match}")
            candidate = root / match
            if any(parent.is_symlink() for parent in [candidate, *candidate.parents]):
                raise ValueError(f"Public path contains a symlink: {match}")
            if not candidate.is_file() or candidate.stat().st_size == 0:
                raise ValueError(f"Public file is missing or empty: {match}")
            selected.add(match)
    if "index.html" not in selected:
        raise ValueError("The public manifest must contain index.html")
    return sorted(selected)


def check_references(root, names):
    """Check local HTML/CSS links and this site's data-driven image/PDF paths."""
    known = set(names)
    for name in names:
        if Path(name).suffix not in {".html", ".css", ".js"}:
            continue
        text = (root / name).read_text()
        references = []
        if Path(name).suffix == ".html":
            references += re.findall(r"(?:src|href|data-alt-src)\s*=\s*[\"']([^\"']+)", text)
        if Path(name).suffix == ".css":
            references += re.findall(r"url\(\s*[\"']?([^\"')]+)", text)
        references += re.findall(r"[\"']((?:images/|Resume/)[^\"']+)[\"']", text)
        for reference in references:
            url = urlsplit(reference)
            if url.scheme or url.netloc or not url.path:
                continue
            relative = os.path.normpath(str(Path(name).parent / unquote(url.path).lstrip("/")))
            if relative not in known:
                raise ValueError(f"Missing public file referenced by {name}: {reference}")


def prepare():
    names = public_files()
    check_references(ROOT, names)
    if SOURCE.parent.is_symlink() or SOURCE.is_symlink():
        raise ValueError("Refusing to replace a symlinked staging directory")
    if SOURCE.exists():
        shutil.rmtree(SOURCE)
    for name in names:
        target = SOURCE / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
        target.chmod(0o644)
        # Stable file timestamps avoid re-uploading every file on each fresh checkout.
        timestamp = int(subprocess.check_output(
            ["git", "log", "-1", "--format=%ct", "--", name], cwd=ROOT).strip())
        os.utime(target, (timestamp, timestamp))
    total = sum((SOURCE / name).stat().st_size for name in names)
    print(f"Staged {len(names)} public files ({total:,} bytes) in .deploy/site/")


if __name__ == "__main__":
    try:
        prepare()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        raise SystemExit(f"Site preparation failed: {error}")
