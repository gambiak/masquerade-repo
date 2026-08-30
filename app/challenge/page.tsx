import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
export default async function Challenge(){
 const user=await getCurrentUser();if(!user)redirect("/login");
 const rows=(await query<any>(`select * from challenges where challenger_id=$1 or challenged_id=$1 order by created_at desc`,[user.id])).rows;
 return <main><section className="hero"><div className="eyebrow">Challenges</div><h1>Make it personal.</h1><p>Challenge friends to the exact same Daily Masquerade and compare results after both finish.</p></section><section className="card"><form action="/api/challenge/create" method="post"><input className="answer" name="friend_email" type="email" placeholder="Friend's email" required/><button className="btn primary" style={{marginTop:10}}>CREATE CHALLENGE</button></form></section><section className="card"><h2>Recent challenges</h2>{rows.length?rows.map((x:any)=><p key={x.id}>{x.status} · <a href={`/c/${x.invite_code}`}>{x.invite_code}</a></p>):<p>No challenges yet.</p>}</section></main>
}
