import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function Stats(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:runs}=await supabase.from("game_sessions").select("*").eq("user_id",user.id).eq("status","completed").order("completed_at",{ascending:false}).limit(30);
 const games=runs?.length||0,avg=games?Math.round((runs||[]).reduce((a,x)=>a+(x.score||0),0)/games):0,pure=(runs||[]).reduce((a,x)=>a+(x.pure_solves||0),0);
 return <main><section className="hero"><div className="eyebrow">Your mind</div><h1>Pattern Hunter.</h1><p>Game-performance indicators, not cognitive or medical assessments.</p></section><div className="stats"><div className="stat"><b>{games}</b><span>games</span></div><div className="stat"><b>{avg}</b><span>avg score</span></div><div className="stat"><b>{pure}</b><span>Pure Solves</span></div><div className="stat"><b>{runs?.[0]?.hints_used||0}</b><span>latest hints</span></div></div></main>
}
