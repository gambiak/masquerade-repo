"use client";
import { useState } from "react";
import DifficultyPicker from "@/components/DifficultyPicker";
export default function Start(){
 const [difficulty,setDifficulty]=useState("devious"),[busy,setBusy]=useState(false);
 async function start(){setBusy(true);const r=await fetch("/api/session/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({difficulty})});if(r.ok)location.href="/play";else setBusy(false);}
 return <main><section className="hero"><div className="eyebrow">Choose your mask</div><h1>Smart starts here.</h1><p>All three levels target strong solvers. Difficulty changes the depth of inference, not the obscurity of trivia.</p></section><DifficultyPicker value={difficulty} disabled={busy} onChange={setDifficulty}/><button className="btn primary" onClick={start} style={{marginTop:16}}>BEGIN</button></main>
}
