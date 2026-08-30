import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(req:Request){
 const supabase=await createClient();
 const admin=createAdminClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId,puzzleId}=await req.json();
 const {data:session}=await supabase.from("game_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).eq("status","active").maybeSingle();
 if(!session)return NextResponse.json({error:"invalid session"},{status:400});
 let {data:result}=await admin.from("puzzle_results").select("*").eq("session_id",sessionId).eq("puzzle_id",puzzleId).maybeSingle();
 const next=Math.min((result?.hints_used||0)+1,3);
 if(result)await admin.from("puzzle_results").update({hints_used:next}).eq("id",result.id);
 else await admin.from("puzzle_results").insert({session_id:sessionId,puzzle_id:puzzleId,hints_used:next,attempts:0,solved:false});
 const {data:p}=await admin.from("puzzles_private").select("hint_1,hint_2,hint_3").eq("id",puzzleId).single();
 if(!p)return NextResponse.json({error:"puzzle missing"},{status:404});
 return NextResponse.json({hint:[p.hint_1,p.hint_2,p.hint_3][next-1],hintsUsed:next});
}
