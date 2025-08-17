 

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get("admin");
  if (isLoggedIn?.value === "true") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const password = body.password;

  if (password === process.env.ADMIN_PASSWORD) {
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set("admin", "true", {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 8, // 8 timer
    });
    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
