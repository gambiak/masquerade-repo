import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { randomBytes } from "crypto";
export async function POST(req:Request){
 const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL("/login",req.url)); const f=await req.formData(); const name=String(f.get("name")||"Morning Crew").slice(0,50); const code=randomBytes(5).toString('hex').toUpperCase();
 const c=await pool.connect();try{await c.query('begin'); const cr=await c.query(`insert into crews(name,owner_id,invite_code) values($1,$2,$3) returning *`,[name,user.id,code]); await c.query(`insert into crew_members(crew_id,user_id) values($1,$2)`,[cr.rows[0].id,user.id]);await c.query('commit');return NextResponse.redirect(new URL(`/join/${code}`,req.url));}catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
