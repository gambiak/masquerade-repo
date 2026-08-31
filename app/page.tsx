import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function Home() {
  const user = await getCurrentUser();

  let active: any = null;
  let last: any = null;

  if (user) {
    active =
      (
        await query<any>(
          `
            select *
            from game_sessions
            where user_id = $1
              and status = 'active'
            order by started_at desc
            limit 1
          `,
          [user.id]
        )
      ).rows[0] || null;

    last =
      (
        await query<any>(
          `
            select *
            from game_sessions
            where user_id = $1
              and status = 'completed'
            order by completed_at desc
            limit 1
          `,
          [user.id]
        )
      ).rows[0] || null;
  }

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">
          Daily Masquerade
        </div>

        <h1>
          See less.
          <br />
          Think more.
        </h1>

        <p>
          Five shared daily puzzles. Challenge friends,
          compare spoiler-free results, and build a morning
          ritual.
        </p>
      </section>

      {!user ? (
        <section className="card">
          <h2>Play with friends</h2>

          <p>
            Sign in to save progress, challenge friends,
            join crews, and compare daily results.
          </p>

          <Link
            className="btn primary"
            href="/login"
          >
            SIGN IN / CREATE ACCOUNT
          </Link>
        </section>
      ) : (
        <section className="card">
          <div className="eyebrow">
            Today&apos;s game
          </div>

          <h2>
            {active
              ? "Your game is waiting."
              : "Ready for today's Masquerade?"}
          </h2>

          <div className="home-primary-action">
            <Link
              className="btn primary"
              href={active ? "/play" : "/start"}
            >
              {active
                ? "CONTINUE GAME"
                : "START TODAY'S MASQUERADE"}
            </Link>
          </div>
        </section>
      )}

      {last && (
        <section className="share">
          <div className="eyebrow result-eyebrow">
            Last result
          </div>

          <h2>
            {last.score} pts ·{" "}
            {last.pure_solves} Pure Solves
          </h2>

          <p>
            {last.hints_used} hints ·{" "}
            {Math.floor(
              Number(last.solve_time_ms || 0) / 1000
            )}{" "}
            sec
          </p>

          <Link
            className="btn result-link"
            href="/results/latest"
          >
            VIEW &amp; SHARE RESULT
          </Link>
        </section>
      )}
    </main>
  );
}