"""Parse all .py files under a cloned repo and emit a structural JSON document.

Usage:
    python tools/parse_python.py <repo_path> <repo_url>

Output (stdout, single JSON object):
{
  "repo": {"url": "...", "name": "...", "sha": "..."},
  "files":     [{"path","language","loc"}],
  "functions": [{"qname","name","file_path","start_line","end_line","signature"}],
  "calls":     [{"src_qname","dst_qname"}],
  "imports":   [{"src_path","dst_path"}],
  "truncated": false
}

Caps: 500 files, 200 functions per file, 5000 functions total.
"""
from __future__ import annotations

import ast
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

MAX_FILES = 500
MAX_FNS_PER_FILE = 200
MAX_FNS_TOTAL = 5000

SKIP_DIRS = {
    ".git", ".hg", ".svn", "__pycache__", ".venv", "venv", "env",
    "node_modules", ".tox", ".mypy_cache", ".pytest_cache", "dist",
    "build", ".next", ".idea", ".vscode",
}


def repo_name_from_url(url: str) -> str:
    cleaned = url.strip().rstrip("/")
    cleaned = re.sub(r"\.git$", "", cleaned)
    cleaned = cleaned.split("?", 1)[0].split("#", 1)[0]
    return cleaned.rsplit("/", 1)[-1] or "repo"


def get_sha(repo_path: Path) -> str:
    try:
        r = subprocess.run(
            ["git", "-C", str(repo_path), "rev-parse", "HEAD"],
            check=True, capture_output=True, text=True,
        )
        return r.stdout.strip()
    except Exception:
        return ""


def discover_py_files(root: Path) -> List[Path]:
    found: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # In-place prune
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if fn.endswith(".py"):
                found.append(Path(dirpath) / fn)
                if len(found) >= MAX_FILES * 4:
                    # Hard ceiling to avoid pathological repos; we'll trim later
                    return found
    return found


def rel_posix(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except Exception:
        return path.as_posix()


def module_path_from_relpath(rel: str) -> str:
    """foo/bar/baz.py -> foo.bar.baz ; foo/bar/__init__.py -> foo.bar"""
    p = rel
    if p.endswith("/__init__.py"):
        p = p[: -len("/__init__.py")]
    elif p.endswith(".py"):
        p = p[:-3]
    return p.replace("/", ".")


def build_signature(node: ast.AST) -> str:
    """Render a compact signature string for a function/async def."""
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return ""
    args = node.args
    parts: List[str] = []
    pos_only = list(getattr(args, "posonlyargs", []) or [])
    pos = list(args.args or [])
    defaults = list(args.defaults or [])
    # defaults align to the tail of pos_only+pos
    all_pos = pos_only + pos
    n_defaults = len(defaults)
    default_offset = len(all_pos) - n_defaults

    def render_arg(a: ast.arg, default: Optional[ast.AST]) -> str:
        s = a.arg
        if a.annotation is not None:
            try:
                s += ": " + ast.unparse(a.annotation)
            except Exception:
                pass
        if default is not None:
            try:
                s += "=" + ast.unparse(default)
            except Exception:
                s += "=..."
        return s

    for i, a in enumerate(pos_only):
        d = defaults[i - default_offset] if i >= default_offset else None
        parts.append(render_arg(a, d))
    if pos_only:
        parts.append("/")
    for j, a in enumerate(pos):
        idx = len(pos_only) + j
        d = defaults[idx - default_offset] if idx >= default_offset else None
        parts.append(render_arg(a, d))
    if args.vararg:
        parts.append("*" + args.vararg.arg)
    elif args.kwonlyargs:
        parts.append("*")
    for k, a in enumerate(args.kwonlyargs or []):
        d = (args.kw_defaults or [])[k]
        parts.append(render_arg(a, d))
    if args.kwarg:
        parts.append("**" + args.kwarg.arg)

    sig = "(" + ", ".join(parts) + ")"
    if getattr(node, "returns", None) is not None:
        try:
            sig += " -> " + ast.unparse(node.returns)
        except Exception:
            pass
    return sig


def end_lineno_of(node: ast.AST) -> int:
    end = getattr(node, "end_lineno", None)
    if isinstance(end, int):
        return end
    # Fallback: max lineno among children
    best = getattr(node, "lineno", 0) or 0
    for child in ast.walk(node):
        ln = getattr(child, "lineno", None)
        if isinstance(ln, int) and ln > best:
            best = ln
    return best


class FunctionCollector(ast.NodeVisitor):
    def __init__(self, module: str, file_path: str):
        self.module = module
        self.file_path = file_path
        self.stack: List[str] = []  # class names for qname scoping
        self.fns: List[dict] = []
        self.fn_calls: List[Tuple[str, List[str]]] = []  # (src_qname, called_names)

    def _qname_for(self, name: str) -> str:
        scope = ".".join(self.stack)
        local = f"{scope}.{name}" if scope else name
        return f"{self.module}:{local}"

    def visit_ClassDef(self, node: ast.ClassDef):
        self.stack.append(node.name)
        self.generic_visit(node)
        self.stack.pop()

    def _visit_fn(self, node):
        if len(self.fns) >= MAX_FNS_PER_FILE:
            return
        qname = self._qname_for(node.name)
        signature = build_signature(node)
        self.fns.append({
            "qname": qname,
            "name": node.name,
            "file_path": self.file_path,
            "start_line": getattr(node, "lineno", 0) or 0,
            "end_line": end_lineno_of(node),
            "signature": signature,
        })
        # Gather call targets (names only; resolved later)
        called: List[str] = []
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                target = child.func
                if isinstance(target, ast.Name):
                    called.append(target.id)
                elif isinstance(target, ast.Attribute):
                    # Use the trailing attribute name; cheap heuristic
                    called.append(target.attr)
        self.fn_calls.append((qname, called))
        # Recurse to capture nested functions/classes
        # Treat as a new function scope: push name to stack? We keep qname based on class chain only.
        # Walking children explicitly:
        for child in node.body:
            self.visit(child)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._visit_fn(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._visit_fn(node)


def collect_imports(tree: ast.AST, current_module: str) -> List[str]:
    """Return list of imported dotted-module strings (best-effort, no relative-from resolution beyond level=1)."""
    out: List[str] = []
    base_parts = current_module.split(".") if current_module else []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name:
                    out.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            level = node.level or 0
            if level > 0:
                # Relative import: pop `level` from base parts, then append mod
                if level > len(base_parts):
                    continue
                anchor = base_parts[: len(base_parts) - level]
                if mod:
                    anchor = anchor + mod.split(".")
                if anchor:
                    out.append(".".join(anchor))
            else:
                if mod:
                    out.append(mod)
    return out


def main(argv: List[str]) -> int:
    if len(argv) < 3:
        print("usage: parse_python.py <repo_path> <repo_url>", file=sys.stderr)
        return 2
    repo_path = Path(argv[1]).resolve()
    repo_url = argv[2]
    repo_name = repo_name_from_url(repo_url)
    sha = get_sha(repo_path)

    py_files = discover_py_files(repo_path)
    py_files.sort(key=lambda p: rel_posix(p, repo_path))

    truncated = False
    if len(py_files) > MAX_FILES:
        truncated = True
        py_files = py_files[:MAX_FILES]

    # Pass 1: collect file records + module map + all function defs
    files_out: List[dict] = []
    module_to_relpath: Dict[str, str] = {}      # "pkg.mod" -> "pkg/mod.py"
    relpath_to_module: Dict[str, str] = {}
    file_imports_raw: Dict[str, List[str]] = {} # relpath -> list of imported module strings
    all_functions: List[dict] = []
    name_index: Dict[str, List[str]] = {}        # short name -> [qnames]
    qname_set: set = set()
    per_file_fn_qnames: Dict[str, List[str]] = {}  # relpath -> [qname]
    pending_calls: List[Tuple[str, str, List[str]]] = []  # (src_qname, src_file, called_names)

    total_fns = 0

    for fp in py_files:
        rel = rel_posix(fp, repo_path)
        module = module_path_from_relpath(rel)

        try:
            text = fp.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        loc = text.count("\n") + (0 if text.endswith("\n") else 1) if text else 0

        try:
            tree = ast.parse(text, filename=rel)
        except SyntaxError:
            files_out.append({"path": rel, "language": "python", "loc": loc})
            module_to_relpath[module] = rel
            relpath_to_module[rel] = module
            continue

        files_out.append({"path": rel, "language": "python", "loc": loc})
        module_to_relpath[module] = rel
        relpath_to_module[rel] = module

        # Imports
        file_imports_raw[rel] = collect_imports(tree, module)

        # Functions + within-file call targets
        if total_fns >= MAX_FNS_TOTAL:
            continue
        col = FunctionCollector(module=module, file_path=rel)
        col.visit(tree)

        room = MAX_FNS_TOTAL - total_fns
        fns_here = col.fns[:room]
        truncated = truncated or len(col.fns) > room or len(col.fns) >= MAX_FNS_PER_FILE
        all_functions.extend(fns_here)
        total_fns += len(fns_here)
        per_file_fn_qnames[rel] = [f["qname"] for f in fns_here]
        for f in fns_here:
            qname_set.add(f["qname"])
            name_index.setdefault(f["name"], []).append(f["qname"])
        # Attach calls only for fns we kept
        kept_qnames = {f["qname"] for f in fns_here}
        for src_qname, called_names in col.fn_calls:
            if src_qname in kept_qnames:
                pending_calls.append((src_qname, rel, called_names))

    # Resolve CALLS edges best-effort
    calls_out: List[dict] = []
    calls_seen: set = set()
    for src_qname, src_file, called_names in pending_calls:
        file_qnames = per_file_fn_qnames.get(src_file, [])
        for cname in called_names:
            if not cname or not cname.isidentifier():
                continue
            # 1) Same-file match by short name
            same_file = [q for q in file_qnames if q.rsplit(":", 1)[-1].rsplit(".", 1)[-1] == cname]
            target = None
            if len(same_file) == 1:
                target = same_file[0]
            else:
                candidates = name_index.get(cname, [])
                if len(candidates) == 1:
                    target = candidates[0]
                # If ambiguous, drop
            if target and target != src_qname:
                key = (src_qname, target)
                if key not in calls_seen:
                    calls_seen.add(key)
                    calls_out.append({"src_qname": src_qname, "dst_qname": target})

    # Resolve IMPORTS edges (file -> file)
    imports_out: List[dict] = []
    imports_seen: set = set()
    for src_rel, mods in file_imports_raw.items():
        for m in mods:
            if not m:
                continue
            # Try exact match, then progressively shorter prefixes
            target_rel = None
            parts = m.split(".")
            for i in range(len(parts), 0, -1):
                candidate = ".".join(parts[:i])
                if candidate in module_to_relpath:
                    target_rel = module_to_relpath[candidate]
                    break
            if target_rel and target_rel != src_rel:
                key = (src_rel, target_rel)
                if key not in imports_seen:
                    imports_seen.add(key)
                    imports_out.append({"src_path": src_rel, "dst_path": target_rel})

    payload = {
        "repo": {"url": repo_url, "name": repo_name, "sha": sha},
        "files": files_out,
        "functions": all_functions,
        "calls": calls_out,
        "imports": imports_out,
        "truncated": truncated,
    }
    sys.stdout.write(json.dumps(payload))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
