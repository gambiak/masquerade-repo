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
    const found = principal.claims?.find(c => c.typ === t || c.typ.endsWith("/" + t));
    if (found?.val) return found.val;
  }
  return undefined;
}

function parsePrincipal(encoded: string | null): EasyAuthPrincipal | null {
  if (!encoded) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  let externalId: string | undefined;
  let email: string | undefined;
  let displayName: string | undefined;

  if (process.env.DEV_AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production") {
    externalId = process.env.DEV_USER_EXTERNAL_ID || "local-developer";
    email = process.env.DEV_USER_EMAIL || "developer@example.com";
    displayName = "Local Developer";
  } else {
    const h = await headers();
    const principal = parsePrincipal(h.get("x-ms-client-principal"));
    if (!principal) return null;
    externalId = principal.userId || claim(principal,
      "oid",
      "objectidentifier",
      "http://schemas.microsoft.com/identity/claims/objectidentifier",
      "sub"
    );
    email = principal.userDetails || claim(principal,
      "email",
      "preferred_username",
      "emails",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    );
    displayName = claim(principal, "name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");
  }

  if (!externalId || !email) return null;
  email = email.toLowerCase().trim();
  const result = await query<AppUser>(
    `insert into users (entra_object_id,email,display_name)
     values ($1,$2,$3)
     on conflict (entra_object_id) do update
       set email=excluded.email,
           display_name=coalesce(excluded.display_name, users.display_name)
     returning id, entra_object_id as "externalId", email, display_name as "displayName"`,
    [externalId, email, displayName || null]
  );
  return result.rows[0] || null;
}

export function loginUrl(returnTo = "/") {
  return `/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(returnTo)}`;
}

export function logoutUrl() {
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent("/")}`;
}
