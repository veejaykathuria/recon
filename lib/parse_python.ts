// Pure-TypeScript Python source extractor.
// Replaces tools/parse_python.py for the Vercel runtime (no python3 there).
//
// Captures what the graph needs:
//   - files (path, language, loc)
//   - functions: qname, name, file_path, start_line, end_line, signature
//   - calls: function -> function (best-effort, same-file then global-unique by name)
//   - imports: file -> file (resolves `import x.y` / `from x.y import z`)
//
// This is a heuristic regex-based extractor. It is NOT a full Python parser.
// It works for conventionally-written Python: `def`, `async def`, `class`,
// `import x.y`, `from x.y import z` at the top of files. Decorators are
// preserved; docstrings are skipped. Lossy on monkey-patched or dynamically-
// generated code, which is fine for a code-overview demo.

import fs from "node:fs";
import path from "node:path";

export interface ParsedRepoTS {
  repo: { url: string; name: string; sha: string };
  files: Array<{ path: string; language: string; loc: number }>;
  functions: Array<{
    qname: string;
    name: string;
    file_path: string;
    start_line: number;
    end_line: number;
    signature: string;
  }>;
  calls: Array<{ src_qname: string; dst_qname: string }>;
  imports: Array<{ src_path: string; dst_path: string }>;
  truncated: boolean;
}

const CAP_FILES = 500;
const CAP_FNS_PER_FILE = 200;
const CAP_FNS_TOTAL = 5000;

// Directory names we always skip.
const SKIP_DIRS = new Set([
  ".git", "node_modules", "__pycache__", ".venv", "venv", "env", ".env",
  "build", "dist", ".tox", ".mypy_cache", ".pytest_cache", ".ruff_cache",
  ".idea", ".vscode", "site-packages", ".eggs", ".coverage",
]);

const PY_BUILTINS = new Set([
  "print", "len", "range", "str", "int", "float", "list", "dict", "set",
  "tuple", "bool", "bytes", "open", "iter", "next", "enumerate", "zip",
  "map", "filter", "sorted", "reversed", "sum", "min", "max", "abs",
  "round", "type", "isinstance", "issubclass", "getattr", "setattr",
  "hasattr", "super", "object", "Exception", "ValueError", "TypeError",
  "KeyError", "IndexError", "RuntimeError", "AttributeError",
  "NotImplementedError", "StopIteration", "format", "repr", "id", "hash",
  "input", "vars", "dir", "callable", "all", "any", "chr", "ord", "hex",
  "oct", "bin", "pow", "divmod", "complex", "frozenset", "bytearray",
  "memoryview", "slice",
]);

function walk(root: string, files: string[], cap: number): void {
  if (files.length >= cap) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (files.length >= cap) return;
    if (e.name.startsWith(".") && SKIP_DIRS.has(e.name)) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(root, e.name), files, cap);
    } else if (e.isFile() && e.name.endsWith(".py")) {
      files.push(path.join(root, e.name));
    }
  }
}

function toModuleName(relPath: string): string {
  // e.g. "src/requests/sessions.py" -> "src.requests.sessions"
  // "src/requests/__init__.py" -> "src.requests"
  let p = relPath.replace(/\\/g, "/");
  if (p.endsWith("/__init__.py")) p = p.slice(0, -"/__init__.py".length);
  else if (p.endsWith(".py")) p = p.slice(0, -".py".length);
  return p.split("/").filter(Boolean).join(".");
}

interface FnFrame {
  name: string;
  qname: string;
  indent: number;
  startLine: number;
  signatureFirstLine: string;
  classStack: string[];
}

function stripComment(line: string): string {
  // Naive — does not respect strings. Good enough for call detection.
  const idx = line.indexOf("#");
  return idx >= 0 ? line.slice(0, idx) : line;
}

function indentOf(line: string): number {
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
  return i;
}

function extractCalls(body: string, knownByName: Map<string, string[]>, ownQname: string): string[] {
  // Find identifier(  occurrences. Resolve by name to a known qname.
  // If a name maps to a unique qname, accept; if ambiguous, drop.
  const out = new Set<string>();
  const re = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const name = m[1];
    if (PY_BUILTINS.has(name)) continue;
    if (name === "def" || name === "class" || name === "if" || name === "for"
        || name === "while" || name === "with" || name === "return"
        || name === "yield" || name === "lambda" || name === "self"
        || name === "cls" || name === "True" || name === "False"
        || name === "None") continue;
    const targets = knownByName.get(name);
    if (!targets || targets.length !== 1) continue; // ambiguous or unknown — drop
    if (targets[0] === ownQname) continue; // self-call
    out.add(targets[0]);
  }
  return Array.from(out);
}

export interface ParsePythonOptions {
  repoUrl: string;
  repoName: string;
  repoSha: string;
}

export function parsePythonRepo(rootDir: string, opts: ParsePythonOptions): ParsedRepoTS {
  const result: ParsedRepoTS = {
    repo: { url: opts.repoUrl, name: opts.repoName, sha: opts.repoSha },
    files: [],
    functions: [],
    calls: [],
    imports: [],
    truncated: false,
  };

  const absRoot = path.resolve(rootDir);
  const allFiles: string[] = [];
  walk(absRoot, allFiles, CAP_FILES + 1);
  if (allFiles.length > CAP_FILES) {
    result.truncated = true;
    allFiles.length = CAP_FILES;
  }

  // Pass 1: parse files, collect file rows + function rows + a tentative call body per function.
  interface FnRow {
    qname: string;
    name: string;
    file_path: string;
    start_line: number;
    end_line: number;
    signature: string;
    body: string;
  }
  const fileRows: ParsedRepoTS["files"] = [];
  const fnRows: FnRow[] = [];
  // module -> abs file path; used to resolve `import x.y` to a file.
  const modToFile = new Map<string, string>();
  // rel path -> module name (for imports edge src/dst)
  const fileToModule = new Map<string, string>();

  for (const abs of allFiles) {
    if (fnRows.length >= CAP_FNS_TOTAL) break;
    let text: string;
    try {
      text = fs.readFileSync(abs, "utf-8");
    } catch {
      continue;
    }
    const rel = path.relative(absRoot, abs).replace(/\\/g, "/");
    const lines = text.split(/\r?\n/);
    const loc = lines.length;
    fileRows.push({ path: rel, language: "Python", loc });
    const moduleName = toModuleName(rel);
    fileToModule.set(rel, moduleName);
    modToFile.set(moduleName, abs);

    const stack: FnFrame[] = [];
    const classStack: { name: string; indent: number }[] = [];
    let fnsInThisFile = 0;

    const DEF_RE = /^(\s*)(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)?/;
    const CLASS_RE = /^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)\s*[(:]/;

    const closeStackTo = (newIndent: number, atLine: number): void => {
      while (stack.length && stack[stack.length - 1].indent >= newIndent) {
        const top = stack.pop()!;
        // record fn body lines now? We'll fill body in a second pass since we
        // need the actual body lines collected during.
      }
      while (classStack.length && classStack[classStack.length - 1].indent >= newIndent) {
        classStack.pop();
      }
    };

    // Collect function ranges using a simple indentation tracker.
    interface Range { qname: string; name: string; start: number; end: number; signature: string }
    const ranges: Range[] = [];
    const openFns: Array<Range & { indent: number }> = [];
    const openClasses: Array<{ name: string; indent: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      if (fnsInThisFile >= CAP_FNS_PER_FILE) break;
      const raw = lines[i];
      // Skip blank lines for nesting purposes only — they don't close blocks.
      if (raw.trim() === "" || raw.trim().startsWith("#")) continue;
      const ind = indentOf(raw);
      // Close any open fns/classes whose indent is >= current AND we're at a sibling/outer level.
      while (openFns.length && openFns[openFns.length - 1].indent >= ind) {
        const f = openFns.pop()!;
        f.end = i; // exclusive end (line index)
        ranges.push(f);
      }
      while (openClasses.length && openClasses[openClasses.length - 1].indent >= ind) {
        openClasses.pop();
      }
      const cls = raw.match(CLASS_RE);
      if (cls) {
        openClasses.push({ name: cls[2], indent: ind });
        continue;
      }
      const def = raw.match(DEF_RE);
      if (def) {
        const name = def[2];
        const classPath = openClasses.map((c) => c.name).join(".");
        const qname = `${moduleName}:${classPath ? classPath + "." : ""}${name}`;
        const signature = raw.trim();
        const fnRange: Range & { indent: number } = {
          qname, name, indent: ind, start: i + 1, end: i + 1, signature,
        };
        openFns.push(fnRange);
        fnsInThisFile++;
        continue;
      }
    }
    while (openFns.length) {
      const f = openFns.pop()!;
      f.end = lines.length;
      ranges.push(f);
    }

    // Extract function bodies for call analysis.
    for (const r of ranges) {
      const bodyLines = lines.slice(r.start, r.end).map(stripComment);
      const body = bodyLines.join("\n");
      fnRows.push({
        qname: r.qname,
        name: r.name,
        file_path: rel,
        start_line: r.start,
        end_line: r.end,
        signature: r.signature,
        body,
      });
      if (fnRows.length >= CAP_FNS_TOTAL) break;
    }

    // Imports: scan top of file for import / from lines.
    const IMPORT_RE = /^\s*import\s+([\w.]+)(?:\s+as\s+\w+)?\s*$/;
    const FROM_RE = /^\s*from\s+(\.*[\w.]*)\s+import\s+/;
    for (let i = 0; i < Math.min(lines.length, 200); i++) {
      const ln = lines[i];
      const im = ln.match(IMPORT_RE);
      if (im) {
        const mod = im[1];
        // We'll resolve later when modToFile is complete.
        result.imports.push({ src_path: rel, dst_path: `MOD::${mod}` });
        continue;
      }
      const fr = ln.match(FROM_RE);
      if (fr) {
        let mod = fr[1];
        if (mod.startsWith(".")) {
          // Relative import. Resolve from current module.
          const dots = mod.match(/^\.+/)![0].length;
          const rest = mod.slice(dots);
          const parts = moduleName.split(".");
          const baseParts = parts.slice(0, Math.max(0, parts.length - (dots - 1) - (rest ? 0 : 0)));
          mod = [...baseParts, rest].filter(Boolean).join(".");
        }
        result.imports.push({ src_path: rel, dst_path: `MOD::${mod}` });
      }
    }
  }

  // Resolve MOD:: imports to file paths now that modToFile is populated.
  result.imports = result.imports
    .map((imp) => {
      if (!imp.dst_path.startsWith("MOD::")) return imp;
      const mod = imp.dst_path.slice("MOD::".length);
      // Longest-prefix match against known modules.
      const candidates: string[] = [];
      for (const known of modToFile.keys()) {
        if (mod === known || mod.startsWith(known + ".")) candidates.push(known);
      }
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.length - a.length);
      const absDst = modToFile.get(candidates[0]);
      if (!absDst) return null;
      const relDst = path.relative(absRoot, absDst).replace(/\\/g, "/");
      if (relDst === imp.src_path) return null;
      return { src_path: imp.src_path, dst_path: relDst };
    })
    .filter((x): x is { src_path: string; dst_path: string } => !!x);

  // Build name -> qnames index for call resolution.
  const byName = new Map<string, string[]>();
  for (const f of fnRows) {
    const arr = byName.get(f.name) || [];
    arr.push(f.qname);
    byName.set(f.name, arr);
  }

  // Pass 2: extract calls.
  for (const f of fnRows) {
    const targets = extractCalls(f.body, byName, f.qname);
    for (const t of targets) {
      result.calls.push({ src_qname: f.qname, dst_qname: t });
    }
  }

  // Strip body field before returning.
  result.files = fileRows;
  result.functions = fnRows.map(({ body, ...rest }) => rest);

  return result;
}
