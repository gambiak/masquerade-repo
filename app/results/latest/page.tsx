import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
import ShareButton from "@/components/ShareButton";

type SearchParams = {
  difficulty?: string;
};

export default async function Latest({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const requestedDifficulty =
    typeof params.difficulty === "string"
      ? params.difficulty.toLowerCase()
      : null;

  const validDifficulty =
    requestedDifficulty &&
    ["clever", "devious", "fiendish"].includes(requestedDifficulty)
      ? requestedDifficulty
      : null;

  const result = validDifficulty
    ? (
        await query<any>(
          `
            select
              gs.*,
              dg.game_number
            from game_sessions gs
            join daily_games dg
              on dg.id = gs.daily_game_id
            where gs.user_id = $1
              and gs.status = 'completed'
              and gs.difficulty_band = $2
            order by gs.completed_at desc
            limit 1
          `,
          [user.id, validDifficulty]
        )
      ).rows[0]
    : (
        await query<any>(
          `
            select
              gs.*,
              dg.game_number
            from game_sessions gs
            join daily_games dg
              on dg.id = gs.daily_game_id
            where gs.user_id = $1
              and gs.status = 'completed'
            order by gs.completed_at desc
            limit 1
          `,
          [user.id]
        )
      ).rows[0];

  if (!result) {
    redirect("/");
  }

  const puzzleResults = (
    await query<any>(
      `
        select
          pr.*,
          dgp.position
        from puzzle_results pr
        join daily_game_puzzles dgp
          on dgp.puzzle_id = pr.puzzle_id
         and dgp.daily_game_id = $1
        where pr.session_id = $2
        order by dgp.position
      `,
      [result.daily_game_id, result.id]
    )
  ).rows;

  const grid = puzzleResults
    .map((item: any) => {
      if (item.pure_solve) {
        return "🟣";
      }

      if (Number(item.hints_used) === 0) {
        return "✅";
      }

      return "💡".repeat(
        Math.min(Number(item.hints_used), 3)
      );
    })
    .join(" ");

  const seconds = Math.floor(
    Number(result.solve_time_ms || 0) / 1000
  );

  const difficultyLabel =
    result.difficulty_band.charAt(0).toUpperCase() +
    result.difficulty_band.slice(1);

  const shareText =
    `MASQUERADE #${result.game_number}\n` +
    `${difficultyLabel}\n` +
    `${result.score} pts\n` +
    `${grid}\n` +
    `🎭 ${result.pure_solves} Pure Solves · ` +
    `${result.hints_used} hints · ` +
    `${seconds} sec`;

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Spoiler-free result</div>

        <h1>
          Masquerade #{result.game_number} complete.
        </h1>

        <p>{difficultyLabel}</p>
      </section>

      <section className="share">
        <div className="eyebrow result-eyebrow">
          {difficultyLabel}
        </div>

        <h2>{result.score} pts</h2>

        <p className="result-grid">
          {grid}
        </p>

        <p>
          {result.pure_solves} Pure Solves ·{" "}
          {result.hints_used} hints ·{" "}
          {seconds} sec
        </p>

        <ShareButton text={shareText} />
      </section>
    </main>
  );
}