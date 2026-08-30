import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(new URL("/login",req.url));
 const form=await req.formData();const name=String(form.get("name")||"Morning Crew").slice(0,50);const code=Math.random().toString(36).slice(2,8).toUpperCase();
 const {data:crew}=await supabase.from("crews").insert({name,owner_id:user.id,invite_code:code}).select().single();
 if(crew)await supabase.from("crew_members").insert({crew_id:crew.id,user_id:user.id});
 return NextResponse.redirect(new URL("/crew",req.url));
}
