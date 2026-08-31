import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  const { difficulty } = await req.json();

  if (!["clever", "devious", "fiendish"].includes(difficulty)) {
    return NextResponse.json(
      { error: "invalid difficulty" },
      { status: 400 }
    );
  }

  const game = (
    await getPool().query<any>(
      `
        select *
        from daily_games
        where game_date = current_date
          and difficulty_band = $1
          and published = true
        limit 1
      `,
      [difficulty]
    )
  ).rows[0];

  if (!game) {
    return NextResponse.json(
      { error: "No daily game published." },
      { status: 404 }
    );
  }

  const existing = (
    await getPool().query<any>(
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
    return NextResponse.json({
      session: existing,
    });
  }

  if (existing?.status === "completed") {
    return NextResponse.json({
      completed: true,
      difficulty,
      sessionId: existing.id,
    });
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");

    if (existing?.status === "quit") {
      await client.query(
        `
          delete from puzzle_attempts
          where session_id = $1
        `,
        [existing.id]
      );

      await client.query(
        `
          delete from puzzle_results
          where session_id = $1
        `,
        [existing.id]
      );

      const restarted = await client.query(
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

      await client.query("commit");

      return NextResponse.json({
        session: restarted.rows[0],
      });
    }

    const created = await client.query(
      `
        insert into game_sessions (
          user_id,
          daily_game_id,
          difficulty_band
        )
        values ($1, $2, $3)
        returning *
      `,
      [user.id, game.id, difficulty]
    );

    await client.query("commit");

    return NextResponse.json({
      session: created.rows[0],
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}