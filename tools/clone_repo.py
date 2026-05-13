"""Shallow-clone a GitHub repo into .tmp/<name>/.

Usage:
    python tools/clone_repo.py <repo_url> [<target_dir>]

Prints JSON {path, name, sha} to stdout.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import stat
import subprocess
import sys
from pathlib import Path


def _force_writable(func, path, exc_info):
    """rmtree onerror hook: clear read-only bit then retry.
    Windows marks .git pack files as read-only; rmtree fails without this.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def repo_name_from_url(url: str) -> str:
    # Strip .git, trailing slash, query, fragment
    cleaned = url.strip().rstrip("/")
    cleaned = re.sub(r"\.git$", "", cleaned)
    cleaned = cleaned.split("?", 1)[0].split("#", 1)[0]
    name = cleaned.rsplit("/", 1)[-1]
    if not name:
        raise ValueError(f"Could not derive repo name from URL: {url}")
    # Make filesystem-safe
    return re.sub(r"[^A-Za-z0-9_.-]", "_", name)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: clone_repo.py <repo_url> [<target_dir>]", file=sys.stderr)
        return 2
    repo_url = argv[1]
    name = repo_name_from_url(repo_url)

    if len(argv) >= 3:
        target = Path(argv[2]).resolve()
    else:
        # Resolve .tmp/<name> relative to repo root (parent of tools/)
        repo_root = Path(__file__).resolve().parent.parent
        target = repo_root / ".tmp" / name

    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists():
        shutil.rmtree(target, onerror=_force_writable)
        if target.exists():
            print(json.dumps({"error": "clone_failed", "message": f"could not remove existing {target}"}))
            return 1

    # Shallow clone
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, str(target)],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        print(
            json.dumps(
                {
                    "error": "clone_failed",
                    "message": (e.stderr or e.stdout or str(e)).strip(),
                }
            )
        )
        return 1
    except FileNotFoundError:
        print(json.dumps({"error": "git_not_installed"}))
        return 1

    # Resolve HEAD SHA
    sha = ""
    try:
        r = subprocess.run(
            ["git", "-C", str(target), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
        sha = r.stdout.strip()
    except Exception:
        sha = ""

    print(json.dumps({"path": str(target), "name": name, "sha": sha}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
