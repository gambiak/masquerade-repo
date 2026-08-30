import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
export default async function Admin(){
 const user=await getCurrentUser(); if(!user||user.email.toLowerCase()!==(process.env.ADMIN_EMAIL||"").toLowerCase())redirect("/");
 const puzzles=(await query<any>(`select id,clue_text,difficulty_band,status,difficulty_score from puzzles order by created_at desc limit 50`)).rows;
 return <main><section className="hero"><div className="eyebrow">Puzzle Studio</div><h1>Curate the Aha.</h1><p>Draft, QA, approve, schedule, and retire puzzles. AI may suggest; humans approve flagship Daily content.</p></section><section className="card"><form action="/api/admin/puzzles" method="post" className="grid">
 <div className="field"><label>Clue</label><textarea name="clue_text" required/></div>
 <div className="grid two"><div className="field"><label>Type</label><select name="clue_type"><option>word</option><option>rebus</option><option>logic</option><option>pattern</option><option>math</option></select></div><div className="field"><label>Difficulty</label><select name="difficulty_band"><option>clever</option><option>devious</option><option>fiendish</option></select></div></div>
 <div className="field"><label>Answer</label><input name="answer" required/></div>
 <div className="field"><label>Hint 1</label><input name="hint_1" required/></div><div className="field"><label>Hint 2</label><input name="hint_2" required/></div><div className="field"><label>Hint 3</label><input name="hint_3" required/></div>
 <button className="btn primary">SAVE DRAFT</button></form></section><section className="card"><h2>Recent puzzles</h2><table className="table"><tbody>{puzzles.map((p:any)=><tr key={p.id}><td>{p.clue_text}</td><td>{p.difficulty_band}</td><td>{p.status}</td></tr>)}</tbody></table></section></main>
}
