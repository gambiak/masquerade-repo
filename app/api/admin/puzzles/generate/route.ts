import crypto from "crypto";

import {
  NextResponse
} from "next/server";

import {
  Difficulty,
  generateDailyDifficulty,
} from "@/lib/puzzle-generation";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function safeEqual(
  left: string,
  right: string
): boolean {
  const a =
    Buffer.from(left);

  const b =
    Buffer.from(right);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(
      a,
      b
    )
  );
}

export async function POST(
  req: Request
) {
  const expectedSecret =
    process.env
      .PUZZLE_CRON_SECRET;

  if (!expectedSecret) {
    console.error(
      "PUZZLE_CRON_SECRET is not configured."
    );

    return NextResponse.json(
      {
        error:
          "Puzzle generation is not configured.",
      },
      {
        status: 503,
      }
    );
  }

  const authorization =
    req.headers.get(
      "authorization"
    ) || "";

  const suppliedSecret =
    authorization.startsWith(
      "Bearer "
    )
      ? authorization.slice(
          "Bearer ".length
        )
      : "";

  if (
    !suppliedSecret ||
    !safeEqual(
      suppliedSecret,
      expectedSecret
    )
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const body =
      await req.json();

    const targetDate =
      body?.targetDate;

    const difficulty =
      body?.difficulty as
        | Difficulty
        | undefined;

    if (
      typeof targetDate !==
      "string"
    ) {
      return NextResponse.json(
        {
          error:
            "targetDate is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !difficulty ||
      ![
        "clever",
        "devious",
        "fiendish",
      ].includes(difficulty)
    ) {
      return NextResponse.json(
        {
          error:
            "difficulty must be clever, devious, or fiendish.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await generateDailyDifficulty(
        targetDate,
        difficulty
      );

    return NextResponse.json(
      result
    );
  } catch (error) {
    console.error(
      "Puzzle generation failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Puzzle generation failed.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}