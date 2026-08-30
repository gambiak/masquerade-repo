import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(req:Request){
 const supabase=await createClient(); const admin=createAdminClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId,puzzleId}=await req.json();
 const {data:session}=await supabase.from("game_sessions").select("id").eq("id",sessionId).eq("user_id",user.id).eq("status","active").maybeSingle();
 if(!session)return NextResponse.json({error:"invalid session"},{status:400});
 const {data:r}=await admin.from("puzzle_results").select("hints_used").eq("session_id",sessionId).eq("puzzle_id",puzzleId).maybeSingle();
 const count=r?.hints_used||0;
 const {data:p}=await admin.from("puzzles_private").select("hint_1,hint_2,hint_3").eq("id",puzzleId).single();
 return NextResponse.json({hints:[p?.hint_1,p?.hint_2,p?.hint_3].filter(Boolean).slice(0,count)});
}
