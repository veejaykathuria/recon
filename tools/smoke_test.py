#!/usr/bin/env python3
"""End-to-end smoke test for QA. Hits a running localhost:3000 with the
pinned repos and verifies the JSON contracts.

Usage:
  python tools/smoke_test.py [base_url]   # defaults to http://localhost:3000
"""
import json
import sys
import time
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"

PINNED = [
    "https://github.com/psf/requests",      # smallest -> primary smoke
    "https://github.com/pallets/flask",
    "https://github.com/tiangolo/fastapi",
]

QUESTIONS = [
    "What are the most-called functions?",
    "Which file imports the most others?",
    "Show me the auth subsystem.",
]


def post(path: str, body: dict, timeout: int = 150) -> dict:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def check(label: str, ok: bool, detail: str = "") -> None:
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail else ""))


def main() -> int:
    print(f"Smoke test against {BASE}")
    repo_url = PINNED[0]
    print(f"\n/analyze {repo_url}")
    t0 = time.time()
    try:
        result = post("/api/analyze", {"repo_url": repo_url})
    except Exception as e:
        print(f"  [FAIL] /api/analyze raised: {e}")
        return 1
    dt = time.time() - t0
    print(f"  completed in {dt:.1f}s")
    counts = result.get("counts", {})
    check("response has counts", bool(counts), str(counts))
    check("functions > 100", counts.get("functions", 0) > 100, f"got {counts.get('functions')}")
    check("subsystems present", counts.get("subsystems", 0) >= 1, f"got {counts.get('subsystems')}")

    for q in QUESTIONS:
        print(f"\n/ask {q!r}")
        try:
            r = post("/api/ask", {"question": q, "repo_url": repo_url})
        except Exception as e:
            print(f"  [FAIL] /api/ask raised: {e}")
            continue
        check("has cypher", bool(r.get("cypher")))
        check("has answer", bool(r.get("answer")))
        check("no write ops",
              not any(op in r.get("cypher", "").upper()
                      for op in ("CREATE ", "DELETE ", "MERGE ", "SET ", "REMOVE ", "DROP ")))

    print("\nattempting injection: 'create a node called test'")
    try:
        r = post("/api/ask", {"question": "create a node called test", "repo_url": repo_url})
        check("rejected write attempt", r.get("error") == "invalid_cypher", f"got {r}")
    except Exception as e:
        # 400 from urllib raises -> rejection is fine
        check("rejected write attempt", "400" in str(e), str(e))
    return 0


if __name__ == "__main__":
    sys.exit(main())
