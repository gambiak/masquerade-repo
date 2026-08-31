import crypto from "crypto";

import { NextResponse } from "next/server";

import {
  Difficulty,
  GenerationStage,
  runGenerationStage,
} from "@/lib/puzzle-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIFFICULTIES: Difficulty[] = ["clever", "devious", "fiendish"];
const STAGES: GenerationStage[] = ["generate", "review", "publish"];
const MAX_GENERATION_ROUNDS = 4;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isDifficulty(value: unknown): value is Difficulty {
  return (
    typeof value === "string" &&
    DIFFICULTIES.includes(value as Difficulty)
  );
}

function isStage(value: unknown): value is GenerationStage {
  return typeof value === "string" && STAGES.includes(value as GenerationStage);
}

export async function POST(req: Request) {
  const expectedSecret = process.env.PUZZLE_CRON_SECRET;

  if (!expectedSecret) {
    console.error("PUZZLE_CRON_SECRET is not configured.");

    return NextResponse.json(
      { error: "Puzzle generation is not configured." },
      { status: 503 }
    );
  }

  const authorization = req.headers.get("authorization") || "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!suppliedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();

    const targetDate = body?.targetDate;
    const difficulty = body?.difficulty;
    const stage = body?.stage;
    const round = body?.round;

    if (typeof targetDate !== "string") {
      return NextResponse.json(
        { error: "targetDate is required." },
        { status: 400 }
      );
    }

    if (!isDifficulty(difficulty)) {
      return NextResponse.json(
        { error: "difficulty must be clever, devious, or fiendish." },
        { status: 400 }
      );
    }

    if (!isStage(stage)) {
      return NextResponse.json(
        { error: "stage must be generate, review, or publish." },
        { status: 400 }
      );
    }

    if (stage === "generate") {
      if (
        !Number.isInteger(round) ||
        round < 1 ||
        round > MAX_GENERATION_ROUNDS
      ) {
        return NextResponse.json(
          { error: `round must be 1-${MAX_GENERATION_ROUNDS}.` },
          { status: 400 }
        );
      }
    }

    const result = await runGenerationStage(
      targetDate,
      difficulty,
      stage,
      stage === "generate" ? round : undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Puzzle generation failed:", error);

    const message =
      error instanceof Error ? error.message : "Puzzle generation failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
