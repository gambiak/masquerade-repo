export const HINT_POINTS=[100,75,50,25];
export function scorePuzzle(hints:number, firstTry:boolean, finalMask:boolean){
  const base=HINT_POINTS[Math.min(Math.max(hints,0),3)];
  const firstTryBonus=firstTry?5:0;
  const finalMaskBonus=finalMask?20:0;
  return base+firstTryBonus+finalMaskBonus;
}
