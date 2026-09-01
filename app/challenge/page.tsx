import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { todayGameDate } from "@/lib/day";
import { redirect } from "next/navigation";

export default async function Challenge() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayGameDate();

  // Past challenges are no longer playable once the Masquerade day changes.
  await query(
    `
      update challenges c
      set status = 'expired'
      from daily_games dg
      where c.daily_game_id = dg.id
        and dg.game_date < $1
        and c.status in ('pending', 'accepted')
        and (
          c.challenger_id = $2
          or c.challenged_id = $2
          or lower(c.challenged_email) = lower($3)
        )
    `,
    [today, user.id, user.email]
  );

  const rows = (
    await query<any>(
      `
        select
          c.*,
          dg.difficulty_band,
          dg.game_date
        from challenges c
        join daily_games dg
          on dg.id = c.daily_game_id
        where dg.game_date = $1
          and (
            c.challenger_id = $2
            or c.challenged_id = $2
            or lower(c.challenged_email) = lower($3)
          )
        order by c.created_at desc
      `,
      [today, user.id, user.email]
    )
  ).rows;

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Today&apos;s Challenges</div>
        <h1>Make it personal.</h1>
        <p>
          Challenge friends to today&apos;s exact Masquerade. Challenge links
          expire when the day ends.
        </p>
      </section>

      <section className="card">
        <form action="/api/challenge/create" method="post">
          <input
            className="answer"
            name="friend_email"
            type="email"
            placeholder="Friend's email"
            required
          />
          <button
            className="btn primary"
            style={{ marginTop: 10 }}
          >
            CREATE CHALLENGE
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Today&apos;s challenges</h2>
        {rows.length ? (
          rows.map((x: any) => (
            <p key={x.id}>
              {x.status} ·{" "}
              <a href={`/c/${x.invite_code}`}>
                {x.invite_code}
              </a>
            </p>
          ))
        ) : (
          <p>No challenges today.</p>
        )}
      </section>
    </main>
  );
}
