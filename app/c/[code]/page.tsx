import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { todayGameDate } from "@/lib/day";
import { redirect, notFound } from "next/navigation";

export default async function ChallengeInvite({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      `/login?returnTo=/c/${encodeURIComponent(code)}`
    );
  }

  const ch = (
    await query<any>(
      `
        select
          c.*,
          u.display_name,
          u.email as challenger_email,
          dg.difficulty_band,
          dg.game_date::text as game_date
        from challenges c
        join users u
          on u.id = c.challenger_id
        join daily_games dg
          on dg.id = c.daily_game_id
        where c.invite_code = $1
      `,
      [code]
    )
  ).rows[0];

  if (!ch) {
    notFound();
  }

  const today = todayGameDate();
  const challengeDate = String(ch.game_date).slice(0, 10);

  if (challengeDate !== today) {
    if (["pending", "accepted"].includes(ch.status)) {
      await query(
        `
          update challenges
          set status = 'expired'
          where id = $1
        `,
        [ch.id]
      );
    }

    return (
      <main>
        <section className="hero">
          <div className="eyebrow">Friend Challenge</div>
          <h1>This mask has expired.</h1>
          <p>
            Challenges belong to a single Masquerade day. Start
            today&apos;s game to create or accept a new one.
          </p>
        </section>
      </main>
    );
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
          and challenged_id is null
      `,
      [user.id, ch.id]
    );
  }

  const mine = (
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

  const theirs = (
    await query<any>(
      `
        select *
        from game_sessions
        where user_id = $1
          and daily_game_id = $2
          and status = 'completed'
      `,
      [ch.challenger_id, ch.daily_game_id]
    )
  ).rows[0];

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Today&apos;s Friend Challenge</div>
        <h1>
          {ch.display_name || ch.challenger_email} challenged you.
        </h1>
        <p>
          {String(ch.difficulty_band).toUpperCase()} · {challengeDate}
        </p>
      </section>

      <section className="card">
        {mine?.status === "completed" && theirs ? (
          <>
            <h2>Challenge complete</h2>
            <p>
              You: {mine.score} pts · {mine.pure_solves} Pure Solves
            </p>
            <p>
              Challenger: {theirs.score} pts · {theirs.pure_solves} Pure
              Solves
            </p>
          </>
        ) : (
          <>
            <h2>
              {mine?.status === "active"
                ? "Your challenge is in progress."
                : "Same five puzzles. No spoilers."}
            </h2>

            <form
              action="/api/challenge/start"
              method="post"
            >
              <input
                type="hidden"
                name="code"
                value={code}
              />
              <button className="btn primary">
                {mine?.status === "active"
                  ? "CONTINUE CHALLENGE"
                  : "ACCEPT & PLAY"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
