import { query } from "./db";

export async function expectedPuzzle(sessionId:string,userId:string){
  const r=await query<any>(
   `select s.*, dgp.puzzle_id, dgp.position, p.clue_type, p.clue_text, p.answer,
           p.accepted_answers, p.numeric_answer, p.hint_1, p.hint_2, p.hint_3,
           p.is_final_mask
      from game_sessions s
      join daily_game_puzzles dgp on dgp.daily_game_id=s.daily_game_id and dgp.position=s.current_position
      join puzzles p on p.id=dgp.puzzle_id
     where s.id=$1 and s.user_id=$2 and s.status='active'`, [sessionId,userId]);
  return r.rows[0]||null;
}
