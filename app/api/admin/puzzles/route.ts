import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
export async function POST(req:Request){
 const user=await getCurrentUser(); if(!user||user.email.toLowerCase()!==(process.env.ADMIN_EMAIL||"").toLowerCase())return NextResponse.json({error:"forbidden"},{status:403});
 const f=await req.formData(); await query(`insert into puzzles(clue_text,clue_type,difficulty_band,answer,hint_1,hint_2,hint_3,difficulty_score,status,numeric_answer,is_final_mask,accepted_answers) values($1,$2,$3,$4,$5,$6,$7,50,'draft',false,false,'{}')`,[String(f.get("clue_text")),String(f.get("clue_type")),String(f.get("difficulty_band")),String(f.get("answer")),String(f.get("hint_1")),String(f.get("hint_2")),String(f.get("hint_3"))]);
 return NextResponse.redirect(new URL("/admin",req.url));
}
