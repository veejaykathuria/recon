// Shallow-clone a GitHub repo into a writable temp dir using isomorphic-git.
// Pure JS — works on Vercel functions, which have NO `git` CLI installed.

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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

function forceRemove(target: string): void {
  if (!fs.existsSync(target)) return;
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Best-effort second pass clearing read-only bits (Windows .git pack files).
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
  const name = repoNameFromUrl(repoUrl);
  const baseDir = path.join(os.tmpdir(), "recon");
  fs.mkdirSync(baseDir, { recursive: true });
  const target = path.join(baseDir, name);

  forceRemove(target);
  fs.mkdirSync(target, { recursive: true });

  // GitHub token (optional) for higher rate limits and private repos.
  const token = process.env.GITHUB_TOKEN || "";
  const onAuth = token ? () => ({ username: token, password: "x-oauth-basic" }) : undefined;

  await git.clone({
    fs,
    http,
    dir: target,
    url: repoUrl,
    singleBranch: true,
    depth: 1,
    // noTags reduces payload further for large repos.
    noTags: true,
    onAuth,
  });

  let sha = "";
  try {
    sha = await git.resolveRef({ fs, dir: target, ref: "HEAD" });
  } catch {
    sha = "";
  }

  console.log(`[clone] ${name} sha=${sha.slice(0, 7)} took=${Date.now() - t0}ms`);
  return { path: target, name, sha };
}
