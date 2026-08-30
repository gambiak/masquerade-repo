import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ShareButton from "@/components/ShareButton";
export default async function Latest(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:r}=await supabase.from("game_sessions").select("*").eq("user_id",user.id).eq("status","completed").order("completed_at",{ascending:false}).limit(1).maybeSingle();if(!r)redirect("/");
 const grid=Array.from({length:5},(_,i)=>i<(r.pure_solves||0)?"🟣":"💡").join(" ");
 const text=`MASQUERADE\n${r.score} pts\n${grid}\n🎭 ${r.pure_solves} Pure Solves · ${r.hints_used} hints · ${Math.floor(r.solve_time_ms/1000)} sec`;
 return <main><section className="hero"><div className="eyebrow">Spoiler-free result</div><h1>Masquerade complete.</h1></section><section className="share"><h2>{r.score} pts</h2><p style={{fontSize:24}}>{grid}</p><p>{r.pure_solves} Pure Solves · {r.hints_used} hints · {Math.floor(r.solve_time_ms/1000)} sec</p><ShareButton text={text}/></section></main>
}
