import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import PlayClient from "@/components/PlayClient";
export default async function Play(){
 const user=await getCurrentUser(); if(!user)redirect("/login");
 const session=(await query<any>(`select * from game_sessions where user_id=$1 and status='active' order by started_at desc limit 1`,[user.id])).rows[0];
 if(!session)redirect("/start");
 const p=(await query<any>(`select p.id,p.clue_type,p.clue_text,p.is_final_mask,dgp.position
   from daily_game_puzzles dgp join puzzles p on p.id=dgp.puzzle_id
   where dgp.daily_game_id=$1 and dgp.position=$2`,[session.daily_game_id,session.current_position])).rows[0];
 if(!p)redirect("/");
 return <main><PlayClient session={session} puzzle={p} shownHints={[]}/></main>
}
