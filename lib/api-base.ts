// Client-side helper: where to POST /api/* requests.
//
// Default: same-origin (relative URL). If NEXT_PUBLIC_API_BASE is set at
// build time (e.g. on Vercel), the frontend posts to that base instead —
// used to run the backend locally via a tunnel while hosting the page on
// Vercel.

const RAW = process.env.NEXT_PUBLIC_API_BASE || "";
const BASE = RAW.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : "/" + path;
  return BASE ? BASE + p : p;
}
