import { normalize,numberValue } from "./numbers";
export function isCorrect(guess:string,answer:string,numeric:boolean,accepted:string[]=[]){
  const options=[answer,...accepted];
  if(numeric){
    const g=numberValue(guess);
    return options.some(x=>{const n=numberValue(x);return g!==null&&n!==null&&g===n});
  }
  return options.some(x=>normalize(x)===normalize(guess));
}
export function editDistance(a:string,b:string){
  a=normalize(a);b=normalize(b);
  const d=Array.from({length:a.length+1},(_,i)=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)d[i][0]=i;
  for(let j=0;j<=b.length;j++)d[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length];
}
