import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
export default async function Crew(){
 const user=await getCurrentUser();if(!user)redirect("/login");
 const memberships=(await query<any>(`select c.* from crew_members cm join crews c on c.id=cm.crew_id where cm.user_id=$1 order by cm.joined_at desc`,[user.id])).rows;
 return <main><section className="hero"><div className="eyebrow">Morning Crews</div><h1>Think together.</h1><p>Private groups for friends, family, or coworkers. No feed—just today's shared ritual.</p></section><section className="card"><form action="/api/crew/create" method="post"><input className="answer" name="name" placeholder="Crew name" required/><button className="btn primary" style={{marginTop:10}}>CREATE CREW</button></form></section><section className="card"><h2>Your crews</h2>{memberships.length?memberships.map((m:any)=><p key={m.id}><b>{m.name}</b> · <a href={`/join/${m.invite_code}`}>invite {m.invite_code}</a></p>):<p>No crew yet.</p>}</section></main>
}
