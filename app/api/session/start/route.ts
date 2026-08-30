import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(req:Request){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {difficulty}=await req.json();
 const today=new Date().toISOString().slice(0,10);
 const {data:game}=await supabase.from("daily_games").select("*").eq("game_date",today).eq("difficulty_band",difficulty).eq("published",true).maybeSingle();
 if(!game)return NextResponse.json({error:"No daily game published."},{status:404});
 const existing=(await supabase.from("game_sessions").select("*").eq("user_id",user.id).eq("daily_game_id",game.id).maybeSingle()).data;
 if(existing)return NextResponse.json({session:existing});
 const {data,error}=await supabase.from("game_sessions").insert({user_id:user.id,daily_game_id:game.id,difficulty_band:difficulty,status:"active",current_position:1,started_at:new Date().toISOString()}).select().single();
 return NextResponse.json(error?{error:error.message}:{session:data},{status:error?400:200});
}
