import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL("/login",req.url)); const f=await req.formData(); const code=String(f.get("code")||"");
 const ch=(await query<any>(`select * from challenges where invite_code=$1 and (challenged_id=$2 or challenged_id is null or challenger_id=$2)`,[code,user.id])).rows[0]; if(!ch)return NextResponse.redirect(new URL("/challenge",req.url));
 if(!ch.challenged_id && ch.challenger_id!==user.id) await query(`update challenges set challenged_id=$1,status='accepted' where id=$2`,[user.id,ch.id]);
 const game=(await query<any>(`select * from daily_games where id=$1`,[ch.daily_game_id])).rows[0];
 let s=(await query<any>(`select * from game_sessions where user_id=$1 and daily_game_id=$2`,[user.id,ch.daily_game_id])).rows[0];
 if(!s) s=(await query<any>(`insert into game_sessions(user_id,daily_game_id,difficulty_band) values($1,$2,$3) returning *`,[user.id,ch.daily_game_id,game.difficulty_band])).rows[0];
 return NextResponse.redirect(new URL(s.status==='completed'?`/c/${code}`:"/play",req.url));
}
