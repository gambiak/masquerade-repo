import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL("/.auth/logout", request.url);
  url.searchParams.set("post_logout_redirect_uri", "/");

  return NextResponse.redirect(url);
}
