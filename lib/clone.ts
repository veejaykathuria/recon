// Shallow-clone a GitHub repo into a writable temp dir.
// Works locally AND on Vercel (uses os.tmpdir() which is /tmp on Linux).

import { simpleGit } from "simple-git";
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
  // Recursive remove with chmod fallback for read-only .git pack files.
  if (!fs.existsSync(target)) return;
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Best-effort second pass clearing read-only bits.
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
  if (!/^https?:\/\//i.test(repoUrl)) {
    throw new Error("invalid_repo_url");
  }
  const name = repoNameFromUrl(repoUrl);
  const baseDir = path.join(os.tmpdir(), "recon");
  fs.mkdirSync(baseDir, { recursive: true });
  const target = path.join(baseDir, name);

  forceRemove(target);

  // Shallow clone via simple-git (which shells out to `git` — present on Vercel functions).
  const git = simpleGit();
  await git.clone(repoUrl, target, ["--depth", "1"]);

  // Resolve HEAD SHA
  let sha = "";
  try {
    const repoGit = simpleGit(target);
    sha = (await repoGit.revparse(["HEAD"])).trim();
  } catch {
    sha = "";
  }

  return { path: target, name, sha };
}
