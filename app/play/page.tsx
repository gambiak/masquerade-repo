import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { todayGameDate } from "@/lib/day";
import PlayClient from "@/components/PlayClient";

export default async function Play() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayGameDate();

  // Close yesterday's unfinished session so it can never be resumed.
  await query(
    `
      update game_sessions gs
      set status = 'quit',
          completed_at = coalesce(gs.completed_at, now())
      from daily_games dg
      where gs.daily_game_id = dg.id
        and gs.user_id = $1
        and gs.status = 'active'
        and dg.game_date <> $2
    `,
    [user.id, today]
  );

  const session = (
    await query<any>(
      `
        select gs.*
        from game_sessions gs
        join daily_games dg
          on dg.id = gs.daily_game_id
        where gs.user_id = $1
          and gs.status = 'active'
          and dg.game_date = $2
        order by gs.started_at desc
        limit 1
      `,
      [user.id, today]
    )
  ).rows[0];

  if (!session) {
    redirect("/start");
  }

  const puzzle = (
    await query<any>(
      `
        select
          p.id,
          p.clue_type,
          p.clue_text,
          p.is_final_mask,
          dgp.position
        from daily_game_puzzles dgp
        join puzzles p
          on p.id = dgp.puzzle_id
        where dgp.daily_game_id = $1
          and dgp.position = $2
      `,
      [session.daily_game_id, session.current_position]
    )
  ).rows[0];

  if (!puzzle) {
    redirect("/");
  }

  const progress = (
    await query<any>(
      `
        select
          count(*) filter (where pr.solved = true)::int as solved_count,
          count(dgp.position)::int as total_count
        from daily_game_puzzles dgp
        left join puzzle_results pr
          on pr.session_id = $1
         and pr.puzzle_id = dgp.puzzle_id
        where dgp.daily_game_id = $2
      `,
      [session.id, session.daily_game_id]
    )
  ).rows[0];

  return (
    <main>
      <PlayClient
        session={session}
        puzzle={puzzle}
        shownHints={[]}
        solvedCount={Number(progress?.solved_count || 0)}
        totalCount={Number(progress?.total_count || 5)}
      />
    </main>
  );
}
