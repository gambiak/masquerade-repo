import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { expectedPuzzle } from "@/lib/game-db";
import { isCorrect,editDistance } from "@/lib/game";
import { scorePuzzle } from "@/lib/scoring";
const witty=["Correct. Suspiciously clever.","Boom. Another mask falls.","Nice. Your neurons just high-fived.","Solved. The clue never stood a chance."];
const far=["Creative detour. Return to what the clue can actually prove.","Bold. The clue respects the confidence, if not the conclusion.","Interesting theory. The evidence has quietly left the room."];
const warm=["Plausible. That's why the clue chose this disguise.","Warm. Your reasoning has the right postcode.","Good theory, wrong keyhole. Try one layer deeper."];
const near=["You're almost wearing the right answer. One detail is inside out.","Very close. The clue just raised one eyebrow.","You're circling it. Tighten the interpretation."];
export async function POST(req:Request){
 const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId,answer}=await req.json(); if(typeof answer!=="string"||!answer.trim())return NextResponse.json({error:"answer required"},{status:400});
 const p=await expectedPuzzle(sessionId,user.id); if(!p)return NextResponse.json({error:"invalid session"},{status:400});
 const c=await getPool().connect(); try{
  await c.query('begin');
  const rr=await c.query(`select * from puzzle_results where session_id=$1 and puzzle_id=$2 for update`,[sessionId,p.puzzle_id]); const result=rr.rows[0];
  const attempts=Number(result?.attempts||0)+1; const ok=isCorrect(answer,p.answer,p.numeric_answer,p.accepted_answers||[]);
  await c.query(`insert into puzzle_attempts(session_id,puzzle_id,attempt_number,submitted_answer,is_correct) values($1,$2,$3,$4,$5)`,[sessionId,p.puzzle_id,attempts,answer,ok]);
  if(!ok){
    if(result) await c.query(`update puzzle_results set attempts=$1 where id=$2`,[attempts,result.id]);
    else await c.query(`insert into puzzle_results(session_id,puzzle_id,attempts) values($1,$2,$3)`,[sessionId,p.puzzle_id,attempts]);
    await c.query('commit');
    const ratio=editDistance(answer,p.answer)/Math.max(answer.length,p.answer.length,1); const poolMsg=ratio<.3?near:ratio<.6?warm:far;
    return NextResponse.json({correct:false,message:poolMsg[(attempts-1)%poolMsg.length]});
  }
  const hints=Number(result?.hints_used||0); const firstTry=attempts===1; const points=scorePuzzle(hints,firstTry,p.is_final_mask);
  if(result) await c.query(`update puzzle_results set attempts=$1,solved=true,score=$2,first_try=$3,pure_solve=$4,solved_at=now() where id=$5`,[attempts,points,firstTry,hints===0,result.id]);
  else await c.query(`insert into puzzle_results(session_id,puzzle_id,attempts,hints_used,solved,score,first_try,pure_solve,solved_at) values($1,$2,$3,0,true,$4,$5,true,now())`,[sessionId,p.puzzle_id,attempts,points,firstTry]);
  const cnt=await c.query(`select count(*)::int as n from daily_game_puzzles where daily_game_id=$1`,[p.daily_game_id]); const next=Number(p.current_position)+1;
  if(next>Number(cnt.rows[0].n)){
    const agg=await c.query(`select coalesce(sum(score),0)::int as score,coalesce(sum(hints_used),0)::int as hints,count(*) filter(where pure_solve)::int as pure from puzzle_results where session_id=$1`,[sessionId]);
    const a=agg.rows[0];
    await c.query(`update game_sessions set status='completed',completed_at=now(),score=$1,hints_used=$2,pure_solves=$3,solve_time_ms=(extract(epoch from (now()-started_at))*1000)::bigint,current_position=$4 where id=$5`,[a.score,a.hints,a.pure,next,sessionId]);
  } else await c.query(`update game_sessions set current_position=$1 where id=$2`,[next,sessionId]);
  await c.query('commit'); return NextResponse.json({correct:true,message:`✨ ${witty[Math.floor(Math.random()*witty.length)]}`,points});
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
