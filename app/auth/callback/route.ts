import { NextResponse } from "next/server";
// Easy Auth handles the OAuth callback. This compatibility route simply returns home.
export async function GET(request:Request){ return NextResponse.redirect(new URL("/",request.url)); }
