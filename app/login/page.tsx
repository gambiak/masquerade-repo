"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function Login(){
 const [email,setEmail]=useState(""); const [msg,setMsg]=useState("");
 async function send(){const supabase=createClient();const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:`${location.origin}/auth/callback`}});setMsg(error?error.message:"Check your email for the sign-in link.");}
 return <main><section className="hero"><div className="eyebrow">Account</div><h1>Join the ritual.</h1><p>Use a magic email link. No password required.</p></section><section className="card"><input className="answer" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button className="btn primary" onClick={send} style={{marginTop:10}}>SEND MAGIC LINK</button>{msg&&<p>{msg}</p>}</section></main>
}
