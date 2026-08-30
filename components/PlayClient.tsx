"use client";
import { useEffect,useState } from "react";

type Puzzle={id:string;clue_type:string;clue_text:string;position:number;is_final_mask:boolean};
type Session={id:string;current_position:number;difficulty_band:string};

export default function PlayClient({session,puzzle,shownHints}:{session:Session;puzzle:Puzzle;shownHints:string[]}){
 const [answer,setAnswer]=useState(""); const [coach,setCoach]=useState(""); const [hints,setHints]=useState(shownHints); const [busy,setBusy]=useState(false);
 useEffect(()=>{ fetch("/api/hints",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:session.id})}).then(r=>r.json()).then(d=>d.hints&&setHints(d.hints)); },[session.id,puzzle.id]);
 async function submit(){
   if(!answer.trim()||busy)return;
   setBusy(true);
   const r=await fetch("/api/answer",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:session.id,answer})});
   const data=await r.json();
   setBusy(false);
   if(data.correct){
     setCoach(data.message);
     setTimeout(()=>location.reload(),900);
   }else setCoach(data.message);
 }
 async function hint(){
   const r=await fetch("/api/hint",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:session.id})});
   const data=await r.json(); if(data.hint)setHints(x=>[...x,data.hint]);
 }
 async function quit(){ if(!confirm("Quit this game? Your unfinished run will be discarded."))return; await fetch("/api/session/quit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:session.id})}); location.href="/"; }
 return <section className="card">
   {puzzle.is_final_mask&&<div className="eyebrow" style={{textAlign:"center"}}>🎭 THE FINAL MASK</div>}
   <div className="row"><span className="eyebrow">Clue {puzzle.position}</span><span className="pill">{puzzle.clue_type}</span></div>
   <div className={`clue ${["logic"].includes(puzzle.clue_type)?"logic":["pattern","math"].includes(puzzle.clue_type)?"pattern":"word"} ${puzzle.is_final_mask?"mask":""}`}>{puzzle.clue_text}</div>
   <input className="answer" value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="One-word answer…" />
   {coach&&<div className={coach.includes("Correct")?"success":"coach"}>{coach}</div>}
   <div className="stack"><button className="btn primary" onClick={submit} disabled={busy}>SUBMIT</button><button className="btn" onClick={hint} disabled={hints.length>=3}>💡 HINT {Math.min(hints.length+1,3)} OF 3</button><button className="btn danger" onClick={quit}>QUIT GAME</button></div>
   {hints.map((h,i)=><div key={i} className="hint"><b>Hint {i+1}</b><br/>{h}</div>)}
 </section>
}
