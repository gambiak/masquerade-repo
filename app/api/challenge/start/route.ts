import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { todayGameDate } from "@/lib/day";

function publicBaseUrl(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto =
    req.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function redirectTo(req: Request, path: string) {
  return NextResponse.redirect(
    new URL(path, `${publicBaseUrl(req)}/`)
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return redirectTo(req, "/login");
  }

  const form = await req.formData();
  const code = String(form.get("code") || "");
  const today = todayGameDate();

  const ch = (
    await query<any>(
      `
        select c.*, dg.difficulty_band, dg.game_date
        from challenges c
        join daily_games dg
          on dg.id = c.daily_game_id
        where c.invite_code = $1
          and dg.game_date = $2
          and c.status <> 'expired'
          and (
            c.challenged_id = $3
            or c.challenged_id is null
            or c.challenger_id = $3
            or lower(c.challenged_email) = lower($4)
          )
      `,
      [code, today, user.id, user.email]
    )
  ).rows[0];

  if (!ch) {
    return redirectTo(req, "/challenge");
  }

  if (
    !ch.challenged_id &&
    ch.challenger_id !== user.id
  ) {
    await query(
      `
        update challenges
        set challenged_id = $1,
            status = 'accepted'
        where id = $2
      `,
      [user.id, ch.id]
    );
  }

  // Close any active session from a previous day before starting today's challenge.
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

  let session = (
    await query<any>(
      `
        select *
        from game_sessions
        where user_id = $1
          and daily_game_id = $2
      `,
      [user.id, ch.daily_game_id]
    )
  ).rows[0];

  if (!session) {
    session = (
      await query<any>(
        `
          insert into game_sessions(
            user_id,
            daily_game_id,
            difficulty_band
          )
          values($1, $2, $3)
          returning *
        `,
        [
          user.id,
          ch.daily_game_id,
          ch.difficulty_band,
        ]
      )
    ).rows[0];
  }

  if (session.status === "quit") {
    await query(
      `delete from puzzle_attempts where session_id = $1`,
      [session.id]
    );
    await query(
      `delete from puzzle_results where session_id = $1`,
      [session.id]
    );

    session = (
      await query<any>(
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
        [session.id]
      )
    ).rows[0];
  }

  return redirectTo(
    req,
    session.status === "completed"
      ? `/c/${encodeURIComponent(code)}`
      : "/play"
  );
}
