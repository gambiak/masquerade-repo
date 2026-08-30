import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
export async function POST(req:Request){
 const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const {sessionId}=await req.json();
 await query(`update game_sessions set status='quit',completed_at=now() where id=$1 and user_id=$2 and status='active'`,[sessionId,user.id]);
 return NextResponse.json({ok:true});
}
