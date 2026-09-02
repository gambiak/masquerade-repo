import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { randomBytes } from "crypto";

function getPublicBaseUrl(req: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (configured) {
    return configured;
  }

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(req.url).origin;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login", getPublicBaseUrl(req))
    );
  }

  const form = await req.formData();

  const name = String(
    form.get("name") || "Morning Crew"
  ).slice(0, 50);

  const code = randomBytes(5)
    .toString("hex")
    .toUpperCase();

  const client = await getPool().connect();

  try {
    await client.query("begin");

    const crew = await client.query(
      `
        insert into crews(name, owner_id, invite_code)
        values($1, $2, $3)
        returning *
      `,
      [name, user.id, code]
    );

    await client.query(
      `
        insert into crew_members(crew_id, user_id)
        values($1, $2)
      `,
      [crew.rows[0].id, user.id]
    );

    await client.query("commit");

    return NextResponse.redirect(
      new URL(`/join/${code}`, getPublicBaseUrl(req))
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
} 