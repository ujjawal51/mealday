import {api as catalogueApi} from './api.js';
const DAY=86400000;
const cleanIds=values=>[...new Set((Array.isArray(values)?values:[]).filter(id=>typeof id==='string'&&id.length>0&&id.length<=150))].slice(0,500);
export function preferenceSignals(input={},now=Date.now()){
  if(!input||typeof input!=='object')input={};
  const ratings=new Map((Array.isArray(input.ratings)?input.ratings:[]).slice(0,500).filter(row=>Array.isArray(row)&&typeof row[0]==='string'&&row[0].length<=150&&Number.isInteger(row[1])&&row[1]>=1&&row[1]<=5));
  const saved=new Set(cleanIds(input.saved)),previous=new Set(cleanIds(input.previous));
  const cooked=new Map(),planned=new Map();
  for(const row of (Array.isArray(input.cooked)?input.cooked:[]).slice(0,200)){
    if(!Array.isArray(row)||typeof row[0]!=='string'||typeof row[1]!=='string')continue;
    const at=Date.parse(row[1]),age=(now-at)/DAY;
    if(Number.isFinite(age)&&age>=0&&age<=30)cooked.set(row[0],Math.min(age,cooked.get(row[0])??Infinity));
  }
  for(const plan of (Array.isArray(input.plans)?input.plans:[]).slice(-8)){
    const age=(now-Date.parse(plan?.at))/DAY;
    if(!Number.isFinite(age)||age<0||age>14)continue;
    for(const id of cleanIds(plan.ids))planned.set(id,Math.min(age,planned.get(id)??Infinity));
  }
  return {ratings,saved,previous,cooked,planned,active:!!(ratings.size||saved.size||previous.size||cooked.size||planned.size)};
}
export function recencyPenalty(id,signals){
  const age=signals.cooked.get(id);
  const cooked=age===undefined?0:age<3?30:age<7?22:age<14?12:5;
  const planned=signals.previous.has(id)?10:signals.planned.has(id)?(signals.planned.get(id)<7?7:3):0;
  return Math.max(cooked,planned);
}
export function preferenceScore(id,signals){
  const rating=signals.ratings.get(id);
  return ({1:-35,2:-18,3:0,4:12,5:20}[rating]||0)+(signals.saved.has(id)?4:0)-recencyPenalty(id,signals);
}
export function recommendationReason(id,signals){
  if(recencyPenalty(id,signals)>=12)return 'Cooked recently';
  const rating=signals.ratings.get(id);
  if(rating>=4)return 'You rated this '+rating+'/5';
  if(signals.saved.has(id))return 'Saved by you';
  if(!recencyPenalty(id,signals)&&(signals.cooked.size||signals.previous.size||signals.planned.size))return 'A change from your recent meals';
  return '';
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export function createPersonalizedApi(baseApi=catalogueApi,clock=()=>Date.now()){
  async function call(origin,path,payload){
    const url=new URL(path,origin);
    const response=await baseApi(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),url);
    return {ok:response.ok,data:await response.json()};
  }
  const score=(plan,signals)=>plan.meals.reduce((n,r)=>n+preferenceScore(r.id,signals),0);
  async function boostCandidates(origin,payload,signals,plan,index){
    const boosters=[...new Set([...signals.ratings.keys()].filter(id=>signals.ratings.get(id)>=4).concat([...signals.saved]))]
      .filter(id=>!plan.meals.some(r=>r.id===id)).sort((a,b)=>preferenceScore(b,signals)-preferenceScore(a,signals)).slice(0,8);
    const accepted=[];
    for(const recipeId of boosters){
      const trial=await call(origin,'/api/swap',{profile:payload.profile,pantry:payload.pantry,plan:plan.plan,index,recipeId});
      if(trial.ok)accepted.push(trial.data);
    }
    return accepted;
  }
  return async function personalizedApi(request,url){
    if(request.method!=='POST'||!['/api/plan','/api/swaps','/api/swap'].includes(url.pathname))return baseApi(request,url);
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return baseApi(request,url);
    let payload,input;
    try{const text=await request.clone().text();if(new TextEncoder().encode(text).length>64000)return json({error:'This request is too large.'},400);({signals:input,...payload}=JSON.parse(text));}catch{return baseApi(request,url);}
    const baseRequest=new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const response=await baseApi(baseRequest,url);
    if(!response.ok)return response;
    const signals=preferenceSignals(input,clock());
    if(!signals.active)return response;
    const original=await response.json();
    try{
      if(url.pathname==='/api/swaps'){
        const choices=[...original.choices];
        // These preferred recipes must pass the same slot, diet, allergy,
        // appliance, duplicate-dish and whole-pack budget checks as any swap.
        const current=await call(url.origin,'/api/quote',{profile:payload.profile,pantry:payload.pantry,plan:payload.plan});
        if(current.ok){
          for(const trial of await boostCandidates(url.origin,payload,signals,current.data,payload.index)){
            const meal=trial.meals[payload.index];
            if(!choices.some(r=>r.id===meal.id))choices.push({...meal,total:trial.total,change:Math.round((trial.total-current.data.total)*100)/100});
          }
        }
        choices.sort((a,b)=>preferenceScore(b.id,signals)-preferenceScore(a.id,signals));
        return json({choices:choices.slice(0,18).map(r=>({...r,recommendationReason:recommendationReason(r.id,signals)}))});
      }
      let best=original;
      if(url.pathname==='/api/plan'){
        // Keep complete plans and every replacement behind the existing API's
        // constraint checks. Personal preferences never relax those checks.
        const seed=Number.isSafeInteger(payload.seed)?payload.seed:0;
        for(let offset=1;offset<=3;offset++){
          const alternative=await call(url.origin,'/api/plan',{...payload,seed:(seed+offset*17)%2147483647});
          if(alternative.ok&&score(alternative.data,signals)>score(best,signals))best=alternative.data;
        }
        for(let index=0;index<best.plan.length;index++){
          for(const trial of await boostCandidates(url.origin,payload,signals,best,index))if(score(trial,signals)>score(best,signals))best=trial;
          const options=await call(url.origin,'/api/swaps',{profile:payload.profile,pantry:payload.pantry,plan:best.plan,index});
          if(!options.ok)continue;
          const currentId=best.meals[index].id;
          const candidates=options.data.choices.filter(r=>preferenceScore(r.id,signals)>preferenceScore(currentId,signals)).sort((a,b)=>preferenceScore(b.id,signals)-preferenceScore(a.id,signals));
          for(const candidate of candidates){
            const trial=await call(url.origin,'/api/swap',{profile:payload.profile,pantry:payload.pantry,plan:best.plan,index,recipeId:candidate.id});
            if(trial.ok&&score(trial.data,signals)>score(best,signals)){best=trial.data;break;}
          }
        }
      }
      return json({...best,meals:best.meals.map(r=>({...r,recommendationReason:recommendationReason(r.id,signals)})),recommendationInfo:{status:'applied',ratings:signals.ratings.size,saved:signals.saved.size,recentCooks:signals.cooked.size,recentMeals:new Set([...signals.previous,...signals.planned.keys()]).size,recentRemaining:best.meals.filter(r=>recencyPenalty(r.id,signals)>0).length,lowRatedRemaining:best.meals.filter(r=>(signals.ratings.get(r.id)||5)<=2).length}});
    }catch{
      return json({...original,recommendationInfo:{status:'unavailable'}});
    }
  };
}
export const personalizedApi=createPersonalizedApi();
