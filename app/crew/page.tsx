import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function Crew(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:memberships}=await supabase.from("crew_members").select("crew_id,crews(id,name,invite_code)").eq("user_id",user.id);
 return <main><section className="hero"><div className="eyebrow">Morning Crews</div><h1>Think together.</h1><p>Private groups for friends, family, or coworkers. No feed—just today's shared ritual.</p></section><section className="card"><form action="/api/crew/create" method="post"><input className="answer" name="name" placeholder="Crew name"/><button className="btn primary" style={{marginTop:10}}>CREATE CREW</button></form></section><section className="card"><h2>Your crews</h2>{memberships?.length?memberships.map((m:any)=><p key={m.crew_id}><b>{m.crews?.name}</b> · invite {m.crews?.invite_code}</p>):<p>No crew yet.</p>}</section></main>
}
