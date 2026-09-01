import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { todayGameDate } from "@/lib/day";

export default async function Home() {
  const user = await getCurrentUser();
  const today = todayGameDate();

  let active: any = null;
  let completed: any = null;

  if (user) {
    active = (
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
    ).rows[0] || null;

    completed = (
      await query<any>(
        `
          select gs.*
          from game_sessions gs
          join daily_games dg
            on dg.id = gs.daily_game_id
          where gs.user_id = $1
            and gs.status = 'completed'
            and dg.game_date = $2
          order by gs.completed_at desc
          limit 1
        `,
        [user.id, today]
      )
    ).rows[0] || null;
  }

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Daily Masquerade</div>
        <h1>
          See less.
          <br />
          Think more.
        </h1>
        <p>
          Five shared daily puzzles. Challenge friends, compare spoiler-free
          results, and build a morning ritual.
        </p>
      </section>

      {!user ? (
        <section className="card">
          <h2>Play today&apos;s Masquerade</h2>
          <p>
            Sign in to save today&apos;s progress, challenge friends, join
            crews, and compare results.
          </p>
          <Link className="btn primary" href="/login">
            SIGN IN / CREATE ACCOUNT
          </Link>
        </section>
      ) : (
        <section className="card">
          <div className="eyebrow">Today&apos;s game</div>
          <h2>
            {active
              ? "Your game is waiting."
              : completed
                ? "Today's mask has fallen."
                : "Ready for today's Masquerade?"}
          </h2>

          {active ? (
            <Link className="btn primary" href="/play">
              CONTINUE TODAY&apos;S GAME
            </Link>
          ) : (
            <Link className="btn primary" href="/start">
              START TODAY&apos;S MASQUERADE
            </Link>
          )}
        </section>
      )}

      {completed && (
        <section className="share">
          <div className="eyebrow">Today&apos;s result</div>
          <h2>
            {completed.score} pts · {completed.pure_solves} Pure Solves
          </h2>
          <p>
            {completed.hints_used} hints ·{" "}
            {Math.floor(Number(completed.solve_time_ms || 0) / 1000)} sec
          </p>
          <Link
            className="btn"
            href={`/results/latest?difficulty=${completed.difficulty_band}`}
          >
            VIEW & SHARE TODAY&apos;S RESULT
          </Link>
        </section>
      )}
    </main>
  );
}
