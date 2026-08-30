import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(req:Request){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId}=await req.json();
 await supabase.from("game_sessions").update({status:"quit",completed_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",user.id);
 return NextResponse.json({ok:true});
}
