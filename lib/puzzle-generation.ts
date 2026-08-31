import crypto from "crypto";
import { getPool } from "@/lib/db";

export type Difficulty =
  | "clever"
  | "devious"
  | "fiendish";

type ClueType =
  | "word"
  | "rebus"
  | "pattern"
  | "logic"
  | "math";

type Candidate = {
  candidate_id: string;
  clue_type: ClueType;
  clue_text: string;

  answer: string;
  accepted_answers: string[];
  numeric_answer: boolean;

  difficulty_score: number;

  hint_1: string;
  hint_2: string;
  hint_3: string;

  explanation: string;
};

type Review = {
  candidate_id: string;

  approved: boolean;
  review_score: number;

  answer_fair: boolean;
  difficulty_fit: boolean;
  hint_quality: boolean;
  originality: boolean;
  family_safe: boolean;

  reason: string;
};

type ReviewedCandidate = Candidate & {
  fingerprint: string;
  review: Review;
};

const GENERATOR_MODEL =
  process.env.PUZZLE_GENERATOR_MODEL ||
  "gpt-5.6-terra";

const REVIEWER_MODEL =
  process.env.PUZZLE_REVIEWER_MODEL ||
  "gpt-5.6-sol";

const REVIEW_THRESHOLD = 80;

const MAX_GENERATION_ROUNDS = 2;

const SCORE_RANGES: Record<
  Difficulty,
  [number, number]
> = {
  clever: [35, 60],
  devious: [55, 80],
  fiendish: [70, 95],
};

const ALLOWED_CLUE_TYPES = new Set<ClueType>([
  "word",
  "rebus",
  "pattern",
  "logic",
  "math",
]);

function normalizeForFingerprint(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function makeFingerprint(
  clue: string,
  answer: string
): string {
  return crypto
    .createHash("sha256")
    .update(
      `${normalizeForFingerprint(
        clue
      )}|${normalizeForFingerprint(answer)}`
    )
    .digest("hex");
}

function clean(value: string): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function isOneWord(value: string): boolean {
  return /^[a-z]+(?:[-'][a-z]+)?$/i.test(
    value.trim()
  );
}

/*
 * Masquerade currently supports spelled-out numeric
 * answers most reliably from 0-99, so AI-generated
 * numeric puzzles are deliberately restricted to that
 * range.
 */
function isSupportedNumber(
  value: string
): boolean {
  if (!/^\d{1,2}$/.test(value.trim())) {
    return false;
  }

  const n = Number(value);

  return (
    Number.isInteger(n) &&
    n >= 0 &&
    n <= 99
  );
}

function hintContainsAnswer(
  answer: string,
  hint: string
): boolean {
  const cleanedAnswer = answer.trim();

  if (cleanedAnswer.length < 3) {
    return false;
  }

  const escaped =
    cleanedAnswer.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  return new RegExp(
    `\\b${escaped}\\b`,
    "i"
  ).test(hint);
}

function validateCandidate(
  candidate: Candidate,
  difficulty: Difficulty
): string[] {
  const problems: string[] = [];

  candidate.candidate_id =
    clean(candidate.candidate_id);

  candidate.clue_text =
    clean(candidate.clue_text);

  candidate.answer =
    clean(candidate.answer);

  candidate.hint_1 =
    clean(candidate.hint_1);

  candidate.hint_2 =
    clean(candidate.hint_2);

  candidate.hint_3 =
    clean(candidate.hint_3);

  candidate.explanation =
    clean(candidate.explanation);

  candidate.accepted_answers =
    Array.isArray(
      candidate.accepted_answers
    )
      ? candidate.accepted_answers
          .map(clean)
          .filter(Boolean)
          .slice(0, 6)
      : [];

  if (!candidate.candidate_id) {
    problems.push(
      "candidate_id is missing"
    );
  }

  if (
    !ALLOWED_CLUE_TYPES.has(
      candidate.clue_type
    )
  ) {
    problems.push(
      "invalid clue type"
    );
  }

  if (
    !candidate.clue_text ||
    candidate.clue_text.length > 240
  ) {
    problems.push(
      "clue must be 1-240 characters"
    );
  }

  if (
    !candidate.answer ||
    candidate.answer.length > 40
  ) {
    problems.push(
      "answer must be 1-40 characters"
    );
  }

  if (candidate.numeric_answer) {
    if (
      !isSupportedNumber(
        candidate.answer
      )
    ) {
      problems.push(
        "numeric answer must be an integer from 0-99"
      );
    }
  } else if (
    !isOneWord(candidate.answer)
  ) {
    problems.push(
      "answer must be one word"
    );
  }

  for (
    const accepted of
    candidate.accepted_answers
  ) {
    if (
      candidate.numeric_answer
        ? !isSupportedNumber(accepted) &&
          !isOneWord(accepted)
        : !isOneWord(accepted)
    ) {
      problems.push(
        `invalid accepted answer: ${accepted}`
      );
    }
  }

  const [minScore, maxScore] =
    SCORE_RANGES[difficulty];

  if (
    !Number.isInteger(
      candidate.difficulty_score
    ) ||
    candidate.difficulty_score <
      minScore ||
    candidate.difficulty_score >
      maxScore
  ) {
    problems.push(
      `difficulty score must be ${minScore}-${maxScore}`
    );
  }

  const hints = [
    candidate.hint_1,
    candidate.hint_2,
    candidate.hint_3,
  ];

  for (
    let i = 0;
    i < hints.length;
    i++
  ) {
    const hint = hints[i];

    if (
      !hint ||
      hint.length > 150
    ) {
      problems.push(
        `hint ${i + 1} must be 1-150 characters`
      );
    }

    if (
      hintContainsAnswer(
        candidate.answer,
        hint
      )
    ) {
      problems.push(
        `hint ${
          i + 1
        } contains the answer`
      );
    }
  }

  const normalizedHints =
    hints.map(
      normalizeForFingerprint
    );

  if (
    new Set(normalizedHints).size !==
    3
  ) {
    problems.push(
      "all three hints must be different"
    );
  }

  if (
    !candidate.explanation ||
    candidate.explanation.length >
      400
  ) {
    problems.push(
      "explanation must be 1-400 characters"
    );
  }

  return problems;
}

function difficultyPrompt(
  difficulty: Difficulty
): string {
  if (difficulty === "clever") {
    return `
CLEVER:
Smart and approachable.
Usually one strong inferential step.
The solver should feel "I can get this."
Difficulty score: 35-60.
`;
  }

  if (difficulty === "devious") {
    return `
DEVIOUS:
A misleading first interpretation,
layered inference, or a two-step insight.
Still fully fair from the clue alone.
Difficulty score: 55-80.
`;
  }

  return `
FIENDISH:
Deep lateral reasoning, a subtle
constraint, or a multi-stage insight.
Hard because of reasoning, never because
of obscure knowledge.
Difficulty score: 70-95.
`;
}

/*
 * Responses API structured-output schema.
 */
const candidateSchema = {
  type: "object",

  additionalProperties: false,

  properties: {
    candidates: {
      type: "array",

      items: {
        type: "object",

        additionalProperties: false,

        properties: {
          candidate_id: {
            type: "string",
          },

          clue_type: {
            type: "string",

            enum: [
              "word",
              "rebus",
              "pattern",
              "logic",
              "math",
            ],
          },

          clue_text: {
            type: "string",
          },

          answer: {
            type: "string",
          },

          accepted_answers: {
            type: "array",

            items: {
              type: "string",
            },
          },

          numeric_answer: {
            type: "boolean",
          },

          difficulty_score: {
            type: "integer",
          },

          hint_1: {
            type: "string",
          },

          hint_2: {
            type: "string",
          },

          hint_3: {
            type: "string",
          },

          explanation: {
            type: "string",
          },
        },

        required: [
          "candidate_id",
          "clue_type",
          "clue_text",
          "answer",
          "accepted_answers",
          "numeric_answer",
          "difficulty_score",
          "hint_1",
          "hint_2",
          "hint_3",
          "explanation",
        ],
      },
    },
  },

  required: ["candidates"],
};

const reviewSchema = {
  type: "object",

  additionalProperties: false,

  properties: {
    reviews: {
      type: "array",

      items: {
        type: "object",

        additionalProperties: false,

        properties: {
          candidate_id: {
            type: "string",
          },

          approved: {
            type: "boolean",
          },

          review_score: {
            type: "integer",
          },

          answer_fair: {
            type: "boolean",
          },

          difficulty_fit: {
            type: "boolean",
          },

          hint_quality: {
            type: "boolean",
          },

          originality: {
            type: "boolean",
          },

          family_safe: {
            type: "boolean",
          },

          reason: {
            type: "string",
          },
        },

        required: [
          "candidate_id",
          "approved",
          "review_score",
          "answer_fair",
          "difficulty_fit",
          "hint_quality",
          "originality",
          "family_safe",
          "reason",
        ],
      },
    },
  },

  required: ["reviews"],
};

function extractOpenAIText(
  payload: any
): string {
  if (
    typeof payload?.output_text ===
      "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text;
  }

  const parts: string[] = [];

  for (
    const item of
    payload?.output || []
  ) {
    for (
      const content of
      item?.content || []
    ) {
      if (
        content?.type ===
          "output_text" &&
        typeof content.text ===
          "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  if (!parts.length) {
    throw new Error(
      "OpenAI response contained no output text."
    );
  }

  return parts.join("");
}

async function structuredResponse<T>(
  model: string,
  instructions: string,
  input: string,
  schemaName: string,
  schema: Record<string, unknown>
): Promise<T> {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured."
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${apiKey}`,

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        model,

        store: false,

        instructions,

        input,

        text: {
          format: {
            type: "json_schema",

            name: schemaName,

            strict: true,

            schema,
          },
        },
      }),
    }
  );

  const payload =
    await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        `OpenAI HTTP ${response.status}`
    );
  }

  const text =
    extractOpenAIText(payload);

  return JSON.parse(text) as T;
}

async function generateCandidates(
  difficulty: Difficulty,
  targetDate: string,
  recentPuzzles: {
    clue_text: string;
    answer: string;
  }[],
  round: number
): Promise<Candidate[]> {
  const history =
    recentPuzzles
      .slice(0, 60)
      .map(
        (p) =>
          `- ${JSON.stringify(
            p.clue_text
          )} -> ${JSON.stringify(
            p.answer
          )}`
      )
      .join("\n");

  const instructions = `
You are the senior puzzle constructor
for MASQUERADE, a premium daily
cognitive puzzle game.

Brand promise:
"See less. Think more."

The desired emotional sequence is:

"I can solve this"
→ "Wait…"
→ "I think I see it…"
→ "AHA!"
→ "I need to show someone."

Create concise, elegant, family-safe
puzzles for smart players.

Allowed clue types:
word, rebus, pattern, logic, math.

NON-NEGOTIABLE RULES:

- No trivia.
- No niche facts.
- No celebrities or pop culture.
- No historical-date knowledge.
- No geography knowledge.
- No audio or video mechanics.
- No picture-sequence guessing.
- Every clue must contain enough
  information to solve the puzzle.
- One-word answers wherever possible.
- Numeric answers may only be whole
  numbers from 0 through 99.
- Exactly three progressive hints.
- Hint 1 nudges the mechanism.
- Hint 2 narrows the route.
- Hint 3 gets close but does NOT
  state the answer.
- Never place the answer verbatim
  inside a hint.
- Avoid famous stock riddles and
  common internet chestnuts.
- Avoid ambiguous pattern sequences.
- Pattern rules must be compelling,
  not merely mathematically possible.
- Logic puzzles must be internally
  consistent.
- Rebus puzzles must work in plain
  text / Unicode.
- Family-safe for children and adults.
- Difficulty must come from reasoning,
  not obscure knowledge.
- Prefer elegant Aha moments.
- Do not repeat or lightly disguise
  recent Masquerade puzzles.

${difficultyPrompt(difficulty)}
`;

  const input = `
Target date: ${targetDate}
Difficulty: ${difficulty}
Generation round: ${round}

Generate 12 genuinely different
candidate puzzles.

Recent Masquerade puzzles that must
not be repeated or lightly rephrased:

${history || "(none)"}
`;

  const result =
    await structuredResponse<{
      candidates: Candidate[];
    }>(
      GENERATOR_MODEL,
      instructions,
      input,
      `masquerade_${difficulty}_generation`,
      candidateSchema
    );

  return result.candidates || [];
}

async function reviewCandidates(
  difficulty: Difficulty,
  candidates: Candidate[],
  recentPuzzles: {
    clue_text: string;
    answer: string;
  }[]
): Promise<Review[]> {
  const instructions = `
You are Masquerade's independent
senior puzzle editor.

You did NOT construct these puzzles.

Reject aggressively.

A puzzle may be approved ONLY when:

1. There is one clearly best answer.

2. The answer follows fairly from the
   clue without obscure knowledge.

3. The intended insight produces a
   satisfying "Aha!"

4. The requested difficulty is correct.

5. Hint 1 is subtle.

6. Hint 2 meaningfully narrows the route.

7. Hint 3 strongly assists the player
   but still does not reveal the answer.

8. The puzzle is family-safe.

9. It is not a famous/common stock
   riddle or near-copy.

10. A smart solver could explain why
    the answer is correct afterward.

11. Pattern/math puzzles have a uniquely
    compelling intended rule.

12. The puzzle does not depend on
    trivia.

13. Difficulty comes from thinking,
    not missing information.

Score harshly.

80 = publishable.
90+ = exceptional.

Set approved=false if ANY quality
boolean is false.

Never approve a mediocre puzzle merely
to fill a quota.

Requested difficulty:
${difficulty}
`;

  const input = JSON.stringify(
    {
      recent_puzzles:
        recentPuzzles.slice(0, 80),

      candidates,
    },
    null,
    2
  );

  const result =
    await structuredResponse<{
      reviews: Review[];
    }>(
      REVIEWER_MODEL,
      instructions,
      input,
      `masquerade_${difficulty}_review`,
      reviewSchema
    );

  return result.reviews || [];
}

function reviewPasses(
  review: Review
): boolean {
  return (
    review.approved === true &&
    review.review_score >=
      REVIEW_THRESHOLD &&
    review.answer_fair === true &&
    review.difficulty_fit === true &&
    review.hint_quality === true &&
    review.originality === true &&
    review.family_safe === true
  );
}

function chooseFive(
  candidates: ReviewedCandidate[]
): ReviewedCandidate[] {
  const sorted =
    [...candidates].sort(
      (a, b) => {
        if (
          b.review.review_score !==
          a.review.review_score
        ) {
          return (
            b.review.review_score -
            a.review.review_score
          );
        }

        return (
          b.difficulty_score -
          a.difficulty_score
        );
      }
    );

  const chosen:
    ReviewedCandidate[] = [];

  const clueCounts =
    new Map<string, number>();

  /*
   * First pass: maximum two of any
   * one clue type.
   */
  for (const candidate of sorted) {
    if (chosen.length === 5) break;

    const current =
      clueCounts.get(
        candidate.clue_type
      ) || 0;

    if (current >= 2) continue;

    chosen.push(candidate);

    clueCounts.set(
      candidate.clue_type,
      current + 1
    );
  }

  /*
   * Require at least 3 different clue
   * types in each daily difficulty.
   */
  if (
    chosen.length === 5 &&
    new Set(
      chosen.map(
        (x) => x.clue_type
      )
    ).size >= 3
  ) {
    return chosen;
  }

  return [];
}

async function alreadyPublished(
  targetDate: string,
  difficulty: Difficulty
): Promise<boolean> {
  const result =
    await getPool().query<{
      puzzle_count: number;
    }>(
      `
        select
          count(dgp.puzzle_id)::int
            as puzzle_count
        from daily_games dg
        left join daily_game_puzzles dgp
          on dgp.daily_game_id = dg.id
        where dg.game_date = $1
          and dg.difficulty_band = $2
          and dg.published = true
      `,
      [targetDate, difficulty]
    );

  return (
    Number(
      result.rows[0]
        ?.puzzle_count || 0
    ) === 5
  );
}

function assertDate(
  targetDate: string
): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      targetDate
    )
  ) {
    throw new Error(
      "targetDate must be YYYY-MM-DD."
    );
  }

  const parsed =
    new Date(
      `${targetDate}T00:00:00Z`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    throw new Error(
      "Invalid targetDate."
    );
  }
}

export async function generateDailyDifficulty(
  targetDate: string,
  difficulty: Difficulty
) {
  assertDate(targetDate);

  if (
    ![
      "clever",
      "devious",
      "fiendish",
    ].includes(difficulty)
  ) {
    throw new Error(
      "Invalid difficulty."
    );
  }

  if (
    await alreadyPublished(
      targetDate,
      difficulty
    )
  ) {
    return {
      targetDate,
      difficulty,
      skipped: true,
      status: "already-published",
    };
  }

  /*
   * Never replace a game after someone
   * has started playing it.
   */
  const sessionResult =
    await getPool().query<{
      count: number;
    }>(
      `
        select count(*)::int as count
        from game_sessions gs
        join daily_games dg
          on dg.id =
             gs.daily_game_id
        where dg.game_date = $1
          and dg.difficulty_band = $2
      `,
      [targetDate, difficulty]
    );

  if (
    Number(
      sessionResult.rows[0]
        ?.count || 0
    ) > 0
  ) {
    throw new Error(
      `Cannot regenerate ${targetDate} ${difficulty}: player sessions already exist.`
    );
  }

  const batch =
    (
      await getPool().query<{
        id: string;
      }>(
        `
          insert into
            puzzle_generation_batches(
              target_date,
              difficulty_band,
              status,
              generator_model,
              reviewer_model,
              started_at,
              completed_at,
              error_message,
              candidate_count,
              accepted_count
            )
          values(
            $1,
            $2,
            'generating',
            $3,
            $4,
            now(),
            null,
            null,
            0,
            0
          )

          on conflict(
            target_date,
            difficulty_band
          )

          do update set
            status = 'generating',
            generator_model =
              excluded.generator_model,
            reviewer_model =
              excluded.reviewer_model,
            started_at = now(),
            completed_at = null,
            error_message = null,
            candidate_count = 0,
            accepted_count = 0

          returning id
        `,
        [
          targetDate,
          difficulty,
          GENERATOR_MODEL,
          REVIEWER_MODEL,
        ]
      )
    ).rows[0];

  try {
    /*
     * Load historical puzzles both for
     * duplicate fingerprints and to
     * provide recent context to the
     * models.
     */
    const history =
      await getPool().query<{
        clue_text: string;
        answer: string;
        content_fingerprint:
          | string
          | null;
      }>(
        `
          select
            clue_text,
            answer,
            content_fingerprint

          from puzzles

          where status <> 'retired'

          order by created_at desc

          limit 600
        `
      );

    const recentPuzzles =
      history.rows.map(
        (row) => ({
          clue_text:
            row.clue_text,

          answer:
            row.answer,
        })
      );

    const historicalFingerprints =
      new Set(
        history.rows.map(
          (row) =>
            row.content_fingerprint ||
            makeFingerprint(
              row.clue_text,
              row.answer
            )
        )
      );

    const acceptedPool:
      ReviewedCandidate[] = [];

    const seenDuringGeneration =
      new Set<string>();

    let totalCandidates = 0;

    for (
      let round = 1;
      round <=
      MAX_GENERATION_ROUNDS;
      round++
    ) {
      const generated =
        await generateCandidates(
          difficulty,
          targetDate,
          recentPuzzles,
          round
        );

      totalCandidates +=
        generated.length;

      const deterministicPass:
        Candidate[] = [];

      for (
        const candidate of
        generated
      ) {
        const problems =
          validateCandidate(
            candidate,
            difficulty
          );

        if (problems.length) {
          continue;
        }

        const fp =
          makeFingerprint(
            candidate.clue_text,
            candidate.answer
          );

        if (
          historicalFingerprints.has(
            fp
          ) ||
          seenDuringGeneration.has(
            fp
          )
        ) {
          continue;
        }

        seenDuringGeneration.add(fp);

        deterministicPass.push(
          candidate
        );
      }

      if (
        deterministicPass.length ===
        0
      ) {
        continue;
      }

      const reviews =
        await reviewCandidates(
          difficulty,
          deterministicPass,
          recentPuzzles
        );

      const reviewsById =
        new Map(
          reviews.map(
            (review) => [
              review.candidate_id,
              review,
            ]
          )
        );

      for (
        const candidate of
        deterministicPass
      ) {
        const review =
          reviewsById.get(
            candidate.candidate_id
          );

        if (
          !review ||
          !reviewPasses(review)
        ) {
          continue;
        }

        acceptedPool.push({
          ...candidate,

          fingerprint:
            makeFingerprint(
              candidate.clue_text,
              candidate.answer
            ),

          review,
        });
      }

      const chosen =
        chooseFive(
          acceptedPool
        );

      if (
        chosen.length === 5
      ) {
        /*
         * Pick the strongest/hardest
         * approved puzzle as position 5.
         */
        const finalMask =
          [...chosen].sort(
            (a, b) =>
              b.difficulty_score +
                b.review
                  .review_score /
                  10 -
              (a.difficulty_score +
                a.review
                  .review_score /
                  10)
          )[0];

        const firstFour =
          chosen
            .filter(
              (x) =>
                x.fingerprint !==
                finalMask.fingerprint
            )
            .sort(
              (a, b) =>
                a.difficulty_score -
                b.difficulty_score
            );

        const ordered = [
          ...firstFour,
          finalMask,
        ];

        const client =
          await getPool().connect();

        try {
          await client.query(
            "begin"
          );

          const game =
            (
              await client.query<{
                id: string;
              }>(
                `
                  insert into daily_games(
                    game_date,
                    difficulty_band,
                    published
                  )

                  values(
                    $1,
                    $2,
                    true
                  )

                  on conflict(
                    game_date,
                    difficulty_band
                  )

                  do update set
                    published = true

                  returning id
                `,
                [
                  targetDate,
                  difficulty,
                ]
              )
            ).rows[0];

          /*
           * Safe because sessions were
           * checked above.
           */
          await client.query(
            `
              delete from
                daily_game_puzzles

              where
                daily_game_id = $1
            `,
            [game.id]
          );

          for (
            let index = 0;
            index <
            ordered.length;
            index++
          ) {
            const puzzle =
              ordered[index];

            const position =
              index + 1;

            const isFinalMask =
              position === 5;

            const inserted =
              (
                await client.query<{
                  id: string;
                }>(
                  `
                    insert into puzzles(
                      clue_type,
                      clue_text,
                      answer,
                      accepted_answers,
                      numeric_answer,
                      difficulty_score,
                      difficulty_band,

                      hint_1,
                      hint_2,
                      hint_3,

                      explanation,

                      is_final_mask,
                      status,
                      source,

                      generation_batch_id,
                      content_fingerprint,

                      review_score,
                      review_notes,

                      scheduled_for
                    )

                    values(
                      $1,
                      $2,
                      $3,
                      $4,
                      $5,
                      $6,
                      $7,
                      $8,
                      $9,
                      $10,
                      $11,
                      $12,
                      'published',
                      'ai_generated',
                      $13,
                      $14,
                      $15,
                      $16::jsonb,
                      $17
                    )

                    returning id
                  `,
                  [
                    puzzle.clue_type,

                    puzzle.clue_text,

                    puzzle.answer
                      .toLowerCase(),

                    puzzle
                      .accepted_answers
                      .map((x) =>
                        x.toLowerCase()
                      ),

                    puzzle.numeric_answer,

                    puzzle.difficulty_score,

                    difficulty,

                    puzzle.hint_1,

                    puzzle.hint_2,

                    puzzle.hint_3,

                    puzzle.explanation,

                    isFinalMask,

                    batch.id,

                    puzzle.fingerprint,

                    puzzle.review
                      .review_score,

                    JSON.stringify({
                      reason:
                        puzzle.review
                          .reason,

                      answer_fair:
                        puzzle.review
                          .answer_fair,

                      difficulty_fit:
                        puzzle.review
                          .difficulty_fit,

                      hint_quality:
                        puzzle.review
                          .hint_quality,

                      originality:
                        puzzle.review
                          .originality,

                      family_safe:
                        puzzle.review
                          .family_safe,
                    }),

                    targetDate,
                  ]
                )
              ).rows[0];

            await client.query(
              `
                insert into
                  daily_game_puzzles(
                    daily_game_id,
                    puzzle_id,
                    position
                  )

                values(
                  $1,
                  $2,
                  $3
                )
              `,
              [
                game.id,
                inserted.id,
                position,
              ]
            );
          }

          await client.query(
            `
              update
                puzzle_generation_batches

              set
                status =
                  'published',

                candidate_count =
                  $2,

                accepted_count =
                  5,

                completed_at =
                  now(),

                details =
                  $3::jsonb

              where id = $1
            `,
            [
              batch.id,

              totalCandidates,

              JSON.stringify({
                published:
                  ordered.map(
                    (
                      candidate,
                      index
                    ) => ({
                      position:
                        index + 1,

                      clue_type:
                        candidate
                          .clue_type,

                      review_score:
                        candidate
                          .review
                          .review_score,

                      difficulty_score:
                        candidate
                          .difficulty_score,
                    })
                  ),
              }),
            ]
          );

          await client.query(
            "commit"
          );
        } catch (error) {
          await client.query(
            "rollback"
          );

          throw error;
        } finally {
          client.release();
        }

        return {
          targetDate,
          difficulty,

          skipped: false,

          status: "published",

          candidatesGenerated:
            totalCandidates,

          puzzlesPublished: 5,

          generatorModel:
            GENERATOR_MODEL,

          reviewerModel:
            REVIEWER_MODEL,
        };
      }
    }

    throw new Error(
      `Could not produce five publication-quality ${difficulty} puzzles after ${MAX_GENERATION_ROUNDS} rounds.`
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown generation error";

    await getPool().query(
      `
        update
          puzzle_generation_batches

        set
          status = 'failed',

          error_message = $2,

          completed_at = now()

        where id = $1
      `,
      [
        batch.id,
        message.slice(0, 4000),
      ]
    );

    throw error;
  }
}