export const COOKING_HISTORY_KEY='mealday.cooking-history.v1';
export const emptyHistory=()=>({version:1,events:[]});
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function loadHistory(raw,legacy=[],recipes=[]){
  if(raw?.version===1&&Array.isArray(raw.events)){
    const seen=new Set();
    return {version:1,events:raw.events.filter(e=>e&&typeof e.id==='string'&&!seen.has(e.id)&&seen.add(e.id)&&typeof e.recipeId==='string'&&e.recipeId&&(e.cookedAt===null||validTime(e.cookedAt))).map(e=>({id:e.id,recipeId:e.recipeId,name:typeof e.name==='string'?e.name:'',cookedAt:e.cookedAt,undoneAt:validTime(e.undoneAt)?e.undoneAt:null}))};
  }
  const names=new Map(recipes.map(r=>[r.id,r.name]));
  return {version:1,events:[...new Set(Array.isArray(legacy)?legacy:[])].filter(id=>typeof id==='string'&&id).map(id=>({id:'legacy:'+id,recipeId:id,name:names.get(id)||'',cookedAt:null,undoneAt:null}))};
}
export const hasCooked=(history,recipeId)=>history.events.some(e=>e.recipeId===recipeId&&!e.undoneAt);
export function recordCook(history,recipe,cookedAt,id){
  if(!recipe?.id||!validTime(cookedAt)||!id||history.events.some(e=>e.id===id))throw Error('Invalid cooking record.');
  return {version:1,events:[...history.events,{id,recipeId:recipe.id,name:recipe.name||'',cookedAt,undoneAt:null}]};
}
export function undoCookedMark(history,recipeId,at){
  if(!validTime(at))throw Error('Invalid cooking record date.');
  return {version:1,events:history.events.map(e=>e.recipeId===recipeId&&!e.undoneAt?{...e,undoneAt:at}:e)};
}
export const historyEntries=history=>history.events.filter(e=>!e.undoneAt).slice().sort((a,b)=>(Date.parse(b.cookedAt)||0)-(Date.parse(a.cookedAt)||0));
