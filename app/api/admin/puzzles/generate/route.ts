import crypto from "crypto";
import { NextResponse } from "next/server";

import {
  Difficulty,
  GenerationStage,
  runGenerationStage,
} from "@/lib/puzzle-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
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

  if (
    !suppliedSecret ||
    !safeEqual(suppliedSecret, expectedSecret)
  ) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    const targetDate = body?.targetDate;
    const difficulty = body?.difficulty as Difficulty | undefined;
    const stage = body?.stage as GenerationStage | undefined;
    const round =
      typeof body?.round === "number"
        ? body.round
        : undefined;

    if (typeof targetDate !== "string") {
      return NextResponse.json(
        { error: "targetDate is required." },
        { status: 400 }
      );
    }

    if (
      !difficulty ||
      !["clever", "devious", "fiendish"].includes(difficulty)
    ) {
      return NextResponse.json(
        {
          error:
            "difficulty must be clever, devious, or fiendish.",
        },
        { status: 400 }
      );
    }

    if (
      !stage ||
      !["generate", "review", "publish"].includes(stage)
    ) {
      return NextResponse.json(
        {
          error:
            "stage must be generate, review, or publish.",
        },
        { status: 400 }
      );
    }

    if (
      stage === "generate" &&
      round !== undefined &&
      ![1, 2].includes(round)
    ) {
      return NextResponse.json(
        { error: "round must be 1 or 2." },
        { status: 400 }
      );
    }

    console.log(
      `Puzzle generation stage starting: ${targetDate} / ${difficulty} / ${stage}` +
        (stage === "generate" ? ` / round ${round || 1}` : "")
    );

    const result = await runGenerationStage(
      targetDate,
      difficulty,
      stage,
      round
    );

    console.log(
      `Puzzle generation stage finished: ${targetDate} / ${difficulty} / ${stage}`
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Puzzle generation stage failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Puzzle generation failed.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
