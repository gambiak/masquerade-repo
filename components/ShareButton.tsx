"use client";
export default function ShareButton({text}:{text:string}){
 async function share(){
  if(navigator.share) await navigator.share({text});
  else { await navigator.clipboard.writeText(text); alert("Result copied."); }
 }
 return <button className="btn" onClick={share}>SHARE RESULT</button>
}
