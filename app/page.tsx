import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export default async function Home(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 let active:any=null,last:any=null;
 if(user){
   active=(await supabase.from("game_sessions").select("*").eq("user_id",user.id).eq("status","active").maybeSingle()).data;
   last=(await supabase.from("game_sessions").select("*").eq("user_id",user.id).eq("status","completed").order("completed_at",{ascending:false}).limit(1).maybeSingle()).data;
 }
 return <main><section className="hero"><div className="eyebrow">Daily Masquerade</div><h1>See less.<br/>Think more.</h1><p>Five shared daily puzzles. Challenge friends, compare spoiler-free results, and build a morning ritual.</p></section>
 {!user?<section className="card"><h2>Play with friends</h2><p>Create an account to save progress, challenge friends, join crews, and compare daily results.</p><Link className="btn primary" href="/login">SIGN IN / CREATE ACCOUNT</Link></section>:
 <section className="card"><div className="eyebrow">Today's game</div><h2>{active?"Your game is waiting.":"Ready for today's Masquerade?"}</h2><Link className="btn primary" href={active?"/play":"/start"}>{active?"CONTINUE GAME":"START TODAY'S MASQUERADE"}</Link></section>}
 {last&&<section className="share"><div className="eyebrow">Last result</div><h2>{last.score} pts · {last.pure_solves} Pure Solves</h2><p>{last.hints_used} hints · {Math.floor(last.solve_time_ms/1000)} sec</p><Link className="btn" href="/results/latest">VIEW SHARE CARD</Link></section>}
 </main>
}
