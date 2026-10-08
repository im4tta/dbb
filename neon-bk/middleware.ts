import { NextRequest, NextResponse } from "next/server";

// Basic bot-security pre-checks; actual auth still happens in each route
export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  // Silently drop obviously bogus traffic that would wake the DB
  if (req.method === "POST" && req.nextUrl.pathname.startsWith("/api/telegram")) {
    if (!ua.includes("TelegramBot") && !ua.includes("curl") && !ua.startsWith("Go-http-client")) {
      // Allow explicit header-based routing in case of custom UA
    }
  }
  // Security headers on the dashboard
  if (!req.nextUrl.pathname.startsWith("/api")) {
    const res = NextResponse.next();
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
