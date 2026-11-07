import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [/^\/$/, /\.[a-z0-9]{2,5}$/i, /^\/assets\//, /^\/type-icons\//, /^\/illustrations\//, /^\/brand\//, /^\/privacy/, /^\/terms/, /^\/refunds/, /^\/login/, /^\/signup/, /^\/api\/auth\//, /^\/api\/health/, /^\/api\/webhooks\//, /^\/api\/billing\/plans/, /^\/_next\//, /^\/favicon/, /^\/logo/, /^\/api\/projects\/estimate/];

/** Redirects signed-out visitors to /login for pages; APIs return 401 from their own guards. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const has = req.cookies.get("y2_session")?.value;
  if (!has && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone(); url.pathname = "/login"; url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
