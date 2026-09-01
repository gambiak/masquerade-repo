import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { todayGameDate } from "@/lib/day";

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { difficulty } = await req.json();

  if (!["clever", "devious", "fiendish"].includes(difficulty)) {
    return NextResponse.json({ error: "invalid difficulty" }, { status: 400 });
  }

  const today = todayGameDate();
  const c = await getPool().connect();

  try {
    await c.query("begin");

    // A new Masquerade day closes any unfinished run from a previous day.
    // This is required because the schema allows only one active session/user.
    await c.query(
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

    const game = (
      await c.query<any>(
        `
          select *
          from daily_games
          where game_date = $1
            and difficulty_band = $2
            and published = true
          limit 1
        `,
        [today, difficulty]
      )
    ).rows[0];

    if (!game) {
      await c.query("rollback");
      return NextResponse.json(
        { error: "No daily game published for today." },
        { status: 404 }
      );
    }

    const existing = (
      await c.query<any>(
        `
          select *
          from game_sessions
          where user_id = $1
            and daily_game_id = $2
          limit 1
        `,
        [user.id, game.id]
      )
    ).rows[0];

    if (existing?.status === "active") {
      await c.query("commit");
      return NextResponse.json({ session: existing });
    }

    if (existing?.status === "completed") {
      await c.query("rollback");
      return NextResponse.json(
        { error: "Today's game is already complete." },
        { status: 409 }
      );
    }

    if (existing?.status === "quit") {
      await c.query(
        `delete from puzzle_attempts where session_id = $1`,
        [existing.id]
      );
      await c.query(
        `delete from puzzle_results where session_id = $1`,
        [existing.id]
      );

      const r = await c.query(
        `
          update game_sessions
          set status = 'active',
              current_position = 1,
              started_at = now(),
              completed_at = null,
              score = 0,
              hints_used = 0,
              pure_solves = 0,
              solve_time_ms = 0
          where id = $1
          returning *
        `,
        [existing.id]
      );

      await c.query("commit");
      return NextResponse.json({ session: r.rows[0] });
    }

    const r = await c.query(
      `
        insert into game_sessions(user_id, daily_game_id, difficulty_band)
        values($1, $2, $3)
        returning *
      `,
      [user.id, game.id, difficulty]
    );

    await c.query("commit");
    return NextResponse.json({ session: r.rows[0] });
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}
