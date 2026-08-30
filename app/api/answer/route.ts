import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCorrect,editDistance } from "@/lib/game";
import { scorePuzzle } from "@/lib/scoring";

const witty=["Correct. Suspiciously clever.","Boom. Another mask falls.","Nice. Your neurons just high-fived.","Solved. The clue never stood a chance."];
const far=["Creative detour. Return to what the clue can actually prove.","Bold. The clue respects the confidence, if not the conclusion.","Interesting theory. The evidence has quietly left the room."];
const warm=["Plausible. That's why the clue chose this disguise.","Warm. Your reasoning has the right postcode.","Good theory, wrong keyhole. Try one layer deeper."];
const near=["You're almost wearing the right answer. One detail is inside out.","Very close. The clue just raised one eyebrow.","You're circling it. Tighten the interpretation."];

export async function POST(req:Request){
 const supabase=await createClient();const admin=createAdminClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId,puzzleId,answer}=await req.json();
 const {data:session}=await supabase.from("game_sessions").select("*").eq("id",sessionId).eq("user_id",user.id).eq("status","active").maybeSingle();if(!session)return NextResponse.json({error:"invalid session"},{status:400});
 const {data:p}=await admin.from("puzzles_private").select("*").eq("id",puzzleId).single();
 let {data:result}=await admin.from("puzzle_results").select("*").eq("session_id",sessionId).eq("puzzle_id",puzzleId).maybeSingle();
 const attempts=(result?.attempts||0)+1;
 const ok=isCorrect(answer,p.answer,p.numeric_answer,p.accepted_answers||[]);
 await admin.from("puzzle_attempts").insert({session_id:sessionId,puzzle_id:puzzleId,attempt_number:attempts,submitted_answer:answer,is_correct:ok});
 if(!ok){
   if(result)await admin.from("puzzle_results").update({attempts}).eq("id",result.id);else await admin.from("puzzle_results").insert({session_id:sessionId,puzzle_id:puzzleId,attempts,hints_used:0,solved:false});
   const ratio=editDistance(answer,p.answer)/Math.max(answer.length,p.answer.length,1);
   const pool=ratio<.3?near:ratio<.6?warm:far;
   return NextResponse.json({correct:false,message:pool[attempts%pool.length]});
 }
 const hints=result?.hints_used||0; const firstTry=attempts===1; const points=scorePuzzle(hints,firstTry,p.is_final_mask);
 if(result)await admin.from("puzzle_results").update({attempts,solved:true,score:points,first_try:firstTry,pure_solve:hints===0,solved_at:new Date().toISOString()}).eq("id",result.id);
 else await admin.from("puzzle_results").insert({session_id:sessionId,puzzle_id:puzzleId,attempts,hints_used:0,solved:true,score:points,first_try:firstTry,pure_solve:true,solved_at:new Date().toISOString()});
 const {count}=await supabase.from("daily_game_puzzles").select("*",{count:"exact",head:true}).eq("daily_game_id",session.daily_game_id);
 const next=session.current_position+1;
 if(next>(count||0)){
   const {data:all}=await admin.from("puzzle_results").select("*").eq("session_id",sessionId);
   const total=(all||[]).reduce((a,x)=>a+(x.score||0),0)+(!result?points:0);
   const hintsUsed=(all||[]).reduce((a,x)=>a+(x.hints_used||0),0);
   const pure=(all||[]).filter(x=>x.pure_solve).length+(!result&&hints===0?1:0);
   const solveTime=Date.now()-new Date(session.started_at).getTime();
   await supabase.from("game_sessions").update({status:"completed",completed_at:new Date().toISOString(),score:total,hints_used:hintsUsed,pure_solves:pure,solve_time_ms:solveTime,current_position:next}).eq("id",sessionId);
 }else await supabase.from("game_sessions").update({current_position:next}).eq("id",sessionId);
 return NextResponse.json({correct:true,message:`✨ ${witty[Math.floor(Math.random()*witty.length)]}`,points});
}
