import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { expectedPuzzle } from "@/lib/game-db";
import { isCorrect, editDistance } from "@/lib/game";
import { scorePuzzle } from "@/lib/scoring";

const witty = [
  "Correct. Suspiciously clever.",
  "Boom. Another mask falls.",
  "Nice. Your neurons just high-fived.",
  "Solved. The clue never stood a chance.",
];

const far = [
  "Creative detour. Return to what the clue can actually prove.",
  "Bold. The clue respects the confidence, if not the conclusion.",
  "Interesting theory. The evidence has quietly left the room.",
];

const warm = [
  "Plausible. That's why the clue chose this disguise.",
  "Warm. Your reasoning has the right postcode.",
  "Good theory, wrong keyhole. Try one layer deeper.",
];

const near = [
  "You're almost wearing the right answer. One detail is inside out.",
  "Very close. The clue just raised one eyebrow.",
  "You're circling it. Tighten the interpretation.",
];

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId, answer } = await req.json();

  if (typeof answer !== "string" || !answer.trim()) {
    return NextResponse.json(
      { error: "answer required" },
      { status: 400 }
    );
  }

  const p = await expectedPuzzle(sessionId, user.id);

  if (!p) {
    return NextResponse.json(
      { error: "invalid session" },
      { status: 400 }
    );
  }

  const c = await getPool().connect();

  try {
    await c.query("begin");

    const rr = await c.query(
      `
        select *
        from puzzle_results
        where session_id = $1
          and puzzle_id = $2
        for update
      `,
      [sessionId, p.puzzle_id]
    );

    const result = rr.rows[0];

    if (result?.solved) {
      await c.query("rollback");
      return NextResponse.json(
        { error: "puzzle already solved" },
        { status: 409 }
      );
    }

    const attempts = Number(result?.attempts || 0) + 1;
    const ok = isCorrect(
      answer,
      p.answer,
      p.numeric_answer,
      p.accepted_answers || []
    );

    await c.query(
      `
        insert into puzzle_attempts(
          session_id,
          puzzle_id,
          attempt_number,
          submitted_answer,
          is_correct
        )
        values($1, $2, $3, $4, $5)
      `,
      [sessionId, p.puzzle_id, attempts, answer, ok]
    );

    if (!ok) {
      if (result) {
        await c.query(
          `update puzzle_results set attempts = $1 where id = $2`,
          [attempts, result.id]
        );
      } else {
        await c.query(
          `
            insert into puzzle_results(session_id, puzzle_id, attempts)
            values($1, $2, $3)
          `,
          [sessionId, p.puzzle_id, attempts]
        );
      }

      await c.query("commit");

      const ratio =
        editDistance(answer, p.answer) /
        Math.max(answer.length, p.answer.length, 1);

      const poolMsg =
        ratio < 0.3 ? near : ratio < 0.6 ? warm : far;

      return NextResponse.json({
        correct: false,
        message: poolMsg[(attempts - 1) % poolMsg.length],
      });
    }

    const hints = Number(result?.hints_used || 0);
    const firstTry = attempts === 1;
    const points = scorePuzzle(
      hints,
      firstTry,
      p.is_final_mask
    );

    if (result) {
      await c.query(
        `
          update puzzle_results
          set attempts = $1,
              solved = true,
              score = $2,
              first_try = $3,
              pure_solve = $4,
              solved_at = now()
          where id = $5
        `,
        [attempts, points, firstTry, hints === 0, result.id]
      );
    } else {
      await c.query(
        `
          insert into puzzle_results(
            session_id,
            puzzle_id,
            attempts,
            hints_used,
            solved,
            score,
            first_try,
            pure_solve,
            solved_at
          )
          values($1, $2, $3, 0, true, $4, $5, true, now())
        `,
        [sessionId, p.puzzle_id, attempts, points, firstTry]
      );
    }

    const totals = (
      await c.query<any>(
        `
          select
            count(dgp.position)::int as total,
            count(*) filter (
              where coalesce(pr.solved, false) = true
            )::int as solved
          from daily_game_puzzles dgp
          left join puzzle_results pr
            on pr.session_id = $1
           and pr.puzzle_id = dgp.puzzle_id
          where dgp.daily_game_id = $2
        `,
        [sessionId, p.daily_game_id]
      )
    ).rows[0];

    const completed =
      Number(totals.solved) >= Number(totals.total);

    if (completed) {
      const agg = (
        await c.query<any>(
          `
            select
              coalesce(sum(score), 0)::int as score,
              coalesce(sum(hints_used), 0)::int as hints,
              count(*) filter (where pure_solve)::int as pure
            from puzzle_results
            where session_id = $1
          `,
          [sessionId]
        )
      ).rows[0];

      await c.query(
        `
          update game_sessions
          set status = 'completed',
              completed_at = now(),
              score = $1,
              hints_used = $2,
              pure_solves = $3,
              solve_time_ms = (
                extract(epoch from (now() - started_at)) * 1000
              )::bigint
          where id = $4
        `,
        [agg.score, agg.hints, agg.pure, sessionId]
      );
    } else {
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
            order by
              case when dgp.position > $3 then 0 else 1 end,
              dgp.position
            limit 1
          `,
          [sessionId, p.daily_game_id, p.current_position]
        )
      ).rows[0];

      if (!next) {
        throw new Error(
          "No unsolved puzzle found for incomplete session."
        );
      }

      await c.query(
        `
          update game_sessions
          set current_position = $1
          where id = $2
        `,
        [next.position, sessionId]
      );
    }

    await c.query("commit");

    return NextResponse.json({
      correct: true,
      completed,
      solvedCount: Number(totals.solved),
      totalCount: Number(totals.total),
      message: `✨ ${witty[Math.floor(Math.random() * witty.length)]}`,
      points,
    });
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}
