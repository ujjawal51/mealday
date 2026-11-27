// Plans and pantry share the planner's canonical ingredient IDs and units.
const qty=n=>Math.round(n*1e6)/1e6;
export function projectedRemaining(item){
 return qty(Math.max(0,item.have+item.packs*item.pack-item.required));
}
export function swapBasketImpact(before,after){
 const left=new Map(before.map(r=>[r.key,r])),right=new Map(after.map(r=>[r.key,r]));
 const cents=rows=>rows.reduce((n,r)=>n+Math.round(r.cost*100),0);
 const beforeCents=cents(before),afterCents=cents(after);
 const rows=[...new Set([...left.keys(),...right.keys()])].flatMap(key=>{
  const a=left.get(key),b=right.get(key),item=b||a;
  if((a?.required??0)===(b?.required??0))return [];
  return [{key,name:item.name,unit:item.unit,fromPacks:a?.packs??0,toPacks:b?.packs??0,
   beforeLeft:a?projectedRemaining(a):item.have,afterLeft:b?projectedRemaining(b):item.have,
   removed:!b}];
 });
 return {beforeCents,afterCents,savedCents:beforeCents-afterCents,rows};
}
export function carryoverRows(items,removed=[]){
 const valid=r=>typeof r?.key==='string'&&typeof r.name==='string'&&typeof r.unit==='string';
 const rows=new Map(removed.filter(valid).map(r=>[r.key,{key:r.key,name:r.name,unit:r.unit,expected:null}]));
 for(const item of items)if(valid(item)&&[item.have,item.packs,item.pack,item.required].every(Number.isFinite)){
  rows.set(item.key,{key:item.key,name:item.name,unit:item.unit,expected:projectedRemaining(item)});
 }
 return [...rows.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function confirmLeftovers(pantry,rows,amounts){
 const next={...pantry};
 for(const row of rows){
  const raw=amounts.get(row.key);
  if(raw==null||raw===''){
   if(Number(pantry[row.key])>0)throw Error('Enter what is left for '+row.name+', or enter 0.');
   continue;
  }
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||Number(raw)>100000)throw Error('Enter a valid amount for '+row.name+'.');
  const amount=Number(raw);
  // Replace measured on-hand stock; never add an estimate or repeat a credit.
  if(amount===0)delete next[row.key];else next[row.key]=amount;
 }
 return next;
}
