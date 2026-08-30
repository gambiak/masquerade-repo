const small:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
export function normalize(s:string){return s.toLowerCase().trim().replace(/[\s-]/g,"").replace(/[^a-z0-9]/g,"")}
export function numberValue(input:string){
  const raw=input.toLowerCase().trim().replace(/-/g," ");
  if(/^\d+$/.test(raw)) return Number(raw);
  const joined=raw.replace(/\s/g,"");
  if(small[joined]!==undefined)return small[joined];
  const parts=raw.split(/\s+/);
  if(parts.length===2&&small[parts[0]]!==undefined&&small[parts[1]]!==undefined)return small[parts[0]]+small[parts[1]];
  return null;
}
