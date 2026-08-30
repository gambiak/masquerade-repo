import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { expectedPuzzle } from "@/lib/game-db";
export async function POST(req:Request){
 const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId}=await req.json(); const p=await expectedPuzzle(sessionId,user.id); if(!p)return NextResponse.json({error:"invalid session"},{status:400});
 const c=await pool.connect(); try{
  await c.query('begin');
  const rr=await c.query(`select * from puzzle_results where session_id=$1 and puzzle_id=$2 for update`,[sessionId,p.puzzle_id]);
  const current=Number(rr.rows[0]?.hints_used||0); if(current>=3){await c.query('commit');return NextResponse.json({error:"all hints used"},{status:409});}
  const next=current+1;
  if(rr.rows[0]) await c.query(`update puzzle_results set hints_used=$1 where id=$2`,[next,rr.rows[0].id]);
  else await c.query(`insert into puzzle_results(session_id,puzzle_id,hints_used) values($1,$2,$3)`,[sessionId,p.puzzle_id,next]);
  await c.query('commit');
  return NextResponse.json({hint:[p.hint_1,p.hint_2,p.hint_3][next-1],hintsUsed:next});
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
