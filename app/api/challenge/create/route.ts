import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(new URL("/login",req.url));
 const form=await req.formData();const friendEmail=String(form.get("friend_email")||"");
 const latest=(await supabase.from("game_sessions").select("*").eq("user_id",user.id).eq("status","completed").order("completed_at",{ascending:false}).limit(1).maybeSingle()).data;
 if(!latest)return NextResponse.redirect(new URL("/challenge?error=finish-a-game-first",req.url));
 const code=Math.random().toString(36).slice(2,8).toUpperCase();
 await supabase.from("challenges").insert({challenger_id:user.id,daily_game_id:latest.daily_game_id,invite_code:code,challenged_email:friendEmail,status:"pending"});
 return NextResponse.redirect(new URL(`/challenge?created=${code}`,req.url));
}
