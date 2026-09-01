import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { todayGameDate } from "@/lib/day";
import { randomBytes } from "crypto";

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
    return redirectTo(req, "/login?returnTo=/challenge");
  }

  const form = await req.formData();
  const friendEmail = String(
    form.get("friend_email") || ""
  )
    .toLowerCase()
    .trim();

  if (!friendEmail) {
    return redirectTo(
      req,
      "/challenge?error=email-required"
    );
  }

  const today = todayGameDate();

  const latest = (
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
  ).rows[0];

  if (!latest) {
    return redirectTo(
      req,
      "/challenge?error=finish-todays-game-first"
    );
  }

  const code = randomBytes(5)
    .toString("hex")
    .toUpperCase();

  await query(
    `
      insert into challenges(
        challenger_id,
        daily_game_id,
        invite_code,
        challenged_email,
        status
      )
      values($1, $2, $3, $4, 'pending')
    `,
    [
      user.id,
      latest.daily_game_id,
      code,
      friendEmail,
    ]
  );

  return redirectTo(
    req,
    `/c/${encodeURIComponent(code)}`
  );
}
