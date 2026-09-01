import Link from "next/link";
import {
  getCurrentUser,
  googleLoginUrl,
  loginUrl,
} from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const returnTo = sp.returnTo?.startsWith("/") ? sp.returnTo : "/";

  if (user) {
    redirect(returnTo);
  }

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Account</div>
        <h1>Join the ritual.</h1>
        <p>Choose how you want to sign in.</p>
      </section>

      <section className="card">
        <div className="stack">
          <Link className="btn primary" href={googleLoginUrl(returnTo)}>
            CONTINUE WITH GOOGLE
          </Link>

          <Link className="btn" href={loginUrl(returnTo)}>
            CONTINUE WITH MICROSOFT
          </Link>
        </div>
      </section>
    </main>
  );
}
