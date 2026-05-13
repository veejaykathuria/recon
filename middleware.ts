import { NextRequest, NextResponse } from "next/server";

// Allow the Vercel-hosted frontend (and any other origin during the demo)
// to call this local backend. Reflect the requesting origin so credentials
// work; if you want to lock this down, replace the line below with a
// hardcoded allowlist.
export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  const res = NextResponse.next();
  const h = corsHeaders(origin);
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  return res;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export const config = {
  matcher: ["/api/:path*"],
};
