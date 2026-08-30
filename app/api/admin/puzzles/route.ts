import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user||user.email!==process.env.ADMIN_EMAIL)return NextResponse.json({error:"forbidden"},{status:403});
 const f=await req.formData();
 await supabase.from("puzzles_private").insert({clue_text:String(f.get("clue_text")),clue_type:String(f.get("clue_type")),difficulty_band:String(f.get("difficulty_band")),answer:String(f.get("answer")),hint_1:String(f.get("hint_1")),hint_2:String(f.get("hint_2")),hint_3:String(f.get("hint_3")),difficulty_score:50,status:"draft",numeric_answer:false,is_final_mask:false,accepted_answers:[]});
 return NextResponse.redirect(new URL("/admin",req.url));
}
