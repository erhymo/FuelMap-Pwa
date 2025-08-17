import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

  if (isAdminRoute) {
    const cookie = req.cookies.get("admin");
    const isOnLoginPage = req.nextUrl.pathname === "/admin";

    // Hvis ikke logget inn og ikke allerede på login-siden → redirect til login
    if (!cookie || cookie.value !== "true") {
      if (!isOnLoginPage) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
