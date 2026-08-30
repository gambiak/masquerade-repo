import Link from "next/link";
import { getCurrentUser, loginUrl } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Login({searchParams}:{searchParams:Promise<{returnTo?:string}>}){
 const user=await getCurrentUser(); const sp=await searchParams; const returnTo=sp.returnTo?.startsWith("/")?sp.returnTo:"/";
 if(user) redirect(returnTo);
 return <main><section className="hero"><div className="eyebrow">Account</div><h1>Join the ritual.</h1><p>Masquerade uses Microsoft Entra through Azure App Service Authentication. Your identity is validated by Azure before it reaches the game.</p></section><section className="card"><Link className="btn primary" href={loginUrl(returnTo)}>SIGN IN / CREATE ACCOUNT</Link><p style={{marginTop:12}}>Configure the Microsoft identity provider in App Service → Authentication before inviting friends.</p></section></main>
}
