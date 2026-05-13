// Fetch a GitHub repo as a tarball and extract to a writable temp dir.
//
// We deliberately avoid `git` and `isomorphic-git`:
//   - Vercel serverless functions have no `git` CLI installed.
//   - isomorphic-git tries to create symlinks for things like SSL cert
//     fixtures, and Windows blocks non-elevated symlink creation, so the
//     clone aborts with MultipleGitError.
// Plain HTTP + tar extraction sidesteps both.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { x as tarExtract } from "tar";

export interface CloneResult {
  path: string;
  name: string;
  sha: string;
}

export function repoNameFromUrl(url: string): string {
  const cleaned = url.trim().replace(/\/$/, "").replace(/\.git$/i, "");
  const last = cleaned.split("/").pop() || "";
  if (!last) throw new Error("could not derive repo name from URL");
  return last.replace(/[^A-Za-z0-9_.\-]/g, "_");
}

interface ParsedGithubUrl {
  owner: string;
  repo: string;
  ref: string; // "HEAD" if not specified
}

function parseGithubUrl(url: string): ParsedGithubUrl {
  // Accept: https://github.com/<owner>/<repo>[.git][/tree/<ref>]
  const m = url.match(
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/\s]+?)(?:\.git)?(?:\/tree\/([^\/\s]+))?\/?$/i
  );
  if (!m) throw new Error("not a recognizable GitHub URL");
  return { owner: m[1], repo: m[2], ref: m[3] || "HEAD" };
}

function forceRemove(target: string): void {
  if (!fs.existsSync(target)) return;
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    const stack: string[] = [target];
    while (stack.length) {
      const cur = stack.pop()!;
      try {
        const st = fs.statSync(cur);
        if (st.isDirectory()) {
          for (const child of fs.readdirSync(cur)) stack.push(path.join(cur, child));
          try { fs.rmdirSync(cur); } catch {}
        } else {
          try { fs.chmodSync(cur, 0o666); } catch {}
          try { fs.unlinkSync(cur); } catch {}
        }
      } catch {}
    }
  }
}

export async function cloneRepo(repoUrl: string): Promise<CloneResult> {
  const t0 = Date.now();
  if (!/^https?:\/\//i.test(repoUrl)) {
    throw new Error("invalid_repo_url");
  }
  const { owner, repo, ref } = parseGithubUrl(repoUrl);
  const name = repoNameFromUrl(repoUrl);
  const baseDir = path.join(os.tmpdir(), "recon");
  fs.mkdirSync(baseDir, { recursive: true });
  const target = path.join(baseDir, name);

  forceRemove(target);
  fs.mkdirSync(target, { recursive: true });

  // GitHub returns a gzipped tarball whose top-level dir is "<repo>-<sha>".
  // We strip one path component so files land directly under `target`.
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(ref)}`;

  const headers: Record<string, string> = {
    "User-Agent": "recon/0.1 (+https://github.com)",
    Accept: "application/vnd.github.v3.tarball",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl, { headers, redirect: "follow" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`github_api_${res.status}: ${body.slice(0, 200)}`);
  }
  if (!res.body) {
    throw new Error("github_empty_body");
  }

  // SHA: GitHub puts the resolved SHA in the redirect URL or in the ETag.
  // Easier: read it from the top-level tar directory name during extraction.
  let topDirSha = "";

  await pipeline(
    Readable.fromWeb(res.body as any),
    tarExtract({
      cwd: target,
      strip: 1,
      // Filter: only Python files + small text we'd want (README). Skip the
      // .git pack and binary fixtures. Also dodges any embedded symlinks.
      filter: (filePath: string) => {
        // filePath is e.g. "psf-requests-abc1234/src/requests/api.py"
        if (!topDirSha) {
          const m = filePath.match(/^[^/]+-([a-f0-9]{7,40})\//);
          if (m) topDirSha = m[1];
        }
        // Drop symlinks proactively at the entry level — keep regular files only.
        return /\.py$/i.test(filePath) || /(?:^|\/)(?:README|LICENSE)/i.test(filePath);
      },
      onwarn: () => { /* swallow tar warnings */ },
      // Don't follow / create symlinks — tar will treat them as regular file
      // entries if encountered, but our filter already drops the cert fixtures.
      preservePaths: false,
      unlink: true,
    })
  );

  console.log(`[clone] ${name} sha=${topDirSha.slice(0, 7)} took=${Date.now() - t0}ms`);
  return { path: target, name, sha: topDirSha };
}
