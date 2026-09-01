import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { todayGameDate } from "@/lib/day";

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await req.json();

  if (!sessionId) {
    return NextResponse.json(
      { error: "session required" },
      { status: 400 }
    );
  }

  const today = todayGameDate();
  const c = await getPool().connect();

  try {
    await c.query("begin");

    const session = (
      await c.query<any>(
        `
          select gs.*
          from game_sessions gs
          join daily_games dg
            on dg.id = gs.daily_game_id
          where gs.id = $1
            and gs.user_id = $2
            and gs.status = 'active'
            and dg.game_date = $3
          for update of gs
        `,
        [sessionId, user.id, today]
      )
    ).rows[0];

    if (!session) {
      await c.query("rollback");
      return NextResponse.json(
        { error: "invalid session" },
        { status: 400 }
      );
    }

    const next = (
      await c.query<any>(
        `
          select dgp.position
          from daily_game_puzzles dgp
          left join puzzle_results pr
            on pr.session_id = $1
           and pr.puzzle_id = dgp.puzzle_id
          where dgp.daily_game_id = $2
            and coalesce(pr.solved, false) = false
            and dgp.position <> $3
          order by
            case when dgp.position > $3 then 0 else 1 end,
            dgp.position
          limit 1
        `,
        [session.id, session.daily_game_id, session.current_position]
      )
    ).rows[0];

    if (!next) {
      await c.query("rollback");
      return NextResponse.json(
        { error: "last-unsolved-clue" },
        { status: 409 }
      );
    }

    await c.query(
      `
        update game_sessions
        set current_position = $1
        where id = $2
      `,
      [next.position, session.id]
    );

    await c.query("commit");

    return NextResponse.json({
      ok: true,
      position: Number(next.position),
    });
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}
