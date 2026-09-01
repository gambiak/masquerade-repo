import { headers } from "next/headers";
import { query } from "./db";

type EasyAuthClaim = { typ: string; val: string };

type EasyAuthPrincipal = {
  auth_typ?: string;
  name_typ?: string;
  role_typ?: string;
  claims?: EasyAuthClaim[];
  userId?: string;
  userDetails?: string;
  identityProvider?: string;
  userRoles?: string[];
};

export type AppUser = {
  id: string;
  externalId: string;
  email: string;
  displayName: string | null;
};

function claim(principal: EasyAuthPrincipal, ...types: string[]) {
  for (const t of types) {
    const found = principal.claims?.find(
      (c) => c.typ === t || c.typ.endsWith("/" + t)
    );
    if (found?.val) return found.val;
  }
  return undefined;
}

function parsePrincipal(encoded: string | null): EasyAuthPrincipal | null {
  if (!encoded) return null;

  try {
    return JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8")
    ) as EasyAuthPrincipal;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  let externalId: string | undefined;
  let email: string | undefined;
  let displayName: string | undefined;

  if (
    process.env.DEV_AUTH_BYPASS === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    externalId = process.env.DEV_USER_EXTERNAL_ID || "local-developer";
    email = process.env.DEV_USER_EMAIL || "developer@example.com";
    displayName = "Local Developer";
  } else {
    const h = await headers();
    const principal = parsePrincipal(h.get("x-ms-client-principal"));

    if (!principal) return null;

    const provider =
      principal.identityProvider ||
      principal.auth_typ ||
      "easyauth";

    const providerUserId =
      principal.userId ||
      claim(
        principal,
        "oid",
        "objectidentifier",
        "http://schemas.microsoft.com/identity/claims/objectidentifier",
        "sub"
      );

    if (providerUserId) {
      externalId = `${provider}:${providerUserId}`;
    }

    email =
      principal.userDetails ||
      claim(
        principal,
        "email",
        "preferred_username",
        "emails",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
      );

    displayName = claim(
      principal,
      "name",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
    );
  }

  if (!externalId || !email) return null;

  email = email.toLowerCase().trim();

  /*
   * Email is the stable Masquerade account key for this family/friends build.
   * This lets the same person use Microsoft or Google without creating a
   * duplicate user row. The provider-specific external id is refreshed when
   * they sign in.
   */
  const result = await query<AppUser>(
    `insert into users (entra_object_id, email, display_name)
     values ($1, $2, $3)
     on conflict (email) do update
       set entra_object_id = excluded.entra_object_id,
           display_name = coalesce(excluded.display_name, users.display_name)
     returning
       id,
       entra_object_id as "externalId",
       email,
       display_name as "displayName"`,
    [externalId, email, displayName || null]
  );

  return result.rows[0] || null;
}

function providerLoginUrl(provider: "aad" | "google", returnTo = "/") {
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/";
  return `/.auth/login/${provider}?post_login_redirect_uri=${encodeURIComponent(
    safeReturnTo
  )}`;
}

export function loginUrl(returnTo = "/") {
  return providerLoginUrl("aad", returnTo);
}

export function googleLoginUrl(returnTo = "/") {
  return providerLoginUrl("google", returnTo);
}

export function logoutUrl() {
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent("/")}`;
}
