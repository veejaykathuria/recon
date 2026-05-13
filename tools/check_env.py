"""Ping Neo4j and Kimchi to verify env config.

Prints PASS/FAIL per service. Exits 0 always (informational).
"""
from __future__ import annotations

import json
import os
import socket
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse


def _load_dotenv():
    """Lightweight .env loader (no python-dotenv dep)."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidate = os.path.join(os.path.dirname(here), ".env")
    if not os.path.exists(candidate):
        return
    try:
        with open(candidate, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


def check_neo4j() -> tuple[bool, str]:
    uri = os.environ.get("NEO4J_URI", "")
    user = os.environ.get("NEO4J_USERNAME", "")
    pwd = os.environ.get("NEO4J_PASSWORD", "")
    if not uri:
        return False, "NEO4J_URI not set"

    # Try the official driver first
    try:
        import neo4j  # type: ignore
        try:
            drv = neo4j.GraphDatabase.driver(uri, auth=neo4j.basic_auth(user, pwd))
            drv.verify_connectivity()
            drv.close()
            return True, "driver connectivity ok"
        except Exception as e:
            return False, f"driver error: {e}"
    except ImportError:
        # Fallback: TCP connect to the host:port from URI
        try:
            parsed = urlparse(uri)
            host = parsed.hostname or ""
            port = parsed.port or 7687
            if not host:
                return False, "could not parse host from NEO4J_URI"
            with socket.create_connection((host, port), timeout=5):
                return True, f"tcp ok {host}:{port} (neo4j driver not installed, skipped auth)"
        except Exception as e:
            return False, f"tcp failed: {e}"


def check_kimchi() -> tuple[bool, str]:
    base = os.environ.get("KIMCHI_BASE_URL", "")
    key = os.environ.get("KIMCHI_API_KEY", "")
    if not base:
        return False, "KIMCHI_BASE_URL not set"

    url = base.rstrip("/") + "/models"
    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", "recon-check-env/1.0")
    if key:
        req.add_header("Authorization", f"Bearer {key}")
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            code = resp.getcode()
            if 200 <= code < 300:
                return True, f"GET /models -> {code}"
            return False, f"GET /models -> {code}"
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return False, "401 unauthorized (check KIMCHI_API_KEY)"
        return False, f"http {e.code}"
    except urllib.error.URLError as e:
        return False, f"unreachable: {e.reason}"
    except Exception as e:
        return False, f"error: {e}"


def main() -> int:
    _load_dotenv()
    results = []
    ok, msg = check_neo4j()
    print(f"[{'PASS' if ok else 'FAIL'}] neo4j: {msg}")
    results.append(("neo4j", ok))
    ok, msg = check_kimchi()
    print(f"[{'PASS' if ok else 'FAIL'}] kimchi: {msg}")
    results.append(("kimchi", ok))
    # Always exit 0; this is informational, not gating.
    return 0


if __name__ == "__main__":
    sys.exit(main())
