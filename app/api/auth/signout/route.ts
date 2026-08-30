import { NextResponse } from "next/server";
import { logoutUrl } from "@/lib/auth";
export async function POST(req:Request){ return NextResponse.redirect(new URL(logoutUrl(), req.url)); }
