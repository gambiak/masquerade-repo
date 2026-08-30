import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlayClient from "@/components/PlayClient";
export default async function Play(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 const {data:session}=await supabase.from("game_sessions").select("*").eq("user_id",user.id).eq("status","active").maybeSingle();
 if(!session)redirect("/start");
 const {data:link}=await supabase.from("daily_game_puzzles").select("position,puzzle_id").eq("daily_game_id",session.daily_game_id).eq("position",session.current_position).maybeSingle();
 if(!link)redirect("/");
 const {data:p}=await supabase.from("puzzles_public").select("id,clue_type,clue_text,is_final_mask").eq("id",link.puzzle_id).maybeSingle();
 if(!p)redirect("/");
 return <main><PlayClient session={session} puzzle={{...p,position:link.position}} shownHints={[]}/></main>
}
