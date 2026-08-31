import crypto from "crypto";
import { getPool } from "@/lib/db";

export type Difficulty = "clever" | "devious" | "fiendish";
export type GenerationStage = "generate" | "review" | "publish";

type ClueType = "word" | "rebus" | "pattern" | "logic" | "math";

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

type StoredCandidate = Candidate & {
  id: string;
  batch_id: string;
  content_fingerprint: string;
  review_status: "pending" | "approved" | "rejected";
  review_score: number | null;
  review_notes: Record<string, unknown> | null;
};

type ReviewedCandidate = Candidate & {
  fingerprint: string;
  review: Review;
};

type RejectionFeedbackRow = {
  candidate_id: string;
  clue_type: ClueType;
  clue_text: string;
  answer: string;
  review_score: number | null;
  review_notes: Record<string, unknown> | null;
};

const GENERATOR_MODEL =
  process.env.PUZZLE_GENERATOR_MODEL || "gpt-5.6-terra";
const REVIEWER_MODEL =
  process.env.PUZZLE_REVIEWER_MODEL || "gpt-5.6-sol";

const REVIEW_THRESHOLD = 80;
const MAX_GENERATION_ROUNDS = 4;
const CANDIDATES_PER_ROUND = 12;

const SCORE_RANGES: Record<Difficulty, [number, number]> = {
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

function normalizeForFingerprint(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function makeFingerprint(clue: string, answer: string): string {
  return crypto
    .createHash("sha256")
    .update(
      `${normalizeForFingerprint(clue)}|${normalizeForFingerprint(answer)}`
    )
    .digest("hex");
}

function clean(value: string): string {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function isOneWord(value: string): boolean {
  return /^[a-z]+(?:[-'][a-z]+)?$/i.test(value.trim());
}

function isSupportedNumber(value: string): boolean {
  if (!/^\d{1,2}$/.test(value.trim())) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 99;
}

function hintContainsAnswer(answer: string, hint: string): boolean {
  const cleanedAnswer = answer.trim();
  if (cleanedAnswer.length < 3) return false;

  const escaped = cleanedAnswer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(hint);
}

function validateCandidate(
  candidate: Candidate,
  difficulty: Difficulty
): string[] {
  const problems: string[] = [];

  candidate.candidate_id = clean(candidate.candidate_id);
  candidate.clue_text = clean(candidate.clue_text);
  candidate.answer = clean(candidate.answer);
  candidate.hint_1 = clean(candidate.hint_1);
  candidate.hint_2 = clean(candidate.hint_2);
  candidate.hint_3 = clean(candidate.hint_3);
  candidate.explanation = clean(candidate.explanation);
  candidate.accepted_answers = Array.isArray(candidate.accepted_answers)
    ? candidate.accepted_answers.map(clean).filter(Boolean).slice(0, 6)
    : [];

  if (!candidate.candidate_id) problems.push("candidate_id is missing");
  if (!ALLOWED_CLUE_TYPES.has(candidate.clue_type)) {
    problems.push("invalid clue type");
  }

  if (!candidate.clue_text || candidate.clue_text.length > 240) {
    problems.push("clue must be 1-240 characters");
  }

  if (!candidate.answer || candidate.answer.length > 40) {
    problems.push("answer must be 1-40 characters");
  }

  if (candidate.numeric_answer) {
    if (!isSupportedNumber(candidate.answer)) {
      problems.push("numeric answer must be an integer from 0-99");
    }
  } else if (!isOneWord(candidate.answer)) {
    problems.push("answer must be one word");
  }

  for (const accepted of candidate.accepted_answers) {
    if (
      candidate.numeric_answer
        ? !isSupportedNumber(accepted) && !isOneWord(accepted)
        : !isOneWord(accepted)
    ) {
      problems.push(`invalid accepted answer: ${accepted}`);
    }
  }

  const [minScore, maxScore] = SCORE_RANGES[difficulty];
  if (
    !Number.isInteger(candidate.difficulty_score) ||
    candidate.difficulty_score < minScore ||
    candidate.difficulty_score > maxScore
  ) {
    problems.push(`difficulty score must be ${minScore}-${maxScore}`);
  }

  const hints = [candidate.hint_1, candidate.hint_2, candidate.hint_3];
  for (let i = 0; i < hints.length; i++) {
    const hint = hints[i];
    if (!hint || hint.length > 150) {
      problems.push(`hint ${i + 1} must be 1-150 characters`);
    }
    if (hintContainsAnswer(candidate.answer, hint)) {
      problems.push(`hint ${i + 1} contains the answer`);
    }
  }

  if (new Set(hints.map(normalizeForFingerprint)).size !== 3) {
    problems.push("all three hints must be different");
  }

  if (!candidate.explanation || candidate.explanation.length > 400) {
    problems.push("explanation must be 1-400 characters");
  }

  return problems;
}

function difficultyPrompt(difficulty: Difficulty): string {
  if (difficulty === "clever") {
    return `
CLEVER:
Smart and approachable, but never trivial or worksheet-like.
A strong player should usually need a real inference, reframing, or compact Aha.
The puzzle may look simple at first, but the solve should not be immediate.
Difficulty score: 35-60.
`;
  }

  if (difficulty === "devious") {
    return `
DEVIOUS:
A misleading first interpretation, layered inference, or two-step insight.
The solver should need to abandon an initially plausible approach.
Still fully fair from the clue alone.
Difficulty score: 55-80.
`;
  }

  return `
FIENDISH:
Deep lateral reasoning, a subtle constraint, or a multi-stage insight.
Hard because of reasoning, never because of obscure knowledge.
The final realization should feel inevitable in hindsight.
Difficulty score: 70-95.
`;
}

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
          candidate_id: { type: "string" },
          clue_type: {
            type: "string",
            enum: ["word", "rebus", "pattern", "logic", "math"],
          },
          clue_text: { type: "string" },
          answer: { type: "string" },
          accepted_answers: {
            type: "array",
            items: { type: "string" },
          },
          numeric_answer: { type: "boolean" },
          difficulty_score: { type: "integer" },
          hint_1: { type: "string" },
          hint_2: { type: "string" },
          hint_3: { type: "string" },
          explanation: { type: "string" },
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
          candidate_id: { type: "string" },
          approved: { type: "boolean" },
          review_score: { type: "integer" },
          answer_fair: { type: "boolean" },
          difficulty_fit: { type: "boolean" },
          hint_quality: { type: "boolean" },
          originality: { type: "boolean" },
          family_safe: { type: "boolean" },
          reason: { type: "string" },
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

function extractOpenAIText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  if (!parts.length) {
    throw new Error("OpenAI response contained no output text.");
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload?.error?.message || `OpenAI HTTP ${response.status}`
    );
  }

  return JSON.parse(extractOpenAIText(payload)) as T;
}

async function loadHistory() {
  return getPool().query<{
    clue_text: string;
    answer: string;
    content_fingerprint: string | null;
  }>(
    `
      select clue_text, answer, content_fingerprint
      from puzzles
      where status <> 'retired'
      order by created_at desc
      limit 600
    `
  );
}

function summarizeRejectedFeedback(rows: RejectionFeedbackRow[]): string {
  if (!rows.length) {
    return "No earlier candidates in this batch have been reviewed yet.";
  }

  const flagCounts: Record<string, number> = {
    answer_fair: 0,
    difficulty_fit: 0,
    hint_quality: 0,
    originality: 0,
    family_safe: 0,
  };

  const reasons: { score: number; text: string }[] = [];

  for (const row of rows) {
    const notes = row.review_notes || {};
    for (const flag of Object.keys(flagCounts)) {
      if (notes[flag] === false) flagCounts[flag]++;
    }

    const reason = clean(String(notes.reason || ""));
    if (reason) {
      reasons.push({ score: Number(row.review_score || 0), text: reason });
    }
  }

  reasons.sort((a, b) => b.score - a.score);

  const flagSummary = Object.entries(flagCounts)
    .filter(([, count]) => count > 0)
    .map(([flag, count]) => `- ${flag}: ${count} rejection(s)`)
    .join("\n");

  const reasonSummary = reasons
    .slice(0, 12)
    .map((item) => `- Score ${item.score}: ${item.text}`)
    .join("\n");

  return `
Earlier reviewer feedback from THIS batch:

Quality dimensions that failed:
${flagSummary || "- none recorded"}

Representative rejection reasons:
${reasonSummary || "- none recorded"}

Use this feedback as construction guidance. Do NOT merely paraphrase an earlier rejected candidate.
Solve the underlying quality problem that caused the rejection.
`;
}

async function loadRejectionFeedback(batchId: string) {
  const result = await getPool().query<RejectionFeedbackRow>(
    `
      select
        candidate_id,
        clue_type,
        clue_text,
        answer,
        review_score,
        review_notes
      from puzzle_generation_candidates
      where batch_id = $1
        and review_status = 'rejected'
      order by review_score desc nulls last, reviewed_at desc nulls last
      limit 40
    `,
    [batchId]
  );

  return summarizeRejectedFeedback(result.rows);
}

async function generateCandidates(
  difficulty: Difficulty,
  targetDate: string,
  recentPuzzles: { clue_text: string; answer: string }[],
  round: number,
  rejectionFeedback: string
): Promise<Candidate[]> {
  const history = recentPuzzles
    .slice(0, 60)
    .map(
      (p) =>
        `- ${JSON.stringify(p.clue_text)} -> ${JSON.stringify(p.answer)}`
    )
    .join("\n");

  const instructions = `
You are the senior puzzle constructor for MASQUERADE, a premium daily cognitive puzzle game.

Brand promise:
"See less. Think more."

Desired emotional sequence:
"I can solve this" → "Wait…" → "I think I see it…" → "AHA!" → "I need to show someone."

Your job is NOT to create generic puzzle-book filler.
Your job is to create concise, elegant, family-safe puzzles that smart people enjoy discussing afterward.

Allowed clue types:
word, rebus, pattern, logic, math.

NON-NEGOTIABLE RULES:
- No trivia, niche facts, celebrities, pop culture, historical-date knowledge, geography knowledge, or specialist vocabulary.
- No audio/video mechanics or picture-sequence guessing.
- Every clue must contain enough information to solve the puzzle fairly.
- One-word answers wherever possible.
- Numeric answers may only be whole numbers 0-99.
- Exactly three progressive hints.
- Hint 1 nudges the mechanism without restating the clue.
- Hint 2 meaningfully narrows the route.
- Hint 3 gets close but does NOT state or effectively spell out the answer.
- Never place the answer verbatim inside a hint.
- Avoid famous stock riddles and common internet chestnuts.
- Avoid ambiguous pattern sequences.
- Pattern rules must be compelling and retrospectively obvious, not merely mathematically possible.
- Logic puzzles must be internally consistent and require meaningful deduction.
- Rebus puzzles must work in plain text / Unicode.
- Family-safe for children and adults.
- Difficulty comes from reasoning, never obscure knowledge.
- Prefer elegant Aha moments over calculation volume.
- Do not repeat or lightly disguise recent Masquerade puzzles.
- Verify the answer, every clue statement, all three hints, and the explanation before returning a candidate.

QUALITY FLOOR — IMPORTANT:
Do NOT submit a candidate if its entire mechanism is basically one of these routine forms:
- obvious shared prefix or suffix completion;
- elementary compound-word matching;
- a commonplace dictionary-definition match with no twist;
- simple fixed/increasing/decreasing number or letter jumps;
- obvious consecutive-number arithmetic;
- elementary digit-sum or reversed-digit algebra;
- stock remainder/divisibility exercises;
- immediate one-step elimination among a few named objects;
- obvious add/remove/change-one-letter transformations;
- a standard worksheet sequence with no second insight.

Those mechanics may appear only when transformed by a genuinely fresh constraint, misdirection, dual interpretation, or elegant second realization.

CONSTRUCTION TARGETS:
- The clue should be compact, but the reasoning should have substance.
- The intended answer should be uniquely best, not merely one defensible possibility.
- A solver should be able to explain the solution cleanly after the Aha.
- Prefer mechanisms that make the clue look different after the solve.
- Across the 12 candidates, deliberately vary clue type and reasoning mechanism.
- Aim for at least 3 clue types in every batch of 12.
- Do not make more than 4 of the 12 candidates the same clue type.
- At least half the candidates should involve a non-obvious reframing, constraint interaction, or lateral insight rather than direct computation or recall.

${difficultyPrompt(difficulty)}
`;

  const input = `
Target date: ${targetDate}
Difficulty: ${difficulty}
Generation round: ${round} of ${MAX_GENERATION_ROUNDS}

Generate exactly ${CANDIDATES_PER_ROUND} genuinely different candidate puzzles.

This is an adaptive generation round. If reviewer feedback appears below, treat it as mandatory editorial guidance for improving this round.

${rejectionFeedback}

Recent Masquerade puzzles that must not be repeated or lightly rephrased:
${history || "(none)"}

Before finalizing each candidate, silently test:
1. Is the answer uniquely best?
2. Is there a real Aha rather than a routine worksheet operation?
3. Does the requested difficulty fit?
4. Are all three hints accurate, progressive, and non-revealing?
5. Is the explanation complete and logically correct?
6. Is the mechanism meaningfully different from the rejected examples and recent puzzle history?

Return only candidates that pass those checks.
`;

  const result = await structuredResponse<{ candidates: Candidate[] }>(
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
  recentPuzzles: { clue_text: string; answer: string }[]
): Promise<Review[]> {
  const instructions = `
You are Masquerade's independent senior puzzle editor.
You did NOT construct these puzzles.

Protect the quality bar. Do not approve mediocre material merely to fill a quota.

A puzzle may be approved ONLY when:
1. There is one clearly best answer.
2. The answer follows fairly from the clue without obscure knowledge.
3. The intended insight produces a satisfying Aha rather than a routine worksheet operation.
4. The requested difficulty is correct.
5. Hint 1 is subtle and does not merely restate the clue.
6. Hint 2 meaningfully narrows the route.
7. Hint 3 strongly assists but does not reveal or effectively identify the answer.
8. The puzzle is family-safe.
9. It is not a famous/common stock riddle or near-copy.
10. A smart solver could explain why the answer is correct afterward.
11. Pattern/math puzzles have a uniquely compelling intended rule.
12. The puzzle does not depend on trivia.
13. Difficulty comes from thinking, not missing information.
14. The clue, answer, hints, and explanation are internally consistent.
15. The puzzle feels appropriate for a premium daily game, not a generic worksheet.

Scoring guidance:
- Below 60: flawed, trivial, generic, ambiguous, or materially below requested difficulty.
- 60-69: sound but too ordinary or too weak for publication.
- 70-79: promising but still needs editorial improvement.
- 80-89: publishable Masquerade quality.
- 90+: exceptional.

Set approved=false if ANY quality boolean is false.
Set approved=false if review_score < ${REVIEW_THRESHOLD}.
Never inflate a score to create enough approved puzzles.

Requested difficulty: ${difficulty}
`;

  const input = JSON.stringify(
    {
      recent_puzzles: recentPuzzles.slice(0, 80),
      candidates,
    },
    null,
    2
  );

  const result = await structuredResponse<{ reviews: Review[] }>(
    REVIEWER_MODEL,
    instructions,
    input,
    `masquerade_${difficulty}_review`,
    reviewSchema
  );

  return result.reviews || [];
}

function reviewPasses(review: Review): boolean {
  return (
    review.approved === true &&
    review.review_score >= REVIEW_THRESHOLD &&
    review.answer_fair === true &&
    review.difficulty_fit === true &&
    review.hint_quality === true &&
    review.originality === true &&
    review.family_safe === true
  );
}

function chooseFive(candidates: ReviewedCandidate[]): ReviewedCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.review.review_score !== a.review.review_score) {
      return b.review.review_score - a.review.review_score;
    }
    return b.difficulty_score - a.difficulty_score;
  });

  const chosen: ReviewedCandidate[] = [];
  const clueCounts = new Map<string, number>();

  for (const candidate of sorted) {
    if (chosen.length === 5) break;

    const current = clueCounts.get(candidate.clue_type) || 0;
    if (current >= 2) continue;

    chosen.push(candidate);
    clueCounts.set(candidate.clue_type, current + 1);
  }

  if (
    chosen.length === 5 &&
    new Set(chosen.map((x) => x.clue_type)).size >= 3
  ) {
    return chosen;
  }

  return [];
}

function assertInputs(targetDate: string, difficulty: Difficulty): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error("targetDate must be YYYY-MM-DD.");
  }

  const parsed = new Date(`${targetDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid targetDate.");
  }

  if (!["clever", "devious", "fiendish"].includes(difficulty)) {
    throw new Error("Invalid difficulty.");
  }
}

async function alreadyPublished(
  targetDate: string,
  difficulty: Difficulty
): Promise<boolean> {
  const result = await getPool().query<{ puzzle_count: number }>(
    `
      select count(dgp.puzzle_id)::int as puzzle_count
      from daily_games dg
      left join daily_game_puzzles dgp
        on dgp.daily_game_id = dg.id
      where dg.game_date = $1
        and dg.difficulty_band = $2
        and dg.published = true
    `,
    [targetDate, difficulty]
  );

  return Number(result.rows[0]?.puzzle_count || 0) === 5;
}

async function assertNoPlayerSessions(
  targetDate: string,
  difficulty: Difficulty
) {
  const result = await getPool().query<{ count: number }>(
    `
      select count(*)::int as count
      from game_sessions gs
      join daily_games dg on dg.id = gs.daily_game_id
      where dg.game_date = $1
        and dg.difficulty_band = $2
    `,
    [targetDate, difficulty]
  );

  if (Number(result.rows[0]?.count || 0) > 0) {
    throw new Error(
      `Cannot regenerate ${targetDate} ${difficulty}: player sessions already exist.`
    );
  }
}

async function getBatch(
  targetDate: string,
  difficulty: Difficulty
): Promise<{ id: string } | null> {
  const result = await getPool().query<{ id: string }>(
    `
      select id
      from puzzle_generation_batches
      where target_date = $1
        and difficulty_band = $2
      limit 1
    `,
    [targetDate, difficulty]
  );

  return result.rows[0] || null;
}

async function startOrResetBatch(
  targetDate: string,
  difficulty: Difficulty
): Promise<{ id: string }> {
  const result = await getPool().query<{ id: string }>(
    `
      insert into puzzle_generation_batches(
        target_date,
        difficulty_band,
        status,
        generator_model,
        reviewer_model,
        started_at,
        completed_at,
        error_message,
        candidate_count,
        accepted_count,
        details
      )
      values(
        $1, $2, 'generating', $3, $4,
        now(), null, null, 0, 0, '{}'::jsonb
      )
      on conflict(target_date, difficulty_band)
      do update set
        status = 'generating',
        generator_model = excluded.generator_model,
        reviewer_model = excluded.reviewer_model,
        started_at = now(),
        completed_at = null,
        error_message = null,
        candidate_count = 0,
        accepted_count = 0,
        details = '{}'::jsonb
      returning id
    `,
    [targetDate, difficulty, GENERATOR_MODEL, REVIEWER_MODEL]
  );

  return result.rows[0];
}

async function requireBatch(
  targetDate: string,
  difficulty: Difficulty
): Promise<{ id: string }> {
  const batch = await getBatch(targetDate, difficulty);
  if (!batch) {
    throw new Error(
      `No generation batch exists for ${targetDate} ${difficulty}. Run generate round 1 first.`
    );
  }

  return batch;
}

async function markBatchFailed(batchId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown generation error";

  await getPool().query(
    `
      update puzzle_generation_batches
      set status = 'failed',
          error_message = $2,
          completed_at = now()
      where id = $1
    `,
    [batchId, message.slice(0, 4000)]
  );
}

function rowToCandidate(row: StoredCandidate): Candidate {
  return {
    candidate_id: row.candidate_id,
    clue_type: row.clue_type,
    clue_text: row.clue_text,
    answer: row.answer,
    accepted_answers: row.accepted_answers || [],
    numeric_answer: row.numeric_answer,
    difficulty_score: row.difficulty_score,
    hint_1: row.hint_1,
    hint_2: row.hint_2,
    hint_3: row.hint_3,
    explanation: row.explanation,
  };
}

function storedRowToReviewed(row: StoredCandidate): ReviewedCandidate {
  const notes = row.review_notes || {};

  return {
    ...rowToCandidate(row),
    fingerprint: row.content_fingerprint,
    review: {
      candidate_id: row.candidate_id,
      approved: row.review_status === "approved",
      review_score: Number(row.review_score || 0),
      answer_fair: notes.answer_fair === true,
      difficulty_fit: notes.difficulty_fit === true,
      hint_quality: notes.hint_quality === true,
      originality: notes.originality === true,
      family_safe: notes.family_safe === true,
      reason: String(notes.reason || ""),
    },
  };
}

async function loadApprovedCandidates(batchId: string): Promise<ReviewedCandidate[]> {
  const result = await getPool().query<StoredCandidate>(
    `
      select *
      from puzzle_generation_candidates
      where batch_id = $1
        and review_status = 'approved'
        and review_score >= $2
      order by review_score desc, difficulty_score desc
    `,
    [batchId, REVIEW_THRESHOLD]
  );

  return result.rows.map(storedRowToReviewed);
}

async function hasPublishableFive(batchId: string): Promise<{
  ready: boolean;
  approvedCount: number;
  clueTypes: number;
}> {
  const approved = await loadApprovedCandidates(batchId);
  const chosen = chooseFive(approved);

  return {
    ready: chosen.length === 5,
    approvedCount: approved.length,
    clueTypes: new Set(approved.map((x) => x.clue_type)).size,
  };
}

export async function generateStage(
  targetDate: string,
  difficulty: Difficulty,
  round: number
) {
  assertInputs(targetDate, difficulty);

  if (await alreadyPublished(targetDate, difficulty)) {
    return {
      targetDate,
      difficulty,
      stage: "generate",
      skipped: true,
      status: "already-published",
    };
  }

  if (!Number.isInteger(round) || round < 1 || round > MAX_GENERATION_ROUNDS) {
    throw new Error(`round must be 1-${MAX_GENERATION_ROUNDS}.`);
  }

  await assertNoPlayerSessions(targetDate, difficulty);

  const batch =
    round === 1
      ? await startOrResetBatch(targetDate, difficulty)
      : await requireBatch(targetDate, difficulty);

  try {
    if (round === 1) {
      await getPool().query(
        `delete from puzzle_generation_candidates where batch_id = $1`,
        [batch.id]
      );
    } else {
      const readiness = await hasPublishableFive(batch.id);
      if (readiness.ready) {
        return {
          targetDate,
          difficulty,
          stage: "generate",
          round,
          skipped: true,
          status: "enough-approved",
          approvedTotal: readiness.approvedCount,
          approvedClueTypes: readiness.clueTypes,
        };
      }
    }

    const history = await loadHistory();
    const recentPuzzles = history.rows.map((row) => ({
      clue_text: row.clue_text,
      answer: row.answer,
    }));

    const historicalFingerprints = new Set(
      history.rows.map(
        (row) =>
          row.content_fingerprint ||
          makeFingerprint(row.clue_text, row.answer)
      )
    );

    const existing = await getPool().query<{ content_fingerprint: string }>(
      `
        select content_fingerprint
        from puzzle_generation_candidates
        where batch_id = $1
      `,
      [batch.id]
    );

    const seen = new Set(existing.rows.map((x) => x.content_fingerprint));
    const rejectionFeedback =
      round === 1
        ? "No prior feedback exists because this is round 1."
        : await loadRejectionFeedback(batch.id);

    const generated = await generateCandidates(
      difficulty,
      targetDate,
      recentPuzzles,
      round,
      rejectionFeedback
    );

    let insertedCount = 0;
    let deterministicRejected = 0;
    let duplicateRejected = 0;

    for (const candidate of generated) {
      const problems = validateCandidate(candidate, difficulty);
      if (problems.length) {
        deterministicRejected++;
        continue;
      }

      const fingerprint = makeFingerprint(
        candidate.clue_text,
        candidate.answer
      );

      if (historicalFingerprints.has(fingerprint) || seen.has(fingerprint)) {
        duplicateRejected++;
        continue;
      }

      seen.add(fingerprint);

      const stableCandidateId = `r${round}-${candidate.candidate_id}`;
      const result = await getPool().query(
        `
          insert into puzzle_generation_candidates(
            batch_id,
            candidate_id,
            clue_type,
            clue_text,
            answer,
            accepted_answers,
            numeric_answer,
            difficulty_score,
            hint_1,
            hint_2,
            hint_3,
            explanation,
            content_fingerprint,
            review_status
          )
          values(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending'
          )
          on conflict do nothing
        `,
        [
          batch.id,
          stableCandidateId,
          candidate.clue_type,
          candidate.clue_text,
          candidate.answer,
          candidate.accepted_answers,
          candidate.numeric_answer,
          candidate.difficulty_score,
          candidate.hint_1,
          candidate.hint_2,
          candidate.hint_3,
          candidate.explanation,
          fingerprint,
        ]
      );

      insertedCount += result.rowCount || 0;
    }

    const totals = await getPool().query<{ count: number }>(
      `
        select count(*)::int as count
        from puzzle_generation_candidates
        where batch_id = $1
      `,
      [batch.id]
    );

    const candidateCount = Number(totals.rows[0]?.count || 0);

    await getPool().query(
      `
        update puzzle_generation_batches
        set status = 'generating',
            candidate_count = $2,
            error_message = null,
            completed_at = null,
            details = jsonb_set(
              coalesce(details, '{}'::jsonb),
              $3::text[],
              $4::jsonb,
              true
            )
        where id = $1
      `,
      [
        batch.id,
        candidateCount,
        [`generate_round_${round}`],
        JSON.stringify({
          generated: generated.length,
          inserted: insertedCount,
          deterministic_rejected: deterministicRejected,
          duplicate_rejected: duplicateRejected,
          used_reviewer_feedback: round > 1,
        }),
      ]
    );

    return {
      targetDate,
      difficulty,
      stage: "generate",
      round,
      status: "generated",
      model: GENERATOR_MODEL,
      generated: generated.length,
      inserted: insertedCount,
      deterministicRejected,
      duplicateRejected,
      candidateCount,
      usedReviewerFeedback: round > 1,
    };
  } catch (error) {
    await markBatchFailed(batch.id, error);
    throw error;
  }
}

export async function reviewStage(
  targetDate: string,
  difficulty: Difficulty
) {
  assertInputs(targetDate, difficulty);

  if (await alreadyPublished(targetDate, difficulty)) {
    return {
      targetDate,
      difficulty,
      stage: "review",
      skipped: true,
      status: "already-published",
    };
  }

  const batch = await requireBatch(targetDate, difficulty);

  try {
    const pending = await getPool().query<StoredCandidate>(
      `
        select *
        from puzzle_generation_candidates
        where batch_id = $1
          and review_status = 'pending'
        order by created_at, candidate_id
      `,
      [batch.id]
    );

    if (!pending.rows.length) {
      const readiness = await hasPublishableFive(batch.id);
      const counts = await getPool().query<{
        approved: number;
        rejected: number;
      }>(
        `
          select
            count(*) filter (
              where review_status = 'approved'
            )::int as approved,
            count(*) filter (
              where review_status = 'rejected'
            )::int as rejected
          from puzzle_generation_candidates
          where batch_id = $1
        `,
        [batch.id]
      );

      return {
        targetDate,
        difficulty,
        stage: "review",
        skipped: true,
        status: "nothing-pending",
        approved: Number(counts.rows[0]?.approved || 0),
        rejected: Number(counts.rows[0]?.rejected || 0),
        publishReady: readiness.ready,
      };
    }

    const history = await loadHistory();
    const recentPuzzles = history.rows.map((row) => ({
      clue_text: row.clue_text,
      answer: row.answer,
    }));

    const candidates = pending.rows.map(rowToCandidate);
    const reviews = await reviewCandidates(
      difficulty,
      candidates,
      recentPuzzles
    );

    const reviewsById = new Map(
      reviews.map((review) => [review.candidate_id, review])
    );

    let approved = 0;
    let rejected = 0;

    for (const row of pending.rows) {
      const review = reviewsById.get(row.candidate_id);

      if (!review) {
        await getPool().query(
          `
            update puzzle_generation_candidates
            set review_status = 'rejected',
                review_score = 0,
                review_notes = $2::jsonb,
                reviewed_at = now()
            where id = $1
          `,
          [
            row.id,
            JSON.stringify({
              approved: false,
              review_score: 0,
              answer_fair: false,
              difficulty_fit: false,
              hint_quality: false,
              originality: false,
              family_safe: true,
              reason: "Reviewer returned no matching review.",
            }),
          ]
        );
        rejected++;
        continue;
      }

      const passes = reviewPasses(review);

      await getPool().query(
        `
          update puzzle_generation_candidates
          set review_status = $2,
              review_score = $3,
              review_notes = $4::jsonb,
              reviewed_at = now()
          where id = $1
        `,
        [
          row.id,
          passes ? "approved" : "rejected",
          review.review_score,
          JSON.stringify(review),
        ]
      );

      if (passes) approved++;
      else rejected++;
    }

    const aggregate = await getPool().query<{
      approved: number;
      total: number;
    }>(
      `
        select
          count(*) filter (
            where review_status = 'approved'
          )::int as approved,
          count(*)::int as total
        from puzzle_generation_candidates
        where batch_id = $1
      `,
      [batch.id]
    );

    const approvedTotal = Number(aggregate.rows[0]?.approved || 0);
    const candidateTotal = Number(aggregate.rows[0]?.total || 0);
    const readiness = await hasPublishableFive(batch.id);

    await getPool().query(
      `
        update puzzle_generation_batches
        set status = 'generating',
            candidate_count = $2,
            accepted_count = $3,
            error_message = null,
            completed_at = null,
            details = jsonb_set(
              coalesce(details, '{}'::jsonb),
              '{last_review}',
              $4::jsonb,
              true
            )
        where id = $1
      `,
      [
        batch.id,
        candidateTotal,
        approvedTotal,
        JSON.stringify({
          reviewed: pending.rows.length,
          approved,
          rejected,
          publish_ready: readiness.ready,
          approved_clue_types: readiness.clueTypes,
        }),
      ]
    );

    return {
      targetDate,
      difficulty,
      stage: "review",
      status: "reviewed",
      model: REVIEWER_MODEL,
      reviewed: pending.rows.length,
      approvedThisStage: approved,
      rejectedThisStage: rejected,
      approvedTotal,
      candidateTotal,
      publishReady: readiness.ready,
      approvedClueTypes: readiness.clueTypes,
    };
  } catch (error) {
    await markBatchFailed(batch.id, error);
    throw error;
  }
}

export async function publishStage(
  targetDate: string,
  difficulty: Difficulty
) {
  assertInputs(targetDate, difficulty);

  if (await alreadyPublished(targetDate, difficulty)) {
    return {
      targetDate,
      difficulty,
      stage: "publish",
      skipped: true,
      status: "already-published",
    };
  }

  await assertNoPlayerSessions(targetDate, difficulty);
  const batch = await requireBatch(targetDate, difficulty);

  try {
    const approved = await loadApprovedCandidates(batch.id);
    const chosen = chooseFive(approved);

    if (chosen.length !== 5) {
      throw new Error(
        `Could not choose five diverse publication-quality ${difficulty} puzzles after up to ${MAX_GENERATION_ROUNDS} rounds. ` +
          `Approved candidates: ${approved.length}. Need five with at least three clue types and no more than two of one clue type.`
      );
    }

    const finalMask = [...chosen].sort(
      (a, b) =>
        b.difficulty_score +
        b.review.review_score / 10 -
        (a.difficulty_score + a.review.review_score / 10)
    )[0];

    const firstFour = chosen
      .filter((x) => x.fingerprint !== finalMask.fingerprint)
      .sort((a, b) => a.difficulty_score - b.difficulty_score);

    const ordered = [...firstFour, finalMask];
    const client = await getPool().connect();

    try {
      await client.query("begin");

      const game = (
        await client.query<{ id: string }>(
          `
            insert into daily_games(
              game_date,
              difficulty_band,
              published
            )
            values($1,$2,true)
            on conflict(game_date,difficulty_band)
            do update set published = true
            returning id
          `,
          [targetDate, difficulty]
        )
      ).rows[0];

      await client.query(
        `delete from daily_game_puzzles where daily_game_id = $1`,
        [game.id]
      );

      for (let index = 0; index < ordered.length; index++) {
        const puzzle = ordered[index];
        const position = index + 1;
        const isFinalMask = position === 5;

        const inserted = (
          await client.query<{ id: string }>(
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
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                'published','ai_generated',$13,$14,$15,$16::jsonb,$17
              )
              returning id
            `,
            [
              puzzle.clue_type,
              puzzle.clue_text,
              puzzle.answer.toLowerCase(),
              puzzle.accepted_answers.map((x) => x.toLowerCase()),
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
              puzzle.review.review_score,
              JSON.stringify({
                reason: puzzle.review.reason,
                answer_fair: puzzle.review.answer_fair,
                difficulty_fit: puzzle.review.difficulty_fit,
                hint_quality: puzzle.review.hint_quality,
                originality: puzzle.review.originality,
                family_safe: puzzle.review.family_safe,
              }),
              targetDate,
            ]
          )
        ).rows[0];

        await client.query(
          `
            insert into daily_game_puzzles(
              daily_game_id,
              puzzle_id,
              position
            )
            values($1,$2,$3)
          `,
          [game.id, inserted.id, position]
        );
      }

      await client.query(
        `
          update puzzle_generation_batches
          set status = 'published',
              candidate_count = $2,
              accepted_count = 5,
              completed_at = now(),
              error_message = null,
              details = jsonb_set(
                coalesce(details, '{}'::jsonb),
                '{published}',
                $3::jsonb,
                true
              )
          where id = $1
        `,
        [
          batch.id,
          approved.length,
          JSON.stringify(
            ordered.map((candidate, index) => ({
              position: index + 1,
              clue_type: candidate.clue_type,
              review_score: candidate.review.review_score,
              difficulty_score: candidate.difficulty_score,
            }))
          ),
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    return {
      targetDate,
      difficulty,
      stage: "publish",
      status: "published",
      puzzlesPublished: 5,
      approvedCandidates: approved.length,
      generatorModel: GENERATOR_MODEL,
      reviewerModel: REVIEWER_MODEL,
    };
  } catch (error) {
    await markBatchFailed(batch.id, error);
    throw error;
  }
}

export async function runGenerationStage(
  targetDate: string,
  difficulty: Difficulty,
  stage: GenerationStage,
  round?: number
) {
  if (stage === "generate") {
    return generateStage(targetDate, difficulty, round || 1);
  }

  if (stage === "review") {
    return reviewStage(targetDate, difficulty);
  }

  if (stage === "publish") {
    return publishStage(targetDate, difficulty);
  }

  throw new Error("Invalid generation stage.");
}
