import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { randomBytes } from "crypto";
export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL("/login",req.url)); const f=await req.formData(); const friendEmail=String(f.get("friend_email")||"").toLowerCase().trim();
 const latest=(await query<any>(`select * from game_sessions where user_id=$1 and status='completed' order by completed_at desc limit 1`,[user.id])).rows[0];
 if(!latest)return NextResponse.redirect(new URL("/challenge?error=finish-a-game-first",req.url)); const code=randomBytes(5).toString('hex').toUpperCase();
 await query(`insert into challenges(challenger_id,daily_game_id,invite_code,challenged_email,status) values($1,$2,$3,$4,'pending')`,[user.id,latest.daily_game_id,code,friendEmail]);
 return NextResponse.redirect(new URL(`/c/${code}`,req.url));
}
