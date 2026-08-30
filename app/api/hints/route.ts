import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { expectedPuzzle } from "@/lib/game-db";
export async function POST(req:Request){
 const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId}=await req.json(); const p=await expectedPuzzle(sessionId,user.id); if(!p)return NextResponse.json({error:"invalid session"},{status:400});
 const r=(await query<any>(`select hints_used from puzzle_results where session_id=$1 and puzzle_id=$2`,[sessionId,p.puzzle_id])).rows[0];
 const count=Number(r?.hints_used||0); return NextResponse.json({hints:[p.hint_1,p.hint_2,p.hint_3].slice(0,count)});
}
