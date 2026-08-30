"use client";
export default function DifficultyPicker({value,disabled,onChange}:{value:string;disabled:boolean;onChange:(v:string)=>void}){
  const levels=[["clever","Clever","15–20 target complexity"],["devious","Devious","21–25 target complexity"],["fiendish","Fiendish","25+ target complexity"]];
  return <div className="grid grid3">{levels.map(([id,label,sub])=><button key={id} disabled={disabled} onClick={()=>onChange(id)} className={`btn level ${value===id?"active":""}`}>{label}<small>{sub}</small></button>)}</div>
}
