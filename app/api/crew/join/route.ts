import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
export async function POST(req:Request){const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL("/login",req.url));const f=await req.formData();const code=String(f.get("code")||"");const crew=(await query<any>(`select * from crews where invite_code=$1`,[code])).rows[0];if(!crew)return NextResponse.redirect(new URL("/crew",req.url));await query(`insert into crew_members(crew_id,user_id) values($1,$2) on conflict do nothing`,[crew.id,user.id]);return NextResponse.redirect(new URL("/crew",req.url));}
