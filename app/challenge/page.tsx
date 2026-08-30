import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function Challenge(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:rows}=await supabase.from("challenges").select("*").or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`).order("created_at",{ascending:false});
 return <main><section className="hero"><div className="eyebrow">Challenges</div><h1>Make it personal.</h1><p>Challenge friends to the exact same Daily Masquerade and compare results after both finish.</p></section><section className="card"><form action="/api/challenge/create" method="post"><input className="answer" name="friend_email" type="email" placeholder="Friend's email"/><button className="btn primary" style={{marginTop:10}}>CREATE CHALLENGE</button></form></section><section className="card"><h2>Recent challenges</h2>{rows?.length?rows.map((x:any)=><p key={x.id}>{x.status} · {x.invite_code}</p>):<p>No challenges yet.</p>}</section></main>
}
